import uuid

import pytest
from sqlalchemy import select

from api.models.schema import Memory
from api.schemas.memory import MemoryQuery, MemorySearch
from api.services import llm_service
from api.services.memory_service import MemoryService

pytestmark = pytest.mark.asyncio


async def _make_memory(db, *, tenant_id, workspace_id, content="seed"):
    m = Memory(
        id=uuid.uuid4(),
        type="note",
        status="active",
        title="seed",
        summary=None,
        content=content,
        content_hash="h",
        size=len(content),
        embedding=[0.1] * 1536,
        metadata_={},
        tags=[],
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        user_id=uuid.uuid4(),
    )
    db.add(m)
    await db.flush()
    return m


async def test_search_memories_workspace_isolation(db_session, monkeypatch):
    """F-03: workspace B must NOT retrieve workspace A's memories (same tenant)."""
    svc = MemoryService()
    tenant = uuid.uuid4()
    ws_a = uuid.uuid4()
    ws_b = uuid.uuid4()
    ma = await _make_memory(db_session, tenant_id=tenant, workspace_id=ws_a, content="alpha")
    mb = await _make_memory(db_session, tenant_id=tenant, workspace_id=ws_b, content="beta")

    async def fake_emb(*a, **k):
        return [0.1] * 1536

    monkeypatch.setattr(llm_service.llm_service, "generate_embedding", fake_emb)

    # Workspace A search must return only A's memory.
    res_a = await svc.search_memories(db_session, MemorySearch(query="x"), tenant, ws_a)
    ids_a = {str(m.id) for m, _ in res_a}
    assert str(ma.id) in ids_a
    assert str(mb.id) not in ids_a

    # Workspace B search must return only B's memory (A not leaked).
    res_b = await svc.search_memories(db_session, MemorySearch(query="x"), tenant, ws_b)
    ids_b = {str(m.id) for m, _ in res_b}
    assert str(mb.id) in ids_b
    assert str(ma.id) not in ids_b


async def test_get_memory_workspace_isolation(db_session):
    """F-03: get_memory must be strictly workspace-scoped."""
    svc = MemoryService()
    tenant = uuid.uuid4()
    ws_a = uuid.uuid4()
    ws_b = uuid.uuid4()
    ma = await _make_memory(db_session, tenant_id=tenant, workspace_id=ws_a)

    # Wrong workspace -> None (not leaked).
    assert await svc.get_memory(db_session, ma.id, tenant, ws_b) is None
    # Correct workspace -> found.
    got = await svc.get_memory(db_session, ma.id, tenant, ws_a)
    assert got is not None and str(got.id) == str(ma.id)


async def test_list_memories_workspace_isolation(db_session):
    """F-03: list_memories must be strictly workspace-scoped."""
    svc = MemoryService()
    tenant = uuid.uuid4()
    ws_a = uuid.uuid4()
    ws_b = uuid.uuid4()
    await _make_memory(db_session, tenant_id=tenant, workspace_id=ws_a)
    await _make_memory(db_session, tenant_id=tenant, workspace_id=ws_b)

    mems_a, total_a = await svc.list_memories(db_session, MemoryQuery(), tenant, ws_a)
    assert total_a == 1
    mems_b, total_b = await svc.list_memories(db_session, MemoryQuery(), tenant, ws_b)
    assert total_b == 1
