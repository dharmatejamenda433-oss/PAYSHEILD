"""Train and evaluate the PayShield fraud model.

Usage (from fraud-service/):
    python training/train.py
    python training/train.py --samples 150000 --fraud-rate 0.02
    python training/train.py --data path/to/prepared_features.csv
    python training/train.py --compare-xgboost

The script saves:
    models/fraud_model.joblib       full preprocessing + classifier pipeline
    models/preprocessor.joblib      fitted preprocessing transformer
    models/model_metadata.json      feature contract, version, metrics
    models/metrics.json             evaluation metrics
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from app.preprocessing import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    TARGET_COLUMN,
    TRANSACTION_TYPES,
    build_preprocessor,
    build_training_frame,
)
from training.evaluate import evaluate_model, save_metrics
from training.synthetic import generate_synthetic_transactions, save_sample


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the PayShield fraud model")
    parser.add_argument("--data", type=str, default=None, help="Prepared training CSV")
    parser.add_argument("--target-column", type=str, default="is_fraud")
    parser.add_argument("--samples", type=int, default=120_000)
    parser.add_argument("--fraud-rate", type=float, default=0.02)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--n-estimators", type=int, default=250)
    parser.add_argument("--max-depth", type=int, default=14)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=str, default=str(SERVICE_ROOT / "models"))
    parser.add_argument("--save-data", action="store_true")
    parser.add_argument("--compare-xgboost", action="store_true")
    return parser.parse_args()


def load_dataset(args: argparse.Namespace):
    if args.data:
        dataset = pd.read_csv(args.data)
        dataset = dataset.rename(
            columns={"isFraud": TARGET_COLUMN, "type": "transaction_type"}
        )

        if args.target_column != TARGET_COLUMN and args.target_column in dataset.columns:
            dataset = dataset.rename(columns={args.target_column: TARGET_COLUMN})

        source = f"csv:{Path(args.data).name}"
        is_synthetic = False
    else:
        dataset = generate_synthetic_transactions(
            n_samples=args.samples,
            fraud_rate=args.fraud_rate,
            random_state=args.seed,
        )
        source = "synthetic_paysim_style"
        is_synthetic = True

        sample_path = SERVICE_ROOT / "training" / "samples" / "synthetic_sample.csv"
        save_sample(dataset, sample_path)

        if args.save_data:
            data_path = SERVICE_ROOT / "training" / "data" / "synthetic_transactions.csv"
            data_path.parent.mkdir(parents=True, exist_ok=True)
            dataset.to_csv(data_path, index=False)
            print(f"Saved generated dataset to {data_path}")

    if TARGET_COLUMN not in dataset.columns:
        raise SystemExit(
            f"Target column '{TARGET_COLUMN}' is missing. "
            "Use --target-column or provide a prepared CSV."
        )

    dataset = dataset.dropna(subset=[TARGET_COLUMN]).reset_index(drop=True)
    dataset[TARGET_COLUMN] = dataset[TARGET_COLUMN].astype(int)

    if not dataset[TARGET_COLUMN].isin([0, 1]).all():
        raise SystemExit("Target column must contain only 0 and 1.")

    return dataset, source, is_synthetic


def build_random_forest(args: argparse.Namespace) -> Pipeline:
    classifier = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        min_samples_leaf=3,
        max_features="sqrt",
        class_weight="balanced_subsample",
        n_jobs=-1,
        random_state=args.seed,
    )

    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("classifier", classifier),
        ]
    )


def build_xgboost(args: argparse.Namespace, positive_ratio: float) -> Pipeline | None:
    try:
        from xgboost import XGBClassifier
    except ImportError:
        print(
            "XGBoost is not installed. Install requirements-ml-extras.txt to compare it. "
            "Continuing with the Random Forest baseline."
        )
        return None

    classifier = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        scale_pos_weight=positive_ratio,
        eval_metric="logloss",
        tree_method="hist",
        n_jobs=-1,
        random_state=args.seed,
    )

    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("classifier", classifier),
        ]
    )


def top_feature_importances(pipeline: Pipeline) -> list[dict]:
    classifier = pipeline.named_steps["classifier"]
    preprocessor = pipeline.named_steps["preprocessor"]

    if not hasattr(classifier, "feature_importances_"):
        return []

    names = preprocessor.get_feature_names_out()
    pairs = sorted(
        zip(names, classifier.feature_importances_),
        key=lambda pair: pair[1],
        reverse=True,
    )

    return [
        {"feature": str(name), "importance": round(float(importance), 6)}
        for name, importance in pairs[:15]
    ]


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    dataset, source, is_synthetic = load_dataset(args)
    features = build_training_frame(dataset)
    target = dataset[TARGET_COLUMN]

    print(f"Dataset source: {source}")
    print(f"Samples: {len(dataset):,} | features: {len(FEATURE_COLUMNS)}")
    print(f"Fraud rate: {target.mean():.4%} ({int(target.sum()):,} fraud cases)")

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=args.test_size,
        stratify=target,
        random_state=args.seed,
    )

    print(f"Train: {len(X_train):,} | Test: {len(X_test):,}")

    candidates = []

    started = time.time()
    random_forest = build_random_forest(args)
    random_forest.fit(X_train, y_train)
    rf_metrics = evaluate_model(random_forest, X_test, y_test, args.threshold)
    candidates.append(("RandomForestClassifier", random_forest, rf_metrics))
    print(
        f"Random Forest trained in {time.time() - started:.1f}s | "
        f"precision={rf_metrics['precision']:.3f} recall={rf_metrics['recall']:.3f} "
        f"f1={rf_metrics['f1_score']:.3f} pr_auc={rf_metrics['pr_auc']:.3f}"
    )

    if args.compare_xgboost:
        positive_ratio = float((len(y_train) - y_train.sum()) / max(y_train.sum(), 1))
        xgboost_pipeline = build_xgboost(args, positive_ratio)

        if xgboost_pipeline is not None:
            started = time.time()
            xgboost_pipeline.fit(X_train, y_train)
            xgb_metrics = evaluate_model(
                xgboost_pipeline, X_test, y_test, args.threshold
            )
            candidates.append(("XGBClassifier", xgboost_pipeline, xgb_metrics))
            print(
                f"XGBoost trained in {time.time() - started:.1f}s | "
                f"precision={xgb_metrics['precision']:.3f} recall={xgb_metrics['recall']:.3f} "
                f"f1={xgb_metrics['f1_score']:.3f} pr_auc={xgb_metrics['pr_auc']:.3f}"
            )

    # Select on PR-AUC because fraud data is highly imbalanced.
    model_type, best_pipeline, best_metrics = max(
        candidates, key=lambda candidate: candidate[2]["pr_auc"]
    )

    joblib.dump(best_pipeline, output_dir / "fraud_model.joblib")
    joblib.dump(
        best_pipeline.named_steps["preprocessor"],
        output_dir / "preprocessor.joblib",
    )
    save_metrics(best_metrics, output_dir / "metrics.json")

    metadata = {
        "model_type": model_type,
        "model_version": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "target": TARGET_COLUMN,
        "features": FEATURE_COLUMNS,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "transaction_types": list(TRANSACTION_TYPES),
        "threshold": args.threshold,
        "dataset": {
            "source": source,
            "synthetic": is_synthetic,
            "samples": int(len(dataset)),
            "fraud_rate": round(float(target.mean()), 6),
            "test_size": args.test_size,
            "random_state": args.seed,
        },
        "metrics": best_metrics,
        "top_features": top_feature_importances(best_pipeline),
        "sklearn_version": sklearn.__version__,
        "note": (
            "Metrics are measured on a held-out synthetic test split. "
            "They do not represent real-world fraud detection performance."
        ),
    }

    with open(output_dir / "model_metadata.json", "w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)

    print(f"\nSelected model: {model_type}")
    print(f"PR-AUC: {best_metrics['pr_auc']:.3f}")
    print(f"Confusion matrix: {best_metrics['confusion_matrix']}")
    print(f"Artifacts saved to: {output_dir}")


if __name__ == "__main__":
    main()
