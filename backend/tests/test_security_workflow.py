import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import TransactionCategory


@pytest.mark.asyncio
async def test_security_policy_get_and_update():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get default policy
        res = await ac.get("/api/security/policy")
        assert res.status_code == 200
        policy = res.json()
        assert policy["user_id"] == "demo-user-001"
        assert policy["daily_limit_cents"] > 0
        assert policy["max_single_amount_cents"] > 0

        # Update policy
        update_payload = {
            "max_single_amount": 3500.0,
            "daily_limit": 10000.0,
            "restricted_categories": ["INVESTMENT"],
            "verification_risk_threshold": 50,
        }
        update_res = await ac.put("/api/security/policy", json=update_payload)
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["max_single_amount_cents"] == 350000
        assert updated["daily_limit_cents"] == 1000000
        assert "INVESTMENT" in updated["restricted_categories"]
        assert updated["verification_risk_threshold"] == 50


@pytest.mark.asyncio
async def test_restricted_category_policy_blocks_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Ensure INVESTMENT is restricted
        await ac.put("/api/security/policy", json={"restricted_categories": ["INVESTMENT"]})

        tx_payload = {
            "amount": 200.0,
            "currency": "USD",
            "recipient": "Apex Digital Assets",
            "category": "INVESTMENT",
        }
        res = await ac.post("/api/transactions", json=tx_payload)
        assert res.status_code == 201
        tx = res.json()
        assert tx["status"] == "BLOCKED"
        assert any("restricted" in r.lower() for r in tx["risk_reasons"])


@pytest.mark.asyncio
async def test_max_single_amount_policy_blocks_transaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Set max single to $1,000.00
        await ac.put("/api/security/policy", json={"max_single_amount": 1000.0, "restricted_categories": []})

        tx_payload = {
            "amount": 2500.0,
            "currency": "USD",
            "recipient": "High Value Vendor",
            "category": "PAYMENT",
        }
        res = await ac.post("/api/transactions", json=tx_payload)
        assert res.status_code == 201
        tx = res.json()
        assert tx["status"] == "BLOCKED"
        assert any("single-transaction limit" in r.lower() for r in tx["risk_reasons"])


@pytest.mark.asyncio
async def test_emergency_mode_activation_and_blocking():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Activate emergency mode
        act_res = await ac.post("/api/security/emergency-mode", json={"activate": True, "reason": "Suspected breach"})
        assert act_res.status_code == 200
        assert act_res.json()["is_active"] is True

        # 2. Attempt transaction while emergency mode is active
        tx_payload = {
            "amount": 15.0,
            "currency": "USD",
            "recipient": "Local Coffee",
            "category": "PAYMENT",
        }
        tx_res = await ac.post("/api/transactions", json=tx_payload)
        assert tx_res.status_code == 201
        tx = tx_res.json()
        assert tx["status"] == "BLOCKED"
        assert any("EMERGENCY MODE ACTIVE" in r for r in tx["risk_reasons"])

        # 3. Deactivate emergency mode
        deact_res = await ac.post("/api/security/emergency-mode", json={"activate": False, "reason": "Threat cleared"})
        assert deact_res.status_code == 200
        assert deact_res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate_transactions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Restore normal single limit
        await ac.put("/api/security/policy", json={"max_single_amount": 10000.0, "restricted_categories": []})

        idem_key = "idemp_test_unique_key_123"
        tx_payload = {
            "amount": 55.0,
            "currency": "USD",
            "recipient": "Supermarket Sydney",
            "category": "PAYMENT",
            "idempotency_key": idem_key,
        }

        # First submission
        res1 = await ac.post("/api/transactions", json=tx_payload)
        assert res1.status_code == 201
        tx1 = res1.json()

        # Second submission with same key
        res2 = await ac.post("/api/transactions", json=tx_payload)
        assert res2.status_code == 201
        tx2 = res2.json()

        # Must return the identical transaction without creating a duplicate
        assert tx1["id"] == tx2["id"]


@pytest.mark.asyncio
async def test_verification_workflow_and_concurrency_prevention():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Check seeded verification
        verifs_res = await ac.get("/api/security/verifications")
        assert verifs_res.status_code == 200
        verifs = verifs_res.json()
        assert len(verifs) > 0

        target_v = verifs[0]
        v_id = target_v["id"]

        # Approve verification
        decide_res = await ac.post(
            f"/api/security/verifications/{v_id}/decide",
            json={"decision": "APPROVE", "reason": "Biometric match verified by user"},
        )
        assert decide_res.status_code == 200
        data = decide_res.json()
        assert data["verification"]["status"] == "APPROVED"
        assert data["transaction"]["status"] == "APPROVED"

        # Conflicting/Repeat decision attempt MUST fail with 400 Bad Request
        repeat_res = await ac.post(
            f"/api/security/verifications/{v_id}/decide",
            json={"decision": "REJECT", "reason": "Attempting conflicting status"},
        )
        assert repeat_res.status_code == 400


@pytest.mark.asyncio
async def test_scheduled_transactions_lifecycle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Create scheduled transaction
        sched_payload = {
            "amount": 750.0,
            "currency": "USD",
            "recipient": "Cloud Hosting Provider",
            "category": "PAYMENT",
            "execution_time": "2026-10-20T12:00:00Z",
            "description": "Monthly hosting bill",
        }
        create_res = await ac.post("/api/security/scheduled", json=sched_payload)
        assert create_res.status_code == 201
        sched = create_res.json()
        assert sched["status"] == "SCHEDULED"
        assert sched["amount_cents"] == 75000

        # 2. Simulate execution
        exec_res = await ac.post(f"/api/security/scheduled/{sched['id']}/execute")
        assert exec_res.status_code == 200
        exec_data = exec_res.json()
        assert exec_data["scheduled"]["status"] == "EXECUTED"
        assert exec_data["executed_transaction"]["status"] == "APPROVED"

        # 3. Repeat execution attempt must fail
        repeat_exec = await ac.post(f"/api/security/scheduled/{sched['id']}/execute")
        assert repeat_exec.status_code == 400


@pytest.mark.asyncio
async def test_notifications_and_audit_history():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Check notifications
        notifs_res = await ac.get("/api/security/notifications")
        assert notifs_res.status_code == 200
        notifs = notifs_res.json()
        assert isinstance(notifs, list)

        # Mark read
        read_res = await ac.post("/api/security/notifications/read")
        assert read_res.status_code == 200

        # Check audit trail
        audit_res = await ac.get("/api/security/audit-events")
        assert audit_res.status_code == 200
        audits = audit_res.json()
        assert len(audits) > 0
        assert "action" in audits[0]
        assert "outcome" in audits[0]
