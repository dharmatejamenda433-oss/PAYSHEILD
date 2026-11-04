import { env } from '../config/env.js';
import { formatInr } from '../utils/ids.js';

const WEIGHTS = {
  LARGE_AMOUNT: 25,
  LARGE_SHARE_OF_BALANCE: 20,
  ABOVE_USUAL_AMOUNT: 20,
  VELOCITY_10M: 25,
  VELOCITY_10M_MODERATE: 15,
  VELOCITY_1H: 15,
  NEW_DEVICE: 15,
  UNUSUAL_LOCATION: 20,
  FAILED_ATTEMPTS: 15,
};

/**
 * Rule-based signals. Each rule returns a human-readable reason and a weight.
 * The weights are additive and capped at 100 so one large payment alone never
 * becomes an automatic fraud classification.
 */
export function evaluateRules({
  amount,
  balanceBefore,
  averageAmount30d,
  transactions10m,
  transactions1h,
  failedAttempts15m,
  isNewDevice,
  isUnusualLocation,
}) {
  const reasons = [];

  if (amount >= env.LARGE_AMOUNT_THRESHOLD_PAISE) {
    reasons.push({
      code: 'LARGE_AMOUNT',
      message: `Payment of ${formatInr(amount)} is above the large-payment threshold of ${formatInr(env.LARGE_AMOUNT_THRESHOLD_PAISE)}.`,
      weight: WEIGHTS.LARGE_AMOUNT,
    });
  }

  // amount / balance >= 0.7, using integers to avoid floating point comparisons.
  if (balanceBefore > 0 && amount * 10 >= balanceBefore * 7 && amount >= 100000) {
    reasons.push({
      code: 'LARGE_SHARE_OF_BALANCE',
      message: `Payment uses ${Math.round((amount / balanceBefore) * 100)}% of the available wallet balance.`,
      weight: WEIGHTS.LARGE_SHARE_OF_BALANCE,
    });
  }

  if (averageAmount30d >= 100000 && amount >= averageAmount30d * 4) {
    reasons.push({
      code: 'ABOVE_USUAL_AMOUNT',
      message: `Payment is more than four times the customer's recent average transfer of ${formatInr(averageAmount30d)}.`,
      weight: WEIGHTS.ABOVE_USUAL_AMOUNT,
    });
  }

  if (transactions10m >= 5) {
    reasons.push({
      code: 'VELOCITY_10M',
      message: `${transactions10m} transfers were attempted in the last 10 minutes.`,
      weight: WEIGHTS.VELOCITY_10M,
    });
  } else if (transactions10m >= 3) {
    reasons.push({
      code: 'VELOCITY_10M',
      message: `${transactions10m} transfers were attempted in the last 10 minutes.`,
      weight: WEIGHTS.VELOCITY_10M_MODERATE,
    });
  }

  if (transactions1h >= 10) {
    reasons.push({
      code: 'VELOCITY_1H',
      message: `${transactions1h} transfers were attempted in the last hour.`,
      weight: WEIGHTS.VELOCITY_1H,
    });
  }

  if (isNewDevice) {
    reasons.push({
      code: 'NEW_DEVICE',
      message: 'This payment was initiated from a device not previously seen for this account.',
      weight: WEIGHTS.NEW_DEVICE,
    });
  }

  if (isUnusualLocation) {
    reasons.push({
      code: 'UNUSUAL_LOCATION',
      message: 'The payment location differs from the customer recent payment locations.',
      weight: WEIGHTS.UNUSUAL_LOCATION,
    });
  }

  if (failedAttempts15m >= 3) {
    reasons.push({
      code: 'FAILED_ATTEMPTS',
      message: `${failedAttempts15m} failed payment attempts were recorded in the last 15 minutes.`,
      weight: WEIGHTS.FAILED_ATTEMPTS,
    });
  }

  const ruleScore = Math.min(
    100,
    reasons.reduce((total, reason) => total + reason.weight, 0)
  );

  return { ruleScore, reasons };
}
