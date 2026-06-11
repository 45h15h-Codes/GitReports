import type { Job, Worker } from 'bullmq'
import { db } from '../db/client'
import { failedJobs } from '../db/schema'

export function attachDlq(worker: Worker): void {
  worker.on('failed', async (job: Job | undefined, err: Error) => {
    if (!job) return

    const maxAttempts = job.opts.attempts ?? 1
    if (job.attemptsMade < maxAttempts) return  // not final attempt — let BullMQ retry

    try {
      await db.insert(failedJobs).values({
        jobId:        job.id ?? 'unknown',
        jobName:      job.name,
        queueName:    worker.name,
        payload:      job.data as Record<string, unknown>,
        errorMessage: err.message,
        attemptsMade: job.attemptsMade,
      })
    } catch (dbErr) {
      // Use structured logger in production — console.error acceptable here
      // as this is last-resort DLQ persistence failure
      console.error('[DLQ] Failed to persist failed job to database', { jobId: job.id, dbErr })
      throw dbErr  // re-throw so BullMQ retry mechanism sees the failure
    }
  })
}
