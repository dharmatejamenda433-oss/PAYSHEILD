import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.predict import (
    development_fallback_prediction,
    get_model_status,
    load_artifacts,
)
from app.preprocessing import build_feature_frame

client = TestClient(app)

VALID_FEATURES = {
    "amount": 4200.0,
    "transaction_type": "TRANSFER",
    "transaction_count_10m": 1,
    "transaction_count_1h": 3,
    "is_new_device": False,
    "is_unusual_location": False,
    "failed_attempts_15m": 0,
    "hour_of_day": 14,
    "day_of_week": 2,
    "avg_amount_30d": 1800.0,
    "amount_to_balance_ratio": 0.08,
}


def test_trained_model_artifacts_load_successfully():
    artifacts = load_artifacts()
    assert artifacts["loaded"] is True, artifacts["error"]
    assert artifacts["model"] is not None
    assert artifacts["preprocessor"] is not None
    assert artifacts["model_type"] in {"RandomForestClassifier", "XGBClassifier"}
    assert artifacts["metadata"]["features"]
    assert len(artifacts["metadata"]["features"]) == 11


def test_health_reports_loaded_model():
    response = client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["fallback"] is False
    assert body["feature_count"] == 11


def test_prediction_endpoint_returns_valid_probability():
    response = client.post("/predict", json=VALID_FEATURES)
    assert response.status_code == 200

    body = response.json()
    assert 0.0 <= body["fraud_probability"] <= 1.0
    assert 0 <= body["risk_score"] <= 100
    assert body["prediction"] in {"FRAUD", "LEGITIMATE"}
    assert body["fallback"] is False
    assert body["model_type"] != "development_rules_fallback"
    assert body["risk_score"] == round(body["fraud_probability"] * 100)


def test_prediction_is_deterministic_for_same_features():
    first = client.post("/predict", json=VALID_FEATURES).json()
    second = client.post("/predict", json=VALID_FEATURES).json()

    assert first["fraud_probability"] == second["fraud_probability"]
    assert first["risk_score"] == second["risk_score"]


def test_obviously_risky_features_score_above_safe_features():
    safe = dict(VALID_FEATURES)

    risky = {
        **VALID_FEATURES,
        "amount": 120000.0,
        "transaction_count_10m": 8,
        "transaction_count_1h": 18,
        "is_new_device": True,
        "is_unusual_location": True,
        "failed_attempts_15m": 5,
        "hour_of_day": 2,
        "amount_to_balance_ratio": 0.95,
    }

    safe_response = client.post("/predict", json=safe).json()
    risky_response = client.post("/predict", json=risky).json()

    assert risky_response["fraud_probability"] > safe_response["fraud_probability"]


@pytest.mark.parametrize(
    "override",
    [
        {"amount": -10},
        {"amount": 0},
        {"transaction_count_10m": -1},
        {"failed_attempts_15m": -2},
        {"hour_of_day": 24},
        {"day_of_week": 7},
        {"transaction_type": "UNKNOWN"},
        {"is_new_device": "definitely"},
    ],
)
def test_invalid_features_are_rejected(override):
    payload = {**VALID_FEATURES, **override}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_unknown_fields_are_rejected():
    payload = {**VALID_FEATURES, "unexpected_feature": 123}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_missing_feature_is_rejected():
    payload = dict(VALID_FEATURES)
    del payload["failed_attempts_15m"]

    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_fallback_is_clearly_labelled_as_not_ml():
    result = development_fallback_prediction(VALID_FEATURES)

    assert result["fallback"] is True
    assert result["model_type"] == "development_rules_fallback"
    assert "not be treated as an ML prediction" in result["note"]
    assert 0.0 <= result["fraud_probability"] <= 1.0
    assert 0 <= result["risk_score"] <= 100


def test_preprocessing_is_consistent_between_boolean_and_numeric_flags():
    artifacts = load_artifacts()
    preprocessor = artifacts["preprocessor"]

    boolean_frame = build_feature_frame(VALID_FEATURES)
    numeric_frame = build_feature_frame(
        {**VALID_FEATURES, "is_new_device": 0, "is_unusual_location": 0}
    )

    boolean_matrix = preprocessor.transform(boolean_frame)
    numeric_matrix = preprocessor.transform(numeric_frame)

    assert boolean_matrix.shape == numeric_matrix.shape
    assert np.allclose(boolean_matrix, numeric_matrix)


def test_model_status_and_fallback_note():
    status = get_model_status()
    assert status["status"] == "ok"
    assert status["model_version"]
    assert status["note"] is None
