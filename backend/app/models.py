from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TransactionStatus(str, Enum):
    CREATED = "CREATED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    # Legacy backwards compatibility synonyms
    COMPLETED = "COMPLETED"
    PENDING = "PENDING"
    FLAGGED = "FLAGGED"


class TransactionCategory(str, Enum):
    TRANSFER = "TRANSFER"
    PAYMENT = "PAYMENT"
    WITHDRAWAL = "WITHDRAWAL"
    DEPOSIT = "DEPOSIT"
    INVESTMENT = "INVESTMENT"


# --- Day 3 Customer Security Policies & Emergency Mode ---

class SecurityPolicy(BaseModel):
    user_id: str
    max_single_amount_cents: int = Field(default=500000, description="Max single transaction in integer cents ($5,000.00)")
    daily_limit_cents: int = Field(default=1500000, description="Daily cumulative spend limit in integer cents ($15,000.00)")
    permitted_start_hour: int = Field(default=6, ge=0, le=23, description="Permitted transaction start hour (0-23 UTC)")
    permitted_end_hour: int = Field(default=23, ge=0, le=23, description="Permitted transaction end hour (0-23 UTC)")
    restricted_categories: List[TransactionCategory] = Field(default_factory=list, description="Categories prohibited by user policy")
    verification_risk_threshold: int = Field(default=65, ge=0, le=100, description="Risk score threshold requiring step-up approval")
    cooling_off_period_hours: int = Field(default=24, ge=1, le=168, description="Cooling-off safety window in hours for new beneficiaries")
    new_beneficiary_limit_cents: int = Field(default=100000, description="Max amount in cents ($1,000.00) without 2FA during cooling-off")
    notification_channels: List[str] = Field(default=["IN_APP"], description="Channels: IN_APP, EMAIL, SMS")
    currency: str = Field(default="USD", min_length=3, max_length=3)
    timezone: str = Field(default="UTC")


class SecurityPolicyUpdate(BaseModel):
    max_single_amount: Optional[float] = Field(default=None, gt=0, description="Max single transaction in dollars")
    daily_limit: Optional[float] = Field(default=None, gt=0, description="Daily limit in dollars")
    permitted_start_hour: Optional[int] = Field(default=None, ge=0, le=23)
    permitted_end_hour: Optional[int] = Field(default=None, ge=0, le=23)
    restricted_categories: Optional[List[TransactionCategory]] = None
    verification_risk_threshold: Optional[int] = Field(default=None, ge=0, le=100)
    cooling_off_period_hours: Optional[int] = Field(default=None, ge=1, le=168)
    new_beneficiary_limit: Optional[float] = Field(default=None, gt=0)
    notification_channels: Optional[List[str]] = None


class EmergencyModeStatus(BaseModel):
    user_id: str
    is_active: bool = False
    activated_at: Optional[str] = None
    activated_by: Optional[str] = None
    reason: Optional[str] = None


class EmergencyModeRequest(BaseModel):
    activate: bool
    reason: Optional[str] = Field(default="User initiated security lockdown", max_length=200)


# --- Day 3 Verification Workflow ---

class VerificationDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class VerificationDecisionRequest(BaseModel):
    decision: VerificationDecision
    reason: Optional[str] = Field(default=None, max_length=250)


class VerificationRecord(BaseModel):
    id: str
    transaction_id: str
    user_id: str
    status: str  # PENDING, APPROVED, REJECTED, EXPIRED
    risk_score: int
    risk_reasons: List[str]
    created_at: str
    expires_at: str
    decided_at: Optional[str] = None
    decided_by: Optional[str] = None
    decision_reason: Optional[str] = None


# --- Day 3 Scheduled Transactions ---

class ScheduledTransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    recipient: str = Field(..., min_length=2, max_length=100)
    category: TransactionCategory = Field(default=TransactionCategory.PAYMENT)
    execution_time: str = Field(..., description="ISO 8601 UTC timestamp")
    description: Optional[str] = Field(default=None, max_length=250)
    is_recurring: bool = False


class ScheduledTransaction(BaseModel):
    id: str
    user_id: str
    amount_cents: int
    amount: float
    currency: str
    recipient: str
    category: TransactionCategory
    execution_time: str
    status: str  # SCHEDULED, EXECUTED, CANCELLED, FAILED
    description: Optional[str] = None
    created_at: str
    executed_at: Optional[str] = None
    execution_tx_id: Optional[str] = None
    failure_reason: Optional[str] = None


# --- Day 3 Notifications & Audit Events ---

class NotificationType(str, Enum):
    SECURITY_ALERT = "SECURITY_ALERT"
    VERIFICATION_REQUIRED = "VERIFICATION_REQUIRED"
    VERIFICATION_DECISION = "VERIFICATION_DECISION"
    EMERGENCY_MODE = "EMERGENCY_MODE"
    POLICY_UPDATE = "POLICY_UPDATE"
    SCHEDULED_TX = "SCHEDULED_TX"


class NotificationItem(BaseModel):
    id: str
    user_id: str
    type: NotificationType
    title: str
    message: str
    created_at: str
    is_read: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AuditEvent(BaseModel):
    id: str
    user_id: str
    action: str
    resource_id: str
    outcome: str  # SUCCESS, BLOCKED, FAILED, CHALLENGED
    correlation_id: Optional[str] = None
    timestamp: str
    details: Dict[str, Any] = Field(default_factory=dict)


# --- Core Transaction Schemas ---

class RiskFactor(BaseModel):
    factor: str
    points: int
    severity: str = "INFO"  # INFO, LOW, MEDIUM, HIGH, CRITICAL
    description: str


class ReportRecipientRequest(BaseModel):
    recipient: str = Field(..., min_length=2, max_length=100)
    reason: str = Field(..., min_length=3, max_length=200)
    details: Optional[str] = Field(default=None, max_length=500)


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in USD, must be greater than zero")
    currency: str = Field(default="USD", min_length=3, max_length=3)
    recipient: str = Field(..., min_length=2, max_length=100, description="Recipient or merchant name")
    category: TransactionCategory = Field(default=TransactionCategory.TRANSFER)
    notes: Optional[str] = Field(default=None, max_length=250)
    idempotency_key: Optional[str] = Field(default=None, max_length=100)

    # Simulation, New Beneficiary & Adaptive Risk attributes
    is_new_beneficiary: bool = Field(default=False, description="Flag indicating recipient was recently added as a new beneficiary")
    is_unusual_location: bool = Field(default=False)
    is_new_device: bool = Field(default=False)
    ip_address: Optional[str] = Field(default="127.0.0.1")
    device_name: Optional[str] = Field(default="Local Browser")


class Transaction(BaseModel):
    id: str
    user_id: str
    amount_cents: int = Field(default=0, description="Monetary representation in integer cents (e.g. $10.50 -> 1050)")
    amount: float
    currency: str
    recipient: str
    category: TransactionCategory
    status: TransactionStatus
    risk_level: RiskLevel
    risk_score: int = Field(..., ge=0, le=100)
    risk_reasons: List[str] = Field(default_factory=list)
    risk_factors: List[Dict[str, Any]] = Field(default_factory=list, description="Structured explainable risk score breakdown factors")
    is_new_beneficiary: bool = Field(default=False)
    cooling_off_active: bool = Field(default=False)
    created_at: str
    updated_at: Optional[str] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    lifecycle_history: List[Dict[str, Any]] = Field(default_factory=list)


class TransactionListResponse(BaseModel):
    items: List[Transaction]
    total: int
    page: int
    page_size: int
    total_pages: int


class RiskDistribution(BaseModel):
    low: int
    medium: int
    high: int
    critical: int


class ActivityPoint(BaseModel):
    date: str
    amount: float
    count: int


class DashboardStats(BaseModel):
    simulated_balance: float
    total_transactions: int
    pending_transactions: int
    flagged_alerts: int
    high_risk_alerts: int
    risk_distribution: RiskDistribution
    recent_transactions: List[Transaction]
    activity_trend: List[ActivityPoint]


class UserContext(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: str = "customer"
