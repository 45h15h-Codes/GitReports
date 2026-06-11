/**
 * BullMQ worker: full report generation pipeline (Sprint D.3)
 *
 * Moves the entire ingestion + aggregation pipeline out of the HTTP route
 * handler into a background worker. The route returns 202 immediately after
 * enqueuing, and this worker handles the long-running operations.
 *
 * Pipeline:
 *   1. Fetch user + decrypt token (UserService)
 *   2. Fetch previous period context (ReportService)
 *   3. ingestMonthlyData() — GitHub API calls (may take 5–30s)
 *   4. aggregateMonthlyData() — pure computation
 *   5. upsertReport() — atomic DB write
 *   6. Enqueue narrative job → narrativeWorker picks up
 *
 * Job lifecycle:
 *   - Route enqueues with jobId `report:${userId}:${period}` (idempotent)
 *   - Worker marks report → 'ingesting' on start
 *   - Worker marks report → 'pending' after upsert (narrative worker takes over)
 *   - On final failure: marks → 'failed'
 *
 * Depends on: getRedisClient/getRedisSubscriber from lib/redis.ts (Sprint C.4)
 */

import { Worker, Queue } from 'bullmq';
import { ingestMonthlyData } from '../services/aggregation/ingestion';
import { aggregateMonthlyData } from '../services/aggregation/engine';
import { getNarrativeQueue } from './narrativeWorker';
import { getRedisClient } from '../lib/redis';
import { getUserForGeneration } from '../services/UserService';
import {
  findPrevPeriodPartial,
  upsertReport,
} from '../services/ReportService';
import type { PrevPeriodSummary, DeveloperPersona } from '../services/aggregation/types';
import { attachDlq } from './dlq';


// ── Queue name ────────────────────────────────────────────────────────────────

export const REPORT_QUEUE_NAME = 'report-generation';

// ── Job payload type ──────────────────────────────────────────────────────────

export interface ReportJobData {
  userId:         number;
  period:         string;
  includePrivate: boolean;
}

// ── Queue factory (used by route to enqueue jobs) ─────────────────────────────

let _queue: Queue<ReportJobData> | null = null;

export function getReportQueue(): Queue<ReportJobData> {
  if (!_queue) {
    _queue = new Queue<ReportJobData>(REPORT_QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts:         3,
        backoff:          { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail:     { count: 25 },
      },
    });
  }
  return _queue;
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function startReportWorker(): Worker<ReportJobData> {
  const conn = getRedisClient();

  const worker = new Worker<ReportJobData>(
    REPORT_QUEUE_NAME,
    async (job) => {
      const { userId, period, includePrivate } = job.data;

      // 1. Fetch user + decrypted token
      const user = await getUserForGeneration(userId);
      if (!user) {
        throw new Error(`User ${userId} not found — cannot generate report`);
      }

      // 2. Fetch previous period for longitudinal context (PRD §6.1)
      const prevPeriod    = getPrevPeriod(period);
      const prevPartial   = await findPrevPeriodPartial(userId, prevPeriod);
      const prevPeriodSummary = prevPartial ? buildPrevSummary(prevPartial) : null;

      // 3. GitHub ingestion — the slow part
      const ingestion = await ingestMonthlyData(
        user.plainToken,
        user.username,
        period,
        { includePrivate },
      );

      if (ingestion.rateLimitHit && ingestion.repos.length === 0) {
        // Rate limit with zero data — abort, don't persist partial results
        throw new Error(
          `GitHub rate limit hit during ingestion for user ${userId} period ${period}. ` +
          `Retry after: ${ingestion.rateLimitReset ?? 'unknown'}`,
        );
      }

      // 4. Aggregate
      const payload = aggregateMonthlyData({
        username: user.username,
        period,
        repos:    ingestion.repos,
        prevPeriodSummary,
      });

      // 5. Atomic upsert
      const report = await upsertReport({
        userId,
        period,
        payloadVersion:  payload.payload_version,
        payload,
        narrativeStatus: 'pending',
        persona:         payload.developer_persona,
        focusScore:      String(payload.focus_score),
        isPublic:        true,
      });

      // 6. Enqueue narrative generation
      const narrativeQueue = getNarrativeQueue();
      await narrativeQueue.add(
        'generate-narrative',
        { reportId: report.id, payload },
        { jobId: `narrative:${userId}:${period}` }, // Sprint B.4 — stable job IDs
      );

      console.info(
        `[report-worker] Pipeline complete — user ${userId} period ${period} ` +
        `repos: ${ingestion.repos.length} skipped: ${ingestion.reposSkipped}`,
      );
    },
    {
      connection:  conn,
      concurrency: 5,
      lockDuration: 180_000, // 3 min — ingestion can take 30-60s on large accounts
    },
  );

  attachDlq(worker);

  worker.on('failed', async (job, err) => {
    const data = job?.data;
    console.error(
      `[report-worker] Job failed user=${data?.userId} period=${data?.period}: ${err.message}`,
    );

    if (!data) return;

    // Only mark failed on final attempt (Sprint B.6 pattern)
    const isLastAttempt = (job!.attemptsMade ?? 0) >= (job!.opts?.attempts ?? 1);
    if (!isLastAttempt) return;

    // Upsert a failed status so the SSE stream can close with an error state
    try {
      await upsertReport({
        userId:          data.userId,
        period:          data.period,
        payloadVersion:  1,
        payload:         { payload_version: 1, period: data.period, repos: [], languages: {}, total_commits: 0, active_days: 0, longest_streak: 0, current_streak: 0, peak_hour_block: 'night', commit_size_dist: { tiny: 0, small: 0, medium: 0, large: 0 }, focus_score: 0, developer_persona: 'The Builder', lines_added_total: 0, prs_merged_total: 0, repos_touched: 0, daily_commits: [], prev_period_summary: null } as unknown as Parameters<typeof upsertReport>[0]['payload'],
        narrativeStatus: 'failed',
        persona:         'The Builder',
        focusScore:      '0',
        isPublic:        false,
      });
    } catch (dbErr) {
      console.error('[report-worker] Failed to mark report as failed:', dbErr);
    }
  });

  worker.on('error', (err) => {
    console.error('[report-worker] Worker error:', err.message);
  });

  console.info('[report-worker] Started — listening on queue:', REPORT_QUEUE_NAME);
  return worker;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function getPrevPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const prev = new Date(year!, month! - 1, 1);
  prev.setMonth(prev.getMonth() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function buildPrevSummary(partial: {
  payload:    Record<string, unknown>;
  persona:    string | null;
  focusScore: string | null;
}): PrevPeriodSummary {
  const p = partial.payload;
  return {
    total_commits:     (p['total_commits'] as number) ?? 0,
    focus_score:       Number(partial.focusScore ?? 0),
    dominant_language: getDominantLanguage(p['languages'] as Record<string, number> | undefined),
    persona:           (partial.persona as DeveloperPersona) ?? 'The Builder',
  };
}

function getDominantLanguage(languages?: Record<string, number>): string | null {
  if (!languages) return null;
  let top: string | null = null;
  let max = 0;
  for (const [lang, pct] of Object.entries(languages)) {
    if (pct > max) { max = pct; top = lang; }
  }
  return top;
}
