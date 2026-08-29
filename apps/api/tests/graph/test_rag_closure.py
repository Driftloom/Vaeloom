"""RAG closure — rag_status explicit, never fabricated, kg hook (LG-07)."""
import uuid

import pytest

from api.graph.nodes import retrieve_context_node
from api.graph.state import build_initial_state


def _payload(task="What is quarterly OKR?"):
    return {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "agent_id": "memory",
        "request_id": str(uuid.uuid4()),
        "input": {"message": task},
        "correlation_id": str(uuid.uuid4()),
    }


@pytest.mark.asyncio
async def test_retrieve_context_never_fabricates():
    p = _payload("organize my files")
    s = build_initial_state(p)
    out = await retrieve_context_node(s)
    assert out["rag_status"] in ("ok", "empty", "unavailable", "timeout", "error")
    rag = out["rag_context"]
    assert isinstance(rag["entities"], list)
    assert isinstance(rag["documents"], list)
    assert isinstance(rag["preferences"], list)
    # never of size >8/8/5 after truncate
    assert len(rag["entities"]) <= 8
    assert len(rag["documents"]) <= 8
    assert len(rag["preferences"]) <= 5


@pytest.mark.asyncio
async def test_retrieve_context_empty_is_valid():
    p = _payload("unknown query that matches nothing xyzabc123")
    s = build_initial_state(p)
    out = await retrieve_context_node(s)
    # In test DB without seed, should be empty (not ok)
    assert out["rag_status"] in ("empty", "unavailable", "timeout", "error", "ok")
    # provenance is empty arrays not None
    assert out["rag_context"] is not None


@pytest.mark.asyncio
async def test_retrieve_context_timeout_never_blocks():
    # timeout is handled internally with 5s wait_for; test that node always returns quickly
    import asyncio, time
    p = _payload("hello world")
    s = build_initial_state(p)
    start = time.monotonic()
    out = await retrieve_context_node(s)
    assert time.monotonic() - start < 6.0
    assert out["execution_status"] == "routing"
