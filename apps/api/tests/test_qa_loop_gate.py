"""Tests for Grounded QA Judge and Closed Loop Verification Gate."""
from __future__ import annotations

import pytest

from api.agents.qa_agent.handler import QAAgent
from api.config import settings
from api.orchestrator.base import AgentContext, BaseAgent
from api.orchestrator.loop import AgentRequest, run_agent_loop
from api.services.llm_service import llm_service


from api.agents.resume_agent.handler import ResumeAgent
from api.orchestrator.loop import _circuit_breakers


class MockGroundedAgent(ResumeAgent):
    def __init__(self, output_to_produce: dict):
        super().__init__()
        self.output = output_to_produce

    async def execute(self, profile):
        return self.output


@pytest.mark.asyncio
async def test_llm_grounding_judge_flags_discrepancy(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    async def mock_llm_completion(*args, **kwargs):
        return {
            "content": '{"is_grounded": false, "unsupported_claims": ["Invented 10 years Kubernetes experience at Google"]}',
            "role": "assistant",
        }

    monkeypatch.setattr(llm_service, "generate_completion", mock_llm_completion)

    qa = QAAgent()
    agent_output = {
        "agent_name": "resume",
        "action": "suggest",
        "confidence": 0.9,
        "result": {
            "summary": "10 years Kubernetes experience at Google",
            "details": "Lead engineer",
            "proposals": [],
            "questions": [],
        },
    }
    ctx = AgentContext(
        workspace_id="ws_123",
        profile={"name": "Junior Dev", "skills": ["HTML"]},
    )

    qa_res = await qa.validate(agent_output, context=ctx)
    assert qa_res.decision == "rejected"
    assert any("Grounding violation" in issue for issue in qa_res.issues)
    assert any("Invented 10 years Kubernetes" in issue for issue in qa_res.issues)


@pytest.mark.asyncio
async def test_loop_executes_qa_verification_gate(monkeypatch):
    _circuit_breakers.clear()
    valid_output = {
        "agent_name": "resume",
        "action": "suggest",
        "confidence": 0.95,
        "result": {
            "summary": "Verified valid resume response.",
            "details": None,
            "proposals": [],
            "questions": [],
        },
    }
    agent = MockGroundedAgent(valid_output)
    import uuid

    req = AgentRequest(
        agent=agent,
        request_id=f"req_{uuid.uuid4()}",
        message="Review my experience",
        workspace_id=str(uuid.uuid4()),
        agent_name="resume",
    )

    resp = await run_agent_loop(req)
    assert resp.status == "success"
    assert "Verified valid resume response." in resp.final_result


@pytest.mark.asyncio
async def test_loop_qa_gate_triggers_retry_on_rejection(monkeypatch):
    _circuit_breakers.clear()
    import uuid

    attempts = 0

    class RetryMockAgent(ResumeAgent):
        def __init__(self):
            super().__init__()

        async def execute(self, profile):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                # QA rejects because confidence < 0.5
                return {
                    "agent_name": "resume",
                    "action": "suggest",
                    "confidence": 0.2,
                    "result": {
                        "summary": "Low confidence draft.",
                        "details": None,
                        "proposals": [],
                        "questions": [],
                    },
                }
            return {
                "agent_name": "resume",
                "action": "suggest",
                "confidence": 0.9,
                "result": {
                    "summary": "High confidence corrected draft.",
                    "details": None,
                    "proposals": [],
                    "questions": [],
                },
            }

    agent = RetryMockAgent()
    req = AgentRequest(
        agent=agent,
        request_id=f"req_{uuid.uuid4()}",
        message="Review my experience",
        workspace_id=str(uuid.uuid4()),
        agent_name="resume",
    )

    resp = await run_agent_loop(req)
    assert resp.status == "success"
    assert "High confidence corrected draft." in resp.final_result
    assert attempts == 2

