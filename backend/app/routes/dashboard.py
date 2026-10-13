from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_repository
from app.db.base import BaseRepository
from app.models import DashboardStats, UserContext

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardStats)
async def get_dashboard(
    user: UserContext = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
):
    """
    Returns high-level security metrics, simulated balance,
    recent transactions, and fraud distribution telemetry.
    """
    return await repo.get_dashboard_stats(user)
