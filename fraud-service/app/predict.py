"""Model loading and fraud prediction.

If trained artifacts are missing, the service returns a clearly labelled
deterministic fallback. It never presents rule output as an ML prediction.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import joblib

from app.preprocessing import FEATURE_COLUMNS, build_feature_frame

SERVICE_ROOT = Path(__file__).resolve().parents[1]

_artifacts: dict | None = None
_lock = threading.Lock()


def get_model_dir() -> Path:
    configured = os.getenv("MODEL_PATH", "models")
    path = Path(configured)
    if not path.is_absolute():
        path = SERVICE_ROOT / path
    return path


def load_artifacts(force: bool = False) -> dict:
    """Load and cache the model pipeline and metadata."""
    global _artifacts

    with _lock:
        if _artifacts is not None and not force:
            return _artifacts

        model_dir = get_model_dir()
        model_path = model_dir / "fraud_model.joblib"
        preprocessor_path = model_dir / "preprocessor.joblib"
        metadata_path = model_dir / "model_metadata.json"

        loaded = False
        model = None
        preprocessor = None
        metadata: dict = {}
        error: str | None = None

        if model_path.is_file():
            try:
                model = joblib.load(model_path)

                if preprocessor_path.is_file():
                    preprocessor = joblib.load(preprocessor_path)
                elif hasattr(model, "named_steps"):
                    preprocessor = model.named_steps.get("preprocessor")

                if metadata_path.is_file():
                    with open(metadata_path, encoding="utf-8") as file:
                        metadata = json.load(file)

                if not hasattr(model, "predict_proba"):
                    raise ValueError("Loaded artifact does not expose predict_proba")

                loaded = True
            except Exception as exc:  # noqa: BLE001 - surfaced in health/fallback note
                error = str(exc)
                loaded = False

        threshold = float(os.getenv("FRAUD_THRESHOLD", metadata.get("threshold", 0.5)))

        _artifacts = {
            "loaded": loaded,
            "model": model,
            "preprocessor": preprocessor,
            "metadata": metadata,
            "model_dir": str(model_dir),
            "model_type": metadata.get("model_type")
            or ("trained_pipeline" if loaded else "development_rules_fallback"),
            "model_version": metadata.get("model_version"),
            "threshold": threshold,
            "error": error,
        }

        return _artifacts


def reload_artifacts() -> dict:
    return load_artifacts(force=True)


def get_model_status() -> dict:
    artifacts = load_artifacts()
    loaded = artifacts["loaded"]

    note = None
    if not loaded:
        note = artifacts["error"] or (
            "No trained model artifact found at "
            f"{artifacts['model_dir']}. Predictions use a development rules fallback "
            "and are not a trained ML prediction."
        )

    return {
        "status": "ok" if loaded else "degraded",
        "model_loaded": loaded,
        "fallback": not loaded,
        "model_type": artifacts["model_type"],
        "model_version": artifacts["model_version"],
        "threshold": artifacts["threshold"],
        "feature_count": len(FEATURE_COLUMNS),
        "model_path": artifacts["model_dir"],
        "note": note,
    }


def development_fallback_prediction(features: dict) -> dict:
    """Deterministic rules used only when no model artifact is available.

    The response is explicitly labelled as a fallback so the Node.js service
    does not treat it as a trained ML probability.
    """
    artifacts = load_artifacts()
    threshold = artifacts["threshold"]

    score = 0
    if features["amount"] >= 25_000:
        score += 20
    if features["amount_to_balance_ratio"] >= 0.7:
        score += 10
    if features["transaction_count_10m"] >= 5:
        score += 25
    elif features["transaction_count_10m"] >= 3:
        score += 15
    if features["transaction_count_1h"] >= 10:
        score += 10
    if features["is_new_device"]:
        score += 15
    if features["is_unusual_location"]:
        score += 20
    if features["failed_attempts_15m"] >= 3:
        score += 15
    if features["hour_of_day"] <= 5:
        score += 10

    score = min(100, score)
    probability = round(score / 100, 4)

    return {
        "fraud_probability": probability,
        "risk_score": score,
        "prediction": "FRAUD" if probability >= threshold else "LEGITIMATE",
        "model_type": "development_rules_fallback",
        "fallback": True,
        "threshold": threshold,
        "model_version": None,
        "note": (
            "No trained ML model is loaded. This deterministic rule score is a "
            "development fallback and must not be treated as an ML prediction."
        ),
    }


def predict_fraud(features: dict) -> dict:
    """Run the trained pipeline, or return the labelled development fallback."""
    artifacts = load_artifacts()

    if not artifacts["loaded"]:
        return development_fallback_prediction(features)

    frame = build_feature_frame(features)
    probability = float(artifacts["model"].predict_proba(frame)[0][1])
    probability = max(0.0, min(1.0, probability))

    return {
        "fraud_probability": round(probability, 6),
        "risk_score": int(round(probability * 100)),
        "prediction": "FRAUD" if probability >= artifacts["threshold"] else "LEGITIMATE",
        "model_type": artifacts["model_type"],
        "fallback": False,
        "threshold": artifacts["threshold"],
        "model_version": artifacts["model_version"],
        "note": None,
    }
