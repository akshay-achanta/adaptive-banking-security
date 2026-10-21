import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
import boto3
from botocore.exceptions import ClientError, BotoCoreError

from app.config import get_settings
from app.db.base import BaseRepository
from app.models import (
    Transaction,
    TransactionCreate,
    DashboardStats,
    UserContext,
    RiskDistribution,
    ActivityPoint,
    RiskLevel,
    TransactionStatus,
    TransactionCategory,
    SecurityPolicy,
    SecurityPolicyUpdate,
    EmergencyModeStatus,
    VerificationRecord,
    ScheduledTransaction,
    ScheduledTransactionCreate,
    NotificationItem,
    NotificationType,
    AuditEvent,
)
from app.ml.risk_service import get_risk_service

logger = logging.getLogger("adaptive_banking.dynamodb")


def dollars_to_cents(amount: float) -> int:
    d = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int(d * 100)


def cents_to_dollars(cents: int) -> float:
    return float(Decimal(cents) / Decimal(100))


def _to_decimal(val: Any) -> Any:
    if isinstance(val, float):
        return Decimal(str(val))
    if isinstance(val, dict):
        return {k: _to_decimal(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_to_decimal(v) for v in val]
    return val


def _from_decimal(val: Any) -> Any:
    if isinstance(val, Decimal):
        return float(val) if val % 1 else int(val)
    if isinstance(val, dict):
        return {k: _from_decimal(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_from_decimal(v) for v in val]
    return val


class DynamoDBRepository(BaseRepository):
    def __init__(self):
        settings = get_settings()
        session_kwargs = {"region_name": settings.AWS_REGION}

        if settings.DYNAMODB_ENDPOINT_URL:
            self.dynamodb = boto3.resource("dynamodb", endpoint_url=settings.DYNAMODB_ENDPOINT_URL, **session_kwargs)
        else:
            self.dynamodb = boto3.resource("dynamodb", **session_kwargs)

        self.table_transactions = self.dynamodb.Table(settings.DYNAMODB_TABLE_NAME)
        self.table_policies = self.dynamodb.Table(settings.DYNAMODB_POLICIES_TABLE)
        self.table_verifications = self.dynamodb.Table(settings.DYNAMODB_VERIFICATIONS_TABLE)
        self.table_scheduled = self.dynamodb.Table(settings.DYNAMODB_SCHEDULED_TABLE)
        self.table_notifications = self.dynamodb.Table(settings.DYNAMODB_NOTIFICATIONS_TABLE)
        self.table_audit = self.dynamodb.Table(settings.DYNAMODB_AUDIT_TABLE)

        # SQS and SNS client for async workflows and alerts
        try:
            self.sqs = boto3.client("sqs", **session_kwargs) if settings.SQS_QUEUE_URL else None
        except Exception:
            self.sqs = None

        try:
            self.sns = boto3.client("sns", **session_kwargs) if settings.SNS_TOPIC_ARN else None
        except Exception:
            self.sns = None

        self.sqs_queue_url = settings.SQS_QUEUE_URL
        self.sns_topic_arn = settings.SNS_TOPIC_ARN

    # --- 1. Transaction Lifecycle & Creation ---
    async def create_transaction(self, tx_in: TransactionCreate, user: UserContext) -> Transaction:
        # Idempotency check if idempotency key is provided
        if tx_in.idempotency_key:
            try:
                resp = self.table_transactions.get_item(Key={"id": f"idemp_{tx_in.idempotency_key}"})
                item = resp.get("Item")
                if item and "target_tx_id" in item:
                    cached = await self.get_transaction(item["target_tx_id"], user)
                    if cached:
                        return cached
            except Exception as e:
                logger.warning("Idempotency lookup failed: %s", e)

        amount_cents = dollars_to_cents(tx_in.amount)
        amount_dollars = cents_to_dollars(amount_cents)

        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        current_hour_utc = now.hour

        # Load policy & emergency mode
        policy = await self.get_security_policy(user.user_id)
        emergency_status = await self.get_emergency_mode(user.user_id)

        # Calculate daily spend in cents
        user_history, _ = await self.list_transactions(user, page=1, page_size=200)
        today_cents = 0
        for t in user_history:
            if t.category != TransactionCategory.DEPOSIT:
                try:
                    t_date = datetime.fromisoformat(t.created_at).date()
                    if t_date == now.date() and t.status in [
                        TransactionStatus.APPROVED,
                        TransactionStatus.COMPLETED,
                        TransactionStatus.PENDING_VERIFICATION,
                    ]:
                        today_cents += t.amount_cents
                except Exception:
                    pass

        # ML Risk Assessment
        risk_service = get_risk_service()
        ml_assessment = risk_service.assess_transaction(
            tx=tx_in,
            user_history=user_history,
            is_emergency_mode=emergency_status.is_active,
            daily_limit=cents_to_dollars(policy.daily_limit_cents),
            current_daily_spend=cents_to_dollars(today_cents),
        )

        final_score = ml_assessment.risk_score
        risk_level = ml_assessment.risk_level
        reasons = list(ml_assessment.assessment_reasons)
        factors = list(ml_assessment.risk_factors)

        # Deterministic Policy Checks
        is_blocked = False
        requires_verification = False
        block_reasons = []

        # Feature 1: New Beneficiary Detection & Cooling-Off Check
        prior_recipients = {t.recipient.strip().lower() for t in user_history}
        is_first_time_recip = tx_in.recipient.strip().lower() not in prior_recipients
        is_new_beneficiary = getattr(tx_in, "is_new_beneficiary", False) or is_first_time_recip
        cooling_off_active = False

        if is_new_beneficiary:
            new_beneficiary_limit = getattr(policy, "new_beneficiary_limit_cents", 100000)
            if amount_cents > new_beneficiary_limit:
                cooling_off_active = True
                requires_verification = True
                cooling_hours = getattr(policy, "cooling_off_period_hours", 24)
                reasons.append(
                    f"NEW BENEFICIARY COOLING-OFF: Initial transfer to newly added recipient exceeding "
                    f"${cents_to_dollars(new_beneficiary_limit):,.2f} requires step-up verification and {cooling_hours}h cooling-off window."
                )

        if emergency_status.is_active:
            is_blocked = True
            block_reasons.append("EMERGENCY MODE ACTIVE: All outgoing transactions are halted by user security lockdown.")

        if tx_in.category in policy.restricted_categories:
            is_blocked = True
            block_reasons.append(f"SECURITY POLICY: Category '{tx_in.category.value}' is restricted on this account.")

        if not (policy.permitted_start_hour <= current_hour_utc <= policy.permitted_end_hour):
            is_blocked = True
            block_reasons.append(f"SECURITY POLICY: Transaction submitted outside permitted hours ({policy.permitted_start_hour}:00 to {policy.permitted_end_hour}:00 UTC).")

        if amount_cents > policy.max_single_amount_cents:
            is_blocked = True
            max_dlr = cents_to_dollars(policy.max_single_amount_cents)
            block_reasons.append(f"SECURITY POLICY: Amount (${amount_dollars:,.2f}) exceeds maximum single-transaction limit (${max_dlr:,.2f}).")

        if (today_cents + amount_cents) > policy.daily_limit_cents:
            is_blocked = True
            daily_dlr = cents_to_dollars(policy.daily_limit_cents)
            block_reasons.append(f"SECURITY POLICY: Transaction would exceed daily spending limit (${daily_dlr:,.2f}).")

        if not is_blocked and final_score >= policy.verification_risk_threshold:
            requires_verification = True
            reasons.append(f"Policy Trigger: Risk score {final_score} meets or exceeds customer verification threshold ({policy.verification_risk_threshold}).")

        lifecycle_history = [
            {"status": "CREATED", "timestamp": now_str, "actor": user.user_id}
        ]

        if is_blocked:
            status = TransactionStatus.BLOCKED
            reasons = block_reasons + reasons
            lifecycle_history.append({"status": "BLOCKED", "timestamp": now_str, "reason": "; ".join(block_reasons)})
        elif requires_verification:
            status = TransactionStatus.PENDING_VERIFICATION
            lifecycle_history.append({"status": "PENDING_VERIFICATION", "timestamp": now_str, "reason": "Requires customer step-up verification"})
        else:
            status = TransactionStatus.APPROVED
            lifecycle_history.append({"status": "APPROVED", "timestamp": now_str, "actor": "SYSTEM_POLICY_ENGINE"})

        tx_id = f"tx_{uuid.uuid4().hex[:12]}"

        item_data = {
            "id": tx_id,
            "user_id": user.user_id,
            "amount_cents": amount_cents,
            "amount": amount_dollars,
            "currency": tx_in.currency.upper(),
            "recipient": tx_in.recipient,
            "category": tx_in.category.value,
            "status": status.value,
            "risk_level": risk_level.value,
            "risk_score": final_score,
            "risk_reasons": reasons,
            "risk_factors": factors,
            "is_new_beneficiary": is_new_beneficiary,
            "cooling_off_active": cooling_off_active,
            "created_at": now_str,
            "notes": tx_in.notes or "",
            "metadata": {
                "ip": tx_in.ip_address or "127.0.0.1",
                "device": tx_in.device_name or "Web Client",
                "is_unusual_location": tx_in.is_unusual_location,
                "is_new_device": tx_in.is_new_device,
                "idempotency_key": tx_in.idempotency_key,
            },
            "lifecycle_history": lifecycle_history,
        }

        try:
            self.table_transactions.put_item(Item=_to_decimal(item_data))
            if tx_in.idempotency_key:
                self.table_transactions.put_item(
                    Item=_to_decimal({"id": f"idemp_{tx_in.idempotency_key}", "target_tx_id": tx_id, "user_id": user.user_id})
                )
        except (ClientError, BotoCoreError) as e:
            logger.error("DynamoDB put_item failed: %s", e)
            raise RuntimeError(f"DynamoDB put_item failed: {e}")

        tx = Transaction(
            id=tx_id,
            user_id=user.user_id,
            amount_cents=amount_cents,
            amount=amount_dollars,
            currency=tx_in.currency.upper(),
            recipient=tx_in.recipient,
            category=tx_in.category,
            status=status,
            risk_level=risk_level,
            risk_score=final_score,
            risk_reasons=reasons,
            risk_factors=factors,
            is_new_beneficiary=is_new_beneficiary,
            cooling_off_active=cooling_off_active,
            created_at=now_str,
            notes=tx_in.notes,
            metadata=item_data["metadata"],
            lifecycle_history=lifecycle_history,
        )

        # Audit event
        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            action="TRANSACTION_CREATE",
            resource_id=tx_id,
            outcome=status.value,
            timestamp=now_str,
            details={"amount": amount_dollars, "recipient": tx_in.recipient, "risk_score": final_score},
        ))

        # Verification challenge if required
        if requires_verification:
            await self.create_verification_record(tx)

        # SNS notification if configured and critical risk
        if self.sns and self.sns_topic_arn and (risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL] or is_blocked):
            try:
                self.sns.publish(
                    TopicArn=self.sns_topic_arn,
                    Subject=f"Adaptive Banking Alert: Transaction {tx_id} [{status.value}]",
                    Message=f"Transaction {tx_id} for ${amount_dollars:.2f} to {tx_in.recipient} was flagged with status {status.value}. Risk Score: {final_score}.",
                )
            except Exception as e:
                logger.warning("SNS publish failed: %s", e)

        return tx

    async def get_transaction(self, transaction_id: str, user: UserContext) -> Optional[Transaction]:
        try:
            resp = self.table_transactions.get_item(Key={"id": transaction_id})
            item = resp.get("Item")
            if not item:
                return None
            clean_item = _from_decimal(item)
            tx = Transaction(**clean_item)
            if tx.user_id != user.user_id and user.role != "admin":
                return None
            return tx
        except (ClientError, BotoCoreError) as e:
            logger.error("DynamoDB get_transaction error: %s", e)
            raise RuntimeError(f"DynamoDB get_item failed: {e}")

    async def list_transactions(
        self,
        user: UserContext,
        page: int = 1,
        page_size: int = 10,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Transaction], int]:
        try:
            resp = self.table_transactions.scan()
            items = [_from_decimal(i) for i in resp.get("Items", []) if not i.get("id", "").startswith("idemp_")]
        except (ClientError, BotoCoreError) as e:
            logger.error("DynamoDB scan failed: %s", e)
            raise RuntimeError(f"DynamoDB scan failed: {e}")

        records = [
            Transaction(**t) for t in items
            if t.get("user_id") == user.user_id or user.role == "admin"
        ]

        if status and status.upper() != "ALL":
            records = [t for t in records if t.status.value.upper() == status.upper()]

        if search:
            q = search.lower().strip()
            records = [
                t for t in records
                if q in t.recipient.lower()
                or q in t.id.lower()
                or (t.notes and q in t.notes.lower())
                or q in t.category.value.lower()
            ]

        records.sort(key=lambda x: x.created_at, reverse=True)
        total = len(records)
        start = (page - 1) * page_size
        return records[start:start + page_size], total

    async def get_dashboard_stats(self, user: UserContext) -> DashboardStats:
        txs, _ = await self.list_transactions(user, page=1, page_size=500)
        simulated_balance = 84520.0
        for tx in txs:
            if tx.status in [TransactionStatus.APPROVED, TransactionStatus.COMPLETED]:
                if tx.category == TransactionCategory.DEPOSIT:
                    simulated_balance += tx.amount
                else:
                    simulated_balance -= tx.amount

        pending_txs = sum(1 for t in txs if t.status in [TransactionStatus.PENDING, TransactionStatus.PENDING_VERIFICATION])
        flagged_alerts = sum(1 for t in txs if t.status in [TransactionStatus.FLAGGED, TransactionStatus.BLOCKED])
        high_risk_alerts = sum(1 for t in txs if t.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL])

        dist = RiskDistribution(
            low=sum(1 for t in txs if t.risk_level == RiskLevel.LOW),
            medium=sum(1 for t in txs if t.risk_level == RiskLevel.MEDIUM),
            high=sum(1 for t in txs if t.risk_level == RiskLevel.HIGH),
            critical=sum(1 for t in txs if t.risk_level == RiskLevel.CRITICAL),
        )

        recent = txs[:5]
        trend_map: Dict[str, Dict[str, float]] = {}
        for i in range(6, -1, -1):
            d_str = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%b %d")
            trend_map[d_str] = {"amount": 0.0, "count": 0}

        for tx in txs:
            try:
                tx_date = datetime.fromisoformat(tx.created_at).strftime("%b %d")
                if tx_date in trend_map:
                    trend_map[tx_date]["amount"] += tx.amount
                    trend_map[tx_date]["count"] += 1
            except Exception:
                pass

        activity_trend = [
            ActivityPoint(date=k, amount=round(v["amount"], 2), count=int(v["count"]))
            for k, v in trend_map.items()
        ]

        return DashboardStats(
            simulated_balance=round(simulated_balance, 2),
            total_transactions=len(txs),
            pending_transactions=pending_txs,
            flagged_alerts=flagged_alerts,
            high_risk_alerts=high_risk_alerts,
            risk_distribution=dist,
            recent_transactions=recent,
            activity_trend=activity_trend,
        )

    # --- 2. Customer Security Policy Management ---
    async def get_security_policy(self, user_id: str) -> SecurityPolicy:
        try:
            resp = self.table_policies.get_item(Key={"user_id": user_id})
            item = resp.get("Item")
            if item:
                clean = _from_decimal(item)
                return SecurityPolicy(**clean)
        except Exception as e:
            logger.warning("Could not read policy from DynamoDB: %s. Using default.", e)

        # Default policy
        default_pol = SecurityPolicy(
            user_id=user_id,
            max_single_amount_cents=500000,
            daily_limit_cents=1500000,
            permitted_start_hour=0,
            permitted_end_hour=23,
            restricted_categories=[],
            verification_risk_threshold=65,
            notification_channels=["IN_APP"],
            currency="USD",
            timezone="UTC",
        )
        try:
            self.table_policies.put_item(Item=_to_decimal(default_pol.model_dump()))
        except Exception:
            pass
        return default_pol

    async def update_security_policy(self, user_id: str, update: SecurityPolicyUpdate) -> SecurityPolicy:
        policy = await self.get_security_policy(user_id)
        if update.max_single_amount is not None:
            policy.max_single_amount_cents = dollars_to_cents(update.max_single_amount)
        if update.daily_limit is not None:
            policy.daily_limit_cents = dollars_to_cents(update.daily_limit)
        if update.permitted_start_hour is not None:
            policy.permitted_start_hour = update.permitted_start_hour
        if update.permitted_end_hour is not None:
            policy.permitted_end_hour = update.permitted_end_hour
        if update.restricted_categories is not None:
            policy.restricted_categories = update.restricted_categories
        if update.verification_risk_threshold is not None:
            policy.verification_risk_threshold = update.verification_risk_threshold
        if update.notification_channels is not None:
            policy.notification_channels = update.notification_channels

        dump = policy.model_dump()
        dump["restricted_categories"] = [c.value if hasattr(c, "value") else c for c in policy.restricted_categories]
        try:
            self.table_policies.put_item(Item=_to_decimal(dump))
        except (ClientError, BotoCoreError) as e:
            logger.error("Failed to update policy in DynamoDB: %s", e)
            raise RuntimeError(f"DynamoDB put_item failed: {e}")

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            action="POLICY_UPDATE",
            resource_id=user_id,
            outcome="SUCCESS",
            timestamp=datetime.now(timezone.utc).isoformat(),
            details={"max_single_cents": policy.max_single_amount_cents, "daily_cents": policy.daily_limit_cents},
        ))
        return policy

    # --- 3. Emergency Mode ---
    async def get_emergency_mode(self, user_id: str) -> EmergencyModeStatus:
        try:
            resp = self.table_policies.get_item(Key={"user_id": f"emergency_{user_id}"})
            item = resp.get("Item")
            if item:
                return EmergencyModeStatus(**_from_decimal(item))
        except Exception:
            pass
        return EmergencyModeStatus(user_id=user_id, is_active=False)

    async def set_emergency_mode(self, user_id: str, activate: bool, reason: str, actor: str) -> EmergencyModeStatus:
        now_str = datetime.now(timezone.utc).isoformat()
        status = EmergencyModeStatus(
            user_id=user_id,
            is_active=activate,
            activated_at=now_str if activate else None,
            activated_by=actor if activate else None,
            reason=reason if activate else None,
        )
        try:
            item_data = status.model_dump()
            item_data["user_id"] = f"emergency_{user_id}"
            self.table_policies.put_item(Item=_to_decimal(item_data))
        except Exception as e:
            logger.error("DynamoDB emergency mode write failed: %s", e)

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            action="EMERGENCY_MODE_ACTIVATE" if activate else "EMERGENCY_MODE_DEACTIVATE",
            resource_id=user_id,
            outcome="SUCCESS",
            timestamp=now_str,
            details={"actor": actor, "reason": reason},
        ))
        return status

    # --- 4. Verification Workflow ---
    async def create_verification_record(self, tx: Transaction) -> VerificationRecord:
        now = datetime.now(timezone.utc)
        record = VerificationRecord(
            id=f"verif_{uuid.uuid4().hex[:10]}",
            transaction_id=tx.id,
            user_id=tx.user_id,
            status="PENDING",
            risk_score=tx.risk_score,
            risk_reasons=tx.risk_reasons or ["Requires two-factor authorization"],
            created_at=now.isoformat(),
            expires_at=(now + timedelta(hours=24)).isoformat(),
        )
        try:
            self.table_verifications.put_item(Item=_to_decimal(record.model_dump()))
        except Exception as e:
            logger.error("DynamoDB verifications write failed: %s", e)
        return record

    async def list_verifications(self, user_id: str, status: Optional[str] = None) -> List[VerificationRecord]:
        try:
            resp = self.table_verifications.scan()
            items = [_from_decimal(i) for i in resp.get("Items", [])]
            records = [VerificationRecord(**i) for i in items if i.get("user_id") == user_id]
            if status:
                records = [r for r in records if r.status.upper() == status.upper()]
            records.sort(key=lambda x: x.created_at, reverse=True)
            return records
        except Exception:
            return []

    async def decide_verification(
        self, verification_id: str, decision: str, reason: str, user: UserContext
    ) -> Tuple[VerificationRecord, Transaction]:
        try:
            resp = self.table_verifications.get_item(Key={"id": verification_id})
            item = resp.get("Item")
            if not item:
                raise ValueError(f"Verification challenge '{verification_id}' not found")

            rec = VerificationRecord(**_from_decimal(item))
            if rec.user_id != user.user_id and user.role != "admin":
                raise PermissionError("Access denied: You cannot decide another user's verification")

            if rec.status != "PENDING":
                raise ValueError(f"Verification already decided: Status is {rec.status}")

            now = datetime.now(timezone.utc)
            if now > datetime.fromisoformat(rec.expires_at):
                rec.status = "EXPIRED"
                self.table_verifications.put_item(Item=_to_decimal(rec.model_dump()))
                raise ValueError("Verification challenge has expired")

            decision_clean = decision.upper()
            if decision_clean not in ["APPROVED", "REJECTED"]:
                raise ValueError(f"Invalid decision '{decision}'. Must be APPROVED or REJECTED")

            rec.status = decision_clean
            rec.decision_notes = reason
            rec.decided_at = now.isoformat()
            rec.decided_by = user.user_id

            # Conditional write to prevent concurrency conflicts
            self.table_verifications.put_item(
                Item=_to_decimal(rec.model_dump()),
                ConditionExpression="attribute_exists(id)",
            )

            # Update underlying transaction
            tx = await self.get_transaction(rec.transaction_id, user)
            if tx:
                new_status = TransactionStatus.APPROVED if decision_clean == "APPROVED" else TransactionStatus.REJECTED
                tx.status = new_status
                tx.lifecycle_history.append({
                    "status": new_status.value,
                    "timestamp": now.isoformat(),
                    "actor": user.user_id,
                    "reason": reason,
                })
                tx_dump = tx.model_dump()
                tx_dump["category"] = tx.category.value
                tx_dump["status"] = tx.status.value
                tx_dump["risk_level"] = tx.risk_level.value
                self.table_transactions.put_item(Item=_to_decimal(tx_dump))

            await self.record_audit_event(AuditEvent(
                id=f"audit_{uuid.uuid4().hex[:10]}",
                user_id=user.user_id,
                action=f"VERIFICATION_{decision_clean}",
                resource_id=rec.transaction_id,
                outcome="SUCCESS",
                timestamp=now.isoformat(),
                details={"verification_id": verification_id, "reason": reason},
            ))

            return rec, tx
        except (ClientError, BotoCoreError) as e:
            logger.error("DynamoDB decide_verification error: %s", e)
            raise RuntimeError(f"DynamoDB error: {e}")

    # --- 5. Scheduled Transactions ---
    async def create_scheduled_transaction(
        self, payload: ScheduledTransactionCreate, user: UserContext
    ) -> ScheduledTransaction:
        cents = dollars_to_cents(payload.amount)
        item = ScheduledTransaction(
            id=f"sched_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            amount_cents=cents,
            amount=cents_to_dollars(cents),
            currency=payload.currency.upper(),
            recipient=payload.recipient,
            category=payload.category,
            execution_time=payload.execution_time,
            status="SCHEDULED",
            description=payload.description,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        try:
            dump = item.model_dump()
            dump["category"] = item.category.value
            self.table_scheduled.put_item(Item=_to_decimal(dump))
        except Exception as e:
            logger.error("DynamoDB scheduled put_item failed: %s", e)
            raise RuntimeError(f"DynamoDB error: {e}")
        return item

    async def list_scheduled_transactions(self, user_id: str) -> List[ScheduledTransaction]:
        try:
            resp = self.table_scheduled.scan()
            items = [_from_decimal(i) for i in resp.get("Items", [])]
            records = [ScheduledTransaction(**i) for i in items if i.get("user_id") == user_id]
            records.sort(key=lambda x: x.execution_time)
            return records
        except Exception:
            return []

    async def cancel_scheduled_transaction(self, scheduled_id: str, user: UserContext) -> ScheduledTransaction:
        try:
            resp = self.table_scheduled.get_item(Key={"id": scheduled_id})
            item = resp.get("Item")
            if not item:
                raise ValueError("Scheduled transaction not found")
            sched = ScheduledTransaction(**_from_decimal(item))
            if sched.user_id != user.user_id and user.role != "admin":
                raise PermissionError("Access denied")
            sched.status = "CANCELLED"
            dump = sched.model_dump()
            dump["category"] = sched.category.value
            self.table_scheduled.put_item(Item=_to_decimal(dump))
            return sched
        except (ClientError, BotoCoreError) as e:
            raise RuntimeError(f"DynamoDB error: {e}")

    async def execute_scheduled_transaction(
        self, scheduled_id: str, user: UserContext
    ) -> Tuple[ScheduledTransaction, Transaction]:
        sched_items = await self.list_scheduled_transactions(user.user_id)
        sched = next((s for s in sched_items if s.id == scheduled_id), None)
        if not sched:
            raise ValueError(f"Scheduled transaction '{scheduled_id}' not found")
        if sched.status != "SCHEDULED":
            raise ValueError(f"Cannot execute transaction with status {sched.status}")

        tx_create = TransactionCreate(
            amount=sched.amount,
            currency=sched.currency,
            recipient=sched.recipient,
            category=sched.category,
            notes=f"Auto-executed scheduled transaction ({sched.description or ''})",
        )
        tx = await self.create_transaction(tx_create, user)
        sched.status = "EXECUTED" if tx.status in [TransactionStatus.APPROVED, TransactionStatus.COMPLETED] else "FAILED"
        dump = sched.model_dump()
        dump["category"] = sched.category.value
        self.table_scheduled.put_item(Item=_to_decimal(dump))
        return sched, tx

    # --- 6. In-App Notifications ---
    async def add_notification(self, item: NotificationItem) -> NotificationItem:
        try:
            dump = item.model_dump()
            dump["type"] = item.type.value if hasattr(item.type, "value") else item.type
            self.table_notifications.put_item(Item=_to_decimal(dump))
        except Exception as e:
            logger.warning("Could not persist notification in DynamoDB: %s", e)
        return item

    async def list_notifications(self, user_id: str, unread_only: bool = False) -> List[NotificationItem]:
        try:
            resp = self.table_notifications.scan()
            items = [_from_decimal(i) for i in resp.get("Items", [])]
            records = [NotificationItem(**i) for i in items if i.get("user_id") == user_id]
            if unread_only:
                records = [r for r in records if not r.is_read]
            records.sort(key=lambda x: x.created_at, reverse=True)
            return records
        except Exception:
            return []

    async def mark_notifications_read(self, user_id: str) -> int:
        notifs = await self.list_notifications(user_id, unread_only=True)
        count = len(notifs)
        for n in notifs:
            n.is_read = True
            try:
                dump = n.model_dump()
                dump["type"] = n.type.value if hasattr(n.type, "value") else n.type
                self.table_notifications.put_item(Item=_to_decimal(dump))
            except Exception:
                pass
        return count

    # --- 7. Security Audit History ---
    async def record_audit_event(self, event: AuditEvent) -> AuditEvent:
        try:
            self.table_audit.put_item(Item=_to_decimal(event.model_dump()))
        except Exception as e:
            logger.warning("Could not persist audit event in DynamoDB: %s", e)
        return event

    async def list_audit_events(self, user_id: str, limit: int = 50) -> List[AuditEvent]:
        try:
            resp = self.table_audit.scan()
            items = [_from_decimal(i) for i in resp.get("Items", [])]
            records = [AuditEvent(**i) for i in items if i.get("user_id") == user_id]
            records.sort(key=lambda x: x.timestamp, reverse=True)
            return records[:limit]
        except Exception:
            return []

    async def report_suspicious_recipient(
        self,
        user: UserContext,
        recipient: str,
        reason: str,
        details: Optional[str] = None,
    ) -> Dict[str, Any]:
        audit_id = f"audit_{uuid.uuid4().hex[:10]}"
        now_str = datetime.now(timezone.utc).isoformat()
        await self.record_audit_event(AuditEvent(
            id=audit_id,
            user_id=user.user_id,
            action="REPORT_SUSPICIOUS_RECIPIENT",
            resource_id=f"recipient:{recipient}",
            outcome="FLAGGED",
            timestamp=now_str,
            details={"recipient": recipient, "reason": reason, "details": details},
        ))

        notif = NotificationItem(
            id=f"notif_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            type=NotificationType.SECURITY_ALERT,
            title="Suspicious Recipient Reported",
            message=f"You reported '{recipient}' ({reason}). It has been added to your protection watchlist and flagged for fraud operations review.",
            created_at=now_str,
            metadata={"recipient": recipient, "reason": reason},
        )
        await self.add_notification(notif)

        return {
            "status": "reported",
            "recipient": recipient,
            "message": f"Recipient '{recipient}' successfully reported and flagged for fraud investigation.",
        }

