import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError
import httpx
from app.config import get_settings
from app.models import UserContext

logger = logging.getLogger("adaptive_banking.auth")

_jwks_cache: dict | None = None

# OpenAPI Security Scheme configuration for Swagger UI
cognito_jwt_scheme = HTTPBearer(
    scheme_name="CognitoJWTBearer",
    bearerFormat="JWT",
    description=(
        "Enter your AWS Cognito JWT token (ID token or Access token) or demo JWT.\n\n"
        "💡 **Quick Demo**: Sign in via `/api/auth/login` with demo credentials or copy the token from `/api/auth/demo-token`."
    ),
    auto_error=False,
)


def set_cognito_jwks_cache(jwks: Optional[dict]) -> None:
    """Helper for testing or resetting cached Cognito JWKS keys."""
    global _jwks_cache
    _jwks_cache = jwks


def create_demo_jwt(
    user_id: str = "demo-user-001",
    email: str = "demo.banker@adaptive-security.io",
    role: str = "customer",
    expires_in_hours: int = 48,
) -> str:
    """
    Generate a genuine, signed JWT with valid header and payload claims.
    Can be used seamlessly across frontend, API requests, and Swagger UI.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=expires_in_hours)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "cognito:groups": [role],
        "token_use": "access",
        "client_id": settings.COGNITO_APP_CLIENT_ID,
        "iss": f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


async def get_cognito_jwks() -> dict:
    """
    Fetch and cache public JSON Web Key Sets (JWKS) from AWS Cognito.
    """
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    settings = get_settings()
    jwks_url = (
        f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/"
        f"{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(jwks_url)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                return _jwks_cache
    except Exception as e:
        logger.warning("Could not fetch Cognito JWKS from %s: %s", jwks_url, e)

    return {"keys": []}


def verify_cognito_token(token: str, jwks: dict, settings) -> dict:
    """
    Verify JWT cryptographic signature, expiration, issuer, and claims.
    Supports both local demonstration JWTs (HS256) and live Cognito JWTs (RS256).
    """
    # 1. Try decoding as local demo JWT (HS256)
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_signature": True, "verify_exp": True},
        )
        return payload
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Demo session token has expired. Please sign in again at /api/auth/login.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        pass

    # 2. Inspect unverified headers to locate matching key ID (kid) for Cognito RS256
    try:
        unverified_headers = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed JWT token format. Please sign in at /api/auth/login or provide a valid Cognito JWT.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expected_issuer = (
        f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/"
        f"{settings.COGNITO_USER_POOL_ID}"
    )

    if not jwks or not jwks.get("keys"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify Cognito token: public keys unavailable",
            headers={"WWW-Authenticate": "Bearer"},
        )

    kid = unverified_headers.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Cognito token: missing 'kid' in header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Find matching key in JWKS
    matching_key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            matching_key = k
            break

    if not matching_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Cognito token: key ID '{kid}' not found in JWKS",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Cryptographic signature, expiration, and issuer verification
    try:
        payload = jwt.decode(
            token,
            matching_key,
            algorithms=["RS256"],
            issuer=expected_issuer,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,  # Verified conditionally below based on token_use
            },
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cognito token has expired",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"The token has expired\""},
        )
    except JWTClaimsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Cognito claims: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Cognito token signature verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Validate Cognito-specific claims: token_use, audience / client_id
    token_use = payload.get("token_use")
    if token_use not in ("id", "access"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Cognito token: invalid token_use '{token_use}' (expected 'id' or 'access')",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_use == "id":
        aud = payload.get("aud")
        if aud != settings.COGNITO_APP_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Cognito ID token: audience '{aud}' does not match client ID",
                headers={"WWW-Authenticate": "Bearer"},
            )
    elif token_use == "access":
        client_id = payload.get("client_id")
        if client_id != settings.COGNITO_APP_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Cognito Access token: client_id '{client_id}' does not match client ID",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return payload


async def get_current_user(
    request: Request,
    auth_creds: Optional[HTTPAuthorizationCredentials] = Depends(cognito_jwt_scheme),
) -> UserContext:
    """
    FastAPI dependency that extracts and validates Cognito JWT Bearer tokens.
    Documented in OpenAPI / Swagger UI via HTTPBearer security scheme.
    """
    settings = get_settings()

    raw_auth_header = request.headers.get("authorization")

    # If an Authorization header was provided:
    if raw_auth_header:
        # Check if the scheme is Bearer
        if not auth_creds or not auth_creds.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization scheme: Bearer token required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_creds.credentials.strip()
        while token.lower().startswith("bearer "):
            token = token[7:].strip()
        token = token.strip('\'"')

        # Demonstration & mock session bypass for testing / interactive demonstration
        if token == "demo-token" or token.startswith("mock-"):
            return UserContext(
                user_id="demo-user-001",
                email="demo.banker@adaptive-security.io",
                role="customer",
            )

        # Live cryptographic verification
        jwks = await get_cognito_jwks()
        payload = verify_cognito_token(token, jwks, settings)

        user_id = payload.get("sub") or payload.get("username", "demo-user-001")
        email = payload.get("email")
        role = "admin" if "admin" in payload.get("cognito:groups", []) else "customer"
        return UserContext(user_id=user_id, email=email, role=role)

    # When NO Authorization header is provided:
    if settings.REQUIRE_AUTH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header with Bearer token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Local development default user (when REQUIRE_AUTH=False)
    return UserContext(
        user_id="demo-user-001",
        email="demo.banker@adaptive-security.io",
        role="customer",
    )
