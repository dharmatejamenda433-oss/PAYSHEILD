import { createHash, randomBytes } from 'node:crypto';

export function generateTransactionId() {
  return `TXN-${randomBytes(6).toString('hex').toUpperCase()}`;
}

/**
 * SHA-256 of the canonical request fields. Used to tell a safe idempotent replay
 * apart from an accidental reuse of the same key with different payment details.
 */
export function hashRequest(payload) {
  const canonical = JSON.stringify({
    receiverId: payload.receiverId,
    amount: payload.amount,
    currency: payload.currency,
    description: payload.description ?? '',
  });

  return createHash('sha256').update(canonical).digest('hex');
}

export function formatInr(minorUnits) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
