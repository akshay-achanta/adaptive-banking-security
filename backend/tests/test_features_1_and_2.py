import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.auth import get_current_user
from app.models import UserContext


@pytest.fixture
def mock_user():
    return UserContext(
        user_id="test_user_features",
        email="test_features@bank.internal",
        username="test_features",
        roles=["customer", "security_auditor"],
    )


@pytest.mark.asyncio
async def test_new_beneficiary_protection_and_cooling_off(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. First transfer to a new beneficiary with amount > $1000 ($1500)
            tx_payload = {
                "amount": 1500.0,
                "currency": "USD",
                "recipient": "Brand New Untrusted Escrow",
                "category": "TRANSFER",
                "notes": "Payment to new supplier",
                "is_new_beneficiary": True,
            }
            resp = await client.post("/api/transactions", json=tx_payload)
            assert resp.status_code == 201
            data = resp.json()

            assert data["is_new_beneficiary"] is True
            assert data["cooling_off_active"] is True
            assert data["status"] == "PENDING_VERIFICATION"
            assert any("NEW BENEFICIARY COOLING-OFF" in r for r in data["risk_reasons"])

            # 2. Verify explainable risk factors are present
            assert "risk_factors" in data
            assert len(data["risk_factors"]) > 0
            factor_names = [f["factor"] for f in data["risk_factors"]]
            assert "New Beneficiary" in factor_names
            new_bene_factor = next(f for f in data["risk_factors"] if f["factor"] == "New Beneficiary")
            assert new_bene_factor["points"] == 25

            # 3. Report suspicious recipient
            report_payload = {
                "recipient": "Brand New Untrusted Escrow",
                "reason": "Phishing or fake invoice attempt",
                "details": "Vendor email was spoofed from an overseas domain",
            }
            report_resp = await client.post("/api/transactions/report-recipient", json=report_payload)
            assert report_resp.status_code == 200
            report_data = report_resp.json()
            assert report_data["status"] == "reported"
            assert report_data["recipient"] == "Brand New Untrusted Escrow"

            # 4. Check that notification was logged under /api/security/notifications
            notifs_resp = await client.get("/api/security/notifications")
            assert notifs_resp.status_code == 200
            notifs = notifs_resp.json()
            assert any("Suspicious Recipient Reported" in n["title"] for n in notifs)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_explainable_risk_decisions_factors(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            tx_payload = {
                "amount": 3500.0,
                "currency": "USD",
                "recipient": "Offshore Merchant Corp",
                "category": "TRANSFER",
                "notes": "Hardware purchase",
                "is_unusual_location": True,
                "is_new_device": True,
                "is_new_beneficiary": True,
            }
            resp = await client.post("/api/transactions", json=tx_payload)
            assert resp.status_code == 201
            data = resp.json()

            assert "risk_factors" in data
            factors = data["risk_factors"]
            assert len(factors) >= 3

            factor_map = {f["factor"]: f["points"] for f in factors}
            assert "New Beneficiary" in factor_map
            assert factor_map["New Beneficiary"] == 25
            assert "Unfamiliar Device" in factor_map
            assert factor_map["Unfamiliar Device"] == 30
            assert "Unusual Geolocation" in factor_map
            assert factor_map["Unusual Geolocation"] == 20
    finally:
        app.dependency_overrides.clear()
