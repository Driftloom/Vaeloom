"""Level 1 — Unit: graph state contract, secret rejection, payload limits, workspace binding."""

import uuid

import pytest

from api.graph.state import (
    MAX_STATE_BYTES,
    build_initial_state,
    validate_graph_state,
    validate_workspace_binding,
)


def _payload(agent="memory", task="organize my files"):
    return {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "agent_id": agent,
        "request_id": str(uuid.uuid4()),
        "input": {"message": task},
        "correlation_id": str(uuid.uuid4()),
    }


def test_build_initial_state_valid():
    p = _payload()
    s = build_initial_state(p)
    assert s["workspace_id"] == p["workspace_id"]
    assert s["execution_status"] == "planning"
    assert s["task"] == "organize my files"
    validate_graph_state(s)  # should not raise


def test_validate_graph_state_rejects_secret():
    p = _payload()
    s = build_initial_state(p)
    s["api_key"] = "sk-test-123"  # forbidden
    with pytest.raises(ValueError, match="secret|forbidden"):
        validate_graph_state(s)


def test_validate_graph_state_rejects_nested_secret():
    p = _payload()
    s = build_initial_state(p)
    s["metadata"] = {"nested": {"access_token": "bad"}}
    with pytest.raises(ValueError, match="secret|forbidden"):
        validate_graph_state(s)


def test_validate_payload_too_large():
    p = _payload()
    s = build_initial_state(p)
    s["result"] = {"blob": "x" * (MAX_STATE_BYTES + 1)}
    with pytest.raises(ValueError, match="too large|exceeds"):
        validate_graph_state(s)


def test_validate_workspace_binding_pass():
    p = _payload()
    s = build_initial_state(p)
    validate_workspace_binding(s, s["workspace_id"])


def test_validate_workspace_binding_fail():
    p = _payload()
    s = build_initial_state(p)
    with pytest.raises(ValueError, match="mismatch"):
        validate_workspace_binding(s, str(uuid.uuid4()))


def test_build_initial_state_missing_required():
    with pytest.raises(ValueError, match="missing required"):
        validate_graph_state({"task": "hi"})


def test_build_initial_state_truncates_large_task():
    p = _payload(task="x" * 30000)
    s = build_initial_state(p)
    assert len(s["task"].encode()) <= 20480
