import pytest
from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    AutonomyLevel,
    BudgetConfig,
    MemoryScopeConfig,
    DelegationPolicy,
    MemoryAccessType,
)
from vaeloom_agent_policy import (
    PolicyEngine,
    load_manifest_from_yaml,
)


@pytest.fixture
def sample_manifest():
    return AgentManifest(
        agent_id="career-agent",
        name="Career Agent",
        version="1.0.0",
        description="Career path recommendations",
        category=AgentCategory.CAREER,
        autonomy_level=AutonomyLevel.APPROVAL_GATED,
        tools=["search_jobs", "query_graph", "create_calendar_event"],
        gated_tools=["create_calendar_event"],
        memory_scopes=MemoryScopeConfig(
            read_scopes=["career_history", "profile"],
            write_scopes=["career_notes"],
            denied_scopes=["financial_records"],
        ),
        delegation=DelegationPolicy(
            allowed_targets=["ats-agent", "resume-agent"],
            max_depth=2,
            can_delegate=True,
        ),
        budget=BudgetConfig(
            max_tokens_per_turn=4000,
            max_steps_per_turn=10,
            max_usd_per_turn=0.25,
        ),
    )


def test_tool_authorization_and_approval_gate(sample_manifest):
    engine = PolicyEngine(sample_manifest)
    
    # Allowed read tool
    v1 = engine.authorize_tool("search_jobs")
    assert v1.allowed is True
    assert v1.requires_approval is False

    # Allowed gated tool
    v2 = engine.authorize_tool("create_calendar_event")
    assert v2.allowed is True
    assert v2.requires_approval is True

    # Denied undeclared tool
    v3 = engine.authorize_tool("execute_code_sandbox")
    assert v3.allowed is False
    assert "not declared" in v3.reason


def test_memory_scope_authorization(sample_manifest):
    engine = PolicyEngine(sample_manifest)

    # Allowed read
    assert engine.authorize_memory_access("career_history", MemoryAccessType.READ).allowed is True

    # Denied write to read-only scope
    assert engine.authorize_memory_access("career_history", MemoryAccessType.WRITE).allowed is False

    # Allowed write
    assert engine.authorize_memory_access("career_notes", MemoryAccessType.WRITE).allowed is True

    # Explicitly denied scope
    v_denied = engine.authorize_memory_access("financial_records", MemoryAccessType.READ)
    assert v_denied.allowed is False
    assert "explicitly denied" in v_denied.reason


def test_delegation_policy(sample_manifest):
    engine = PolicyEngine(sample_manifest)

    # Allowed target within depth
    assert engine.authorize_delegation("ats-agent", current_depth=1).allowed is True

    # Target not in allowed list
    assert engine.authorize_delegation("github-agent", current_depth=1).allowed is False

    # Exceeding max depth
    assert engine.authorize_delegation("ats-agent", current_depth=2).allowed is False


def test_budget_exhaustion(sample_manifest):
    engine = PolicyEngine(sample_manifest)

    # Within budget
    assert engine.check_budget(current_tokens=2000, current_steps=5, current_cost_usd=0.10).allowed is True

    # Token ceiling hit
    assert engine.check_budget(current_tokens=4000, current_steps=5, current_cost_usd=0.10).allowed is False

    # Step limit hit
    assert engine.check_budget(current_tokens=1000, current_steps=10, current_cost_usd=0.10).allowed is False


def test_load_manifest_from_yaml_string():
    yaml_text = """
agent_id: test-agent
name: Test Agent
version: 1.0.0
description: A testing agent
category: system
autonomy_level: read_only
tools:
  - web_search
"""
    manifest = load_manifest_from_yaml(yaml_text)
    assert manifest.agent_id == "test-agent"
    assert manifest.tools == ["web_search"]
