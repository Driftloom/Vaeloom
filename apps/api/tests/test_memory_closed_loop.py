"""F-05 regression: finalize_node must actually persist extracted memory candidates
(closed loop), not just tag a provenance marker.
"""

import contextlib
import os

import pytest

from api.graph import nodes


class _FakeMemory:
    id = "mem-1"


class _FakeSession:
    async def commit(self):
        return None


@pytest.mark.asyncio
async def test_finalize_persists_preference_memory(monkeypatch):
    os.environ["VAELOOM_TEST_MEMORY_WRITE"] = "1"
    captured: dict = {}

    async def _fake_consolidate(**kw):
        captured.update(kw)
        return {"status": "success", "consolidated_count": 1}

    from api.agents.memory.consolidator import memory_consolidator

    monkeypatch.setattr(memory_consolidator, "consolidate_trajectory", _fake_consolidate)

    import uuid

    ws = str(uuid.uuid4())
    uid = str(uuid.uuid4())
    state = {
        "workspace_id": ws,
        "user_id": uid,
        "task": "I prefer concise summaries",
        "result": {"summary": "done"},
        "execution_status": "completed",
        "metadata": {},
    }
    out = await nodes.finalize_node(state)

    assert captured.get("workspace_id") == ws, "consolidate_trajectory was not called"
    assert captured.get("user_id") == uid or captured.get("user_id") is None
    assert out["result"]["provenance"]["memory_persisted"] is True


@pytest.mark.asyncio
async def test_finalize_skips_persist_when_no_preference(monkeypatch):
    os.environ["VAELOOM_TEST_MEMORY_WRITE"] = "1"
    called = {"n": 0}

    async def _fake_consolidate(**kw):
        called["n"] += 1
        return {"status": "success", "consolidated_count": 1}

    from api.agents.memory.consolidator import memory_consolidator

    monkeypatch.setattr(memory_consolidator, "consolidate_trajectory", _fake_consolidate)
    import uuid

    state = {
        "workspace_id": str(uuid.uuid4()),
        "user_id": str(uuid.uuid4()),
        "task": "summarize this document",
        "result": {"summary": "done"},
        "execution_status": "completed",
        "metadata": {},
    }
    await nodes.finalize_node(state)
    assert called["n"] == 0


def _fake_factory_ctx():
    @contextlib.asynccontextmanager
    async def _f():
        yield _FakeSession()

    return _f
