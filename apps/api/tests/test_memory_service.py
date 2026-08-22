import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.models.schema import Memory
from api.schemas.memory import MemoryCreate, MemoryUpdate, MemoryQuery, MemorySearch
from api.services.memory_service import MemoryService
from api.services.llm_service import LLMProviderError

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return MemoryService()


@pytest.fixture(autouse=True)
def patch_tags_overlap(monkeypatch):
    """Memory.tags is an InstrumentedAttribute; replace it so .overlap() works."""
    mock_tags = MagicMock()
    mock_tags.overlap.return_value = True
    monkeypatch.setattr(Memory, "tags", mock_tags)


def build_mock_memory(**kwargs):
    defaults = dict(
        id=uuid.uuid4(), type="note", status="active",
        title="Test Memory", summary=None, content=None,
        content_hash="abc123", size=0, embedding=[0.1] * 1536,
        metadata_={}, tags=[],
        tenant_id=None, user_id=None, workspace_id=None,
        source_type=None, source_uri=None, source_label=None,
        connector_id=None,
    )
    defaults.update(kwargs)
    obj = type("Memory", (), defaults)()
    return obj


class TestCreateMemory:
    async def test_create_with_content(self, svc):
        db = MagicMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryCreate(type="note", title="My Note", content="hello world")
        memory = await svc.create_memory(db, dto, tenant_id="t-1", user_id="u-1")
        assert memory.type == "note"
        assert memory.title == "My Note"
        assert memory.tenant_id == "t-1"
        assert memory.user_id == "u-1"
        db.add.assert_called_once()
        db.flush.assert_called_once()
        db.refresh.assert_called_once_with(memory)

    async def test_create_without_content(self, svc):
        # P14 fix: empty title/summary/content must 422, not 500 via DB
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            MemoryCreate(type="note", title="")

    async def test_create_embedding_error(self, svc, monkeypatch):
        from api.services import llm_service

        async def failing_embedding(*args, **kwargs):
            raise LLMProviderError("fail")
        monkeypatch.setattr(llm_service.llm_service, "generate_embedding", failing_embedding)
        db = MagicMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryCreate(type="note", title="Fail", content="test")
        memory = await svc.create_memory(db, dto, tenant_id="t-1", user_id="u-1")
        assert memory.embedding is None

    async def test_create_whitespace_content(self, svc):
        # P14 fix: whitespace-only must 422
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            MemoryCreate(type="note", title="   ", content="   ")


class TestListMemories:
    async def test_list_default(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 2
        rows_result = MagicMock()
        mem1 = build_mock_memory(title="A")
        mem2 = build_mock_memory(title="B")
        rows_result.scalars.return_value.all.return_value = [mem1, mem2]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        query = MemoryQuery()
        memories, total = await svc.list_memories(db, query, tenant_id=None)
        assert total == 2
        assert len(memories) == 2

    async def test_list_with_type_and_tags(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        mem = build_mock_memory(type="doc", tags=["tag1", "tag2"])
        rows_result.scalars.return_value.all.return_value = [mem]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        query = MemoryQuery(type="doc", tags=["tag1"])
        memories, total = await svc.list_memories(db, query, tenant_id="t-1")
        assert total == 1

    async def test_list_empty(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = []
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        query = MemoryQuery()
        memories, total = await svc.list_memories(db, query, tenant_id=None)
        assert total == 0
        assert memories == []


class TestGetMemory:
    async def test_get_found_no_tenant(self, svc):
        result = MagicMock()
        mem = build_mock_memory(id=uuid.uuid4())
        result.scalar_one_or_none.return_value = mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        memory = await svc.get_memory(db, mem.id, tenant_id=None)
        assert memory is not None
        assert memory.id == mem.id

    async def test_get_found_with_tenant(self, svc):
        result = MagicMock()
        mem = build_mock_memory(tenant_id="t-1")
        result.scalar_one_or_none.return_value = mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        memory = await svc.get_memory(db, mem.id, tenant_id="t-1")
        assert memory is not None

    async def test_get_not_found(self, svc):
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        memory = await svc.get_memory(db, uuid.uuid4(), tenant_id=None)
        assert memory is None


class TestUpdateMemory:
    async def test_update_basic(self, svc):
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, title="Old", content="old content")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryUpdate(title="New Title", summary="New Summary")
        result = await svc.update_memory(db, mem_id, dto, tenant_id=None)
        assert result.title == "New Title"
        assert result.summary == "New Summary"
        db.flush.assert_called_once()
        db.refresh.assert_called_once_with(result)

    async def test_update_with_content(self, svc):
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, content="old")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryUpdate(content="new content here")
        result = await svc.update_memory(db, mem_id, dto, tenant_id=None)
        assert result.content == "new content here"
        assert result.embedding is not None

    async def test_update_not_found(self, svc):
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        dto = MemoryUpdate(title="X")
        result = await svc.update_memory(db, uuid.uuid4(), dto, tenant_id=None)
        assert result is None

    async def test_update_content_embedding_error(self, svc, monkeypatch):
        from api.services import llm_service

        async def failing_embedding(*args, **kwargs):
            raise LLMProviderError("fail")
        monkeypatch.setattr(llm_service.llm_service, "generate_embedding", failing_embedding)
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, content="old")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryUpdate(content="new content")
        result = await svc.update_memory(db, mem_id, dto, tenant_id=None)
        assert result is not None


class TestDeleteMemory:
    async def test_delete_found(self, svc):
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, status="active")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        ok = await svc.delete_memory(db, mem_id, tenant_id=None)
        assert ok is True
        assert mock_mem.status == "deleted"
        db.flush.assert_called_once()

    async def test_delete_not_found(self, svc):
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        ok = await svc.delete_memory(db, uuid.uuid4(), tenant_id=None)
        assert ok is False


class TestSearchMemories:
    async def test_search_basic(self, svc):
        result = MagicMock()
        mem1 = build_mock_memory(title="Match 1")
        mem2 = build_mock_memory(title="Match 2")
        result.all.return_value = [(mem1, 0.1), (mem2, 0.2)]
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        dto = MemorySearch(query="test")
        results = await svc.search_memories(db, dto, tenant_id=None)
        assert len(results) == 2
        assert results[0][1] == pytest.approx(0.9)
        assert results[1][1] == pytest.approx(0.8)

    async def test_search_with_filters(self, svc):
        result = MagicMock()
        mem = build_mock_memory(type="doc", tags=["ai"], tenant_id="t-1")
        result.all.return_value = [(mem, 0.05)]
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        dto = MemorySearch(query="ai", type="doc", tags=["ai"], top_k=5, threshold=0.8)
        results = await svc.search_memories(db, dto, tenant_id="t-1")
        assert len(results) == 1

    async def test_search_no_threshold(self, svc):
        result = MagicMock()
        mem = build_mock_memory()
        result.all.return_value = [(mem, 0.5)]
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        dto = MemorySearch(query="test", threshold=None)
        results = await svc.search_memories(db, dto, tenant_id=None)
        assert len(results) == 1


class TestMemoryTaxonomy:
    async def test_create_with_domain(self, svc):
        db = MagicMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryCreate(type="fact", domain="hr", title="Domain Memory", content="x")
        memory = await svc.create_memory(db, dto, tenant_id="t-1", user_id="u-1")
        assert memory.domain == "hr"
        assert memory.supersedes_id is None

    async def test_update_with_domain(self, svc):
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, domain=None)
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryUpdate(domain="engineering")
        updated = await svc.update_memory(db, mem_id, dto, tenant_id=None)
        assert updated.domain == "engineering"

    async def test_delete_sets_deleted_at(self, svc):
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, status="active")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        ok = await svc.delete_memory(db, mem_id, tenant_id=None)
        assert ok is True
        assert mock_mem.status == "deleted"
        assert mock_mem.deleted_at is not None

    async def test_list_filters_by_domain(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        mem = build_mock_memory(domain="hr")
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = [mem]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        query = MemoryQuery(domain="hr")
        memories, total = await svc.list_memories(db, query, tenant_id="t-1")
        assert total == 1
        assert memories[0].domain == "hr"

    async def test_search_filters_by_domain(self, svc):
        result = MagicMock()
        mem = build_mock_memory(domain="sales")
        result.all.return_value = [(mem, 0.1)]
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        dto = MemorySearch(query="deal", domain="sales")
        results = await svc.search_memories(db, dto, tenant_id="t-1")
        assert len(results) == 1


class TestMemorySupersession:
    async def test_create_supersedes_marks_previous(self, svc):
        old = build_mock_memory(id=uuid.uuid4(), status="active")
        result = MagicMock()
        result.scalar_one_or_none.return_value = old
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryCreate(type="fact", title="New", content="v2", supersedes_id=old.id)
        memory = await svc.create_memory(db, dto, tenant_id="t-1", user_id="u-1")
        assert memory.supersedes_id == old.id
        assert old.status == "superseded"

    async def test_create_supersedes_skips_deleted_previous(self, svc):
        old = build_mock_memory(id=uuid.uuid4(), status="deleted")
        result = MagicMock()
        result.scalar_one_or_none.return_value = old
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryCreate(type="fact", title="New", content="v2", supersedes_id=old.id)
        memory = await svc.create_memory(db, dto, tenant_id="t-1", user_id="u-1")
        assert memory.supersedes_id == old.id
        assert old.status == "deleted"

    async def test_update_supersedes_marks_previous(self, svc):
        old_id = uuid.uuid4()
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, status="active")
        old = build_mock_memory(id=old_id, status="active")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        previous_result = MagicMock()
        previous_result.scalar_one_or_none.return_value = old
        results = [result, previous_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryUpdate(title="Updated", supersedes_id=old_id)
        updated = await svc.update_memory(db, mem_id, dto, tenant_id=None)
        assert updated.supersedes_id == old_id
        assert old.status == "superseded"

    async def test_update_ignores_self_supersession(self, svc):
        mem_id = uuid.uuid4()
        mock_mem = build_mock_memory(id=mem_id, status="active")
        result = MagicMock()
        result.scalar_one_or_none.return_value = mock_mem
        db = MagicMock()

        async def execute(stmt):
            return result

        db.execute = execute
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        dto = MemoryUpdate(title="Self", supersedes_id=mem_id)
        updated = await svc.update_memory(db, mem_id, dto, tenant_id=None)
        assert updated.status == "active"
