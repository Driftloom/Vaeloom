"""F-02: native Send fan-out — unit tests (deterministic, no network).

PYTEST_CURRENT_TEST is set by pytest, so agent_node stays on its deterministic
stub path (no LLM/DB calls).
"""

import typing

import pytest

from api.graph import Send, get_graph_metadata, route_fanout
from api.graph import nodes as gnodes
from api.graph.state import VaeloomGraphState


def _state(**over):
    s = {
        "workspace_id": "ws-1",
        "user_id": "u-1",
        "agent_id": "memory",
        "request_id": "r-1",
        "task": "test task for fan-out",
        "metadata": {},
    }
    s.update(over)
    return s


def test_route_no_dag_single_agent():
    assert route_fanout(_state()) == "agent"


def test_route_single_agent_layers():
    s = _state(metadata={"dag": [["memory"], ["resume"]]})
    assert route_fanout(s) == "agent"


def test_route_parallel_layer_fires_sends():
    s = _state(metadata={"dag": [["gmail", "scheduler"]]})
    out = route_fanout(s)
    assert isinstance(out, list) and len(out) == 2
    assert all(isinstance(x, Send) and x.node == "fanout_worker" for x in out)
    assert sorted(x.arg["selected_agent"] for x in out) == ["gmail", "scheduler"]
    assert all(x.arg["fanout_task"]["agent"] == x.arg["selected_agent"] for x in out)


def test_route_clamps_to_eight():
    s = _state(metadata={"dag": [[f"a{i}" for i in range(9)]]})
    out = route_fanout(s)
    assert isinstance(out, list) and len(out) == 8


def test_reducer_wired_on_branch_results():
    import operator

    hints = typing.get_type_hints(VaeloomGraphState, include_extras=True)
    assert "branch_results" in hints
    hint = hints["branch_results"]
    # Direct Annotated[...] or union-wrapped — find the Annotated member either way
    candidates = (hint,) + tuple(getattr(hint, "__args__", ()))
    assert any(operator.add in getattr(a, "__metadata__", ()) for a in candidates)


@pytest.mark.asyncio
async def test_fanout_worker_success_records_entry():
    s = _state(
        selected_agent="memory",
        fanout_task={"agent": "gmail", "request_id": "r-1"},
    )
    out = await gnodes.fanout_worker_node(s)
    assert "branch_results" in out and len(out["branch_results"]) == 1
    entry = out["branch_results"][0]
    assert entry["agent"] == "gmail"
    assert entry["status"] != "failed"
    # branch must not leak raw agent keys into shared state
    assert "selected_tool" not in out and "execution_status" not in out


@pytest.mark.asyncio
async def test_fanout_worker_failure_isolated(monkeypatch):
    async def _boom(state):
        raise RuntimeError("branch exploded")

    monkeypatch.setattr(gnodes, "agent_node", _boom)
    s = _state(fanout_task={"agent": "gmail", "request_id": "r-1"})
    out = await gnodes.fanout_worker_node(s)
    entry = out["branch_results"][0]
    assert entry["agent"] == "gmail" and entry["status"] == "failed"


@pytest.mark.asyncio
async def test_fan_in_aggregates_order_independent():
    branches = [
        {"agent": "b", "status": "finalizing", "summary": "second"},
        {"agent": "a", "status": "finalizing", "summary": "first"},
        {"agent": "c", "status": "failed", "error": "boom"},
    ]
    out1 = await gnodes.fan_in_node(_state(branch_results=branches))
    out2 = await gnodes.fan_in_node(_state(branch_results=list(reversed(branches))))
    assert out1["result"]["fanout"] == {"branches": 3, "succeeded": 2, "failed": 1}
    assert out1["result"]["fanout"] == out2["result"]["fanout"]
    assert out1["execution_status"] == "finalizing"
    assert "a: first" in out1["result"]["summary"]


def test_graph_metadata_lists_fanout_nodes():
    meta = get_graph_metadata()
    assert "fanout_worker" in meta["nodes"] and "fan_in" in meta["nodes"]
    assert meta["send_fanout"] is True
