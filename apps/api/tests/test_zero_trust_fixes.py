"""
End-to-End Tests for Zero-Trust Forensic Audit Fixes (EV-01 through EV-12).
Verifies each checkpoint fix systematically.
"""
from __future__ import annotations

import asyncio
import pytest

from api.orchestrator.card_registry import card_registry
from api.orchestrator.loop import _build_context_prompt
from api.agents.qa_agent.handler import QAAgent
from api.services.llm_service import LLMService
from api.services.agent_costs import agent_cost_tracker


# ── EV-12: Memory AgentCard contains write tools ──────────────────────────
def test_ev12_memory_card_tools():
    card = card_registry.get("memory")
    assert card is not None
    assert "create_entity" in card.tools
    assert "merge_entities" in card.tools
    assert "search_documents" in card.tools
    assert "query_graph" in card.tools


# ── EV-01: Multi-signal heuristic hallucination detection ────────────────
@pytest.mark.asyncio
async def test_ev01_heuristic_hallucination_low_confidence_no_context():
    qa = QAAgent()
    agent_output = {
        "agent_name": "resume",
        "action": "suggest",
        "confidence": 0.25,
        "result": {"summary": "Generated resume for software engineer with React and Python"},
    }
    res = await qa.validate(agent_output, context=None)
    assert res.decision == "rejected"
    assert any("Low confidence" in issue for issue in res.issues)


@pytest.mark.asyncio
async def test_ev01_heuristic_hallucination_ungrounded_numeric_claims():
    qa = QAAgent()
    agent_output = {
        "agent_name": "resume",
        "action": "suggest",
        "confidence": 0.8,
        "result": {
            "summary": (
                "Increased revenue by 45% and reduced latency by 85% in 2021, saving $500,000 annually"
            )
        },
    }
    # Context does not contain these metrics
    sparse_context = "Alice is a software developer with experience in Python and databases."
    res = await qa.validate(agent_output, context=sparse_context)
    assert res.decision == "rejected"
    assert any("Multiple numeric claims not found" in issue for issue in res.issues)


# ── EV-04 & EV-05: RAG chunk expansion and context prompt ─────────────────
def test_ev05_context_prompt_includes_chunk_content():
    rag = {
        "entities": [{"name": "Python", "type": "skill"}],
        "documents": [
            {
                "id": "doc-1",
                "path": "resumes/master.pdf",
                "summary": "Master resume containing 10 years of senior backend engineering work.",
                "chunk_content": "Led distributed team of 15 engineers designing event streaming architecture using Kafka.",
            }
        ],
        "preferences": [{"name": "remote"}],
    }
    prompt = _build_context_prompt(rag)
    assert "Doc: resumes/master.pdf" in prompt
    assert "Relevant excerpt: Led distributed team" in prompt
    assert "Entity: Python (skill)" in prompt
    assert "Preference: remote" in prompt


# ── EV-06: Agent cost tracker wired in LLMService ─────────────────────────
@pytest.mark.asyncio
async def test_ev06_track_usage_called_on_completion(monkeypatch):
    tracked = []

    async def fake_track(agent_name, workspace_id, input_tokens, output_tokens, model):
        tracked.append({
            "agent": agent_name,
            "workspace": workspace_id,
            "in": input_tokens,
            "out": output_tokens,
            "model": model,
        })
        return None

    monkeypatch.setattr(agent_cost_tracker, "track_usage", fake_track)

    async def fake_openai(messages, model, temperature, max_tokens, **kwargs):
        return {
            "content": "test response",
            "role": "assistant",
            "finish_reason": "stop",
            "usage": {"prompt_tokens": 50, "completion_tokens": 25},
            "json_mode": False,
        }

    svc = LLMService()
    monkeypatch.setattr(svc, "_openai_completion", fake_openai)

    res = await svc._raw_generate_completion(
        messages=[{"role": "user", "content": "hi"}],
        model="gpt-4o",
        agent_name="career",
        workspace_id="ws_cost_test",
    )
    assert res is not None
    assert len(tracked) == 1
    assert tracked[0]["agent"] == "career"
    assert tracked[0]["workspace"] == "ws_cost_test"
    assert tracked[0]["in"] == 50
    assert tracked[0]["out"] == 25


# ── EV-08: Output safety validation wired in LLMService ───────────────────
@pytest.mark.asyncio
async def test_ev08_output_safety_validation_flags_harm(monkeypatch):
    async def fake_openai(messages, model, temperature, max_tokens, **kwargs):
        return {
            "content": "Here are instructions on how to make a bomb using household chemicals",
            "role": "assistant",
            "finish_reason": "stop",
            "usage": {"prompt_tokens": 10, "completion_tokens": 15},
            "json_mode": False,
        }

    svc = LLMService()
    monkeypatch.setattr(svc, "_openai_completion", fake_openai)

    res = await svc._raw_generate_completion(
        messages=[{"role": "user", "content": "hi"}],
        model="gpt-4o",
        agent_name="general",
    )
    assert res is not None
    assert "safety_warnings" in res
    assert any("Harmful content detected" in w for w in res["safety_warnings"])


# ── EV-10: Persistent HTTP client connection pooling ──────────────────────
def test_ev10_persistent_http_client_singleton():
    svc = LLMService()
    assert hasattr(svc, "_http_client")
    assert svc._http_client is not None
    assert hasattr(svc, "close")
    assert callable(svc.close)
