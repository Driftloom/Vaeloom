"""ReAct revival safety verification.

The ReAct loop in `loop.py:_try_react_loop` was 100% dead: lines ~1648-1649 read
a bare `request` object that does not exist in that scope, so every round raised
NameError, the outer handler swallowed it into a `None` return, and act_phase
fell through to static dispatch. Every test still "passed" because they asserted
the `None`/fallback outcome the crash produced.

Reviving it changes `act_phase` from "always static dispatch" to "ReAct first,
static on failure". That is only safe if the QA grounding gate — which exists to
catch hallucinated claims — still validates whatever ReAct produced.

These tests pin that property. If someone later removes the QA gate from the
ReAct path, `test_react_result_still_passes_through_qa_gate` fails.
"""

import uuid

import pytest

from api.agents.resume_agent.handler import ResumeAgent
from api.config import settings
from api.orchestrator.base import AgentContext
from api.orchestrator.loop import AgentRequest, _circuit_breakers, run_agent_loop


class _ScriptedAgent(ResumeAgent):
    """Resume agent whose static path would produce a clearly-known answer.

    If the run ever returns this text, the static ladder ran. If it returns the
    ReAct text instead, ReAct took over.
    """

    STATIC_TEXT = "STATIC-PATH-RAN"

    async def execute(self, context: AgentContext) -> dict:
        return {
            "summary": self.STATIC_TEXT,
            "details": None,
            "proposals": [],
            "questions": [],
        }

    async def fallback(self):
        return {"agent_name": "resume", "action": "fallback", "result": {"summary": self.STATIC_TEXT}}


def _req(agent) -> AgentRequest:
    return AgentRequest(
        agent=agent,
        request_id=f"req_{uuid.uuid4()}",
        message="summarise my experience",
        workspace_id=str(uuid.uuid4()),
        agent_name="resume",
    )


class TestReactIsActuallyAlive:
    """The loop must no longer be a silent no-op."""

    @pytest.mark.asyncio
    async def test_react_loop_does_not_swallow_a_nameerror(self, monkeypatch):
        """
        Regression for the dead loop. Previously every round hit
        `NameError: name 'request' is not defined`, was caught by the outer
        handler, and returned None. We assert that specific exception no longer
        occurs and that a real round is attempted.
        """
        from api.services.llm_service import LLMService
        from api.orchestrator import loop as loop_mod

        monkeypatch.setattr(settings, "agent_react_enabled", True)
        monkeypatch.setattr(settings, "llm_api_key", "test-key")
        _circuit_breakers.clear()

        calls: list[dict] = []

        async def mock_stream(self, messages, tools=None, **kwargs):
            calls.append({"model": kwargs.get("model"), "temperature": kwargs.get("temperature")})
            yield {
                "type": "text_delta",
                "text": '{"summary": "react answer", "action": "suggest"}',
            }
            yield {"type": "done"}

        monkeypatch.setattr(
            LLMService, "generate_completion_with_tools_stream", mock_stream, raising=False
        )

        result = await loop_mod._try_react_loop(
            agent=_ScriptedAgent(),
            message="summarise my experience",
            workspace_id=str(uuid.uuid4()),
            agent_name="resume",
        )

        # The loop reached the LLM call — i.e. it did not die before it.
        assert calls, "ReAct never reached the model; the loop is dead again"
        assert calls[0]["model"], "model must be resolved, not None"
        assert result is not None, "a working ReAct round must produce a result"


class TestQaGateAppliesToReactResults:
    """A hallucinated ReAct answer must still be rejected."""

    @pytest.mark.asyncio
    async def test_react_result_still_passes_through_qa_gate(self, monkeypatch):
        """
        run_agent_loop validates whatever act_phase returns — including a ReAct
        result — with QAAgent.validate(). If a ReAct answer containing an
        unsupported claim reaches the user, the gate has been bypassed.

        The QA agent is stubbed to *reject*, so this asserts the wiring, not the
        judge: the run must terminate as failed rather than surfacing the text.
        """
        from api.agents.qa_agent.handler import QAAgent

        monkeypatch.setattr(settings, "agent_react_enabled", True)
        monkeypatch.setattr(settings, "llm_api_key", "test-key")
        _circuit_breakers.clear()

        agent = _ScriptedAgent()

        # Force act_phase to hand back a ReAct-style result directly, so this
        # test exercises the gate-on-act_result wiring without depending on the
        # ReAct loop's own mocking.
        async def fake_act_phase(plan, request, on_token=None, state=None):
            return {
                "agent_name": "resume",
                "action": "suggest",
                "confidence": 0.9,
                "result": {
                    "summary": "Invented 10 years Kubernetes experience",
                    "details": None,
                    "proposals": [],
                    "questions": [],
                },
            }

        monkeypatch.setattr(
            "api.orchestrator.loop._act_phase_inner", fake_act_phase, raising=False
        )

        class _Rejecting:
            decision = "rejected"
            issues = ["Grounding violation: unsupported claim"]

        async def fake_validate(self, result, context=None):
            return _Rejecting()

        monkeypatch.setattr(QAAgent, "validate", fake_validate, raising=False)

        resp = await run_agent_loop(_req(agent))

        assert resp.status != "success", (
            "a rejected act result must not be surfaced as a successful run"
        )
        assert "Invented 10 years Kubernetes" not in str(resp.final_result), (
            "rejected content leaked to the user — the QA gate was bypassed"
        )


class TestApprovalGateNotBypassed:
    """ReAct must not execute tools the agent card does not permit."""

    @pytest.mark.asyncio
    async def test_react_cannot_execute_out_of_contract_tools(self, monkeypatch):
        """
        Negative control on the Muse enforcement ladder. ReAct proposes tools
        freely; every proposal must still pass existence -> arg-schema -> scope ->
        AgentCard contract -> approval before execution. A tool absent from the
        card must be denied, not executed.
        """
        from api.tools.definitions import CREATE_MEMORY, SEARCH_MEMORIES
        from api.tools.executor import PermissionDeniedError, execute_tool

        # Gate 1 — scope. A registered tool called with no scopes granted must be
        # denied outright, so ReAct cannot write memory it was not given.
        with pytest.raises(PermissionDeniedError):
            await execute_tool(
                tool=CREATE_MEMORY,
                params={"content": "should never be written"},
                agent_id="resume",
                agent_scopes=[],
                workspace_id=str(uuid.uuid4()),
            )

        # Gate 2 — AgentCard contract. Holding `memory.read` is still not enough:
        # the resume agent's card does not list search_memories, so the contract
        # check denies it. ReAct proposing a tool the card omits must fail here,
        # which is the property that actually protects the ladder.
        with pytest.raises(PermissionDeniedError):
            await execute_tool(
                tool=SEARCH_MEMORIES,
                params={"query": "anything", "strategy": "keyword"},
                agent_id="resume",
                agent_scopes=["memory.read"],
                workspace_id=str(uuid.uuid4()),
            )