"""Tests for the ReAct loop with AgentCard prompt injection, tool calling, and schema validation."""
from __future__ import annotations

import json
from typing import Any
import pytest

from api.agents.resume_agent.handler import ResumeAgent
from api.config import settings
from api.orchestrator.base import AgentContext, BaseAgent
from api.orchestrator.card import AgentCard
from api.orchestrator.loop import _try_react_loop, act_phase, AgentRequest
from api.services.llm_service import LLMService


class DummyAgent(BaseAgent):
    mission = "A simple agent for testing ReAct loop"
    tools = []
    card = AgentCard(
        name="dummy",
        version="1.0.0",
        description="Dummy agent for test assertions",
        tools=["search_documents", "draft_email"],
        output_schema={
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "proposals": {"type": "array"},
            },
            "required": ["summary"],
        },
    )

    async def fallback(self) -> Any:
        return {"agent_name": "dummy", "action": "fallback", "result": {"summary": "fallback"}}


@pytest.mark.asyncio
async def test_react_loop_skips_when_no_llm_key(monkeypatch):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "")

    agent = DummyAgent()
    result = await _try_react_loop(agent, "test message", "ws_123", "dummy")
    assert result is None


@pytest.mark.asyncio
async def test_react_loop_direct_structured_answer(monkeypatch):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    captured_messages = []

    # Stream generator yielding direct answer.
    # NOTE: patched at CLASS level with explicit self — patching the
    # llm_service singleton instance leaves a shadowing __dict__ entry after
    # teardown (pytest restores by assignment) that hijacks later tests'
    # class-level patches. Never patch the singleton instance bare.
    async def mock_stream(self, messages, tools=None, **kwargs):
        captured_messages.extend(messages)
        yield {
            "type": "text_delta",
            "text": '{"summary": "Here is your structured summary", "proposals": [{"id": 1}], "action": "suggest"}',
        }
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)

    agent = DummyAgent()
    ctx = AgentContext(workspace_id="ws_123", profile={"name": "Alice Tester"})

    result = await _try_react_loop(
        agent=agent,
        message="Please summarize my documents",
        workspace_id="ws_123",
        agent_name="dummy",
        context=ctx,
    )

    assert result is not None
    assert result["agent_name"] == "dummy"
    assert result["confidence"] >= 0.88
    assert result["result"]["summary"] == "Here is your structured summary"

    # Verify that the system prompt contained the AgentCard prompt with user context
    system_msg = next((m for m in captured_messages if m["role"] == "system"), None)
    assert system_msg is not None
    assert "dummy" in system_msg["content"]
    assert "Alice Tester" in system_msg["content"]
    assert "STRICT OUTPUT CONTRACT" in system_msg["content"]


@pytest.mark.asyncio
async def test_react_loop_tool_execution_flow(monkeypatch):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    call_count = 0

    # Stream generator yielding tool_calls in round 0, and final text in round 1
    async def mock_stream(self, messages, tools=None, **kwargs):
        nonlocal call_count
        if call_count == 0:
            call_count += 1
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "id": "call_search_1",
                        "function": {
                            "name": "search_documents",
                            "arguments": json.dumps({"query": "python experience"}),
                        },
                    }
                ],
            }
        else:
            yield {
                "type": "text_delta",
                "text": json.dumps({
                    "summary": "Found 2 matching resume documents with Python experience.",
                    "proposals": [{"type": "doc", "title": "Resume 2026"}],
                }),
            }
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)

    agent = DummyAgent()
    result = await _try_react_loop(
        agent=agent,
        message="Search my python background",
        workspace_id="ws_123",
        agent_name="dummy",
    )

    assert result is not None
    assert "Found 2 matching resume documents" in result["result"]["summary"]


@pytest.mark.asyncio
async def test_react_loop_approval_gated_tool(monkeypatch, db_session):
    """Approval-gated tools are never auto-executed: without approval the run
    pauses with a durable PENDING request + card (real DB rows)."""
    import uuid as _uuid
    from sqlalchemy import select as _select
    from api.models.schema import AgentApproval

    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    class _SessionCtx:
        def __init__(self, s):
            self.s = s

        async def __aenter__(self):
            return self.s

        async def __aexit__(self, *a):
            return False

    _factory = lambda: _SessionCtx(db_session)  # noqa: E731
    monkeypatch.setattr("api.database.async_session_factory", _factory)

    async def mock_stream(self, messages, tools=None, **kwargs):
        # LLM requests draft_email with the REAL schema args (to/subject/body).
        yield {
            "type": "tool_calls",
            "tool_calls": [
                {
                    "id": "call_draft_1",
                    "function": {
                        "name": "draft_email",
                        "arguments": json.dumps({"to": "test@company.com", "subject": "Hi", "body": "Hello"}),
                    },
                }
            ],
        }
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)

    ws = str(_uuid.uuid4())
    agent = DummyAgent()
    result = await _try_react_loop(
        agent=agent,
        message="Send an email to the hiring manager",
        workspace_id=ws,
        agent_name="dummy",
        db=db_session,
        request_id=f"req-approval-{_uuid.uuid4().hex[:8]}",
    )

    assert result is not None
    assert result["action"] == "request_approval", result
    approval_id = (result.get("approval") or {}).get("approval_id")
    assert approval_id, result
    # Durable PENDING request bound to this exact tool+args.
    row = (await db_session.execute(
        _select(AgentApproval).where(AgentApproval.id == _uuid.UUID(approval_id))
    )).scalar_one_or_none()
    assert row is not None and row.status == "PENDING"
    assert (row.payload or {}).get("tool") == "draft_email"
    # Termination is explicit and the run ledger records the pause.
    assert result.get("termination_reason") == "success"  # outer flow surfaces the card as satisfied work
    assert (result.get("react") or {}).get("termination") == "approval_paused"


@pytest.mark.asyncio
async def test_act_phase_react_integration(monkeypatch):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    async def mock_stream(self, messages, tools=None, **kwargs):
        yield {
            "type": "text_delta",
            # Valid resume contract: summary + proposals + questions.
            "text": '{"summary": "Act phase direct answer", "proposals": [], "questions": []}',
        }
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)

    plan = {
        "agent": "resume",
        "agent_name": "resume",
        "agent_type": "ResumeAgent",
        "agent_context": AgentContext(workspace_id="ws_999", profile={"skills": ["Python"]}),
    }
    agent_inst = ResumeAgent()
    req = AgentRequest(
        agent=agent_inst,
        request_id="req_test_1",
        message="Tailor my resume with Python",
        workspace_id="ws_999",
        agent_name="resume",
    )

    act_result = await act_phase(plan, req)
    assert act_result is not None
    assert act_result["agent_name"] == "resume"
    assert "Act phase direct answer" in act_result["result"]["summary"]

