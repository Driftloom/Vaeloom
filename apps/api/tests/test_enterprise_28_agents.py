"""
Unit and integration tests for the full 28 Enterprise Agent roster.
Verifies all 28 agents instantiate, declare valid contracts, and process tasks.
"""
import pytest
from httpx import AsyncClient

from api.orchestrator.base import BaseAgent
from api.orchestrator.router import AGENT_REGISTRY, classify_intent

pytestmark = pytest.mark.asyncio


async def test_enterprise_roster_exact_count_28():
    """Verify AGENT_REGISTRY contains exactly 28 routable enterprise agents."""
    assert len(AGENT_REGISTRY) == 28, f"Expected 28 agents, found {len(AGENT_REGISTRY)}: {list(AGENT_REGISTRY.keys())}"


async def test_all_28_agents_contract_compliance():
    """Every agent in AGENT_REGISTRY must inherit BaseAgent and adhere to the contract."""
    expected_agents = [
        "organization", "memory", "resume", "ats", "job_search", "application",
        "gmail", "scheduler", "planning", "research", "career", "learning",
        "github", "coding", "reminder", "analytics", "recommendation", "reflection",
        "security", "connector", "plugin", "drive",
        # 6 new specialist agents:
        "workspace", "calendar", "internship", "document", "pdf", "self_improvement"
    ]

    for name in expected_agents:
        assert name in AGENT_REGISTRY, f"Agent '{name}' missing from AGENT_REGISTRY"
        agent_cls = AGENT_REGISTRY[name]
        assert issubclass(agent_cls, BaseAgent), f"Agent '{name}' must subclass BaseAgent"

        instance = agent_cls()
        assert instance.mission, f"Agent '{name}' must define mission"
        assert isinstance(instance.tools, list), f"Agent '{name}' tools must be a list"
        assert len(instance.tools) > 0, f"Agent '{name}' must define at least one tool"
        assert hasattr(instance, "memory_scopes"), f"Agent '{name}' must have memory_scopes"
        assert instance.default_autonomy in ("suggest", "full", "read_only", "approval_gated")


async def test_all_28_agents_fallback_method():
    """Every agent's fallback() must return a structured dictionary."""
    for name, agent_cls in AGENT_REGISTRY.items():
        instance = agent_cls()
        fb = await instance.fallback()
        assert isinstance(fb, dict), f"Agent '{name}' fallback() did not return dict"
        assert "agent_name" in fb
        assert "action" in fb
        assert "result" in fb


async def test_new_specialist_agents_execution():
    """Verify the 6 newly added enterprise specialist agents execute process() cleanly."""
    new_agent_names = ["workspace", "calendar", "internship", "document", "pdf", "self_improvement"]

    for name in new_agent_names:
        agent_cls = AGENT_REGISTRY[name]
        agent = agent_cls()

        req = {"message": f"Run {name} task for workspace ws-123", "workspace_id": "ws-123"}
        res = await agent.process(req)
        assert isinstance(res, dict)
        assert res.get("agent_name") == name
        assert res.get("confidence", 0) > 0.8
        assert "result" in res
        assert "summary" in res["result"]


async def test_stage2_routing_to_new_agents():
    """Verify router correctly dispatches queries to the 6 new agents."""
    test_cases = [
        ("Identify redundant duplicate files in workspace hierarchy", "workspace"),
        ("Find an open calendar meeting slot for next week", "calendar"),
        ("Search for Summer 2027 student internship and fellowship programs", "internship"),
        ("Synthesize deep multi-document citation facts", "document"),
        ("Extract and fill PDF form fields from my profile", "pdf"),
        ("Critique reasoning accuracy and benchmark agent accuracy", "self_improvement"),
    ]

    for query, expected_agent in test_cases:
        agent, conf = await classify_intent(query)
        assert agent == expected_agent, f"Query '{query}' routed to '{agent}', expected '{expected_agent}'"
