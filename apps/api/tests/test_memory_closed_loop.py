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

    async def _fake_create(db, dto, tenant_id, user_id):
        captured["dto"] = dto
        captured["tenant_id"] = tenant_id
        captured["user_id"] = user_id
        return _FakeMemory()

    from api.services.memory_service import memory_service

    monkeypatch.setattr(memory_service, "create_memory", _fake_create)

    @contextlib.asynccontextmanager
    async def _fake_factory():
        yield _FakeSession()

    monkeypatch.setattr("api.database.async_session_factory", _fake_factory)

    state = {
        "workspace_id": "ws-123",
        "user_id": "user-456",
        "task": "I prefer concise summaries",
        "result": {"summary": "done"},
        "execution_status": "completed",
        "metadata": {},
    }
    out = await nodes.finalize_node(state)

    assert captured.get("dto") is not None, "memory_service.create_memory was not called"
    assert str(captured["dto"].workspace_id) == "ws-123"
    assert captured["user_id"] == "user-456"
    assert out["result"]["provenance"]["memory_persisted"] is True


@pytest.mark.asyncio
async def test_finalize_skips_persist_when_no_preference(monkeypatch):
    os.environ["VAELOOM_TEST_MEMORY_WRITE"] = "1"
    called = {"n": 0}

    async def _fake_create(db, dto, tenant_id, user_id):
        called["n"] += 1
        return _FakeMemory()

    from api.services.memory_service import memory_service

    monkeypatch.setattr(memory_service, "create_memory", _fake_create)
    monkeypatch.setattr("api.database.async_session_factory", _fake_factory_ctx())

    state = {
        "workspace_id": "ws-123",
        "user_id": "user-456",
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
