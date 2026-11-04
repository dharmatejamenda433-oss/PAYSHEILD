"""Model evaluation helpers and a small evaluation CLI.

Usage (from fraud-service/):
    python training/evaluate.py
    python training/evaluate.py --data prepared_features.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


def evaluate_model(model: Any, features, target, threshold: float = 0.5) -> dict:
    """Return precision, recall, F1, PR-AUC, ROC-AUC and the confusion matrix."""
    probabilities = model.predict_proba(features)[:, 1]
    predictions = (probabilities >= threshold).astype(int)

    labels = np.asarray(target)
    matrix = confusion_matrix(labels, predictions, labels=[0, 1])
    true_negative, false_positive, false_negative, true_positive = matrix.ravel()

    report = classification_report(
        labels,
        predictions,
        labels=[0, 1],
        target_names=["legitimate", "fraud"],
        output_dict=True,
        zero_division=0,
    )

    return {
        "threshold": threshold,
        "accuracy": float(accuracy_score(labels, predictions)),
        "precision": float(precision_score(labels, predictions, zero_division=0)),
        "recall": float(recall_score(labels, predictions, zero_division=0)),
        "f1_score": float(f1_score(labels, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(labels, probabilities)),
        "pr_auc": float(average_precision_score(labels, probabilities)),
        "confusion_matrix": {
            "true_negative": int(true_negative),
            "false_positive": int(false_positive),
            "false_negative": int(false_negative),
            "true_positive": int(true_positive),
        },
        "classification_report": {
            "legitimate": {
                "precision": float(report["legitimate"]["precision"]),
                "recall": float(report["legitimate"]["recall"]),
                "f1_score": float(report["legitimate"]["f1-score"]),
            },
            "fraud": {
                "precision": float(report["fraud"]["precision"]),
                "recall": float(report["fraud"]["recall"]),
                "f1_score": float(report["fraud"]["f1-score"]),
            },
        },
        "test_samples": int(len(labels)),
        "test_fraud_cases": int(labels.sum()),
    }


def save_metrics(metrics: dict, path) -> None:
    with open(path, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate a saved fraud model")
    parser.add_argument("--data", type=str, default=None)
    parser.add_argument(
        "--model",
        type=str,
        default=str(SERVICE_ROOT / "models" / "fraud_model.joblib"),
    )
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--samples", type=int, default=120_000)
    parser.add_argument("--fraud-rate", type=float, default=0.02)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    from app.preprocessing import TARGET_COLUMN, build_training_frame
    from training.synthetic import generate_synthetic_transactions

    args = parse_args()
    model = joblib.load(args.model)

    if args.data:
        dataset = pd.read_csv(args.data).rename(
            columns={"isFraud": TARGET_COLUMN, "type": "transaction_type"}
        )
    else:
        dataset = generate_synthetic_transactions(
            n_samples=args.samples,
            fraud_rate=args.fraud_rate,
            random_state=args.seed,
        )

    dataset = dataset.dropna(subset=[TARGET_COLUMN]).reset_index(drop=True)
    features = build_training_frame(dataset)
    target = dataset[TARGET_COLUMN].astype(int)

    _, X_test, _, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        stratify=target,
        random_state=args.seed,
    )

    metrics = evaluate_model(model, X_test, y_test, args.threshold)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
