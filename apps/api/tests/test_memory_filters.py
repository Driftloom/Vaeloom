import uuid

import pytest

from api.schemas.memory import MemoryCreate, MemoryQuery, MemoryUpdate
from api.services.memory_service import MemoryService

pytestmark = pytest.mark.asyncio

TENANT = str(uuid.uuid4())
USER = str(uuid.uuid4())


@pytest.fixture
def svc():
    return MemoryService()


async def _create_active(svc, db, **kwargs):
    data = {"type": "note", "title": "x", "content": "y"}
    data.update(kwargs)
    m = await svc.create_memory(
        db,
        MemoryCreate(**data),
        tenant_id=TENANT, user_id=USER,
    )
    await svc.update_memory(db, m.id, MemoryUpdate(status="active"), TENANT)
    return m


class TestWorkspaceScopedFiltering:
    async def test_workspace_id_filters_listing(self, db_session, svc):
        ws_a = str(uuid.uuid4())
        ws_b = str(uuid.uuid4())
        m_a = await _create_active(svc, db_session, title="A", content="aaa", workspace_id=ws_a)
        await _create_active(svc, db_session, title="B", content="bbb", workspace_id=ws_b)
        await _create_active(svc, db_session, title="Global", content="ccc")

        memories, total = await svc.list_memories(db_session, MemoryQuery(workspace_id=ws_a), tenant_id=TENANT)
        ids = {str(m.id) for m in memories}
        titles = {m.title for m in memories}
        assert str(m_a.id) in ids
        assert "B" not in titles
        assert "Global" not in titles
        assert total == 1

    async def test_no_workspace_filter_returns_all(self, db_session, svc):
        ws_a = str(uuid.uuid4())
        await _create_active(svc, db_session, title="Scoped", content="x", workspace_id=ws_a)
        await _create_active(svc, db_session, title="Global", content="y")
        memories, total = await svc.list_memories(db_session, MemoryQuery(), tenant_id=TENANT)
        assert total == 2
        assert len(memories) == 2


class TestSupersededHandling:
    async def test_superseded_hidden_by_default(self, db_session, svc):
        m1 = await _create_active(svc, db_session, title="Original", content="orig")
        await _create_active(
            svc, db_session, title="Updated", content="new", supersedes_id=m1.id,
        )
        active, active_total = await svc.list_memories(db_session, MemoryQuery(status="active"), tenant_id=TENANT)
        assert str(m1.id) not in {str(m.id) for m in active}
        assert active_total == 1

    async def test_include_superseded_shows_history(self, db_session, svc):
        m1 = await _create_active(svc, db_session, title="Original", content="orig")
        await _create_active(
            svc, db_session, title="Updated", content="new", supersedes_id=m1.id,
        )
        with_ss, ss_total = await svc.list_memories(
            db_session, MemoryQuery(status="active", include_superseded=True), tenant_id=TENANT,
        )
        assert str(m1.id) in {str(m.id) for m in with_ss}
        assert ss_total == 2


class TestStatusAll:
    async def test_status_all_includes_deleted(self, db_session, svc):
        m1 = await _create_active(svc, db_session, title="Doomed", content="aaa")
        await svc.delete_memory(db_session, m1.id, TENANT)
        await _create_active(svc, db_session, title="Alive", content="bbb")
        all_mem, total = await svc.list_memories(db_session, MemoryQuery(status="all"), tenant_id=TENANT)
        assert total == 2
        assert len(all_mem) == 2

        default, _ = await svc.list_memories(db_session, MemoryQuery(), tenant_id=TENANT)
        assert len(default) == 1
        assert default[0].title == "Alive"

    async def test_status_filter_specific(self, db_session, svc):
        m1 = await _create_active(svc, db_session, title="Doomed", content="aaa")
        await svc.delete_memory(db_session, m1.id, TENANT)
        deleted, total = await svc.list_memories(db_session, MemoryQuery(status="deleted"), tenant_id=TENANT)
        assert total == 1
        assert deleted[0].title == "Doomed"