import { env } from '../config/env.js';

let lastWarningAt = 0;

function warnOnce(message) {
  const now = Date.now();
  if (now - lastWarningAt > 60000) {
    console.warn(message);
    lastWarningAt = now;
  }
}

/**
 * Calls the Python FastAPI model. The response is only treated as a real ML
 * prediction when the service confirms a trained model was used. Its labelled
 * development fallback is intentionally ignored and the API uses rules only.
 */
export async function getFraudPrediction(features) {
  try {
    const response = await fetch(`${env.FRAUD_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: AbortSignal.timeout(env.FRAUD_SERVICE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Fraud service returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const modelType = data.model_type || 'unknown';
    const isFallback =
      data.fallback === true || modelType.toLowerCase().includes('fallback');

    if (
      isFallback ||
      typeof data.fraud_probability !== 'number' ||
      !Number.isFinite(data.fraud_probability) ||
      data.fraud_probability < 0 ||
      data.fraud_probability > 1
    ) {
      warnOnce(
        '[fraud-service] No trained model available (development fallback detected). ' +
          'Using the rule-based decision engine only for this request.'
      );
      return {
        available: false,
        probability: null,
        model: modelType,
        note: data.note || 'Trained ML model unavailable; rules used instead.',
      };
    }

    return {
      available: true,
      probability: data.fraud_probability,
      riskScore: data.risk_score,
      model: modelType,
      note: null,
    };
  } catch (error) {
    warnOnce(
      `[fraud-service] Prediction request failed (${error.message}). ` +
        'Using the rule-based decision engine only for this request.'
    );

    return {
      available: false,
      probability: null,
      model: 'unavailable',
      note: 'Fraud service unavailable; rules used instead.',
    };
  }
}
