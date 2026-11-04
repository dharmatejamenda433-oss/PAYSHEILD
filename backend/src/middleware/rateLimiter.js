import { getRedisClient } from '../config/redis.js';

const fallbackCounters = new Map();

export function resetRateLimitMemory() {
  fallbackCounters.clear();
}

function checkMemoryCounter(key, windowSeconds) {
  const now = Date.now();
  const existing = fallbackCounters.get(key);

  if (!existing || existing.resetAt <= now) {
    fallbackCounters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }

  existing.count += 1;
  return existing.count;
}

/**
 * Redis-backed fixed-window limiter with an in-process fallback.
 * It fails open when neither store is available, which keeps the payment API
 * usable during a cache outage.
 */
export function rateLimit({ scope, windowSeconds, max, keyResolver }) {
  return async function rateLimiter(req, res, next) {
    const identity = keyResolver ? keyResolver(req) : req.ip;
    const key = `payshield:ratelimit:${scope}:${identity}`;

    let count;

    const client = getRedisClient();
    if (client) {
      try {
        count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }
      } catch (error) {
        console.warn(`[rate-limit] Redis failed, using memory fallback: ${error.message}`);
        count = checkMemoryCounter(key, windowSeconds);
      }
    } else {
      count = checkMemoryCounter(key, windowSeconds);
    }

    if (fallbackCounters.size > 10000) {
      const now = Date.now();
      for (const [counterKey, value] of fallbackCounters.entries()) {
        if (value.resetAt <= now) fallbackCounters.delete(counterKey);
      }
    }

    if (count > max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
          details: { retryAfterSeconds: windowSeconds },
        },
      });
    }

    return next();
  };
}
