from typing import Tuple, List
from app.models import TransactionCreate, RiskLevel, TransactionStatus


def evaluate_adaptive_risk(tx_in: TransactionCreate) -> Tuple[int, RiskLevel, TransactionStatus, List[str]]:
    """
    Evaluates real-time adaptive risk based on transaction parameters,
    anomaly flags, and behavioral heuristics.
    """
    score = 8
    reasons: List[str] = []

    # High amount check
    if tx_in.amount >= 10000:
        score += 45
        reasons.append(f"Large transaction amount (${tx_in.amount:,.2f}) exceeds standard velocity threshold")
    elif tx_in.amount >= 3000:
        score += 25
        reasons.append(f"Elevated transfer amount (${tx_in.amount:,.2f}) above typical daily median")
    elif tx_in.amount >= 1000:
        score += 10

    # Unusual geolocation anomaly
    if tx_in.is_unusual_location:
        score += 35
        reasons.append(f"Access detected from unrecognized geopolitical zone (IP: {tx_in.ip_address})")

    # New device authentication anomaly
    if tx_in.is_new_device:
        score += 22
        reasons.append(f"Session originated from unverified hardware fingerprint ({tx_in.device_name})")

    # Category risk weighting
    if tx_in.category.value in ["WITHDRAWAL", "INVESTMENT"] and tx_in.amount > 2000:
        score += 15
        reasons.append(f"High-friction asset movement for category {tx_in.category.value}")

    # Clamp score to 0..100
    score = min(max(score, 2), 99)

    # Determine risk level and initial status
    if score >= 75:
        level = RiskLevel.CRITICAL
        status = TransactionStatus.FLAGGED
        reasons.append("Triggered automated adaptive freeze pending secondary MFA challenge")
    elif score >= 50:
        level = RiskLevel.HIGH
        status = TransactionStatus.FLAGGED
        reasons.append("Flagged for compliance and fraud operations review")
    elif score >= 25:
        level = RiskLevel.MEDIUM
        status = TransactionStatus.PENDING
    else:
        level = RiskLevel.LOW
        status = TransactionStatus.COMPLETED
        if not reasons:
            reasons.append("Clean transaction baseline; passed all behavioral telemetry checks")

    return score, level, status, reasons
