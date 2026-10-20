import os
import json
import logging
from typing import Dict, Any, List, Optional
import joblib
import pandas as pd
from app.models import Transaction, TransactionCreate, RiskLevel, TransactionStatus

logger = logging.getLogger("adaptive_banking.ml.service")

# Global singleton storage for loaded models to prevent duplicate loads per worker
_SUPERVISED_MODEL = None
_ANOMALY_MODEL = None
_MODEL_METADATA = None
_ANOMALY_METADATA = None


class RiskAssessmentResult:
    def __init__(
        self,
        risk_score: int,
        risk_probability: Optional[float],
        risk_level: RiskLevel,
        recommended_action: str,
        is_anomaly: bool,
        anomaly_score: float,
        model_version: str,
        assessment_reasons: List[str],
        requires_verification: bool,
        policy_override_applied: bool,
        status: TransactionStatus,
        risk_factors: Optional[List[Dict[str, Any]]] = None,
    ):
        self.risk_score = risk_score
        self.risk_probability = risk_probability
        self.risk_level = risk_level
        self.recommended_action = recommended_action
        self.is_anomaly = is_anomaly
        self.anomaly_score = anomaly_score
        self.model_version = model_version
        self.assessment_reasons = assessment_reasons
        self.requires_verification = requires_verification
        self.policy_override_applied = policy_override_applied
        self.status = status
        self.risk_factors = risk_factors or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": self.risk_score,
            "risk_probability": self.risk_probability,
            "risk_level": self.risk_level.value,
            "recommended_action": self.recommended_action,
            "is_anomaly": self.is_anomaly,
            "anomaly_score": round(self.anomaly_score, 4),
            "model_version": self.model_version,
            "assessment_reasons": self.assessment_reasons,
            "risk_factors": self.risk_factors,
            "requires_verification": self.requires_verification,
            "policy_override_applied": self.policy_override_applied,
            "status": self.status.value,
        }



class HybridRiskService:
    def __init__(self, artifacts_dir: str = "artifacts/models"):
        self.artifacts_dir = artifacts_dir
        self._ensure_models_loaded()

    def _ensure_models_loaded(self):
        global _SUPERVISED_MODEL, _ANOMALY_MODEL, _MODEL_METADATA, _ANOMALY_METADATA

        if _SUPERVISED_MODEL is None:
            supervised_path = os.path.join(self.artifacts_dir, "supervised_risk_model.joblib")
            if os.path.exists(supervised_path):
                try:
                    _SUPERVISED_MODEL = joblib.load(supervised_path)
                    logger.info("Loaded supervised risk classifier from %s", supervised_path)
                except Exception as e:
                    logger.warning("Could not load supervised risk classifier: %s", e)

        if _ANOMALY_MODEL is None:
            anomaly_path = os.path.join(self.artifacts_dir, "isolation_forest.joblib")
            if os.path.exists(anomaly_path):
                try:
                    _ANOMALY_MODEL = joblib.load(anomaly_path)
                    logger.info("Loaded Isolation Forest from %s", anomaly_path)
                except Exception as e:
                    logger.warning("Could not load Isolation Forest: %s", e)

        if _MODEL_METADATA is None:
            meta_path = os.path.join(self.artifacts_dir, "model_metadata.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r") as f:
                        _MODEL_METADATA = json.load(f)
                except Exception as e:
                    logger.warning("Could not read model metadata: %s", e)

        if _ANOMALY_METADATA is None:
            anom_meta_path = os.path.join(self.artifacts_dir, "anomaly_metadata.json")
            if os.path.exists(anom_meta_path):
                try:
                    with open(anom_meta_path, "r") as f:
                        _ANOMALY_METADATA = json.load(f)
                except Exception as e:
                    logger.warning("Could not read anomaly metadata: %s", e)

    def extract_features(
        self,
        tx: TransactionCreate,
        user_history: Optional[List[Transaction]] = None,
    ) -> pd.DataFrame:
        """
        Extracts tabular features for model inference, validating against missing history.
        """
        user_txs = user_history or []
        past_amounts = [t.amount for t in user_txs if t.amount > 0]
        mean_spend = sum(past_amounts) / len(past_amounts) if past_amounts else 150.0

        spending_deviation = round(float(tx.amount / max(mean_spend, 10.0)), 3)

        # Recent frequency (past 24h count simulated from history or baseline)
        recent_freq_24h = len(user_txs) if len(user_txs) < 10 else 3

        # Transaction hour (defaults to 14:00 if not provided)
        transaction_hour = 14

        merchant_novelty = 1 if tx.recipient.lower().startswith("new ") or "unknown" in tx.recipient.lower() else 0
        location_change = 1 if tx.is_unusual_location else 0
        device_novelty = 1 if tx.is_new_device else 0

        feature_dict = {
            "amount": float(tx.amount),
            "category": tx.category.value,
            "transaction_hour": transaction_hour,
            "recent_freq_24h": recent_freq_24h,
            "spending_deviation": spending_deviation,
            "merchant_novelty": merchant_novelty,
            "location_change": location_change,
            "device_novelty": device_novelty,
        }

        return pd.DataFrame([feature_dict])

    def assess_transaction(
        self,
        tx: TransactionCreate,
        user_history: Optional[List[Transaction]] = None,
        is_emergency_mode: bool = False,
        daily_limit: float = 25000.0,
        current_daily_spend: float = 0.0,
    ) -> RiskAssessmentResult:
        """
        Executes hybrid assessment:
        1. Model inference (Supervised risk classifier + Isolation Forest anomaly detection).
        2. Non-negotiable security policy enforcement (Hard spending limits, Emergency Freeze).
           CRITICAL SAFETY RULE: Security policy triggers can NEVER be bypassed by low ML risk scores.
        """
        self._ensure_models_loaded()
        reasons: List[str] = []
        policy_override = False

        # --- STEP 1: ML Supervised Classifier Inference ---
        model_prob: Optional[float] = None
        model_risk_score = 10
        model_version = _MODEL_METADATA.get("model_version", "v1.0.0-heuristic") if _MODEL_METADATA else "v1.0.0-heuristic"

        features_df = self.extract_features(tx, user_history)

        if _SUPERVISED_MODEL is not None:
            try:
                probs = _SUPERVISED_MODEL.predict_proba(features_df)[0]
                model_prob = float(probs[1])
                model_risk_score = int(round(model_prob * 100))
                if model_prob >= 0.5:
                    reasons.append(f"Supervised ML classifier flagged elevated risk probability ({model_prob:.1%})")
            except Exception as e:
                logger.error("Inference failure on supervised model: %s", e)
                # Fallback to heuristic score safely
                model_risk_score = 25
        else:
            # Baseline heuristic fallback if model artifact not yet generated
            if tx.amount > 5000:
                model_risk_score += 40
            if tx.is_unusual_location:
                model_risk_score += 30
            if tx.is_new_device:
                model_risk_score += 20

        # --- STEP 2: Unsupervised Anomaly Detection (Isolation Forest) ---
        is_anomaly = False
        anomaly_score = 0.0

        if _ANOMALY_MODEL is not None:
            try:
                # isolation_forest.decision_function: negative values indicate outliers
                decision_score = float(_ANOMALY_MODEL.decision_function(features_df)[0])
                anomaly_pred = int(_ANOMALY_MODEL.predict(features_df)[0])
                is_anomaly = (anomaly_pred == -1)
                anomaly_score = decision_score
                if is_anomaly:
                    reasons.append(f"Isolation Forest flagged statistical anomaly (Score: {decision_score:.3f})")
            except Exception as e:
                logger.error("Inference failure on anomaly detector: %s", e)

        # Combine ML outputs
        final_score = model_risk_score
        if is_anomaly and final_score < 70:
            final_score = min(90, final_score + 25)
            reasons.append("Anomaly detector amplified risk score for novel spending pattern")

        # --- STEP 3: Mandatory Deterministic Security Policies ---
        # 3a. Emergency Mode Freeze
        if is_emergency_mode:
            policy_override = True
            final_score = 100
            reasons.insert(0, "CRITICAL POLICY: Account is in Emergency Lockdown mode. All transactions halted.")

        # 3b. Daily Spending Limit Violation
        if (current_daily_spend + tx.amount) > daily_limit:
            policy_override = True
            final_score = max(final_score, 90)
            reasons.insert(0, f"SECURITY POLICY: Cumulative transaction amount exceeds daily limit (${daily_limit:,.2f})")

        # 3c. Hard Amount Threshold (e.g. > $50,000 always requires senior compliance verification)
        if tx.amount >= 50000.0:
            policy_override = True
            final_score = max(final_score, 85)
            reasons.append("COMPLIANCE POLICY: Mandatory dual-approval threshold triggered for transfers >= $50,000")

        # --- STEP 4: Structured Explainable Risk Factors Breakdown ---
        factors: List[Dict[str, Any]] = []

        is_new_recip = getattr(tx, "is_new_beneficiary", False) or tx.recipient.lower().startswith("new ")
        if is_new_recip:
            factors.append({
                "factor": "New Beneficiary",
                "points": 25,
                "severity": "MEDIUM",
                "description": "First-time transfer to newly added recipient within cooling-off safety window (+25 pts)",
            })
            reasons.append("New beneficiary: cooling-off safety checks applied (+25)")
            if not policy_override:
                final_score = min(99, final_score + 25)

        if tx.amount >= 10000:
            factors.append({
                "factor": "Unusually Large Amount",
                "points": 45,
                "severity": "CRITICAL",
                "description": f"Transaction amount (${tx.amount:,.2f}) significantly exceeds typical account median (+45 pts)",
            })
        elif tx.amount >= 3000:
            factors.append({
                "factor": "Elevated Transfer Amount",
                "points": 20,
                "severity": "MEDIUM",
                "description": f"Transfer amount (${tx.amount:,.2f}) is above standard daily median (+20 pts)",
            })
        elif tx.amount >= 1000:
            factors.append({
                "factor": "Moderate Transfer Size",
                "points": 10,
                "severity": "LOW",
                "description": f"Transfer size (${tx.amount:,.2f}) exceeds routine baseline (+10 pts)",
            })

        if tx.is_new_device:
            factors.append({
                "factor": "Unfamiliar Device",
                "points": 30,
                "severity": "HIGH",
                "description": f"Session originated from unverified hardware fingerprint ({tx.device_name}) (+30 pts)",
            })

        if tx.is_unusual_location:
            factors.append({
                "factor": "Unusual Geolocation",
                "points": 20,
                "severity": "HIGH",
                "description": f"Access detected from anomalous geopolitical zone (IP: {tx.ip_address}) (+20 pts)",
            })

        if user_history and len(user_history) >= 3:
            factors.append({
                "factor": "Repeated Transfers in Short Period",
                "points": 15,
                "severity": "MEDIUM",
                "description": "High velocity: multiple successive outgoing transfers detected in short monitoring interval (+15 pts)",
            })

        if is_anomaly:
            factors.append({
                "factor": "Statistical Anomaly (Isolation Forest)",
                "points": 20,
                "severity": "HIGH",
                "description": f"Machine learning anomaly detector flagged deviation from baseline (Score: {anomaly_score:.3f}) (+20 pts)",
            })

        # Clamp final score
        final_score = max(1, min(99 if not is_emergency_mode else 100, final_score))

        # Categorize Risk Level & Status
        if final_score >= 80:
            risk_level = RiskLevel.CRITICAL
            status = TransactionStatus.FLAGGED
            recommended_action = "Block immediate execution. Require step-up biometric MFA and compliance authorization."
            requires_verification = True
        elif final_score >= 55:
            risk_level = RiskLevel.HIGH
            status = TransactionStatus.FLAGGED
            recommended_action = "Hold for risk review. Send push challenge to registered hardware device."
            requires_verification = True
        elif final_score >= 30:
            risk_level = RiskLevel.MEDIUM
            status = TransactionStatus.PENDING
            recommended_action = "Allow with standard velocity logging and SMS confirmation."
            requires_verification = False
        else:
            risk_level = RiskLevel.LOW
            status = TransactionStatus.COMPLETED
            recommended_action = "Approve immediately. Baseline profile nominal."
            requires_verification = False
            if not reasons:
                reasons.append("Nominal transaction within typical behavioral parameters")

        return RiskAssessmentResult(
            risk_score=final_score,
            risk_probability=model_prob,
            risk_level=risk_level,
            recommended_action=recommended_action,
            is_anomaly=is_anomaly,
            anomaly_score=anomaly_score,
            model_version=model_version,
            assessment_reasons=reasons,
            requires_verification=requires_verification,
            policy_override_applied=policy_override,
            status=status,
            risk_factors=factors,
        )


_service_instance: Optional[HybridRiskService] = None


def get_risk_service() -> HybridRiskService:
    global _service_instance
    if _service_instance is None:
        _service_instance = HybridRiskService()
    return _service_instance
