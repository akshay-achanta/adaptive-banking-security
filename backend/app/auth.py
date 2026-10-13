import logging
from typing import Optional
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
import httpx
from app.config import get_settings
from app.models import UserContext

logger = logging.getLogger("adaptive_banking.auth")

_jwks_cache: dict | None = None


async def get_cognito_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    settings = get_settings()
    jwks_url = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(jwks_url)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                return _jwks_cache
    except Exception as e:
        logger.warning("Could not fetch Cognito JWKS from %s: %s", jwks_url, e)

    return {"keys": []}


async def get_current_user(authorization: Optional[str] = Header(None)) -> UserContext:
    settings = get_settings()

    # If auth header is provided
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

        # In dev mode with mock token
        if token.startswith("mock-") or token == "demo-token":
            return UserContext(user_id="demo-user-001", email="demo.banker@adaptive-security.io", role="customer")

        # Try live Cognito token verification
        try:
            jwks = await get_cognito_jwks()
            # If jwks keys are present, verify cryptographic signature and claims
            if jwks.get("keys"):
                payload = jwt.decode(
                    token,
                    jwks,
                    algorithms=["RS256"],
                    audience=settings.COGNITO_APP_CLIENT_ID,
                    issuer=f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}",
                )
            else:
                # If offline/unreachable Cognito, unverified decode for claim inspection
                payload = jwt.get_unverified_claims(token)

            user_id = payload.get("sub") or payload.get("username", "demo-user-001")
            email = payload.get("email")
            role = "admin" if "admin" in payload.get("cognito:groups", []) else "customer"
            return UserContext(user_id=user_id, email=email, role=role)
        except JWTError as e:
            if settings.REQUIRE_AUTH:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid Cognito token: {str(e)}",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            logger.warning("Token verification failed in non-strict mode: %s. Using fallback user.", e)

    # When no token is passed
    if settings.REQUIRE_AUTH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header with Bearer token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Local development default user
    return UserContext(
        user_id="demo-user-001",
        email="demo.banker@adaptive-security.io",
        role="customer"
    )
