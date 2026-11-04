import { env } from '../config/env.js';
import { getRedisClient } from '../config/redis.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../utils/ApiError.js';

function cacheKey(senderId, idempotencyKey) {
  return `payshield:idem:${senderId.toString()}:${idempotencyKey}`;
}

/**
 * Looks for an earlier payment made with the same key.
 * Redis is only a fast cache; MongoDB's unique compound index is the durable
 * protection and the fallback lookup.
 */
export async function findIdempotentTransaction({ senderId, idempotencyKey, requestHash }) {
  const client = getRedisClient();

  if (client) {
    try {
      const cachedJson = await client.get(cacheKey(senderId, idempotencyKey));

      if (cachedJson) {
        const cached = JSON.parse(cachedJson);

        if (cached.requestHash !== requestHash) {
          throw ApiError.conflict(
            'IDEMPOTENCY_KEY_REUSED',
            'This idempotency key was already used with different payment details.',
            { transactionId: cached.transactionId }
          );
        }

        const cachedTransaction = await Transaction.findOne({
          transactionId: cached.transactionId,
        });

        if (cachedTransaction) {
          return cachedTransaction;
        }

        // Stale cache entry: continue with the durable MongoDB lookup.
        await client.del(cacheKey(senderId, idempotencyKey));
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.warn(`[idempotency] Redis lookup failed: ${error.message}`);
    }
  }

  const existing = await Transaction.findOne({ senderId, idempotencyKey });

  if (!existing) return null;

  if (existing.requestHash !== requestHash) {
    throw ApiError.conflict(
      'IDEMPOTENCY_KEY_REUSED',
      'This idempotency key was already used with different payment details.',
      { transactionId: existing.transactionId }
    );
  }

  return existing;
}

export async function rememberIdempotency({ senderId, idempotencyKey, transaction }) {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.setex(
      cacheKey(senderId, idempotencyKey),
      env.IDEMPOTENCY_TTL_SECONDS,
      JSON.stringify({
        transactionId: transaction.transactionId,
        requestHash: transaction.requestHash,
      })
    );
  } catch (error) {
    console.warn(`[idempotency] Redis cache write failed: ${error.message}`);
  }
}
