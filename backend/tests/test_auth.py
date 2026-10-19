import time
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from httpx import AsyncClient, ASGITransport
from jose import jwt, jwk

from app.main import app
from app.config import get_settings
from app.auth import set_cognito_jwks_cache


@pytest.fixture(scope="module")
def rsa_keypair():
    """Generate an ephemeral RSA keypair for cryptographic token testing."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    jwk_dict = jwk.RSAKey(key=private_key.public_key(), algorithm="RS256").to_dict()
    jwk_dict["kid"] = "test-auth-key-001"

    jwks = {"keys": [jwk_dict]}
    return private_pem, jwks, "test-auth-key-001"


@pytest.fixture(autouse=True)
def setup_jwks(rsa_keypair):
    """Inject test JWKS into auth cache and restore on teardown."""
    _, jwks, _ = rsa_keypair
    set_cognito_jwks_cache(jwks)
    yield
    set_cognito_jwks_cache(None)


@pytest.mark.asyncio
async def test_openapi_security_scheme_and_authorize_button():
    """Verify OpenAPI documents Cognito JWT Bearer and Swagger Authorize button."""
    openapi = app.openapi()

    # 1. OpenAPI components must include the CognitoJWTBearer security scheme
    security_schemes = openapi.get("components", {}).get("securitySchemes", {})
    assert "CognitoJWTBearer" in security_schemes
    scheme = security_schemes["CognitoJWTBearer"]
    assert scheme["type"] == "http"
    assert scheme["scheme"] == "bearer"
    assert scheme["bearerFormat"] == "JWT"

    # 2. Protected routes must require CognitoJWTBearer without individual header params
    dashboard_get = openapi["paths"]["/api/dashboard"]["get"]
    assert dashboard_get.get("security") == [{"CognitoJWTBearer": []}]
    header_params = [
        p["name"] for p in dashboard_get.get("parameters", []) if p.get("in") == "header"
    ]
    assert "authorization" not in header_params

    verif_get = openapi["paths"]["/api/security/verifications"]["get"]
    assert verif_get.get("security") == [{"CognitoJWTBearer": []}]

    # 3. Public endpoints must not have security requirements
    health_get = openapi["paths"]["/health"]["get"]
    assert health_get.get("security") is None

    auth_config_get = openapi["paths"]["/api/auth/config"]["get"]
    assert auth_config_get.get("security") is None


@pytest.mark.asyncio
async def test_public_endpoints_accessible_without_token():
    """Ensure /health and /api/auth/config are publicly accessible without authentication."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        health_resp = await ac.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["status"] == "healthy"

        config_resp = await ac.get("/api/auth/config")
        assert config_resp.status_code == 200
        data = config_resp.json()
        assert "user_pool_id" in data
        assert "app_client_id" in data
        assert "region" in data


@pytest.mark.asyncio
async def test_missing_token_returns_401_when_auth_required(monkeypatch):
    """Protected endpoints return 401 when no token is provided and auth is required."""
    settings = get_settings()
    monkeypatch.setattr(settings, "REQUIRE_AUTH", True)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp_dashboard = await ac.get("/api/dashboard")
        assert resp_dashboard.status_code == 401
        assert "Bearer" in resp_dashboard.headers.get("WWW-Authenticate", "")

        resp_verif = await ac.get("/api/security/verifications")
        assert resp_verif.status_code == 401
        assert "Bearer" in resp_verif.headers.get("WWW-Authenticate", "")


@pytest.mark.asyncio
async def test_invalid_scheme_returns_401():
    """Non-Bearer schemes in Authorization header are rejected with 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": "Basic 12345"})
        assert resp.status_code == 401
        assert "Bearer" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_malformed_token_returns_401():
    """Malformed JWT strings are rejected with 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": "Bearer not.a.valid.jwt"})
        assert resp.status_code == 401
        assert "Malformed" in resp.json()["detail"] or "Invalid" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_untrusted_signature_token_returns_401():
    """Tokens signed with an untrusted private key not in JWKS are rejected."""
    # Generate an untrusted private key
    untrusted_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    untrusted_pem = untrusted_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    settings = get_settings()
    issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"
    token = jwt.encode(
        {
            "sub": "attacker-user-001",
            "iss": issuer,
            "aud": settings.COGNITO_APP_CLIENT_ID,
            "token_use": "id",
            "exp": int(time.time()) + 3600,
        },
        untrusted_pem,
        algorithm="RS256",
        headers={"kid": "untrusted-kid"},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "not found in JWKS" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_issuer_token_returns_401(rsa_keypair):
    """Tokens with an invalid issuer are rejected with 401."""
    private_pem, _, kid = rsa_keypair
    settings = get_settings()

    token = jwt.encode(
        {
            "sub": "user-001",
            "iss": "https://evil-unauthorized-issuer.com",
            "aud": settings.COGNITO_APP_CLIENT_ID,
            "token_use": "id",
            "exp": int(time.time()) + 3600,
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "Invalid Cognito claims" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_mismatched_audience_id_token_returns_401(rsa_keypair):
    """ID tokens with mismatched audience are rejected with 401."""
    private_pem, _, kid = rsa_keypair
    settings = get_settings()
    issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"

    token = jwt.encode(
        {
            "sub": "user-001",
            "iss": issuer,
            "aud": "wrong-client-id",
            "token_use": "id",
            "exp": int(time.time()) + 3600,
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "audience" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_mismatched_client_id_access_token_returns_401(rsa_keypair):
    """Access tokens with mismatched client_id are rejected with 401."""
    private_pem, _, kid = rsa_keypair
    settings = get_settings()
    issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"

    token = jwt.encode(
        {
            "sub": "user-001",
            "iss": issuer,
            "client_id": "wrong-client-id",
            "token_use": "access",
            "exp": int(time.time()) + 3600,
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "client_id" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_expired_token_returns_401(rsa_keypair):
    """Expired Cognito tokens are rejected with 401."""
    private_pem, _, kid = rsa_keypair
    settings = get_settings()
    issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"

    token = jwt.encode(
        {
            "sub": "user-001",
            "iss": issuer,
            "aud": settings.COGNITO_APP_CLIENT_ID,
            "token_use": "id",
            "exp": int(time.time()) - 3600,  # Expired 1 hour ago
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_valid_cognito_id_token_authenticates_successfully(rsa_keypair):
    """Valid Cognito ID token authenticates and accesses protected endpoints."""
    private_pem, _, kid = rsa_keypair
    settings = get_settings()
    issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"

    token = jwt.encode(
        {
            "sub": "usr_cognito_12345",
            "email": "akshay.banker@adaptive-security.io",
            "iss": issuer,
            "aud": settings.COGNITO_APP_CLIENT_ID,
            "token_use": "id",
            "exp": int(time.time()) + 3600,
            "cognito:groups": ["admin"],
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp_dashboard = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp_dashboard.status_code == 200

        resp_verif = await ac.get("/api/security/verifications", headers={"Authorization": f"Bearer {token}"})
        assert resp_verif.status_code == 200


@pytest.mark.asyncio
async def test_valid_cognito_access_token_authenticates_successfully(rsa_keypair):
    """Valid Cognito Access token authenticates and accesses protected endpoints."""
    private_pem, _, kid = rsa_keypair
    settings = get_settings()
    issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"

    token = jwt.encode(
        {
            "sub": "usr_cognito_67890",
            "username": "customer_user_1",
            "iss": issuer,
            "client_id": settings.COGNITO_APP_CLIENT_ID,
            "token_use": "access",
            "exp": int(time.time()) + 3600,
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp_dashboard = await ac.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp_dashboard.status_code == 200


@pytest.mark.asyncio
async def test_token_with_redundant_bearer_prefix_normalized():
    """Verify that entering 'Bearer demo-token' or quoted strings is normalized automatically."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp1 = await ac.get("/api/dashboard", headers={"Authorization": "Bearer Bearer demo-token"})
        assert resp1.status_code == 200

        resp2 = await ac.get("/api/dashboard", headers={"Authorization": 'Bearer "demo-token"'})
        assert resp2.status_code == 200
