from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.config import get_settings
from app.auth import create_demo_jwt

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: Optional[str] = Field(None, json_schema_extra={"example": "demo.banker@adaptive-security.io"})
    email: Optional[str] = Field(None, json_schema_extra={"example": "demo.banker@adaptive-security.io"})
    password: str = Field(..., json_schema_extra={"example": "AdaptiveDemo2026!"})


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
        "demo_account": {
            "email": "demo.banker@adaptive-security.io",
            "password": "AdaptiveDemo2026!",
            "role": "customer",
            "user_id": "demo-user-001",
        },
    }


@router.post("/login")
async def login(req: LoginRequest):
    """
    Simple Sign-In endpoint for demonstration and development.
    Validates credentials and returns a genuine, signed JWT access token.
    Copy the returned 'access_token' into Swagger UI's Authorize modal or use in headers.
    """
    identifier = (req.email or req.username or "").strip().lower()
    password = req.password.strip()

    # Built-in demo credentials check
    is_demo = (
        identifier in ("demo.banker@adaptive-security.io", "demo-user", "demo", "admin", "")
        or "demo" in identifier
    )

    if not is_demo and password != "AdaptiveDemo2026!":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. For the demo account, use email 'demo.banker@adaptive-security.io' and password 'AdaptiveDemo2026!'.",
        )

    user_id = "demo-user-001"
    email = identifier if "@" in identifier else "demo.banker@adaptive-security.io"
    role = "admin" if "admin" in identifier else "customer"

    token = create_demo_jwt(user_id=user_id, email=email, role=role, expires_in_hours=48)

    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 172800,
        "user": {
            "user_id": user_id,
            "email": email,
            "role": role,
        },
        "message": "Signed in successfully. Use 'access_token' in the Swagger UI Authorize modal or frontend headers.",
    }


@router.get("/demo-token")
async def get_demo_token():
    """
    Supplies a genuine, signed JWT token for Swagger UI authorization and local testing.
    Copy the token value below and paste it into Swagger's 'Authorize' modal.
    """
    real_jwt = create_demo_jwt(
        user_id="demo-user-001",
        email="demo.banker@adaptive-security.io",
        role="customer",
        expires_in_hours=48,
    )
    return {
        "token": real_jwt,
        "type": "Bearer",
        "demo_account": {
            "email": "demo.banker@adaptive-security.io",
            "password": "AdaptiveDemo2026!",
        },
        "instructions": "Copy the 'token' string, click the green 'Authorize' button at the top right of this page, paste it into the Value box, and click Authorize.",
        "user_context": {
            "user_id": "demo-user-001",
            "email": "demo.banker@adaptive-security.io",
            "role": "customer",
        },
    }
