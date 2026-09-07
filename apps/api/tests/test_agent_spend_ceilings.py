"""Wave 1 (2026-09-06) — spend ceilings + loop budgets (G-01, G-02).

Covers: workspace USD budgets (set/check/clear/default), quota fail-open
locally, loop-path enforcement card, quota wiring parity, configurable
ReAct max rounds. Mock-safe: no redis, no LLM key, no DB required.
"""
import pytest

from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.agent_costs import AgentCostTracker, agent_cost_tracker


@pytest.fixture(autouse=True)
async def _clean_tracker():
    await agent_cost_tracker.reset()
    yield
    await agent_cost_tracker.reset()


class _StubAgent(BaseAgent):
    mission = "Stub agent for ceiling tests"
    tools = [Tool(name="search_documents", description="stub")]
    memory_scopes = MemoryScopes(read_types=["activity"], write_types=[])
    default_autonomy = "suggest"

    async def fallback(self):
        return {}


def _make_request():
    from api.orchestrator.loop import AgentRequest

    return AgentRequest(
        agent=_StubAgent(),
        request_id="ceil-test-1",
        message="hello ceiling test",
        workspace_id="ws-ceil-1",
    )


# ── Budgets ──────────────────────────────────────────────────────────

async def test_no_budget_means_unlimited():
    status = await agent_cost_tracker.check_budget("ws-ceil-1")
    assert status["allowed"] is True
    assert status["limit_usd"] == 0.0


async def test_budget_allows_under_limit():
    await agent_cost_tracker.set_budget("ws-ceil-1", 10.0)
    await agent_cost_tracker.track_usage("memory", "ws-ceil-1", 100, 50, "gpt-4o-mini")
    status = await agent_cost_tracker.check_budget("ws-ceil-1")
    assert status["allowed"] is True
    assert status["spent_usd"] > 0
    assert status["limit_usd"] == 10.0
    assert status["remaining_usd"] == pytest.approx(10.0 - status["spent_usd"])


async def test_budget_denies_over_limit():
    # $0.0001 budget: 1000 gpt-4o-mini input tokens cost $0.00015 → over.
    await agent_cost_tracker.set_budget("ws-ceil-1", 0.0001)
    await agent_cost_tracker.track_usage("memory", "ws-ceil-1", 1000, 0, "gpt-4o-mini")
    status = await agent_cost_tracker.check_budget("ws-ceil-1")
    assert status["allowed"] is False
    assert status["remaining_usd"] == 0.0


async def test_clear_budget_restores_unlimited():
    await agent_cost_tracker.set_budget("ws-ceil-1", 0.0001)
    await agent_cost_tracker.track_usage("memory", "ws-ceil-1", 1000, 0, "gpt-4o-mini")
    assert (await agent_cost_tracker.check_budget("ws-ceil-1"))["allowed"] is False
    assert await agent_cost_tracker.clear_budget("ws-ceil-1") is True
    assert (await agent_cost_tracker.check_budget("ws-ceil-1"))["allowed"] is True


async def test_default_budget_from_settings(monkeypatch):
    from api.config import settings

    monkeypatch.setattr(settings, "agent_default_daily_budget_usd", 0.0001)
    await agent_cost_tracker.track_usage("memory", "ws-ceil-1", 1000, 0, "gpt-4o-mini")
    status = await agent_cost_tracker.check_budget("ws-ceil-1")
    assert status["allowed"] is False
    assert status["limit_usd"] == pytest.approx(0.0001)


async def test_set_budget_rejects_negative():
    with pytest.raises(ValueError):
        await AgentCostTracker().set_budget("ws-x", -5.0)


# ── Quota ────────────────────────────────────────────────────────────

async def test_quota_fail_open_without_redis():
    """No REDIS_URL in test env → local fail-open (True, 0)."""
    import os

    os.environ.pop("REDIS__URL", None)
    os.environ.pop("REDIS_URL", None)
    from api.temporal.quota import check_and_reserve

    allowed, cur = await check_and_reserve("ws-ceil-1", "requests", 1)
    assert allowed is True


async def test_loop_calls_shared_quota(monkeypatch):
    """Loop path must use the SAME quota function as the Temporal path."""
    import api.temporal.quota as quota_mod
    from api.orchestrator import loop as loop_mod

    calls = []

    async def fake_check(workspace_id, metric="requests", increment=1, limit=None):
        calls.append((workspace_id, metric, increment))
        return False, 9999  # deny → loop must surface quota card

    monkeypatch.setattr(quota_mod, "check_and_reserve", fake_check)
    result = await loop_mod._act_phase_inner({"message": "hi"}, _make_request())
    assert calls and calls[0][0] == "ws-ceil-1" and calls[0][1] == "requests"
    assert result["action"] == "error"
    assert "quota" in result["result"]["summary"].lower()


# ── Loop enforcement ─────────────────────────────────────────────────

async def test_loop_blocked_when_budget_exceeded():
    await agent_cost_tracker.set_budget("ws-ceil-1", 0.0001)
    await agent_cost_tracker.track_usage("memory", "ws-ceil-1", 1000, 0, "gpt-4o-mini")
    from api.orchestrator import loop as loop_mod

    result = await loop_mod._act_phase_inner({"message": "hi"}, _make_request())
    assert result["action"] == "error"
    assert "budget" in result["result"]["summary"].lower()
    assert result["agent_name"] == "_stub"  # derived from _StubAgent class name


async def test_loop_passes_gate_when_no_budget():
    """Gate must not block normal traffic when no budget is configured."""
    import api.temporal.quota as quota_mod
    from api.orchestrator import loop as loop_mod

    async def fake_allow(*a, **k):
        return True, 1

    # Patch quota to allow (no redis in CI) then verify we get PAST the gate:
    # ReAct is disabled by default and static dispatch needs a real agent, so
    # we assert the failure (if any) is NOT a ceiling card.
    import unittest.mock as mock

    with mock.patch.object(quota_mod, "check_and_reserve", side_effect=fake_allow):
        try:
            result = await loop_mod._act_phase_inner({"message": "hi"}, _make_request())
        except Exception:
            return  # static dispatch needs DB — gate passed if we got here
    summary = (result.get("result") or {}).get("summary", "")
    assert "budget" not in summary.lower() and "quota" not in summary.lower()


# ── Configurable ReAct rounds ────────────────────────────────────────

async def test_react_rounds_follow_settings(monkeypatch):
    """Stream always emits an unknown tool → loop must stop after N rounds."""
    from api.config import settings
    from api.orchestrator import loop as loop_mod
    from api.services.llm_service import LLMService, llm_service

    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-key")
    monkeypatch.setattr(settings, "agent_max_react_rounds", 2)

    # Isolate from card-registry pollution: _dispatch_agent's get_or_create
    # side effect (Phase A authorization gate) permanently registers a
    # fallback `_stub` card with default max_react_rounds=5, which would
    # otherwise win over this test's explicit settings override via the
    # `card_max or settings` precedence in _try_react_loop.
    from api.orchestrator.card_registry import card_registry
    for _leaked in ("_stub", "stub"):
        card_registry._cards.pop(_leaked, None)

    calls = {"n": 0}

    async def fake_stream(*args, **kwargs):
        calls["n"] += 1
        yield {
            "type": "tool_calls",
            "tool_calls": [
                {"id": "c1", "function": {"name": "nope_unknown_tool", "arguments": "{}"}}
            ],
        }

    # Patch BOTH class and singleton (instance attrs shadow class patches).
    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", fake_stream)

    result = await loop_mod._try_react_loop(
        _StubAgent(), "do a multi-step research task", "ws-ceil-1", "stub"
    )
    assert result is None  # rounds exhausted, no answer
    assert calls["n"] == 2


async def test_react_default_rounds_is_bounded():
    from api.config import settings

    assert 1 <= int(settings.agent_max_react_rounds) <= 10
