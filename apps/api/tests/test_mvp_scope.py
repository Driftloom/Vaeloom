import pytest
from unittest.mock import AsyncMock

pytestmark = pytest.mark.asyncio


class TestMvpScopeLock:
    """MVP scope enforcement (INT-02 §2.2 / CF-05 / R5).

    With `settings.mvp_scope_enforced = True`, the orchestrator must only
    dispatch the 8 canonical agents and return an explicit out_of_scope
    response for enterprise extras. The existing suites run with the lock
    off (conftest autouse fixture); this module turns it on and verifies it.
    """

    CANONICAL = ["organization", "memory", "resume", "ats", "job_search",
                 "application", "gmail", "scheduler", "planning", "research"]
    ENTERPRISE = ["career", "learning", "github", "coding",
                  "reminder", "analytics", "recommendation", "reflection",
                  "security", "connector", "plugin", "drive"]

    @pytest.fixture(autouse=True)
    def _enforce_mvp_scope(self, monkeypatch, mock_llm):
        # Depend on mock_llm so this runs AFTER conftest's autouse that sets mvp_scope_enforced=False
        # Must be sync (not async) — pytest-asyncio warns async autouse is unsupported and may not run.
        from api.config import settings
        monkeypatch.setattr(settings, "mvp_scope_enforced", True)
        yield
        monkeypatch.setattr(settings, "mvp_scope_enforced", False)

    @pytest.mark.parametrize("agent", CANONICAL)
    async def test_canonical_agent_passes_scope_gate(self, monkeypatch, agent):
        from api.orchestrator.router import handle, UserRequest
        async def fake_classify(message):
            return agent, 0.9
        monkeypatch.setattr("api.orchestrator.router.classify_intent", fake_classify)
        request = UserRequest("r1", "message", "ws1")
        result = await handle(request)
        assert result["action"] in ("suggest", "error")
        assert result["agent_name"] in ("orchestrator", agent)

    @pytest.mark.parametrize("agent", ENTERPRISE)
    async def test_enterprise_agent_blocked_in_mvp(self, monkeypatch, agent):
        from api.orchestrator.router import handle, UserRequest
        async def fake_classify(message):
            return agent, 0.9
        monkeypatch.setattr("api.orchestrator.router.classify_intent", fake_classify)
        request = UserRequest("r1", "message", "ws1")
        result = await handle(request)
        assert result["action"] == "out_of_scope"
        assert result["result"]["summary"].startswith(f"'{agent}' is outside")

    async def test_scope_lock_disabled_allows_enterprise(self, monkeypatch):
        from api.orchestrator.router import handle, UserRequest, AGENT_REGISTRY, run_agent_loop, QAAgent
        from api.orchestrator.loop import AgentResponse
        from api.agents.qa_agent.handler import QAValidationResult
        from api.config import settings

        class MockAgent:
            pass

        async def fake_classify(message):
            return "test_agent", 0.85

        async def fake_loop(request):
            return AgentResponse(status="success", final_result="Task complete")

        async def fake_validate(self, output):
            return QAValidationResult(decision="approved", issues=[])

        monkeypatch.setattr(settings, "mvp_scope_enforced", False)
        monkeypatch.setattr("api.orchestrator.router.classify_intent", fake_classify)
        monkeypatch.setitem(AGENT_REGISTRY, "test_agent", MockAgent)
        monkeypatch.setattr("api.orchestrator.router.run_agent_loop", fake_loop)
        monkeypatch.setattr(QAAgent, "validate", fake_validate)

        request = UserRequest("r1", "organize files", "ws1")
        result = await handle(request)
        assert result["agent_name"] == "test_agent"
        assert result["action"] == "suggest"

    async def test_canonical_roster_matches_int02(self):
        from api.orchestrator.router import MVP_CANONICAL_AGENTS
        assert MVP_CANONICAL_AGENTS == frozenset({
            "organization", "memory", "resume", "ats", "job_search",
            "application", "gmail", "scheduler", "planning", "research",
        })
        assert len(MVP_CANONICAL_AGENTS) == 10
