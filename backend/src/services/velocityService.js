import { randomUUID } from 'node:crypto';
import { getRedisClient, isRedisAvailable } from '../config/redis.js';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const KEY_TTL_SECONDS = 3700;

// Development fallback used only while Redis is unreachable.
const memoryStore = new Map();

function getMemoryBucket(userId) {
  const key = userId.toString();
  if (!memoryStore.has(key)) {
    memoryStore.set(key, { transactions: [], failedAttempts: [] });
  }
  return memoryStore.get(key);
}

function cleanup(list, cutoff) {
  return list.filter((timestamp) => timestamp >= cutoff);
}

function countSince(list, since) {
  return list.filter((timestamp) => timestamp >= since).length;
}

async function redisRecord(key, member) {
  const client = getRedisClient();
  if (!client) return false;

  const now = Date.now();
  const pipeline = client.pipeline();
  pipeline.zadd(key, now, member);
  pipeline.zremrangebyscore(key, 0, now - ONE_HOUR_MS);
  pipeline.expire(key, KEY_TTL_SECONDS);

  try {
    await pipeline.exec();
    return true;
  } catch (error) {
    console.warn(`[velocity] Redis write failed, using memory fallback: ${error.message}`);
    return false;
  }
}

/**
 * Adds a transaction to the user's sliding one-hour window.
 * The member includes the timestamp so retried Redis calls stay idempotent-ish.
 */
export async function recordTransaction(userId, transactionId) {
  const member = `${transactionId}:${Date.now()}`;
  const recorded = await redisRecord(
    `payshield:velocity:${userId.toString()}`,
    member
  );

  if (!recorded) {
    const bucket = getMemoryBucket(userId);
    bucket.transactions = cleanup(
      [...bucket.transactions, Date.now()],
      Date.now() - ONE_HOUR_MS
    );
  }
}

export async function recordFailedAttempt(userId, attemptId = randomUUID()) {
  const member = `${attemptId}:${Date.now()}`;
  const recorded = await redisRecord(
    `payshield:failed:${userId.toString()}`,
    member
  );

  if (!recorded) {
    const bucket = getMemoryBucket(userId);
    bucket.failedAttempts = cleanup(
      [...bucket.failedAttempts, Date.now()],
      Date.now() - ONE_HOUR_MS
    );
  }
}

async function readRedisCounts(userId) {
  if (!isRedisAvailable()) return null;

  const client = getRedisClient();
  if (!client) return null;

  const now = Date.now();
  const velocityKey = `payshield:velocity:${userId.toString()}`;
  const failedKey = `payshield:failed:${userId.toString()}`;

  try {
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(velocityKey, 0, now - ONE_HOUR_MS);
    pipeline.zcount(velocityKey, now - TEN_MINUTES_MS, '+inf');
    pipeline.zcount(velocityKey, now - ONE_HOUR_MS, '+inf');
    pipeline.zcount(failedKey, now - FIFTEEN_MINUTES_MS, '+inf');

    const results = await pipeline.exec();
    // ioredis returns [[error, value], ...] for pipeline executions.
    const values = results.map(([error, value]) => {
      if (error) throw error;
      return Number(value);
    });

    return {
      transactions10m: values[1],
      transactions1h: values[2],
      failedAttempts15m: values[3],
      source: 'redis',
    };
  } catch (error) {
    console.warn(`[velocity] Redis read failed, using memory fallback: ${error.message}`);
    return null;
  }
}

export async function getVelocityFeatures(userId) {
  const redisCounts = await readRedisCounts(userId);
  if (redisCounts) return redisCounts;

  const now = Date.now();
  const bucket = getMemoryBucket(userId);

  bucket.transactions = cleanup(bucket.transactions, now - ONE_HOUR_MS);
  bucket.failedAttempts = cleanup(bucket.failedAttempts, now - ONE_HOUR_MS);

  return {
    transactions10m: countSince(bucket.transactions, now - TEN_MINUTES_MS),
    transactions1h: countSince(bucket.transactions, now - ONE_HOUR_MS),
    failedAttempts15m: countSince(bucket.failedAttempts, now - FIFTEEN_MINUTES_MS),
    source: 'memory',
  };
}

export function resetVelocityMemoryStore() {
  memoryStore.clear();
}
