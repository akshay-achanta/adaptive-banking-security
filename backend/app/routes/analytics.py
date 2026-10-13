import os
import json
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.auth import get_current_user
from app.db import get_repository
from app.db.base import BaseRepository
from app.models import UserContext
from app.ml.analytics import calculate_spending_analytics, generate_spending_forecast

router = APIRouter(prefix="/api/analytics", tags=["Analytics & AI"])


@router.get("/spending")
async def get_spending_analytics(
    current_month_budget: float = Query(12000.0, ge=100.0, description="User budget threshold"),
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Returns actual daily spending totals, category expenditure distributions,
    and budget overrun indicators for the authenticated user.
    """
    txs, _ = await repo.list_transactions(user=user, page=1, page_size=200)
    return calculate_spending_analytics(txs, current_month_budget=current_month_budget)


@router.get("/forecast")
async def get_spending_forecast(
    forecast_days: int = Query(14, ge=1, le=60, description="Forecast horizon in days"),
    monthly_budget: float = Query(12000.0, ge=100.0, description="Monthly expenditure target"),
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Computes statistical expenditure forecasts with Gaussian uncertainty bounds.
    Explicitly flags insufficient history if transaction count is below minimum requirements.
    """
    txs, _ = await repo.list_transactions(user=user, page=1, page_size=200)
    return generate_spending_forecast(txs, forecast_days=forecast_days, monthly_budget=monthly_budget)


@router.get("/model-metrics")
async def get_model_metrics(
    user: UserContext = Depends(get_current_user),
):
    """
    Returns genuine evaluation metrics from the trained ML intelligence layer,
    including Precision, Recall, F1, ROC-AUC, PR-AUC, and confusion matrix.
    """
    metadata_path = "artifacts/models/model_metadata.json"
    anomaly_path = "artifacts/models/anomaly_metadata.json"

    if not os.path.exists(metadata_path):
        return {
            "status": "NOT_TRAINED",
            "message": "Model artifacts not yet initialized. Please trigger model training.",
            "metrics": {},
        }

    with open(metadata_path, "r") as f:
        supervised_meta = json.load(f)

    anomaly_meta = {}
    if os.path.exists(anomaly_path):
        with open(anomaly_path, "r") as f:
            anomaly_meta = json.load(f)

    return {
        "status": "ACTIVE",
        "supervised_model": supervised_meta,
        "anomaly_detector": anomaly_meta,
    }
