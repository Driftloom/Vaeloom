"""Enterprise StateGraph Execution Engine Test Suite.

Verifies:
- StateGraph full execution traversal (understand -> plan -> execute -> observe -> approve -> reflect -> complete)
- Illegal state transition prevention via ExecutionStateMachine
- Approval gate pausing (waiting_approval) and resumption
- Streaming node transitions through AsyncGenerator
- Greeting fast-path optimization
"""

import pytest

from api.orchestrator.execution import (
    ExecutionState,
    ExecutionStateMachine,
    InvalidStateTransitionError,
    StateGraph,
)

pytestmark = pytest.mark.asyncio


async def test_stategraph_greeting_fast_path():
    """Verify greeting fast-path transitions directly to complete."""
    graph = StateGraph()
    state = ExecutionState(
        agent_name="career_architect",
        message="hello",
    )
    result = await graph.run(state)
    assert result.is_terminal is True
    assert result.status == "completed"
    assert "Hello!" in result.final_response


async def test_stategraph_full_traversal():
    """Verify graph runs through full ReAct nodes when tools are available."""
    graph = StateGraph()
    state = ExecutionState(
        agent_name="resume",
        message="Optimize bullet points for AWS and Python",
        available_tools=["search_documents"],
    )
    result = await graph.run(state)
    assert result.is_terminal is True
    assert result.status == "completed"
    assert len(result.tool_calls) > 0
    assert len(result.observations) > 0
    assert result.final_response is not None


async def test_stategraph_approval_pause_and_resume():
    """Verify state machine pauses when proposal requires approval, then resumes upon user approval."""
    graph = StateGraph()
    state = ExecutionState(
        agent_name="organization",
        message="Clean up obsolete files",
        proposals=[{
            "title": "Purge files",
            "requires_approval": True,
            "action": "delete_all",
        }],
    )

    paused_state = await graph.run(state)
    assert paused_state.status == "waiting_approval"
    assert paused_state.pending_approval is not None
    assert paused_state.is_terminal is False

    # Resume with approval granted
    resumed_state = await graph.resume(paused_state, approved=True)
    assert resumed_state.is_approved is True
    assert resumed_state.status == "completed"
    assert resumed_state.is_terminal is True


async def test_stategraph_approval_decline():
    """Verify state machine cancels execution when user declines approval."""
    graph = StateGraph()
    state = ExecutionState(
        agent_name="organization",
        message="Drop database tables",
        proposals=[{
            "title": "Drop tables",
            "requires_approval": True,
        }],
    )

    paused_state = await graph.run(state)
    assert paused_state.status == "waiting_approval"

    declined_state = await graph.resume(paused_state, approved=False)
    assert declined_state.status == "cancelled"
    assert declined_state.is_terminal is True
    assert "declined" in declined_state.final_response.lower()


async def test_stategraph_streaming():
    """Verify run_stream yields progression events for each node."""
    graph = StateGraph()
    state = ExecutionState(
        agent_name="career_architect",
        message="Review my profile",
        available_tools=["search_documents"],
    )

    events = []
    async for event in graph.run_stream(state):
        events.append(event)

    event_names = [e["event"] for e in events]
    assert "graph_start" in event_names
    assert "node_enter" in event_names
    assert "node_exit" in event_names
    assert "graph_complete" in event_names


async def test_state_machine_transition_validation():
    """Verify ExecutionStateMachine rejects illegal non-DAG transitions."""
    sm = ExecutionStateMachine()

    # Legal transitions
    assert sm.validate_transition("understand", "plan") is True
    assert sm.validate_transition("plan", "execute") is True
    assert sm.validate_transition("execute", "observe") is True

    # Illegal transition: execute directly to complete without observe
    with pytest.raises(InvalidStateTransitionError):
        sm.validate_transition("execute", "complete")

    # Illegal transition: complete to anything
    with pytest.raises(InvalidStateTransitionError):
        sm.validate_transition("complete", "plan")
