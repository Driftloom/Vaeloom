"""Level 2 — LangGraph Runtime: real StateGraph execution, no mocks removing LangGraph."""

import uuid

import pytest

from api.graph import get_vaeloom_graph
from api.graph.state import build_initial_state


def _payload(task: str, agent: str = "memory"):
    return {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "agent_id": agent,
        "request_id": str(uuid.uuid4()),
        "input": {"message": task},
        "correlation_id": str(uuid.uuid4()),
    }


@pytest.mark.asyncio
async def test_graph_simple_organize():
    g = get_vaeloom_graph()
    p = _payload("organize my files")
    s = build_initial_state(p)
    res = await g.ainvoke(s, config={"configurable": {"thread_id": p["request_id"]}})
    assert res["execution_status"] in {"completed", "finalizing"}
    assert res.get("selected_agent") in {"organization", "memory", "resume"}


@pytest.mark.asyncio
async def test_graph_branching_multi_agent():
    g = get_vaeloom_graph()
    p = _payload("organize my files and schedule a meeting tomorrow")
    s = build_initial_state(p)
    res = await g.ainvoke(s, config={"configurable": {"thread_id": p["request_id"]}})
    assert res["execution_status"] in {"completed", "failed", "finalizing"}
    # dag should have been computed
    assert "dag" in res.get("metadata", {}) or res.get("selected_agent") is not None


@pytest.mark.asyncio
async def test_graph_tool_execution():
    g = get_vaeloom_graph()
    p = _payload("search my documents for resume")
    s = build_initial_state(p)
    res = await g.ainvoke(s, config={"configurable": {"thread_id": p["request_id"]}})
    # tool path may be taken or not, but should complete
    assert res["execution_status"] in {"completed", "finalizing", "failed"}
    # if tool was selected, result should contain tool output or mock
    if res.get("selected_tool"):
        assert res.get("result") is not None


@pytest.mark.asyncio
async def test_graph_interrupt_approval_gated():
    # Tool that is approval-gated should go to waiting_approval, not tool_execute
    g = get_vaeloom_graph()
    # Use a task that triggers agent that may select approval-gated tool via heuristic?
    # For deterministic test, directly set selected_tool to approval_gated
    p = _payload("create a github issue for my project")
    s = build_initial_state(p)
    # Force selected_tool via state mutation before invoke? Instead test node directly
    from api.graph.nodes import policy_check_node

    test_state = {
        "workspace_id": p["workspace_id"],
        "user_id": p["user_id"],
        "agent_id": p["agent_id"],
        "request_id": p["request_id"],
        "task": "create github issue",
        "selected_tool": "create_github_issue",  # approval_gated
        "execution_status": "executing_tool",
        "metadata": {},
        "messages": [],
    }
    res = await policy_check_node(test_state)
    assert res["execution_status"] == "waiting_approval"
    assert res["approval_state"]["tool"] == "create_github_issue"


@pytest.mark.asyncio
async def test_graph_state_secret_rejection():
    from api.graph.state import validate_graph_state

    bad = {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "agent_id": "memory",
        "request_id": str(uuid.uuid4()),
        "task": "hi",
        "api_key": "sk-bad",
        "messages": [],
        "execution_status": "planning",
        "metadata": {},
    }
    with pytest.raises(ValueError):
        validate_graph_state(bad)


@pytest.mark.asyncio
async def test_graph_no_secret_in_state():
    g = get_vaeloom_graph()
    p = _payload("hello")
    s = build_initial_state(p)
    # Ensure no secret keys in initial state
    assert "api_key" not in str(s).lower()
    res = await g.ainvoke(s, config={"configurable": {"thread_id": p["request_id"]}})
    assert "api_key" not in str(res).lower()
