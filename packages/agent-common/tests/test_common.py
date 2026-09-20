import pytest
from uuid import uuid4
import time

from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    AutonomyLevel,
    SSEEventType,
)
from vaeloom_agent_security import SecurityContext
from vaeloom_agent_common import (
    AgentTurnContext,
    CancellationToken,
    AgentCancelledError,
    SSEFormatter,
    ReActStep,
    BaseAgent,
)


class DummyAgent(BaseAgent):
    async def run_step(self, context: AgentTurnContext, token: CancellationToken) -> ReActStep:
        token.check()
        return ReActStep(
            step_index=context.step_count,
            thought="Analyzing user request",
            is_final=True,
            final_answer="Analysis complete",
        )


def test_base_agent_tool_validation():
    manifest = AgentManifest(
        agent_id="dummy-agent",
        name="Dummy Agent",
        version="1.0.0",
        description="Dummy testing agent",
        category=AgentCategory.SYSTEM,
        autonomy_level=AutonomyLevel.FULL,
        tools=["web_search"],
    )
    agent = DummyAgent(manifest)
    
    assert agent.validate_tool_call("web_search").allowed is True
    assert agent.validate_tool_call("execute_code").allowed is False


def test_cancellation_token():
    token = CancellationToken(timeout_seconds=0.1)
    token.check()  # Should not raise initially
    
    time.sleep(0.15)
    with pytest.raises(AgentCancelledError, match="timed out"):
        token.check()

    manual_token = CancellationToken()
    manual_token.cancel()
    with pytest.raises(AgentCancelledError, match="cancelled"):
        manual_token.check()


def test_sse_formatter():
    session_id = uuid4()
    formatted = SSEFormatter.format_event(
        event_type=SSEEventType.THINKING_STEP,
        session_id=session_id,
        step_index=1,
        payload={"thought": "Processing goals"},
    )
    assert "event: thinking_step" in formatted
    assert "Processing goals" in formatted
    assert formatted.endswith("\n\n")
