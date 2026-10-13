import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_list_transactions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/transactions")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert data["total"] >= 1


@pytest.mark.asyncio
async def test_create_low_risk_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "amount": 45.50,
            "currency": "USD",
            "recipient": "Local Grocer Sydney",
            "category": "PAYMENT",
            "notes": "Weekly groceries",
            "is_unusual_location": False,
            "is_new_device": False,
        }
        response = await ac.post("/api/transactions", json=payload)
        assert response.status_code == 201
        tx = response.json()
        assert tx["amount"] == 45.50
        assert tx["recipient"] == "Local Grocer Sydney"
        assert tx["risk_level"] == "LOW"
        assert tx["status"] in ["APPROVED", "COMPLETED"]
        assert tx["risk_score"] < 35


@pytest.mark.asyncio
async def test_create_high_risk_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "amount": 18500.00,
            "currency": "USD",
            "recipient": "Foreign Wire Account HK",
            "category": "TRANSFER",
            "notes": "Urgent transfer",
            "is_unusual_location": True,
            "is_new_device": True,
            "ip_address": "194.26.29.11",
            "device_name": "Unrecognized Android",
        }
        response = await ac.post("/api/transactions", json=payload)
        assert response.status_code == 201
        tx = response.json()
        assert tx["amount"] == 18500.00
        assert tx["risk_level"] in ["HIGH", "CRITICAL"]
        assert tx["status"] in ["BLOCKED", "FLAGGED", "PENDING_VERIFICATION"]
        assert len(tx["risk_reasons"]) > 0
        assert tx["risk_score"] >= 75


@pytest.mark.asyncio
async def test_get_transaction_by_id():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First list to get an existing ID
        list_resp = await ac.get("/api/transactions")
        first_item = list_resp.json()["items"][0]
        tx_id = first_item["id"]

        detail_resp = await ac.get(f"/api/transactions/{tx_id}")
        assert detail_resp.status_code == 200
        assert detail_resp.json()["id"] == tx_id


@pytest.mark.asyncio
async def test_get_nonexistent_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/transactions/tx_nonexistent_99999")
        assert resp.status_code == 404
