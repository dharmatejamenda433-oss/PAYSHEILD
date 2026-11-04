"""FastAPI entry point for the PayShield fraud prediction service."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

SERVICE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(SERVICE_ROOT / ".env")

from app.predict import get_model_status, predict_fraud  # noqa: E402
from app.schemas import (  # noqa: E402
    HealthResponse,
    PredictionRequest,
    PredictionResponse,
)

app = FastAPI(
    title="PayShield Fraud Service",
    version="1.0.0",
    description=(
        "Machine-learning fraud scoring for PayShield. "
        "Node.js remains responsible for all payment and ledger logic."
    ),
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return get_model_status()


@app.post("/predict", response_model=PredictionResponse, tags=["fraud"])
def predict(payload: PredictionRequest) -> PredictionResponse:
    return predict_fraud(payload.model_dump())


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "service": "PayShield Fraud Service",
        "docs": "/docs",
        "endpoints": ["/health", "/predict"],
    }
