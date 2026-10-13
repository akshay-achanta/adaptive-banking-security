from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.auth import get_current_user
from app.db import get_repository
from app.db.base import BaseRepository
from app.models import (
    UserContext,
    SecurityPolicy,
    SecurityPolicyUpdate,
    EmergencyModeStatus,
    EmergencyModeRequest,
    VerificationRecord,
    VerificationDecisionRequest,
    ScheduledTransaction,
    ScheduledTransactionCreate,
    NotificationItem,
    AuditEvent,
)

router = APIRouter(prefix="/api/security", tags=["Security & Workflow Engine"])


# 1. Customer Security Policies
@router.get("/policy", response_model=SecurityPolicy)
async def get_policy(
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Retrieve the current user's security policies (spending limits, permitted hours, categories)."""
    return await repo.get_security_policy(user.user_id)


@router.put("/policy", response_model=SecurityPolicy)
async def update_policy(
    update: SecurityPolicyUpdate,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Update user security policies. Enforced backend-side on all transactions."""
    return await repo.update_security_policy(user.user_id, update)


# 2. Emergency Mode
@router.get("/emergency-mode", response_model=EmergencyModeStatus)
async def get_emergency_mode(
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Check emergency mode lockdown status."""
    return await repo.get_emergency_mode(user.user_id)


@router.post("/emergency-mode", response_model=EmergencyModeStatus)
async def set_emergency_mode(
    req: EmergencyModeRequest,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Activate or deactivate Emergency Mode.
    When active, halts all outgoing transactions and records an immutable audit log.
    Note: Operates within the application security boundary; does not freeze external physical bank cards.
    """
    return await repo.set_emergency_mode(
        user_id=user.user_id,
        activate=req.activate,
        reason=req.reason or "User toggled emergency mode",
        actor=user.user_id,
    )


# 3. Verification Workflow
@router.get("/verifications", response_model=List[VerificationRecord])
async def list_verifications(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """List pending or past verification challenges for the current user."""
    return await repo.list_verifications(user.user_id, status=status_filter)


@router.post("/verifications/{verification_id}/decide")
async def decide_verification(
    verification_id: str,
    req: VerificationDecisionRequest,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Approve or reject a held transaction.
    Concurrency-safe: Only the authorized transaction owner may decide, and cannot be decided twice.
    """
    try:
        verif, tx = await repo.decide_verification(
            verification_id=verification_id,
            decision=req.decision.value,
            reason=req.reason or f"User decided {req.decision.value}",
            user=user,
        )
        return {"verification": verif, "transaction": tx}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# 4. Scheduled Transactions
@router.get("/scheduled", response_model=List[ScheduledTransaction])
async def list_scheduled_transactions(
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """List scheduled transactions for the current user."""
    return await repo.list_scheduled_transactions(user.user_id)


@router.post("/scheduled", response_model=ScheduledTransaction, status_code=status.HTTP_201_CREATED)
async def create_scheduled_transaction(
    payload: ScheduledTransactionCreate,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Create a new scheduled transaction."""
    return await repo.create_scheduled_transaction(payload, user)


@router.post("/scheduled/{scheduled_id}/cancel", response_model=ScheduledTransaction)
async def cancel_scheduled_transaction(
    scheduled_id: str,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Cancel a pending scheduled transaction."""
    try:
        return await repo.cancel_scheduled_transaction(scheduled_id, user)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/scheduled/{scheduled_id}/execute")
async def execute_scheduled_transaction(
    scheduled_id: str,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Simulate execution of a scheduled transaction.
    Re-checks current security policies and emergency mode at execution time.
    """
    try:
        sched, tx = await repo.execute_scheduled_transaction(scheduled_id, user)
        return {"scheduled": sched, "executed_transaction": tx}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# 5. Notifications
@router.get("/notifications", response_model=List[NotificationItem])
async def list_notifications(
    unread_only: bool = Query(False),
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Retrieve security notifications (verification alerts, policy changes, emergency mode)."""
    return await repo.list_notifications(user.user_id, unread_only=unread_only)


@router.post("/notifications/read")
async def mark_notifications_read(
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Mark all unread notifications as read."""
    count = await repo.mark_notifications_read(user.user_id)
    return {"marked_read_count": count}


# 6. Audit History
@router.get("/audit-events", response_model=List[AuditEvent])
async def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """Retrieve immutable audit trail records for security actions."""
    return await repo.list_audit_events(user.user_id, limit=limit)
