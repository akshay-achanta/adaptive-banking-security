from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import get_settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    settings = get_settings()
    return {
        "status": "healthy",
        "service": "adaptive-banking-security-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.ENVIRONMENT,
        "database": {
            "mode": "mock_in_memory" if settings.USE_MOCK_DB else "aws_dynamodb",
            "table_name": settings.DYNAMODB_TABLE_NAME,
            "region": settings.AWS_REGION,
        },
        "cognito": {
            "user_pool_id": settings.COGNITO_USER_POOL_ID,
            "app_client_id": settings.COGNITO_APP_CLIENT_ID,
            "region": settings.COGNITO_REGION,
            "auth_enforced": settings.REQUIRE_AUTH,
        },
        "version": "1.0.0",
    }
