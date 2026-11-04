import { env } from '../config/env.js';

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Blends the ML probability with rule findings and maps the final score to a
 * business decision. Thresholds and the high-risk policy are configurable.
 *
 * - LOW      -> APPROVE
 * - MEDIUM   -> MANUAL_REVIEW
 * - HIGH     -> MANUAL_REVIEW or DECLINE, based on HIGH_RISK_ACTION
 */
export function decideRisk({ ruleScore, mlAvailable, mlProbability }) {
  const mlScore =
    mlAvailable && typeof mlProbability === 'number'
      ? clampScore(mlProbability * 100)
      : null;

  let finalScore;

  if (mlScore === null) {
    // The ML service is unavailable or only returned its development fallback.
    finalScore = clampScore(ruleScore);
  } else {
    finalScore = clampScore(mlScore * env.ML_WEIGHT + ruleScore * env.RULE_WEIGHT);

    // Strong deterministic evidence must not be diluted by a confident model.
    if (ruleScore >= env.RISK_HIGH_THRESHOLD) {
      finalScore = Math.max(finalScore, ruleScore);
    }
  }

  let riskLevel;
  if (finalScore >= env.RISK_HIGH_THRESHOLD) {
    riskLevel = 'HIGH';
  } else if (finalScore >= env.RISK_MEDIUM_THRESHOLD) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  let decision;
  if (riskLevel === 'LOW') {
    decision = 'APPROVE';
  } else if (riskLevel === 'MEDIUM') {
    decision = 'MANUAL_REVIEW';
  } else {
    decision = env.HIGH_RISK_ACTION === 'decline' ? 'DECLINE' : 'MANUAL_REVIEW';
  }

  return {
    riskScore: finalScore,
    riskLevel,
    decision,
    mlScore,
    ruleScore,
    blend: {
      mlWeight: env.ML_WEIGHT,
      ruleWeight: env.RULE_WEIGHT,
      highRiskAction: env.HIGH_RISK_ACTION,
    },
  };
}
