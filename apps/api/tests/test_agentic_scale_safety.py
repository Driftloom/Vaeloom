"""
Tests for Agentic Scale-Safety (Wave 1):
- Spend budget configuration, checks, and limits per workspace
- Quota and budget enforcement in orchestrator loop
- ReAct max rounds configurable ceiling
- Admin API endpoints for budget management
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.config import settings
from api.dependencies import get_current_user
from api.orchestrator.loop import (
    _ceiling_error_card,
    _check_spend_and_quota,
)
from api.services.agent_costs import (
    AgentCostTracker,
    agent_cost_tracker,
    router as agent_costs_router,
)


@pytest.fixture
def tracker():
    t = AgentCostTracker()
    return t


class TestSpendBudgetTracker:
    @pytest.mark.asyncio
    async def test_set_and_get_budget(self, tracker):
        budget = await tracker.set_budget("ws-test", 25.0, period_seconds=86400)
        assert budget.workspace_id == "ws-test"
        assert budget.limit_usd == 25.0
        assert budget.period_seconds == 86400

        fetched = await tracker.get_budget("ws-test")
        assert fetched is not None
        assert fetched.limit_usd == 25.0

    @pytest.mark.asyncio
    async def test_set_negative_budget_raises(self, tracker):
        with pytest.raises(ValueError, match="limit_usd must be >= 0"):
            await tracker.set_budget("ws-test", -5.0)

    @pytest.mark.asyncio
    async def test_clear_budget(self, tracker):
        await tracker.set_budget("ws-clear", 10.0)
        assert await tracker.get_budget("ws-clear") is not None

        cleared = await tracker.clear_budget("ws-clear")
        assert cleared is True
        assert await tracker.get_budget("ws-clear") is None

        # Clearing again returns False
        assert await tracker.clear_budget("ws-clear") is False

    @pytest.mark.asyncio
    async def test_check_budget_unlimited_when_not_set(self, tracker):
        status = await tracker.check_budget("ws-none")
        assert status["allowed"] is True
        assert status["limit_usd"] == 0.0
        assert status["spent_usd"] == 0.0

    @pytest.mark.asyncio
    async def test_check_budget_under_limit(self, tracker):
        await tracker.set_budget("ws-under", 10.0)
        # Track $0.50 of usage
        await tracker.track_usage("test-agent", "ws-under", 1000, 1000, "gpt-4o")

        status = await tracker.check_budget("ws-under")
        assert status["allowed"] is True
        assert status["spent_usd"] > 0
        assert status["spent_usd"] < 10.0
        assert status["remaining_usd"] > 0

    @pytest.mark.asyncio
    async def test_check_budget_exceeded(self, tracker):
        # Set a tiny budget of $0.0001
        await tracker.set_budget("ws-over", 0.0001)
        # Track 5000 tokens on sonnet (will easily exceed $0.0001)
        await tracker.track_usage("test-agent", "ws-over", 5000, 5000, "claude-3-5-sonnet-20241022")

        status = await tracker.check_budget("ws-over")
        assert status["allowed"] is False
        assert status["spent_usd"] > 0.0001
        assert status["remaining_usd"] == 0.0

    @pytest.mark.asyncio
    async def test_effective_limit_falls_back_to_settings(self, tracker, monkeypatch):
        monkeypatch.setattr(settings, "agent_default_daily_budget_usd", 5.0)
        limit = await tracker.effective_limit_usd("ws-default")
        assert limit == 5.0

        # Workspace override takes precedence
        await tracker.set_budget("ws-default", 15.0)
        limit = await tracker.effective_limit_usd("ws-default")
        assert limit == 15.0


class TestLoopSpendAndQuotaGate:
    @pytest.mark.asyncio
    async def test_ceiling_error_card_structure(self):
        card = _ceiling_error_card("test_agent", "Test ceiling reached")
        assert card["agent_name"] == "test_agent"
        assert card["action"] == "error"
        assert card["confidence"] == 0.0
        assert "Test ceiling reached" in card["result"]["summary"]

    @pytest.mark.asyncio
    async def test_check_spend_and_quota_allows_when_under_budget(self):
        ws_id = "ws-gate-pass"
        await agent_cost_tracker.set_budget(ws_id, 100.0)
        try:
            err, kind = await _check_spend_and_quota(ws_id, "resume")
            assert err is None
        finally:
            await agent_cost_tracker.clear_budget(ws_id)

    @pytest.mark.asyncio
    async def test_check_spend_and_quota_blocks_when_budget_exceeded(self):
        ws_id = "ws-gate-block"
        await agent_cost_tracker.set_budget(ws_id, 0.00001)
        await agent_cost_tracker.track_usage("resume", ws_id, 5000, 5000, "gpt-4o")
        try:
            err, kind = await _check_spend_and_quota(ws_id, "resume")
            assert err is not None
            assert "Workspace LLM spend budget exhausted" in err
            assert kind == "cost_budget"
        finally:
            await agent_cost_tracker.clear_budget(ws_id)

    @pytest.mark.asyncio
    async def test_react_max_rounds_setting_default(self):
        assert hasattr(settings, "agent_max_react_rounds")
        assert settings.agent_max_react_rounds >= 1


class TestBudgetAdminEndpoints:
    @pytest.fixture
    def app_client(self):
        app = FastAPI()
        app.include_router(agent_costs_router, prefix="/api/v1")
        app.dependency_overrides[get_current_user] = lambda: {"id": "admin-1", "roles": ["admin"]}
        return TestClient(app)

    def test_put_and_get_and_delete_budget(self, app_client):
        ws = "ws-admin-test"
        # 1. PUT budget
        put_resp = app_client.put(
            "/api/v1/admin/agents/usage/budgets",
            json={"workspace_id": ws, "limit_usd": 50.0, "period_hours": 24.0},
        )
        assert put_resp.status_code == 200
        data = put_resp.json()
        assert data["workspace_id"] == ws
        assert data["limit_usd"] == 50.0
        assert data["allowed"] is True

        # 2. GET budget
        get_resp = app_client.get(f"/api/v1/admin/agents/usage/budgets?workspace_id={ws}")
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data["configured"] is True
        assert get_data["limit_usd"] == 50.0

        # 3. DELETE budget
        del_resp = app_client.delete(f"/api/v1/admin/agents/usage/budgets?workspace_id={ws}")
        assert del_resp.status_code == 200
        assert del_resp.json()["cleared"] is True

        # 4. Verify cleared
        get_after = app_client.get(f"/api/v1/admin/agents/usage/budgets?workspace_id={ws}")
        assert get_after.json()["configured"] is False
