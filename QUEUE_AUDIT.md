# GitReport Queue & Redis Infrastructure Audit

## 1. Job Duplication & Orphaned Jobs (High Priority)
- **Failure scenario**: In `reports.ts`, clicking "Generate" deletes the existing report row and creates a new one with a new auto-incrementing ID. The BullMQ `jobId` is set to `narrative:${report.id}`. If a user spams the generation endpoint, multiple jobs are queued for the same period with different IDs.
- **Impact**: The worker processes old jobs for deleted reports. It makes expensive and slow LLM calls (Claude Haiku), but the final `db.update` affects 0 rows because the `reportId` was deleted. This wastes LLM API quotas and blocks the queue for legitimate jobs.
- **Recommended fix**: 
  1. Change the BullMQ `jobId` to a deterministic string based on user and period (e.g., `narrative:${userId}:${period}`).
  2. In the worker, fetch the report row *first*. If it does not exist, exit immediately without calling the LLM.

## 2. Worker Crashes & Stalled Jobs
- **Failure scenario**: BullMQ's default `lockDuration` is 30,000ms (30 seconds). The worker calls an external LLM API (`generateNarrative`). If the LLM response takes longer than 30 seconds, BullMQ will assume the worker process crashed or stalled.
- **Impact**: BullMQ will move the job back to the wait queue and assign it to another worker. Both workers will process the same job concurrently, resulting in duplicate LLM API calls and race conditions during the database update.
- **Recommended fix**: Explicitly configure `lockDuration` in the `Worker` options to safely exceed the maximum possible LLM timeout (e.g., `lockDuration: 120000` for 2 minutes).

## 3. Retry Logic & UI Flapping
- **Failure scenario**: The queue sets `attempts: 3` with an exponential backoff. However, the `worker.on('failed')` event handler updates the database `narrativeStatus` to `'failed'` immediately upon *any* failure.
- **Impact**: If a transient network error occurs on the first attempt, the database marks the report as "failed", and the UI displays a failure state to the user. Minutes later, the job automatically retries, succeeds, and updates the database to "complete", causing confusing UI state flapping.
- **Recommended fix**: Update the `failed` event listener to check `job.attemptsMade`. Only update the database status to `'failed'` if `job.attemptsMade >= job.opts.attempts` (i.e., it was the final attempt).

## 4. Redis Memory Usage & Eviction Policies
- **Failure scenario**: The infrastructure uses Redis for BullMQ. If the Redis instance is configured with an LRU eviction policy (e.g., `volatile-lru` or `allkeys-lru`, which are common defaults in Azure/AWS), keys will be evicted when memory is full.
- **Impact**: BullMQ relies on persistent data structures (Lists, Hashes, ZSets) without explicit TTLs. If Redis evicts these keys, the queue will become severely corrupted, resulting in lost jobs, stuck workers, and crash loops.
- **Recommended fix**: Ensure the Redis instance dedicated to BullMQ is strictly configured with the `noeviction` maxmemory policy. 

## 5. Dead-Letter Queues (DLQ)
- **Failure scenario**: Failed jobs are currently retained in BullMQ using `removeOnFail: { count: 50 }`. There is no separate DLQ or persistent error logging for permanently failed payloads.
- **Impact**: If a systemic issue occurs (e.g., invalid API keys or prompt schema changes), the failure count will quickly exceed 50. Job payloads and stack traces will be permanently deleted from Redis, making debugging and job replay impossible.
- **Recommended fix**: Implement a dedicated DLQ process. When a job fails its final attempt, move its payload to a dedicated database table (`failed_jobs`) or logging sink before it gets pruned by BullMQ.

## 6. Race Conditions on Graceful Shutdown
- **Failure scenario**: The worker is started via `startNarrativeWorker()`, but there is no `SIGINT/SIGTERM` listener to gracefully shut it down.
- **Impact**: When the deployment environment (e.g., Vercel, Docker, Azure) shuts down the container, active workers are killed mid-execution. Jobs will remain locked until the 30-second `lockDuration` expires, delaying processing on new instances.
- **Recommended fix**: Implement a process listener for `SIGTERM` and `SIGINT` that calls `await worker.close()` to stop accepting new jobs and gracefully finish the currently running LLM tasks.

## 7. Queue Reliability & Rate Limit Mismatch
- **Failure scenario**: The route rate limiter allows 10 requests per user per minute. However, the worker is globally throttled to `limiter: { max: 5, duration: 60_000 }` (5 jobs per minute *globally*).
- **Impact**: If just two users hit their rate limit, they will queue 20 jobs. At 5 jobs per minute globally, the queue will take 4 minutes to process. As the user base grows, the queue backlog will quickly spiral out of control, making the "Fast Mode" dashboard extremely slow.
- **Recommended fix**: Re-evaluate the global rate limit of 5 jobs/minute against the Claude API limits. If the API allows it, remove or increase the BullMQ global limiter, relying instead on concurrency settings (`concurrency: 5`) to control throughput.
