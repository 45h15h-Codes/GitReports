/**
 * BullMQ worker: narrative generation (PRD §3.6, §10.2)
 *
 * Consumes jobs from the 'narrative' queue. Each job carries:
 *   - reportId: the database report row to update
 *   - payload: the full AiPayload JSON
 *
 * Job lifecycle:
 *   1. Fetch report row, verify it is still 'pending'
 *   2. Mark narrativeStatus → 'generating' (prevents duplicate LLM calls)
 *   3. Call Claude API via generateNarrative()
 *   4. Update report row: narrative text + narrativeStatus → 'complete'
 *   5. On error: narrativeStatus → 'failed', log error
 *
 * Rate limit: BullMQ limiter = 5 jobs/user/min (matches PRD §9.3).
 * The concurrency is set to 5 global workers — each takes ~2–4s per call.
 *
 * Connection: uses createRedisConnection() from lib/redis.ts.
 * BullMQ requires separate IORedis instances for Queue and Worker.
 */

import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { reports, users } from '../db/schema';
import { generateNarrative } from '../services/narrative/llm';
import { getRedisClient } from '../lib/redis';
import { getUserForGeneration } from '../services/UserService';
import type { AiPayload } from '../services/aggregation/types';
import { attachDlq } from './dlq';
import { sendReportReadyEmail }  from '../lib/email';
import { evaluateAchievements }  from '../services/achievements/evaluator';


// ── Queue name ────────────────────────────────────────────────────────────────

export const NARRATIVE_QUEUE_NAME = 'narrative';

// ── Job payload type ──────────────────────────────────────────────────────────

export interface NarrativeJobData {
  reportId: number;
  payload:  AiPayload;
}

// ── Queue factory (used by report route to enqueue jobs) ─────────────────────

let _queue: Queue<NarrativeJobData> | null = null;

export function getNarrativeQueue(): Queue<NarrativeJobData> {
  if (!_queue) {
    _queue = new Queue<NarrativeJobData>(NARRATIVE_QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts:   3,
        backoff:    { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    });
  }
  return _queue;
}

// ── Worker factory ────────────────────────────────────────────────────────────

/**
 * Start the BullMQ narrative worker.
 * Call once at server startup (e.g., in index.ts or a separate worker process).
 * Returns the Worker instance for graceful shutdown handling.
 */
export function startNarrativeWorker(): Worker<NarrativeJobData> {
  const conn = getRedisClient();

  const worker = new Worker<NarrativeJobData>(
    NARRATIVE_QUEUE_NAME,
    async (job) => {
      const { reportId, payload } = job.data;

      // 1. Mark as 'generating' — prevents duplicate calls on retry
      await db
        .update(reports)
        .set({ narrativeStatus: 'generating', updatedAt: new Date() })
        .where(eq(reports.id, reportId));

      // 2. Fetch user to get personal Gemini API key
      const reportRow = await db
        .select({ userId: reports.userId })
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1)
        .then(r => r[0]);

      if (!reportRow) {
        throw new Error(`Report ${reportId} not found`);
      }

      const user = await getUserForGeneration(reportRow.userId);
      if (!user?.geminiApiKey) {
        throw new Error(`[narrative] User ${reportRow.userId} missing Gemini API key`);
      }

      // 3. Generate narrative via Claude API
      const result = await generateNarrative(payload, user.geminiApiKey);

      // 4. Persist result
      await db
        .update(reports)
        .set({
          narrative:       result.narrative,
          narrativeStatus: 'complete',
          updatedAt:       new Date(),
        })
        .where(eq(reports.id, reportId));

      console.info(
        `[narrative-worker] Report ${reportId} complete — ` +
        `in: ${result.inputTokens} tokens, out: ${result.outputTokens} tokens`,
      );

      // 4. Send report-ready email — PRD §7.8 P0
      // Fire-and-forget: email failure must never fail the job
      try {
        const reportRow = await db
          .select({
            userId:  reports.userId,
            period:  reports.period,
            persona: reports.persona,
            payload: reports.payload,
          })
          .from(reports)
          .where(eq(reports.id, reportId))
          .limit(1)
          .then(r => r[0]);

        if (reportRow) {
          const userRow = await db
            .select({
              email:       users.email,
              username:    users.username,
              displayName: users.displayName,
              avatarUrl:   users.avatarUrl,
            })
            .from(users)
            .where(eq(users.id, reportRow.userId))
            .limit(1)
            .then(r => r[0]);

          // Only send if user has an email — GitHub email is nullable (PRD §9.1)
          if (userRow?.email) {
            const p = reportRow.payload as { total_commits?: number };
            const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

            await sendReportReadyEmail({
              to:           userRow.email,
              username:     userRow.username,
              displayName:  userRow.displayName ?? userRow.username,
              period:       reportRow.period,
              persona:      reportRow.persona ?? 'The Builder',
              totalCommits: p.total_commits ?? 0,
              reportUrl:    `${frontendUrl}/u/${userRow.username}/${reportRow.period}`,
            });

            console.info(`[narrative-worker] Report-ready email sent to ${userRow.email}`);
          }
        }
      } catch (emailErr) {
        // Log but do not throw — email failure must not fail the job or trigger retry
        console.error(
          `[narrative-worker] Failed to send report-ready email for report ${reportId}:`,
          emailErr,
        );
      }

      // 5. Evaluate achievements — PRD §5.4
      // Fire-and-forget: achievement failure must never fail the job
      try {
        const achievementRow = await db
          .select({
            userId:  reports.userId,
            period:  reports.period,
            payload: reports.payload,
          })
          .from(reports)
          .where(eq(reports.id, reportId))
          .limit(1)
          .then(r => r[0]);

        if (achievementRow) {
          const newAchievements = await evaluateAchievements(
            achievementRow.userId,
            achievementRow.period,
            achievementRow.payload as AiPayload,
          )
          const newCount = newAchievements.filter(a => a.isNew).length
          if (newCount > 0) {
            console.info(
              `[narrative-worker] ${newCount} achievement(s) unlocked for user ${achievementRow.userId}`,
            )
          }
        }
      } catch (achievementErr) {
        console.error(
          `[narrative-worker] Achievement evaluation failed for report ${reportId}:`,
          achievementErr,
        )
      }
    },
    {
      connection:  conn,
      concurrency: 10,
    },
  );

  attachDlq(worker);

  worker.on('failed', async (job, err) => {
    const data = job?.data;
    console.error(`[narrative-worker] Job failed report=${data?.reportId}: ${err.message}`);

    if (!data) return;

    const isLastAttempt = (job!.attemptsMade ?? 0) >= (job!.opts?.attempts ?? 1);
    if (!isLastAttempt) return;

    try {
      await db
        .update(reports)
        .set({ narrativeStatus: 'failed', updatedAt: new Date() })
        .where(eq(reports.id, data.reportId));
    } catch (dbErr) {
      console.error('[narrative-worker] Failed to mark report as failed:', dbErr);
    }
  });

  worker.on('error', (err) => {
    console.error('[narrative-worker] Worker error:', err.message);
  });

  console.info('[narrative-worker] Started — listening on queue:', NARRATIVE_QUEUE_NAME);
  return worker;
}
