import Redis from 'ioredis';
import { env } from './env.js';

let client = null;
let available = false;

/**
 * Returns the shared Redis client only when it is actually ready.
 * Services use this check to fall back to their in-process store.
 */
export function getRedisClient() {
  return available ? client : null;
}

export function isRedisAvailable() {
  return available;
}

/**
 * Connects to Redis without crashing the API when Redis is down.
 * Velocity counters and rate limits have a development fallback, while
 * MongoDB remains the durable source of truth for money movement.
 */
export async function connectRedis() {
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      // Keep retrying with a capped backoff so Redis can recover at runtime.
      if (times > 20) return null;
      return Math.min(times * 500, 5000);
    },
  });

  client.on('ready', () => {
    available = true;
    console.log('[redis] connected');
  });

  client.on('error', (error) => {
    if (available) {
      console.warn(`[redis] connection lost: ${error.message}`);
    }
    available = false;
  });

  client.on('end', () => {
    available = false;
  });

  try {
    await client.connect();
    available = true;
  } catch (error) {
    available = false;
    console.warn(
      `[redis] not reachable at ${env.REDIS_URL}. Velocity checks, rate limits and the ` +
        `idempotency cache will use the in-process development fallback. Reason: ${error.message}`
    );
  }

  return client;
}

export async function disconnectRedis() {
  if (!client) return;

  try {
    await client.quit();
  } catch {
    // ignore shutdown errors
  }

  client = null;
  available = false;
}
