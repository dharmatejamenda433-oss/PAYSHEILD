"""Shared feature preparation for the PayShield fraud model.

The exact same function is used by training and by the FastAPI inference
service. That is the main protection against training/serving skew.
"""

from __future__ import annotations

import math
from typing import Any

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

TRANSACTION_TYPES = ("TRANSFER", "PAYMENT", "CASH_OUT", "CASH_IN", "DEBIT")

NUMERIC_FEATURES = [
    "amount",
    "transaction_count_10m",
    "transaction_count_1h",
    "is_new_device",
    "is_unusual_location",
    "failed_attempts_15m",
    "hour_of_day",
    "day_of_week",
    "avg_amount_30d",
    "amount_to_balance_ratio",
]

CATEGORICAL_FEATURES = ["transaction_type"]

FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET_COLUMN = "is_fraud"


def build_preprocessor() -> ColumnTransformer:
    """Build an unfitted preprocessing pipeline.

    Numeric values are imputed and scaled; transaction types are one-hot encoded.
    handle_unknown="ignore" keeps inference safe if a new type is ever added.
    """
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            ),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, NUMERIC_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )


def _to_number(value: Any, field_name: str) -> float:
    if isinstance(value, bool):
        return 1.0 if value else 0.0

    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be a number") from error

    if not math.isfinite(number):
        raise ValueError(f"{field_name} must be a finite number")

    return number


def build_feature_frame(features: dict[str, Any]) -> pd.DataFrame:
    """Convert a single feature dictionary into a one-row DataFrame.

    Booleans are converted to 0/1 and the transaction type is normalized to
    upper case. Validation of ranges happens in the Pydantic request schema.
    """
    transaction_type = str(features["transaction_type"]).upper()
    if transaction_type not in TRANSACTION_TYPES:
        raise ValueError(
            f"transaction_type must be one of {', '.join(TRANSACTION_TYPES)}"
        )

    row: dict[str, Any] = {
        "transaction_type": transaction_type,
    }

    for field_name in NUMERIC_FEATURES:
        row[field_name] = _to_number(features[field_name], field_name)

    return pd.DataFrame([row], columns=FEATURE_COLUMNS)


def build_training_frame(dataset: pd.DataFrame) -> pd.DataFrame:
    """Select and normalize the model feature columns from a training dataset."""
    missing = [column for column in FEATURE_COLUMNS if column not in dataset.columns]
    if missing:
        raise ValueError(
            "Training dataset is missing required feature columns: "
            + ", ".join(missing)
        )

    frame = dataset[FEATURE_COLUMNS].copy()
    frame["transaction_type"] = frame["transaction_type"].astype(str).str.upper()

    for field_name in NUMERIC_FEATURES:
        frame[field_name] = pd.to_numeric(frame[field_name], errors="coerce")

    if frame[NUMERIC_FEATURES].isna().all(axis=None):
        raise ValueError("Training dataset does not contain usable numeric values")

    return frame
