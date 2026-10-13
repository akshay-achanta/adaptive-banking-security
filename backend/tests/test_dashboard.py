import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_dashboard_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "simulated_balance" in data
        assert "total_transactions" in data
        assert "pending_transactions" in data
        assert "high_risk_alerts" in data
        assert "risk_distribution" in data
        assert "recent_transactions" in data
        assert "activity_trend" in data
        assert data["simulated_balance"] > 0
