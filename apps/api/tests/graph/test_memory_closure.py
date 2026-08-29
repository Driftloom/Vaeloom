"""Memory closed-loop — preference conciseness (LG-05)."""
import uuid

import pytest

from api.graph.state import build_initial_state
from api.graph.nodes import finalize_node


def _payload(task="I prefer concise reports", agent="memory"):
    return {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "agent_id": agent,
        "request_id": str(uuid.uuid4()),
        "input": {"message": task},
        "correlation_id": str(uuid.uuid4()),
    }


@pytest.mark.asyncio
async def test_finalize_extracts_preference_concise():
    p = _payload("I prefer concise reports.")
    s = build_initial_state(p)
    s["result"] = {"summary": "ack"}
    s["rag_status"] = "empty"
    out = await finalize_node(s)
    assert out["result"]["provenance"]["memory_candidate"]["type"] == "preference"
    assert out["result"]["provenance"]["memory_candidate"]["signal"] == "concise"


@pytest.mark.asyncio
async def test_finalize_no_preference_when_not_signal():
    p = _payload("organize my files")
    s = build_initial_state(p)
    s["result"] = {"summary": "done"}
    out = await finalize_node(s)
    assert "memory_candidate" not in out["result"].get("provenance", {})


@pytest.mark.asyncio
async def test_memory_retrieval_affects_evaluation():
    from api.graph.nodes import evaluate_node

    p = _payload("Prepare my weekly report")
    s = build_initial_state(p)
    s["result"] = {"summary": "weekly report: done"}
    s["rag_status"] = "ok"
    s["rag_context"] = {"entities": [], "documents": [], "preferences": [{"type": "preference", "content": "concise"}]}
    s["metadata"] = {"node": "agent"}
    out = await evaluate_node(s)
    assert out["evaluation"]["memory_relevance"] is True
    assert out["evaluation"]["score"] >= 0.6
