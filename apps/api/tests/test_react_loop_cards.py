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
from api.services.llm_service import llm_service


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

    # Stream generator yielding direct answer
    async def mock_stream(messages, tools=None):
        captured_messages.extend(messages)
        yield {
            "type": "text_delta",
            "text": '{"summary": "Here is your structured summary", "proposals": [{"id": 1}], "action": "suggest"}',
        }
        yield {"type": "done"}

    monkeypatch.setattr(llm_service, "generate_completion_with_tools_stream", mock_stream)

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
    async def mock_stream(messages, tools=None):
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

    monkeypatch.setattr(llm_service, "generate_completion_with_tools_stream", mock_stream)

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
async def test_react_loop_approval_gated_tool(monkeypatch):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    rounds_messages = []

    async def mock_stream(messages, tools=None):
        rounds_messages.append(list(messages))
        if len(rounds_messages) == 1:
            # First round: LLM tries to call draft_email (which is in approval_gated_tools)
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "id": "call_draft_1",
                        "function": {
                            "name": "draft_email",
                            "arguments": json.dumps({"recipient": "test@company.com", "subject": "Hi"}),
                        },
                    }
                ],
            }
        else:
            # Second round: receives approval required notice, synthesizes safe response
            yield {
                "type": "text_delta",
                "text": '{"summary": "Drafted email awaiting approval.", "proposals": []}',
            }
        yield {"type": "done"}

    monkeypatch.setattr(llm_service, "generate_completion_with_tools_stream", mock_stream)

    agent = DummyAgent()
    result = await _try_react_loop(
        agent=agent,
        message="Send an email to the hiring manager",
        workspace_id="ws_123",
        agent_name="dummy",
    )

    assert result is not None
    # Check that the tool result in the 2nd round message history informed the LLM about approval required
    tool_feedback = [m for m in rounds_messages[1] if m.get("role") == "tool"]
    assert len(tool_feedback) == 1
    assert "Approval required" in tool_feedback[0]["content"]


@pytest.mark.asyncio
async def test_act_phase_react_integration(monkeypatch):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")

    async def mock_stream(messages, tools=None):
        yield {
            "type": "text_delta",
            "text": '{"summary": "Act phase direct answer", "proposals": []}',
        }
        yield {"type": "done"}

    monkeypatch.setattr(llm_service, "generate_completion_with_tools_stream", mock_stream)

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

