import pytest
import pandas as pd
import numpy as np
from app.ml.dataset import generate_synthetic_transactions, split_dataset
from app.ml.risk_service import HybridRiskService
from app.ml.analytics import calculate_spending_analytics, generate_spending_forecast
from app.models import Transaction, TransactionCreate, TransactionCategory, TransactionStatus, RiskLevel


def test_synthetic_dataset_generation():
    df = generate_synthetic_transactions(n_samples=200, random_seed=99)
    assert len(df) == 200
    expected_cols = [
        "transaction_id", "user_id", "amount", "category",
        "transaction_hour", "recent_freq_24h", "spending_deviation",
        "merchant_novelty", "location_change", "device_novelty", "is_high_risk"
    ]
    for col in expected_cols:
        assert col in df.columns
    assert df["is_high_risk"].isin([0, 1]).all()


def test_dataset_splitting_prevent_leakage():
    df = generate_synthetic_transactions(n_samples=300, random_seed=42)
    train, val, test = split_dataset(df, test_size=0.15, val_size=0.15, random_state=42)

    assert len(train) + len(val) + len(test) == len(df)
    # Check no duplicate transaction IDs across train, val, and test splits
    train_ids = set(train["transaction_id"])
    val_ids = set(val["transaction_id"])
    test_ids = set(test["transaction_id"])

    assert len(train_ids.intersection(val_ids)) == 0
    assert len(train_ids.intersection(test_ids)) == 0
    assert len(val_ids.intersection(test_ids)) == 0


def test_feature_extraction_and_bounds():
    service = HybridRiskService()
    tx = TransactionCreate(
        amount=150.0,
        currency="USD",
        recipient="Sydney Coffee Roasters",
        category=TransactionCategory.PAYMENT,
        is_unusual_location=False,
        is_new_device=False,
    )
    df_features = service.extract_features(tx, user_history=[])
    assert len(df_features) == 1
    assert df_features["amount"].iloc[0] == 150.0
    assert df_features["location_change"].iloc[0] == 0
    assert df_features["device_novelty"].iloc[0] == 0


def test_security_policy_emergency_freeze_cannot_be_overridden():
    """
    Non-negotiable policy: In Emergency Lockdown, a low ML score MUST NOT allow execution.
    Final risk score must be 100 with immediate block recommendation.
    """
    service = HybridRiskService()
    # Nominal small transaction that would normally be low risk
    tx = TransactionCreate(
        amount=12.50,
        currency="USD",
        recipient="Safe Local Merchant",
        category=TransactionCategory.PAYMENT,
        is_unusual_location=False,
        is_new_device=False,
    )
    result = service.assess_transaction(tx, user_history=[], is_emergency_mode=True)
    assert result.risk_score == 100
    assert result.risk_level == RiskLevel.CRITICAL
    assert result.policy_override_applied is True
    assert "CRITICAL POLICY" in result.assessment_reasons[0]


def test_daily_spending_limit_policy_enforcement():
    """
    Non-negotiable policy: Cumulative spend exceeding user daily limit must trigger policy override.
    """
    service = HybridRiskService()
    tx = TransactionCreate(
        amount=5000.0,
        currency="USD",
        recipient="Retail Electronics",
        category=TransactionCategory.PAYMENT,
    )
    # Current daily spend is 22,000 and limit is 25,000 -> 27,000 exceeds limit
    result = service.assess_transaction(
        tx,
        user_history=[],
        daily_limit=25000.0,
        current_daily_spend=22000.0,
    )
    assert result.policy_override_applied is True
    assert result.risk_score >= 90
    assert any("SECURITY POLICY" in r for r in result.assessment_reasons)


def test_risk_score_boundaries():
    service = HybridRiskService()
    tx = TransactionCreate(
        amount=999999.0,
        currency="USD",
        recipient="Offshore Account",
        category=TransactionCategory.TRANSFER,
        is_unusual_location=True,
        is_new_device=True,
    )
    result = service.assess_transaction(tx, user_history=[])
    assert 0 <= result.risk_score <= 100


def test_forecast_insufficient_history_fallback():
    """
    Verifies that system explicitly refuses to hallucinate forecasts when data is insufficient.
    """
    empty_history = []
    res = generate_spending_forecast(empty_history)
    assert res["has_sufficient_data"] is False
    assert res["status"] == "INSUFFICIENT_HISTORY"
    assert len(res["forecast_points"]) == 0

    # With 1 transaction (still below threshold of 3)
    single_tx = [
        Transaction(
            id="tx_1",
            user_id="user_1",
            amount=50.0,
            currency="USD",
            recipient="Cafe",
            category=TransactionCategory.PAYMENT,
            status=TransactionStatus.COMPLETED,
            risk_level=RiskLevel.LOW,
            risk_score=5,
            created_at="2026-10-10T12:00:00Z",
        )
    ]
    res_single = generate_spending_forecast(single_tx)
    assert res_single["has_sufficient_data"] is False


def test_forecast_active_calculation():
    # 5 historical transactions
    history = [
        Transaction(
            id=f"tx_{i}",
            user_id="user_1",
            amount=float(100 + i * 20),
            currency="USD",
            recipient="Store",
            category=TransactionCategory.PAYMENT,
            status=TransactionStatus.COMPLETED,
            risk_level=RiskLevel.LOW,
            risk_score=5,
            created_at="2026-10-10T12:00:00Z",
        )
        for i in range(5)
    ]
    res = generate_spending_forecast(history, forecast_days=7)
    assert res["has_sufficient_data"] is True
    assert res["status"] == "ACTIVE_FORECAST"
    assert len(res["forecast_points"]) == 7
    assert res["forecast_points"][0]["predicted_amount"] > 0
