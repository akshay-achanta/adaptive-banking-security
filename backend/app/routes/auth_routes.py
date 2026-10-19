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


@router.get("/demo-token")
async def get_demo_token():
    """
    Supplies a sample token for Swagger UI authorization and local testing.
    Copy the token value below and paste it into Swagger's 'Authorize' modal.
    """
    return {
        "token": "demo-token",
        "type": "Bearer",
        "instructions": "Copy 'demo-token', click the green 'Authorize' button at the top right of this page, paste it into the Value box, and click Authorize.",
        "user_context": {
            "user_id": "demo-user-001",
            "email": "demo.banker@adaptive-security.io",
            "role": "customer",
        },
    }
