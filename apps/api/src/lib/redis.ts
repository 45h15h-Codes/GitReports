/**
 * Shared Redis client singleton (PRD §10.1)
 *
 * All modules that need a Redis connection (BullMQ, session, rate-limit, cache)
 * import `createRedisConnection()` from this module instead of creating their
 * own IORedis instances.
 *
 * Each call to createRedisConnection() returns a FRESH IORedis instance.
 * BullMQ requires separate connections for Queue and Worker — do NOT share a
 * single instance between them.
 *
 * Environment variable:
 *   REDIS_URL  e.g. redis://localhost:6379 or rediss://user:pass@host:6380
 */

import IORedis from 'ioredis';

/**
 * Create a new IORedis connection from REDIS_URL.
 *
 * BullMQ requirements:
 *   - maxRetriesPerRequest must be null (prevents BullMQ blocking call errors)
 *   - enableReadyCheck: false (recommended for BullMQ compatibility)
 *
 * Throws immediately if REDIS_URL is not set.
 */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('[redis] REDIS_URL environment variable is not set');
  }

  const conn = new IORedis(url, {
    maxRetriesPerRequest: null,   // required by BullMQ
    enableReadyCheck:     false,  // recommended for BullMQ
    lazyConnect:          false,
  });

  conn.on('error', (err: Error) => {
    console.error('[redis] Connection error:', err.message);
  });

  conn.on('connect', () => {
    console.info('[redis] Connected');
  });

  return conn;
}
