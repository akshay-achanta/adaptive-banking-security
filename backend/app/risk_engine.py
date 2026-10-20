from typing import Tuple, List, Dict, Any
from app.models import TransactionCreate, RiskLevel, TransactionStatus


def calculate_explainable_risk_factors(tx_in: TransactionCreate) -> List[Dict[str, Any]]:
    """
    Computes explainable risk factors showing exact point contributions (0-100 scale).
    """
    factors: List[Dict[str, Any]] = []

    # 1. New Beneficiary Protection (+25)
    is_new_recip = getattr(tx_in, "is_new_beneficiary", False) or tx_in.recipient.lower().startswith("new ")
    if is_new_recip:
        factors.append({
            "factor": "New Beneficiary",
            "points": 25,
            "severity": "MEDIUM",
            "description": "First-time transfer to newly added recipient within cooling-off safety window",
        })

    # 2. Unusually Large Amount (+20 to +45)
    if tx_in.amount >= 10000:
        factors.append({
            "factor": "Unusually Large Amount",
            "points": 45,
            "severity": "CRITICAL",
            "description": f"Transaction amount (${tx_in.amount:,.2f}) significantly exceeds typical account threshold",
        })
    elif tx_in.amount >= 3000:
        factors.append({
            "factor": "Elevated Transfer Amount",
            "points": 20,
            "severity": "MEDIUM",
            "description": f"Transfer amount (${tx_in.amount:,.2f}) is above standard daily median",
        })
    elif tx_in.amount >= 1000:
        factors.append({
            "factor": "Moderate Transfer Size",
            "points": 10,
            "severity": "LOW",
            "description": f"Transfer size (${tx_in.amount:,.2f}) exceeds routine baseline",
        })

    # 3. Unfamiliar Hardware Device (+30)
    if tx_in.is_new_device:
        factors.append({
            "factor": "Unfamiliar Device",
            "points": 30,
            "severity": "HIGH",
            "description": f"Session originated from unverified hardware fingerprint ({tx_in.device_name})",
        })

    # 4. Unusual Geolocation / IP Mismatch (+25)
    if tx_in.is_unusual_location:
        factors.append({
            "factor": "Unusual Geolocation",
            "points": 25,
            "severity": "HIGH",
            "description": f"Access detected from anomalous geopolitical zone (IP: {tx_in.ip_address})",
        })

    # 5. Category-Specific Risk (+15)
    if tx_in.category.value in ["WITHDRAWAL", "INVESTMENT"] and tx_in.amount > 2000:
        factors.append({
            "factor": "High-Friction Category",
            "points": 15,
            "severity": "MEDIUM",
            "description": f"Higher risk associated with rapid asset offramping ({tx_in.category.value})",
        })

    return factors


def evaluate_adaptive_risk(tx_in: TransactionCreate) -> Tuple[int, RiskLevel, TransactionStatus, List[str]]:
    """
    Evaluates real-time adaptive risk based on transaction parameters,
    anomaly flags, and behavioral heuristics.
    """
    score = 8
    reasons: List[str] = []

    factors = calculate_explainable_risk_factors(tx_in)
    for f in factors:
        score += f["points"]
        reasons.append(f["description"])

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

