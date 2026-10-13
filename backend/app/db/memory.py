import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
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


def dollars_to_cents(amount: float) -> int:
    d = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int(d * 100)


def cents_to_dollars(cents: int) -> float:
    return float(Decimal(cents) / Decimal(100))


class InMemoryRepository(BaseRepository):
    def __init__(self):
        self._transactions: Dict[str, Transaction] = {}
        self._policies: Dict[str, SecurityPolicy] = {}
        self._emergency_modes: Dict[str, EmergencyModeStatus] = {}
        self._verifications: Dict[str, VerificationRecord] = {}
        self._scheduled: Dict[str, ScheduledTransaction] = {}
        self._notifications: List[NotificationItem] = []
        self._audit_logs: List[AuditEvent] = []
        self._idempotency_cache: Dict[str, str] = {}  # key -> tx_id

        self._seed_initial_data()

    def _seed_initial_data(self):
        now = datetime.now(timezone.utc)
        user_id = "demo-user-001"

        # Default policy for demo user
        self._policies[user_id] = SecurityPolicy(
            user_id=user_id,
            max_single_amount_cents=500000,    # $5,000.00 max single
            daily_limit_cents=1500000,          # $15,000.00 daily limit
            permitted_start_hour=0,
            permitted_end_hour=23,
            restricted_categories=[],
            verification_risk_threshold=65,
            notification_channels=["IN_APP"],
            currency="USD",
            timezone="UTC",
        )

        # Emergency mode off
        self._emergency_modes[user_id] = EmergencyModeStatus(
            user_id=user_id,
            is_active=False,
        )

        seed_samples = [
            {
                "id": "tx_mock_101",
                "user_id": user_id,
                "amount_cents": 1250000,
                "amount": 12500.0,
                "currency": "USD",
                "recipient": "Offshore Capital Holdings LLC",
                "category": TransactionCategory.TRANSFER,
                "status": TransactionStatus.BLOCKED,
                "risk_level": RiskLevel.CRITICAL,
                "risk_score": 92,
                "risk_reasons": [
                    "Large transaction amount exceeds standard velocity threshold",
                    "Access detected from unrecognized geopolitical zone (IP: 185.220.101.4)",
                    "Blocked: Exceeds user maximum single-transaction limit ($5,000.00)",
                ],
                "created_at": (now - timedelta(minutes=14)).isoformat(),
                "notes": "Wire transfer requested to newly added external bank beneficiary",
                "metadata": {"ip": "185.220.101.4", "device": "Unknown Linux Tor Browser", "location": "Bucharest, RO"},
                "lifecycle_history": [
                    {"status": "CREATED", "timestamp": (now - timedelta(minutes=14)).isoformat(), "actor": user_id},
                    {"status": "BLOCKED", "timestamp": (now - timedelta(minutes=14)).isoformat(), "reason": "Single transaction limit policy"},
                ],
            },
            {
                "id": "tx_mock_102",
                "user_id": user_id,
                "amount_cents": 420000,
                "amount": 4200.0,
                "currency": "USD",
                "recipient": "Apex Digital Assets Exchange",
                "category": TransactionCategory.INVESTMENT,
                "status": TransactionStatus.PENDING_VERIFICATION,
                "risk_level": RiskLevel.HIGH,
                "risk_score": 67,
                "risk_reasons": [
                    "Elevated transfer amount above typical daily median",
                    "Session originated from unverified hardware fingerprint",
                    "Triggered verification challenge: Risk score 67 >= policy threshold 65",
                ],
                "created_at": (now - timedelta(hours=2, minutes=30)).isoformat(),
                "notes": "Crypto liquidity provider top-up",
                "metadata": {"ip": "93.184.216.34", "device": "iPhone 15 Pro (Safari)", "location": "Sydney, AU"},
                "lifecycle_history": [
                    {"status": "CREATED", "timestamp": (now - timedelta(hours=2, minutes=30)).isoformat(), "actor": user_id},
                    {"status": "PENDING_VERIFICATION", "timestamp": (now - timedelta(hours=2, minutes=30)).isoformat(), "reason": "Step-up authorization required"},
                ],
            },
            {
                "id": "tx_mock_103",
                "user_id": user_id,
                "amount_cents": 85000,
                "amount": 850.0,
                "currency": "USD",
                "recipient": "Cloud Hosting & Telecom Sydney",
                "category": TransactionCategory.PAYMENT,
                "status": TransactionStatus.APPROVED,
                "risk_level": RiskLevel.MEDIUM,
                "risk_score": 35,
                "risk_reasons": ["Amount exceeds soft threshold for payment category"],
                "created_at": (now - timedelta(hours=5)).isoformat(),
                "notes": "Infrastructure monthly server invoice",
                "metadata": {"ip": "110.145.20.10", "device": "MacBook Air M2", "location": "Melbourne, AU"},
                "lifecycle_history": [
                    {"status": "CREATED", "timestamp": (now - timedelta(hours=5)).isoformat(), "actor": user_id},
                    {"status": "APPROVED", "timestamp": (now - timedelta(hours=5)).isoformat(), "actor": user_id},
                ],
            },
            {
                "id": "tx_mock_104",
                "user_id": user_id,
                "amount_cents": 32050,
                "amount": 320.50,
                "currency": "USD",
                "recipient": "Amazon Web Services AP-SE-2",
                "category": TransactionCategory.PAYMENT,
                "status": TransactionStatus.APPROVED,
                "risk_level": RiskLevel.LOW,
                "risk_score": 8,
                "risk_reasons": ["Clean transaction baseline; passed all behavioral telemetry checks"],
                "created_at": (now - timedelta(days=1, hours=3)).isoformat(),
                "notes": "Cloud infrastructure compute charge",
                "metadata": {"ip": "110.145.20.10", "device": "Trusted Workstation", "location": "Sydney, AU"},
                "lifecycle_history": [
                    {"status": "CREATED", "timestamp": (now - timedelta(days=1, hours=3)).isoformat(), "actor": user_id},
                    {"status": "APPROVED", "timestamp": (now - timedelta(days=1, hours=3)).isoformat(), "actor": user_id},
                ],
            },
            {
                "id": "tx_mock_105",
                "user_id": user_id,
                "amount_cents": 2500000,
                "amount": 25000.0,
                "currency": "USD",
                "recipient": "Payroll Inbound Deposit",
                "category": TransactionCategory.DEPOSIT,
                "status": TransactionStatus.APPROVED,
                "risk_level": RiskLevel.LOW,
                "risk_score": 5,
                "risk_reasons": ["Verified corporate ACH deposit"],
                "created_at": (now - timedelta(days=2)).isoformat(),
                "notes": "Bi-weekly executive compensation",
                "metadata": {"ip": "127.0.0.1", "device": "Automated ACH Clearinghouse", "location": "Sydney, AU"},
                "lifecycle_history": [
                    {"status": "CREATED", "timestamp": (now - timedelta(days=2)).isoformat(), "actor": user_id},
                    {"status": "APPROVED", "timestamp": (now - timedelta(days=2)).isoformat(), "actor": "ACH_SYSTEM"},
                ],
            },
        ]

        for s in seed_samples:
            tx = Transaction(**s)
            self._transactions[tx.id] = tx

        # Seed verification challenge for tx_mock_102
        v_id = "verif_mock_102"
        self._verifications[v_id] = VerificationRecord(
            id=v_id,
            transaction_id="tx_mock_102",
            user_id=user_id,
            status="PENDING",
            risk_score=67,
            risk_reasons=["Risk score 67 >= policy threshold 65"],
            created_at=(now - timedelta(hours=2, minutes=30)).isoformat(),
            expires_at=(now + timedelta(hours=21, minutes=30)).isoformat(),
        )

        # Seed scheduled transaction
        sched_id = "sched_mock_001"
        self._scheduled[sched_id] = ScheduledTransaction(
            id=sched_id,
            user_id=user_id,
            amount_cents=120000,
            amount=1200.0,
            currency="USD",
            recipient="Sydney Data Center Lease",
            category=TransactionCategory.PAYMENT,
            execution_time=(now + timedelta(days=3)).isoformat(),
            status="SCHEDULED",
            description="Recurring facility lease payment",
            created_at=(now - timedelta(days=1)).isoformat(),
        )

        # Seed initial audit log
        self._audit_logs.append(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            action="SYSTEM_INIT",
            resource_id="BANKING_CORE",
            outcome="SUCCESS",
            timestamp=now.isoformat(),
            details={"version": "1.3.0", "engine": "Day 3 Security & Workflow Engine"},
        ))

    async def create_transaction(self, tx_in: TransactionCreate, user: UserContext) -> Transaction:
        # 1. Idempotency Check
        if tx_in.idempotency_key:
            if tx_in.idempotency_key in self._idempotency_cache:
                cached_id = self._idempotency_cache[tx_in.idempotency_key]
                cached_tx = self._transactions.get(cached_id)
                if cached_tx:
                    return cached_tx

        # Safe monetary integer representation in cents
        amount_cents = dollars_to_cents(tx_in.amount)
        amount_dollars = cents_to_dollars(amount_cents)

        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        current_hour_utc = now.hour

        # 2. Fetch Customer Security Policy & Emergency Mode
        policy = await self.get_security_policy(user.user_id)
        emergency_status = await self.get_emergency_mode(user.user_id)

        # 3. Calculate current daily spend in cents
        user_history = [
            t for t in self._transactions.values()
            if t.user_id == user.user_id and t.category != TransactionCategory.DEPOSIT
        ]
        # Sum transactions from today
        today_cents = 0
        for t in user_history:
            try:
                t_date = datetime.fromisoformat(t.created_at).date()
                if t_date == now.date() and t.status in [TransactionStatus.APPROVED, TransactionStatus.COMPLETED, TransactionStatus.PENDING_VERIFICATION]:
                    today_cents += t.amount_cents
            except Exception:
                pass

        # 4. Run ML Risk Assessment via Hybrid Risk Service
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

        # 5. Deterministic Security Policy Enforcement
        is_blocked = False
        requires_verification = False
        block_reasons = []

        # Policy 5a: Emergency Mode Freeze
        if emergency_status.is_active:
            is_blocked = True
            block_reasons.append("EMERGENCY MODE ACTIVE: All outgoing transactions are halted by user security lockdown.")

        # Policy 5b: Restricted Categories
        if tx_in.category in policy.restricted_categories:
            is_blocked = True
            block_reasons.append(f"SECURITY POLICY: Category '{tx_in.category.value}' is restricted on this account.")

        # Policy 5c: Permitted Transaction Hours
        if not (policy.permitted_start_hour <= current_hour_utc <= policy.permitted_end_hour):
            is_blocked = True
            block_reasons.append(f"SECURITY POLICY: Transaction submitted outside permitted hours ({policy.permitted_start_hour}:00 to {policy.permitted_end_hour}:00 UTC).")

        # Policy 5d: Maximum Single Transaction Amount
        if amount_cents > policy.max_single_amount_cents:
            is_blocked = True
            max_dlr = cents_to_dollars(policy.max_single_amount_cents)
            block_reasons.append(f"SECURITY POLICY: Amount (${amount_dollars:,.2f}) exceeds maximum single-transaction limit (${max_dlr:,.2f}).")

        # Policy 5e: Daily Spending Limit
        if (today_cents + amount_cents) > policy.daily_limit_cents:
            is_blocked = True
            daily_dlr = cents_to_dollars(policy.daily_limit_cents)
            block_reasons.append(f"SECURITY POLICY: Transaction would exceed daily spending limit (${daily_dlr:,.2f}).")

        # Policy 5f: Risk Score Verification Threshold
        if not is_blocked:
            if final_score >= policy.verification_risk_threshold:
                requires_verification = True
                reasons.append(f"Policy Trigger: Risk score {final_score} meets or exceeds customer verification threshold ({policy.verification_risk_threshold}).")

        # 6. Determine Lifecycle Status
        lifecycle_history = [
            {"status": "CREATED", "timestamp": now_str, "actor": user.user_id}
        ]

        if is_blocked:
            status = TransactionStatus.BLOCKED
            final_reasons = block_reasons + reasons
            lifecycle_history.append({"status": "BLOCKED", "timestamp": now_str, "reasons": block_reasons})
        elif requires_verification:
            status = TransactionStatus.PENDING_VERIFICATION
            final_reasons = reasons
            lifecycle_history.append({"status": "PENDING_VERIFICATION", "timestamp": now_str, "reasons": ["Awaiting user MFA/biometric approval"]})
        else:
            status = TransactionStatus.APPROVED
            final_reasons = reasons
            lifecycle_history.append({"status": "APPROVED", "timestamp": now_str, "actor": "SYSTEM_POLICY"})

        tx_id = f"tx_{uuid.uuid4().hex[:12]}"

        tx = Transaction(
            id=tx_id,
            user_id=user.user_id,
            amount_cents=amount_cents,
            amount=amount_dollars,
            currency=policy.currency,
            recipient=tx_in.recipient,
            category=tx_in.category,
            status=status,
            risk_level=risk_level,
            risk_score=final_score,
            risk_reasons=final_reasons,
            created_at=now_str,
            updated_at=now_str,
            notes=tx_in.notes,
            metadata={
                "ip": tx_in.ip_address or "127.0.0.1",
                "device": tx_in.device_name or "Web Client",
                "is_unusual_location": tx_in.is_unusual_location,
                "is_new_device": tx_in.is_new_device,
                "policy_timezone": policy.timezone,
                "idempotency_key": tx_in.idempotency_key,
            },
            lifecycle_history=lifecycle_history,
        )

        self._transactions[tx.id] = tx

        if tx_in.idempotency_key:
            self._idempotency_cache[tx_in.idempotency_key] = tx.id

        # 7. Record Audit Event
        outcome = "BLOCKED" if is_blocked else ("CHALLENGED" if requires_verification else "SUCCESS")
        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            action="TRANSACTION_SUBMIT",
            resource_id=tx.id,
            outcome=outcome,
            timestamp=now_str,
            details={
                "amount": amount_dollars,
                "recipient": tx.recipient,
                "status": status.value,
                "risk_score": final_score,
            },
        ))

        # 8. Create Verification Record if held
        if requires_verification:
            await self.create_verification_record(tx)

        # 9. Notify user where applicable
        if is_blocked:
            await self.add_notification(NotificationItem(
                id=f"notif_{uuid.uuid4().hex[:10]}",
                user_id=user.user_id,
                type=NotificationType.SECURITY_ALERT,
                title="Transaction Blocked by Security Policy",
                message=f"Attempted ${amount_dollars:,.2f} transfer to {tx.recipient} was blocked. Reason: {block_reasons[0]}",
                created_at=now_str,
                metadata={"transaction_id": tx.id},
            ))
        elif requires_verification:
            await self.add_notification(NotificationItem(
                id=f"notif_{uuid.uuid4().hex[:10]}",
                user_id=user.user_id,
                type=NotificationType.VERIFICATION_REQUIRED,
                title="Action Required: Verify Transaction",
                message=f"Transfer of ${amount_dollars:,.2f} to {tx.recipient} requires your confirmation (Risk: {final_score}/100).",
                created_at=now_str,
                metadata={"transaction_id": tx.id},
            ))

        return tx

    async def get_transaction(self, transaction_id: str, user: UserContext) -> Optional[Transaction]:
        tx = self._transactions.get(transaction_id)
        if not tx:
            return None
        if tx.user_id != user.user_id and user.role != "admin":
            return None
        return tx

    async def list_transactions(
        self,
        user: UserContext,
        page: int = 1,
        page_size: int = 10,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Transaction], int]:
        records = [
            t for t in self._transactions.values()
            if t.user_id == user.user_id or user.role == "admin"
        ]

        if status and status.upper() != "ALL":
            # Support both new and legacy status strings
            st_upper = status.upper()
            records = [t for t in records if t.status.value.upper() == st_upper or (st_upper == "PENDING" and t.status == TransactionStatus.PENDING_VERIFICATION)]

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
        end = start + page_size
        return records[start:end], total

    async def get_dashboard_stats(self, user: UserContext) -> DashboardStats:
        user_txs = [
            t for t in self._transactions.values()
            if t.user_id == user.user_id or user.role == "admin"
        ]

        simulated_balance = 84520.0
        for tx in user_txs:
            if tx.status in [TransactionStatus.APPROVED, TransactionStatus.COMPLETED]:
                if tx.category == TransactionCategory.DEPOSIT:
                    simulated_balance += tx.amount
                else:
                    simulated_balance -= tx.amount

        total_txs = len(user_txs)
        pending_txs = sum(1 for t in user_txs if t.status in [TransactionStatus.PENDING, TransactionStatus.PENDING_VERIFICATION])
        flagged_alerts = sum(1 for t in user_txs if t.status in [TransactionStatus.FLAGGED, TransactionStatus.BLOCKED])
        high_risk_alerts = sum(1 for t in user_txs if t.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL])

        dist = RiskDistribution(
            low=sum(1 for t in user_txs if t.risk_level == RiskLevel.LOW),
            medium=sum(1 for t in user_txs if t.risk_level == RiskLevel.MEDIUM),
            high=sum(1 for t in user_txs if t.risk_level == RiskLevel.HIGH),
            critical=sum(1 for t in user_txs if t.risk_level == RiskLevel.CRITICAL),
        )

        sorted_txs = sorted(user_txs, key=lambda x: x.created_at, reverse=True)
        recent = sorted_txs[:5]

        trend_map: Dict[str, Dict[str, float]] = {}
        for i in range(6, -1, -1):
            d_str = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%b %d")
            trend_map[d_str] = {"amount": 0.0, "count": 0}

        for tx in user_txs:
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
            total_transactions=total_txs,
            pending_transactions=pending_txs,
            flagged_alerts=flagged_alerts,
            high_risk_alerts=high_risk_alerts,
            risk_distribution=dist,
            recent_transactions=recent,
            activity_trend=activity_trend,
        )

    # --- Day 3 Customer Security Policies ---
    async def get_security_policy(self, user_id: str) -> SecurityPolicy:
        if user_id not in self._policies:
            self._policies[user_id] = SecurityPolicy(
                user_id=user_id,
                max_single_amount_cents=500000,
                daily_limit_cents=1500000,
                permitted_start_hour=0,
                permitted_end_hour=23,
                restricted_categories=[],
                verification_risk_threshold=65,
                notification_channels=["IN_APP"],
            )
        return self._policies[user_id]

    async def update_security_policy(self, user_id: str, update: SecurityPolicyUpdate) -> SecurityPolicy:
        policy = await self.get_security_policy(user_id)
        data = policy.model_dump()

        if update.max_single_amount is not None:
            data["max_single_amount_cents"] = dollars_to_cents(update.max_single_amount)
        if update.daily_limit is not None:
            data["daily_limit_cents"] = dollars_to_cents(update.daily_limit)
        if update.permitted_start_hour is not None:
            data["permitted_start_hour"] = update.permitted_start_hour
        if update.permitted_end_hour is not None:
            data["permitted_end_hour"] = update.permitted_end_hour
        if update.restricted_categories is not None:
            data["restricted_categories"] = update.restricted_categories
        if update.verification_risk_threshold is not None:
            data["verification_risk_threshold"] = update.verification_risk_threshold
        if update.notification_channels is not None:
            data["notification_channels"] = update.notification_channels

        updated = SecurityPolicy(**data)
        self._policies[user_id] = updated

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            action="SECURITY_POLICY_UPDATE",
            resource_id=f"policy_{user_id}",
            outcome="SUCCESS",
            timestamp=datetime.now(timezone.utc).isoformat(),
            details={"updated_fields": list(update.model_dump(exclude_unset=True).keys())},
        ))

        await self.add_notification(NotificationItem(
            id=f"notif_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            type=NotificationType.POLICY_UPDATE,
            title="Security Policy Updated",
            message="Your account security restrictions and daily limits have been updated.",
            created_at=datetime.now(timezone.utc).isoformat(),
        ))

        return updated

    # --- Day 3 Emergency Mode ---
    async def get_emergency_mode(self, user_id: str) -> EmergencyModeStatus:
        if user_id not in self._emergency_modes:
            self._emergency_modes[user_id] = EmergencyModeStatus(user_id=user_id, is_active=False)
        return self._emergency_modes[user_id]

    async def set_emergency_mode(self, user_id: str, activate: bool, reason: str, actor: str) -> EmergencyModeStatus:
        now_str = datetime.now(timezone.utc).isoformat()
        current = await self.get_emergency_mode(user_id)

        status = EmergencyModeStatus(
            user_id=user_id,
            is_active=activate,
            activated_at=now_str if activate else None,
            activated_by=actor if activate else None,
            reason=reason if activate else None,
        )
        self._emergency_modes[user_id] = status

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            action="EMERGENCY_MODE_ACTIVATED" if activate else "EMERGENCY_MODE_DEACTIVATED",
            resource_id=f"emergency_{user_id}",
            outcome="SUCCESS",
            timestamp=now_str,
            details={"actor": actor, "reason": reason, "is_active": activate},
        ))

        await self.add_notification(NotificationItem(
            id=f"notif_{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            type=NotificationType.EMERGENCY_MODE,
            title="Emergency Mode Activated" if activate else "Emergency Mode Deactivated",
            message=f"Account emergency lockdown is now {'ACTIVE. All simulated outgoing transfers halted.' if activate else 'OFF. Normal security policies restored.'}",
            created_at=now_str,
        ))

        return status

    # --- Day 3 Verification Workflow ---
    async def create_verification_record(self, tx: Transaction) -> VerificationRecord:
        now = datetime.now(timezone.utc)
        v_id = f"verif_{uuid.uuid4().hex[:10]}"
        record = VerificationRecord(
            id=v_id,
            transaction_id=tx.id,
            user_id=tx.user_id,
            status="PENDING",
            risk_score=tx.risk_score,
            risk_reasons=tx.risk_reasons,
            created_at=now.isoformat(),
            expires_at=(now + timedelta(hours=24)).isoformat(),
        )
        self._verifications[v_id] = record
        return record

    async def list_verifications(self, user_id: str, status: Optional[str] = None) -> List[VerificationRecord]:
        records = [v for v in self._verifications.values() if v.user_id == user_id]
        if status:
            records = [v for v in records if v.status.upper() == status.upper()]
        records.sort(key=lambda x: x.created_at, reverse=True)
        return records

    async def decide_verification(
        self, verification_id: str, decision: str, reason: str, user: UserContext
    ) -> Tuple[VerificationRecord, Transaction]:
        record = self._verifications.get(verification_id)
        if not record:
            raise ValueError(f"Verification challenge {verification_id} not found.")

        # Ownership check
        if record.user_id != user.user_id and user.role != "admin":
            raise PermissionError("Unauthorized: Only the authorized transaction owner may decide this challenge.")

        # Concurrency & Idempotency check: Cannot decide twice
        if record.status != "PENDING":
            raise ValueError(f"Verification already decided: current status is '{record.status}'. Conflicting transition rejected.")

        # Timeout check
        now = datetime.now(timezone.utc)
        if now > datetime.fromisoformat(record.expires_at):
            record.status = "EXPIRED"
            raise ValueError("Verification challenge has expired. Transaction cannot be approved.")

        tx = self._transactions.get(record.transaction_id)
        if not tx:
            raise ValueError(f"Target transaction {record.transaction_id} not found.")

        now_str = now.isoformat()
        dec = decision.upper()

        if dec == "APPROVE":
            record.status = "APPROVED"
            tx.status = TransactionStatus.APPROVED
            tx.lifecycle_history.append({"status": "APPROVED", "timestamp": now_str, "actor": user.user_id, "reason": reason})
        elif dec == "REJECT":
            record.status = "REJECTED"
            tx.status = TransactionStatus.REJECTED
            tx.lifecycle_history.append({"status": "REJECTED", "timestamp": now_str, "actor": user.user_id, "reason": reason})
        else:
            raise ValueError(f"Invalid decision '{decision}'. Expected APPROVE or REJECT.")

        record.decided_at = now_str
        record.decided_by = user.user_id
        record.decision_reason = reason
        tx.updated_at = now_str

        # Record Audit Event
        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            action="VERIFICATION_DECISION",
            resource_id=record.id,
            outcome=dec,
            timestamp=now_str,
            details={"transaction_id": tx.id, "decision": dec, "reason": reason},
        ))

        # Push Notification
        await self.add_notification(NotificationItem(
            id=f"notif_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            type=NotificationType.VERIFICATION_DECISION,
            title=f"Transaction {dec.title()}d",
            message=f"Transaction {tx.id} for ${tx.amount:,.2f} has been {dec.lower()}d.",
            created_at=now_str,
            metadata={"transaction_id": tx.id, "verification_id": record.id},
        ))

        return record, tx

    # --- Day 3 Scheduled Transactions ---
    async def create_scheduled_transaction(
        self, payload: ScheduledTransactionCreate, user: UserContext
    ) -> ScheduledTransaction:
        now = datetime.now(timezone.utc)
        s_id = f"sched_{uuid.uuid4().hex[:10]}"
        amount_cents = dollars_to_cents(payload.amount)

        item = ScheduledTransaction(
            id=s_id,
            user_id=user.user_id,
            amount_cents=amount_cents,
            amount=cents_to_dollars(amount_cents),
            currency=payload.currency,
            recipient=payload.recipient,
            category=payload.category,
            execution_time=payload.execution_time,
            status="SCHEDULED",
            description=payload.description,
            created_at=now.isoformat(),
        )
        self._scheduled[s_id] = item

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            action="SCHEDULED_TRANSACTION_CREATE",
            resource_id=s_id,
            outcome="SUCCESS",
            timestamp=now.isoformat(),
            details={"recipient": payload.recipient, "amount": payload.amount, "execution_time": payload.execution_time},
        ))

        await self.add_notification(NotificationItem(
            id=f"notif_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            type=NotificationType.SCHEDULED_TX,
            title="Scheduled Transaction Created",
            message=f"Payment of ${payload.amount:,.2f} to {payload.recipient} scheduled for {payload.execution_time}.",
            created_at=now.isoformat(),
            metadata={"scheduled_id": s_id},
        ))

        return item

    async def list_scheduled_transactions(self, user_id: str) -> List[ScheduledTransaction]:
        items = [s for s in self._scheduled.values() if s.user_id == user_id]
        items.sort(key=lambda x: x.execution_time)
        return items

    async def cancel_scheduled_transaction(self, scheduled_id: str, user: UserContext) -> ScheduledTransaction:
        item = self._scheduled.get(scheduled_id)
        if not item:
            raise ValueError(f"Scheduled transaction {scheduled_id} not found.")
        if item.user_id != user.user_id and user.role != "admin":
            raise PermissionError("Unauthorized to cancel scheduled transaction.")
        if item.status != "SCHEDULED":
            raise ValueError(f"Cannot cancel: scheduled transaction status is '{item.status}'.")

        item.status = "CANCELLED"

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            action="SCHEDULED_TRANSACTION_CANCEL",
            resource_id=scheduled_id,
            outcome="SUCCESS",
            timestamp=datetime.now(timezone.utc).isoformat(),
            details={"recipient": item.recipient, "amount": item.amount},
        ))

        return item

    async def execute_scheduled_transaction(
        self, scheduled_id: str, user: UserContext
    ) -> Tuple[ScheduledTransaction, Transaction]:
        item = self._scheduled.get(scheduled_id)
        if not item:
            raise ValueError(f"Scheduled transaction {scheduled_id} not found.")
        if item.user_id != user.user_id and user.role != "admin":
            raise PermissionError("Unauthorized to execute scheduled transaction.")
        if item.status != "SCHEDULED":
            raise ValueError(f"Cannot execute: scheduled transaction is already '{item.status}'.")

        now_str = datetime.now(timezone.utc).isoformat()

        # Re-check CURRENT security policies and emergency mode at execution time!
        tx_create = TransactionCreate(
            amount=item.amount,
            currency=item.currency,
            recipient=item.recipient,
            category=item.category,
            notes=f"Scheduled execution: {item.description or ''}",
        )

        executed_tx = await self.create_transaction(tx_create, user)

        if executed_tx.status == TransactionStatus.BLOCKED:
            item.status = "FAILED"
            item.failure_reason = "Blocked by security policy at execution time."
        else:
            item.status = "EXECUTED"
            item.executed_at = now_str
            item.execution_tx_id = executed_tx.id

        await self.record_audit_event(AuditEvent(
            id=f"audit_{uuid.uuid4().hex[:10]}",
            user_id=user.user_id,
            action="SCHEDULED_TRANSACTION_EXECUTE",
            resource_id=scheduled_id,
            outcome=item.status,
            timestamp=now_str,
            details={"tx_id": executed_tx.id, "status": executed_tx.status.value},
        ))

        return item, executed_tx

    # --- Day 3 Notifications ---
    async def add_notification(self, item: NotificationItem) -> NotificationItem:
        self._notifications.insert(0, item)
        return item

    async def list_notifications(self, user_id: str, unread_only: bool = False) -> List[NotificationItem]:
        items = [n for n in self._notifications if n.user_id == user_id]
        if unread_only:
            items = [n for n in items if not n.is_read]
        return items

    async def mark_notifications_read(self, user_id: str) -> int:
        count = 0
        for n in self._notifications:
            if n.user_id == user_id and not n.is_read:
                n.is_read = True
                count += 1
        return count

    # --- Day 3 Audit History ---
    async def record_audit_event(self, event: AuditEvent) -> AuditEvent:
        self._audit_logs.insert(0, event)
        return event

    async def list_audit_events(self, user_id: str, limit: int = 50) -> List[AuditEvent]:
        items = [a for a in self._audit_logs if a.user_id == user_id or user_id == "admin"]
        return items[:limit]
