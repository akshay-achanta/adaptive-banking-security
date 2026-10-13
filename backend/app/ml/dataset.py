import os
import json
import logging
from typing import Tuple, Dict, Any, List
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

logger = logging.getLogger("adaptive_banking.ml.dataset")


def generate_synthetic_transactions(
    n_samples: int = 5000,
    random_seed: int = 42,
    output_path: str | None = None,
) -> pd.DataFrame:
    """
    Generates a reproducible synthetic banking transaction dataset with realistic
    fraud heuristics and behavioral anomalies.

    LIMITATIONS DOCUMENTATION:
    - These labels are generated using synthetic business heuristics (ground-truth rules)
      and do NOT represent verified real-world financial fraud investigations.
    - Real-world fraud exhibits evolving adversarial behavior, concept drift, and class imbalance (often < 0.1%).
    - In this synthetic benchmark, the base anomaly/risk rate is calibrated to ~8-12% for supervised model training stability.
    """
    rng = np.random.default_rng(random_seed)

    categories = ["PAYMENT", "TRANSFER", "WITHDRAWAL", "DEPOSIT", "INVESTMENT"]
    category_weights = [0.45, 0.25, 0.15, 0.10, 0.05]

    # Simulated users
    n_users = 250
    user_ids = [f"user_{i:04d}" for i in range(1, n_users + 1)]

    # Historical average spending profile per user
    user_avg_spend = {uid: rng.uniform(30.0, 450.0) for uid in user_ids}

    data: List[Dict[str, Any]] = []

    for i in range(n_samples):
        user_id = rng.choice(user_ids)
        category = rng.choice(categories, p=category_weights)
        user_mean = user_avg_spend[user_id]

        # Base transaction amount sampled according to category distribution
        if category == "PAYMENT":
            amount = rng.exponential(scale=user_mean * 0.8) + 5.0
        elif category == "TRANSFER":
            amount = rng.exponential(scale=user_mean * 2.5) + 20.0
        elif category == "WITHDRAWAL":
            amount = rng.choice([50, 100, 200, 300, 500, 800, 1500]) * rng.uniform(0.9, 1.1)
        elif category == "DEPOSIT":
            amount = rng.uniform(500.0, 5000.0)
        else:  # INVESTMENT
            amount = rng.exponential(scale=user_mean * 4.0) + 100.0

        amount = round(float(amount), 2)

        # Transaction hour (0-23) - naturally higher between 8 AM and 10 PM
        raw_hour_weights = np.array([
            0.01, 0.01, 0.01, 0.01, 0.01, 0.02, # 0-5
            0.04, 0.06, 0.08, 0.08, 0.07, 0.06, # 6-11
            0.07, 0.07, 0.06, 0.06, 0.06, 0.07, # 12-17
            0.07, 0.06, 0.04, 0.02, 0.01, 0.01  # 18-23
        ])
        hour_weights = raw_hour_weights / raw_hour_weights.sum()
        hour = int(rng.choice(24, p=hour_weights))

        # Recent transaction frequency in the last 24h
        recent_freq_24h = int(rng.poisson(lam=3))

        # Deviation from user historical average spending
        spending_deviation = round(float(amount / max(user_mean, 10.0)), 3)

        # Merchant novelty (0 = known recurrent merchant, 1 = brand new merchant)
        merchant_novelty = int(rng.binomial(n=1, p=0.22))

        # Simulated geolocation change (0 = familiar home location, 1 = foreign/unusual IP)
        location_change = int(rng.binomial(n=1, p=0.08))

        # Simulated device novelty (0 = trusted registered device, 1 = newly recognized device)
        device_novelty = int(rng.binomial(n=1, p=0.12))

        # Synthetic risk heuristic scoring rules for ground truth labeling
        risk_points = 0
        reasons = []

        if amount > 5000:
            risk_points += 40
            reasons.append("High monetary value spike")
        elif amount > 2000 and spending_deviation > 3.0:
            risk_points += 25
            reasons.append("Significant spending deviation above baseline")

        if spending_deviation > 5.0:
            risk_points += 25
            reasons.append("Extreme deviation from personal historical average")

        if location_change == 1:
            risk_points += 30
            reasons.append("Geolocation anomaly outside habitual perimeter")

        if device_novelty == 1 and merchant_novelty == 1:
            risk_points += 20
            reasons.append("Simultaneous novel device and unverified merchant")

        if hour in [1, 2, 3, 4] and amount > 500:
            risk_points += 20
            reasons.append("High amount during anomalous nocturnal hours")

        if recent_freq_24h >= 8:
            risk_points += 25
            reasons.append("Abnormal transaction burst velocity")

        if category in ["WITHDRAWAL", "INVESTMENT"] and amount > 2500:
            risk_points += 15
            reasons.append("High friction capital movement")

        # Ground truth binary risk label (1 = high risk/potential fraud, 0 = legitimate)
        is_high_risk = 1 if risk_points >= 45 else 0

        data.append({
            "transaction_id": f"tx_synth_{i:06d}",
            "user_id": user_id,
            "amount": amount,
            "category": category,
            "transaction_hour": hour,
            "recent_freq_24h": recent_freq_24h,
            "spending_deviation": spending_deviation,
            "merchant_novelty": merchant_novelty,
            "location_change": location_change,
            "device_novelty": device_novelty,
            "is_high_risk": is_high_risk,
            "risk_points": risk_points,
        })

    df = pd.DataFrame(data)

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)
        logger.info("Saved %d synthetic records to %s", len(df), output_path)

    return df


def split_dataset(
    df: pd.DataFrame,
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Splits data into train (70%), validation (15%), and test (15%) sets.
    Stratified on target is_high_risk to maintain consistent label distributions across splits.
    """
    train_val, test = train_test_split(
        df,
        test_size=test_size,
        random_state=random_state,
        stratify=df["is_high_risk"],
    )

    val_relative_ratio = val_size / (1.0 - test_size)
    train, val = train_test_split(
        train_val,
        test_size=val_relative_ratio,
        random_state=random_state,
        stratify=train_val["is_high_risk"],
    )

    return train.reset_index(drop=True), val.reset_index(drop=True), test.reset_index(drop=True)
