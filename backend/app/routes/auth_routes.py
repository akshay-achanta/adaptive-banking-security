from fastapi import APIRouter
from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/config")
async def get_auth_config():
    """
    Supplies the frontend with public AWS Cognito configuration,
    ensuring zero hardcoding in frontend bundles.
    """
    settings = get_settings()
    return {
        "user_pool_id": settings.COGNITO_USER_POOL_ID,
        "app_client_id": settings.COGNITO_APP_CLIENT_ID,
        "region": settings.COGNITO_REGION,
        "auth_enforced": settings.REQUIRE_AUTH,
        "environment": settings.ENVIRONMENT,
    }
