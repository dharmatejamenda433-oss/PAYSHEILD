"""Deterministic synthetic transaction generator.

This produces a PaySim-style dataset (heavy-tailed amounts, fraud labels driven by
velocity, device/location novelty and failed attempts). It is intentionally
synthetic: reported metrics measure performance on this synthetic distribution,
not on real payment traffic.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

TRANSACTION_TYPES = ("TRANSFER", "PAYMENT", "CASH_OUT", "CASH_IN", "DEBIT")


def _sigmoid(value: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-value))


def generate_synthetic_transactions(
    n_samples: int = 120_000,
    fraud_rate: float = 0.02,
    random_state: int = 42,
) -> pd.DataFrame:
    """Generate a labelled dataset with the same features used at inference time.

    Fraud labels are sampled from a logistic function of the features plus noise.
    The intercept is calibrated so the requested fraud rate is reached. This keeps
    the dataset imbalanced and learnable without using the test set for tuning.
    """
    if n_samples < 1000:
        raise ValueError("n_samples must be at least 1000")

    if not 0 < fraud_rate < 0.5:
        raise ValueError("fraud_rate must be between 0 and 0.5")

    rng = np.random.default_rng(random_state)

    transaction_type = rng.choice(
        TRANSACTION_TYPES,
        size=n_samples,
        p=[0.34, 0.28, 0.18, 0.12, 0.08],
    )

    amount = np.round(np.exp(rng.normal(7.5, 1.05, n_samples))).clip(10, 500_000)
    average_amount_30d = np.round(
        np.exp(rng.normal(7.2, 0.9, n_samples))
    ).clip(10, 300_000)

    balance = np.round(
        average_amount_30d * np.exp(rng.normal(1.3, 0.7, n_samples))
    ).clip(500, 5_000_000)
    amount_to_balance_ratio = np.clip(amount / np.maximum(balance, 1), 0, 20)

    burst = (rng.random(n_samples) < 0.04) * rng.integers(1, 7, n_samples)
    transaction_count_10m = rng.poisson(1.0, n_samples) + burst
    transaction_count_1h = transaction_count_10m + rng.poisson(2.5, n_samples)

    is_new_device = rng.binomial(1, 0.12, n_samples)
    is_unusual_location = rng.binomial(1, 0.08, n_samples)

    failed_burst = (rng.random(n_samples) < 0.03) * rng.integers(1, 5, n_samples)
    failed_attempts_15m = rng.poisson(0.25, n_samples) + failed_burst

    hour_of_day = rng.integers(0, 24, n_samples)
    day_of_week = rng.integers(0, 7, n_samples)

    night = (hour_of_day <= 5).astype(int)
    is_cash_out = np.isin(transaction_type, ["CASH_OUT"]).astype(int)
    is_transfer = np.isin(transaction_type, ["TRANSFER"]).astype(int)
    is_above_usual_amount = (amount > average_amount_30d * 4).astype(int)

    z_amount = (np.log1p(amount) - 7.5) / 1.05

    # Signal strength: higher values mean more fraud-like behaviour.
    # Coefficients are deliberately strong enough for a demo model to learn,
    # while the logistic noise keeps the problem non-deterministic.
    strength = (
        1.6 * z_amount
        + 1.1 * np.minimum(transaction_count_10m, 8)
        + 0.25 * np.minimum(transaction_count_1h, 25)
        + 2.4 * is_new_device
        + 2.2 * is_unusual_location
        + 0.7 * np.minimum(failed_attempts_15m, 6)
        + 1.3 * np.clip(amount_to_balance_ratio, 0, 3)
        + 1.0 * night
        + 0.8 * is_cash_out
        + 0.3 * is_transfer
        + 0.8 * is_above_usual_amount
        + rng.normal(0, 0.25, n_samples)
    )

    # Calibrate the intercept with a bisection search so mean(prob) ~= fraud_rate.
    low, high = -20.0, 10.0
    for _ in range(80):
        midpoint = (low + high) / 2
        current_rate = float(_sigmoid(strength + midpoint).mean())
        if current_rate < fraud_rate:
            low = midpoint
        else:
            high = midpoint

    intercept = (low + high) / 2
    probabilities = _sigmoid(strength + intercept)
    is_fraud = rng.binomial(1, probabilities)

    return pd.DataFrame(
        {
            "amount": amount.round(2),
            "transaction_type": transaction_type,
            "transaction_count_10m": transaction_count_10m.astype(int),
            "transaction_count_1h": transaction_count_1h.astype(int),
            "is_new_device": is_new_device.astype(int),
            "is_unusual_location": is_unusual_location.astype(int),
            "failed_attempts_15m": failed_attempts_15m.astype(int),
            "hour_of_day": hour_of_day.astype(int),
            "day_of_week": day_of_week.astype(int),
            "avg_amount_30d": average_amount_30d.round(2),
            "amount_to_balance_ratio": amount_to_balance_ratio.round(4),
            "is_fraud": is_fraud.astype(int),
        }
    )


def save_sample(dataset: pd.DataFrame, path: Path, rows: int = 200) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    dataset.head(rows).to_csv(path, index=False)
