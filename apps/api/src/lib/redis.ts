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

let _client: IORedis | null = null;
let _subscriber: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!_client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('[redis] REDIS_URL environment variable is not set');
    _client = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: false });
    _client.on('error', (err: Error) => console.error('[redis client] Connection error:', err.message));
  }
  return _client;
}

export function getRedisSubscriber(): IORedis {
  if (!_subscriber) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('[redis] REDIS_URL environment variable is not set');
    _subscriber = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: false });
    _subscriber.on('error', (err: Error) => console.error('[redis sub] Connection error:', err.message));
  }
  return _subscriber;
}

export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('[redis] REDIS_URL environment variable is not set');
  const conn = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: false });
  conn.on('error', (err: Error) => console.error('[redis worker] Connection error:', err.message));
  return conn;
}
