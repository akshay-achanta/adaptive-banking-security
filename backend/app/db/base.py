from abc import ABC, abstractmethod
from typing import Optional, List, Tuple
from app.models import (
    Transaction,
    TransactionCreate,
    DashboardStats,
    UserContext,
    SecurityPolicy,
    SecurityPolicyUpdate,
    EmergencyModeStatus,
    VerificationRecord,
    ScheduledTransaction,
    ScheduledTransactionCreate,
    NotificationItem,
    AuditEvent,
)


class BaseRepository(ABC):
    @abstractmethod
    async def create_transaction(self, tx_in: TransactionCreate, user: UserContext) -> Transaction:
        """Create a new transaction with lifecycle validation & policy enforcement."""
        pass

    @abstractmethod
    async def get_transaction(self, transaction_id: str, user: UserContext) -> Optional[Transaction]:
        """Retrieve a single transaction with user ownership validation."""
        pass

    @abstractmethod
    async def list_transactions(
        self,
        user: UserContext,
        page: int = 1,
        page_size: int = 10,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Transaction], int]:
        """List transactions with filtering, search and pagination."""
        pass

    @abstractmethod
    async def get_dashboard_stats(self, user: UserContext) -> DashboardStats:
        """Retrieve simulated balance, risk counts and metrics."""
        pass

    # --- Day 3 Customer Security Policies ---
    @abstractmethod
    async def get_security_policy(self, user_id: str) -> SecurityPolicy:
        """Retrieve active security policy for a user."""
        pass

    @abstractmethod
    async def update_security_policy(self, user_id: str, update: SecurityPolicyUpdate) -> SecurityPolicy:
        """Update and persist security policies for a user."""
        pass

    # --- Day 3 Emergency Mode ---
    @abstractmethod
    async def get_emergency_mode(self, user_id: str) -> EmergencyModeStatus:
        """Retrieve emergency mode status for a user."""
        pass

    @abstractmethod
    async def set_emergency_mode(self, user_id: str, activate: bool, reason: str, actor: str) -> EmergencyModeStatus:
        """Toggle emergency mode state with audit tracking."""
        pass

    # --- Day 3 Verification Workflow ---
    @abstractmethod
    async def create_verification_record(self, tx: Transaction) -> VerificationRecord:
        """Create a pending verification challenge for a high-risk or policy-held transaction."""
        pass

    @abstractmethod
    async def list_verifications(self, user_id: str, status: Optional[str] = None) -> List[VerificationRecord]:
        """List verification challenges for a user."""
        pass

    @abstractmethod
    async def decide_verification(
        self, verification_id: str, decision: str, reason: str, user: UserContext
    ) -> Tuple[VerificationRecord, Transaction]:
        """Concurrency-safe decision (APPROVE or REJECT) for a verification challenge."""
        pass

    # --- Day 3 Scheduled Transactions ---
    @abstractmethod
    async def create_scheduled_transaction(
        self, payload: ScheduledTransactionCreate, user: UserContext
    ) -> ScheduledTransaction:
        """Create and queue a scheduled transaction."""
        pass

    @abstractmethod
    async def list_scheduled_transactions(self, user_id: str) -> List[ScheduledTransaction]:
        """List pending and executed scheduled transactions."""
        pass

    @abstractmethod
    async def cancel_scheduled_transaction(self, scheduled_id: str, user: UserContext) -> ScheduledTransaction:
        """Cancel a pending scheduled transaction."""
        pass

    @abstractmethod
    async def execute_scheduled_transaction(self, scheduled_id: str, user: UserContext) -> Tuple[ScheduledTransaction, Transaction]:
        """Execute a scheduled transaction with current policy and emergency mode rechecks."""
        pass

    # --- Day 3 Notifications ---
    @abstractmethod
    async def add_notification(self, item: NotificationItem) -> NotificationItem:
        """Push an in-app security notification."""
        pass

    @abstractmethod
    async def list_notifications(self, user_id: str, unread_only: bool = False) -> List[NotificationItem]:
        """List user notifications."""
        pass

    @abstractmethod
    async def mark_notifications_read(self, user_id: str) -> int:
        """Mark all unread notifications as read."""
        pass

    # --- Day 3 Audit History ---
    @abstractmethod
    async def record_audit_event(self, event: AuditEvent) -> AuditEvent:
        """Record an immutable security audit event."""
        pass

    @abstractmethod
    async def list_audit_events(self, user_id: str, limit: int = 50) -> List[AuditEvent]:
        """Retrieve recent security audit logs."""
        pass
