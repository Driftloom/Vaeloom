"""Closure contracts — RoutingDecision, AgentPlan, Handoff, EvaluationResult (LG-03/04/09/15)."""
import uuid

import pytest

from api.graph.contracts import (
    validate_agent_plan,
    validate_evaluation,
    validate_handoff,
    validate_routing_decision,
)
from api.graph.routing import route_classify_structured
from api.graph.state import build_initial_state, validate_handoff_state, validate_graph_state


@pytest.mark.asyncio
async def test_routing_decision_structured():
    dec = await route_classify_structured("organize my files")
    validate_routing_decision(dec)
    assert dec["final_agent"] == "organization"
    assert 0.0 <= dec["confidence"] <= 1.0
    assert dec["schema_version"] == 1
    assert "provenance" in dec


@pytest.mark.asyncio
async def test_routing_decision_out_of_scope_fallback():
    dec = await route_classify_structured("tell me about github repo")
    # github is enterprise out-of-scope when mvp_scope_enforced true -> falls back to memory
    validate_routing_decision(dec)
    assert dec["final_agent"] in ("research", "memory", "github")


def test_routing_decision_rejects_invalid():
    with pytest.raises(ValueError):
        validate_routing_decision({"final_agent": ""})
    with pytest.raises(ValueError):
        validate_routing_decision({"final_agent": "memory", "confidence": 9})


def test_agent_plan_validation_bounds():
    validate_agent_plan({"dag": [["memory"], ["resume"]], "schema_version": 1})
    with pytest.raises(ValueError, match="depth"):
        validate_agent_plan({"dag": [["a"]] * 6})
    with pytest.raises(ValueError, match="fan-out"):
        validate_agent_plan({"dag": [["x"] * 9]})
    # total >20 also triggers depth first (6 layers *2=12) — need 5 layers each 5 nodes =25 to hit total without depth
    with pytest.raises(ValueError, match="total|depth"):
        validate_agent_plan({"dag": [["a", "b", "c", "d", "e"]] * 5})
    with pytest.raises(ValueError, match="cycle"):
        validate_agent_plan({"dag": [["memory"], ["memory"]]})


def test_handoff_validation():
    ws = str(uuid.uuid4())
    h = {
        "source_agent": "research",
        "target_agent": "memory",
        "workspace_id": ws,
        "user_id": str(uuid.uuid4()),
        "request_id": str(uuid.uuid4()),
        "task_id": "t1",
        "objective": "summarize",
        "context_refs": ["doc1"],
        "allowed_tools": ["search_documents"],
        "required_scopes": ["memory.read"],
        "handoff_reason": "needs memory",
        "provenance": {"step": 1},
        "schema_version": 1,
    }
    validate_handoff(h)
    # oversized
    h2 = dict(h)
    h2["context_refs"] = ["x"] * 20
    with pytest.raises(ValueError):
        validate_handoff(h2)
    # workspace mismatch via state
    from api.graph.state import validate_handoff_state

    state = build_initial_state(
        {
            "workspace_id": ws,
            "user_id": h["user_id"],
            "agent_id": "research",
            "request_id": h["request_id"],
            "input": {"message": "hi"},
        }
    )
    state["handoff"] = h
    validate_handoff_state(state)
    # mismatch
    state["handoff"] = {**h, "workspace_id": str(uuid.uuid4())}
    with pytest.raises(ValueError, match="mismatch"):
        validate_handoff_state(state)


def test_handoff_secret_rejected():
    ws = str(uuid.uuid4())
    state = build_initial_state(
        {"workspace_id": ws, "user_id": str(uuid.uuid4()), "agent_id": "memory", "request_id": str(uuid.uuid4()), "input": {"message": "hi"}}
    )
    state["handoff"] = {
        "source_agent": "a",
        "target_agent": "b",
        "workspace_id": ws,
        "user_id": state["user_id"],
        "request_id": state["request_id"],
        "objective": "x",
        "schema_version": 1,
        "api_key": "bad",
    }
    with pytest.raises(ValueError, match="secret|forbidden"):
        validate_graph_state(state)


def test_evaluation_validation():
    validate_evaluation({"score": 0.8, "replan_required": False, "schema_version": 1})
    with pytest.raises(ValueError):
        validate_evaluation({"score": 9})
    with pytest.raises(ValueError):
        validate_evaluation({"score": 0.5, "replan_required": False, "schema_version": 1, "reason": "x" * 5000})


@pytest.mark.asyncio
async def test_evaluate_node_produces_evaluation():
    from api.graph.nodes import evaluate_node
    from api.graph.state import build_initial_state

    p = {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "agent_id": "memory",
        "request_id": str(uuid.uuid4()),
        "input": {"message": "hello"},
    }
    s = build_initial_state(p)
    s["result"] = {"summary": "hi"}
    s["rag_status"] = "ok"
    s["metadata"] = {"node": "agent"}
    out = await evaluate_node(s)
    assert "evaluation" in out
    assert 0.0 <= out["evaluation"]["score"] <= 1.0
    assert out["execution_status"] in ("completed", "failed")
