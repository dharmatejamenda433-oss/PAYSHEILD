import { ApiError } from '../utils/ApiError.js';

/**
 * Explicit transaction state machine.
 *
 * PENDING_REVIEW -> APPROVED -> COMPLETED
 * PENDING_REVIEW -> DECLINED
 * APPROVED       -> FAILED
 *
 * Money only moves while moving from APPROVED to COMPLETED.
 */
const ALLOWED_TRANSITIONS = {
  PENDING_REVIEW: ['APPROVED', 'DECLINED'],
  APPROVED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  DECLINED: [],
  FAILED: [],
};

export const TRANSACTION_STATUSES = Object.keys(ALLOWED_TRANSITIONS);

export function assertTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw ApiError.conflict(
      'INVALID_TRANSACTION_TRANSITION',
      `Cannot move transaction from ${fromStatus} to ${toStatus}.`
    );
  }
}

export function isFinalStatus(status) {
  return (ALLOWED_TRANSITIONS[status] || []).length === 0;
}
