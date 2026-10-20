from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.auth import get_current_user
from app.db import get_repository
from app.db.base import BaseRepository
from app.models import (
    Transaction,
    TransactionCreate,
    TransactionListResponse,
    UserContext,
    ReportRecipientRequest,
)
from app.ml.risk_service import get_risk_service, HybridRiskService

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


class RiskAssessmentRequest(BaseModel):
    is_emergency_mode: bool = False
    daily_limit: float = 25000.0


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status (COMPLETED, PENDING, FLAGGED, REJECTED)"),
    search: Optional[str] = Query(None, description="Search query across recipient, notes, id"),
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    List transactions with pagination, text search, and status filtering.
    """
    items, total = await repo.list_transactions(
        user=user,
        page=page,
        page_size=page_size,
        status=status,
        search=search,
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return TransactionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/report-recipient", status_code=status.HTTP_200_OK)
async def report_suspicious_recipient(
    payload: ReportRecipientRequest,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Report a recipient as suspicious, scam, or unverified.
    Logs to security audit trail and dispatches an instant protection alert.
    """
    return await repo.report_suspicious_recipient(
        user=user,
        recipient=payload.recipient,
        reason=payload.reason,
        details=payload.details,
    )


@router.post("", response_model=Transaction, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_in: TransactionCreate,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Simulate a new banking transaction with real-time adaptive risk evaluation.
    Evaluates amounts, geolocations, and hardware fingerprint heuristics.
    """
    return await repo.create_transaction(tx_in=tx_in, user=user)


@router.get("/{transaction_id}", response_model=Transaction)
async def get_transaction(
    transaction_id: str,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Retrieve full transaction telemetry details with user-ownership authorization check.
    """
    tx = await repo.get_transaction(transaction_id=transaction_id, user=user)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID '{transaction_id}' was not found or access is unauthorized.",
        )
    return tx


@router.post("/{transaction_id}/risk")
async def evaluate_transaction_risk(
    transaction_id: str,
    assessment_req: Optional[RiskAssessmentRequest] = None,
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
    risk_service: HybridRiskService = Depends(get_risk_service),
):
    """
    Deep ML risk assessment on a specific transaction ID.
    Performs feature extraction, Supervised Classifier inference, Isolation Forest anomaly scoring,
    and security policy checks (spending limits, emergency freeze).
    Enforces user ownership.
    """
    tx = await repo.get_transaction(transaction_id=transaction_id, user=user)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID '{transaction_id}' was not found or access is unauthorized.",
        )

    # Fetch user history for context
    history, _ = await repo.list_transactions(user=user, page=1, page_size=50)

    # Convert existing Transaction to TransactionCreate representation for feature extraction
    tx_create = TransactionCreate(
        amount=tx.amount,
        currency=tx.currency,
        recipient=tx.recipient,
        category=tx.category,
        notes=tx.notes,
        is_unusual_location=tx.metadata.get("is_unusual_location", False),
        is_new_device=tx.metadata.get("is_new_device", False),
        ip_address=tx.metadata.get("ip", "127.0.0.1"),
        device_name=tx.metadata.get("device", "Web Client"),
    )

    emergency_mode = assessment_req.is_emergency_mode if assessment_req else False
    daily_limit = assessment_req.daily_limit if assessment_req else 25000.0

    current_daily = sum(t.amount for t in history if t.id != tx.id)

    result = risk_service.assess_transaction(
        tx=tx_create,
        user_history=history,
        is_emergency_mode=emergency_mode,
        daily_limit=daily_limit,
        current_daily_spend=current_daily,
    )

    return {
        "transaction_id": tx.id,
        "amount": tx.amount,
        "recipient": tx.recipient,
        "category": tx.category.value,
        "assessment": result.to_dict(),
    }
