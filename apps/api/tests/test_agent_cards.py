"""Tests for AgentCard declarative contracts, prompt rendering, schema validation, and registry."""
from __future__ import annotations

import pytest

from api.orchestrator.base import AgentContext, BaseAgent
from api.orchestrator.card import AgentCard
from api.orchestrator.card_registry import (
    APPLICATION_CARD,
    ATS_CARD,
    JOB_SEARCH_CARD,
    RESUME_CARD,
    card_registry,
    get_agent_card,
    list_agent_cards,
    register_agent_card,
)


def test_agent_card_rendering_with_context():
    card = AgentCard(
        name="test_agent",
        version="1.0.0",
        description="A specialized test agent.",
        tools=["search_documents", "calculate_ats_score"],
        output_schema={
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
        },
        few_shot_examples=[
            {
                "user": "Hello agent",
                "tool_calls": [{"name": "search_documents", "args": {"query": "test"}}],
                "response": {"summary": "Hello user"},
            }
        ],
    )

    ctx = AgentContext(
        workspace_id="ws_123",
        profile={"name": "Alice", "skills": ["Python", "Kubernetes"]},
        preferences=[{"type": "remote", "value": "always"}],
    )

    prompt = card.render_system_prompt(ctx)

    assert "test_agent" in prompt
    assert "A specialized test agent." in prompt
    assert "Alice" in prompt
    assert "Python" in prompt
    assert "Kubernetes" in prompt
    assert "search_documents" in prompt
    assert "calculate_ats_score" in prompt
    assert "STRICT OUTPUT CONTRACT" in prompt
    assert "FEW-SHOT GOLDEN EXAMPLES" in prompt
    assert "Hello agent" in prompt


def test_agent_card_rendering_without_context():
    card = AgentCard(
        name="minimal_agent",
        description="No context needed.",
    )
    prompt = card.render_system_prompt(None)
    assert "minimal_agent" in prompt
    assert "No context needed." in prompt
    assert "OPERATIONAL BOUNDARIES" in prompt


def test_agent_card_schema_validation():
    card = AgentCard(
        name="validator_agent",
        description="Validates schema outputs.",
        output_schema={
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "score": {"type": "number"},
                "tags": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["summary", "score"],
        },
    )

    # Valid output
    valid_data = {"summary": "Valid run", "score": 98.5, "tags": ["ats", "resume"]}
    is_valid, errs = card.validate_output(valid_data)
    assert is_valid is True
    assert errs == []

    # Valid output wrapped in standard envelope {"result": {...}}
    wrapped_valid = {"action": "suggest", "result": valid_data}
    is_valid, errs = card.validate_output(wrapped_valid)
    assert is_valid is True
    assert errs == []

    # Invalid output (missing required "score", wrong type for tags)
    invalid_data = {"summary": "Invalid run", "tags": "not-an-array"}
    is_valid, errs = card.validate_output(invalid_data)
    assert is_valid is False
    assert len(errs) >= 1


def test_canonical_agent_cards_in_registry():
    assert get_agent_card("resume") is not None
    assert get_agent_card("job_search") is not None
    assert get_agent_card("application") is not None
    assert get_agent_card("ats") is not None
    assert get_agent_card("organization") is not None

    resume_card = get_agent_card("resume")
    assert "search_documents" in resume_card.tools
    assert "compile_resume_pdf" in resume_card.tools
    assert resume_card.output_schema["required"] == ["summary", "proposals", "questions"]

    # Test suffix resolution e.g. "ResumeAgent"
    assert get_agent_card("ResumeAgent") is not None
    assert get_agent_card("JobSearchAgent") is not None


def test_custom_card_registration():
    custom_card = AgentCard(
        name="custom_copilot",
        version="2.1.0",
        description="Custom engineering assistant",
        tools=["run_linter"],
    )
    register_agent_card(custom_card)

    retrieved = get_agent_card("custom_copilot")
    assert retrieved is not None
    assert retrieved.name == "custom_copilot"
    assert retrieved.version == "2.1.0"
    assert "run_linter" in retrieved.tools


def test_card_registry_get_or_create_fallback():
    class MysteryAgent(BaseAgent):
        mission = "Solves mysterious problems."
        tools = []

    inst = MysteryAgent()
    card = card_registry.get_or_create("mystery", inst)
    assert card.name == "mystery"
    assert card.description == "Solves mysterious problems."


def test_base_agent_integration():
    from api.agents.resume_agent.handler import ResumeAgent

    agent = ResumeAgent()
    # ResumeAgent automatically resolves to RESUME_CARD
    ctx = AgentContext(
        workspace_id="ws_abc",
        profile={"name": "Bob Tester", "skills": ["Go", "Distributed Systems"]},
    )
    prompt = agent.get_system_prompt(ctx)
    assert "resume" in prompt.lower()
    assert "Bob Tester" in prompt
    assert "Distributed Systems" in prompt

    # Output validation via BaseAgent
    valid_res = {
        "result": {
            "summary": "Tailored resume",
            "proposals": [{"type": "bullet", "content": "Built high-scale Go services"}],
            "questions": [],
        }
    }
    valid, errs = agent.validate_output(valid_res)
    assert valid is True
    assert errs == []
