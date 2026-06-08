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
import { reports } from '../db/schema';
import { generateNarrative } from '../services/narrative/llm';
import { createRedisConnection } from '../lib/redis';
import type { AiPayload } from '../services/aggregation/types';

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
      connection: createRedisConnection(),
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
  const conn = createRedisConnection();

  const worker = new Worker<NarrativeJobData>(
    NARRATIVE_QUEUE_NAME,
    async (job) => {
      const { reportId, payload } = job.data;

      // 1. Mark as 'generating' — prevents duplicate calls on retry
      await db
        .update(reports)
        .set({ narrativeStatus: 'generating', updatedAt: new Date() })
        .where(eq(reports.id, reportId));

      // 2. Generate narrative via Claude API
      const result = await generateNarrative(payload);

      // 3. Persist result
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
    },
    {
      connection:  conn,
      concurrency: 5,
      limiter: {
        max:      5,
        duration: 60_000,  // 5 jobs per minute global (PRD §9.3)
      },
    },
  );

  worker.on('failed', async (job, err) => {
    const reportId = job?.data?.reportId;
    console.error(`[narrative-worker] Job failed for report ${reportId}:`, err.message);

    if (reportId) {
      // Mark as failed so the UI can show a friendly fallback
      await db
        .update(reports)
        .set({ narrativeStatus: 'failed', updatedAt: new Date() })
        .where(eq(reports.id, reportId))
        .catch((dbErr: Error) =>
          console.error('[narrative-worker] Failed to mark report as failed:', dbErr.message),
        );
    }
  });

  worker.on('error', (err) => {
    console.error('[narrative-worker] Worker error:', err.message);
  });

  console.info('[narrative-worker] Started — listening on queue:', NARRATIVE_QUEUE_NAME);
  return worker;
}
