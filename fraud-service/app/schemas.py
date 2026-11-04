"""Pydantic request/response contracts for the fraud service."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal["TRANSFER", "PAYMENT", "CASH_OUT", "CASH_IN", "DEBIT"]


class PredictionRequest(BaseModel):
    """Features sent by the Node.js payment engine.

    extra="forbid" prevents silently accepting misspelled fields that would
    otherwise be ignored and produce a misleading prediction.
    """

    model_config = ConfigDict(extra="forbid")

    amount: float = Field(
        gt=0,
        le=1_000_000_000,
        allow_inf_nan=False,
        description="Payment amount in major currency units (INR).",
    )
    transaction_type: TransactionType
    transaction_count_10m: int = Field(ge=0, le=10_000)
    transaction_count_1h: int = Field(ge=0, le=10_000)
    is_new_device: bool
    is_unusual_location: bool
    failed_attempts_15m: int = Field(ge=0, le=10_000)
    hour_of_day: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    avg_amount_30d: float = Field(ge=0, le=1_000_000_000, allow_inf_nan=False)
    amount_to_balance_ratio: float = Field(ge=0, le=1_000, allow_inf_nan=False)


class PredictionResponse(BaseModel):
    fraud_probability: float = Field(ge=0, le=1)
    risk_score: int = Field(ge=0, le=100)
    prediction: Literal["FRAUD", "LEGITIMATE"]
    model_type: str
    fallback: bool
    threshold: float
    model_version: Optional[str] = None
    note: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    fallback: bool
    model_type: str
    model_version: Optional[str] = None
    threshold: float
    feature_count: int
    model_path: str
    note: Optional[str] = None
