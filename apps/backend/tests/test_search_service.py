import uuid
from unittest.mock import MagicMock

import pytest

from backend.services.search_service import SearchService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return SearchService()


def mock_memory(**kwargs):
    defaults = dict(
        id=uuid.uuid4(), title="Test Memory", type="note",
        summary="A summary", content="Some content", tenant_id="t-1",
    )
    defaults.update(kwargs)
    return type("Memory", (), defaults)()


def mock_record(**kwargs):
    defaults = dict(
        id=uuid.uuid4(), content={"text": "Record content"},
        type="observation", confidence=0.95,
    )
    defaults.update(kwargs)
    return type("MemoryRecord", (), defaults)()


def mock_entity(**kwargs):
    defaults = dict(
        id=uuid.uuid4(), canonical_name="Test Entity",
        type="person", aliases=["TE", "Test"],
    )
    defaults.update(kwargs)
    return type("Entity", (), defaults)()


class TestSearchAll:
    async def test_search_all_sources(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = [
            mock_memory(title="Hello World"),
        ]
        rec_result = MagicMock()
        rec_result.scalars.return_value.all.return_value = [
            mock_record(),
        ]
        ent_result = MagicMock()
        ent_result.scalars.return_value.all.return_value = [
            mock_entity(canonical_name="Hello Entity"),
        ]
        results = [mem_result, rec_result, ent_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        result = await svc.search_all("Hello", tenant_id=None, sources=None, limit=20, offset=0, db=db)
        assert result["total"] == 3
        assert result["results"][0]["score"] == 2.0

    async def test_search_only_memory(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = [
            mock_memory(title="Only Memory", content="hello"),
        ]
        db = MagicMock()

        async def execute(stmt):
            return mem_result

        db.execute = execute
        result = await svc.search_all("hello", tenant_id=None, sources=["memory"], limit=20, offset=0, db=db)
        assert result["total"] == 1
        assert result["results"][0]["source"] == "memory"

    async def test_search_only_memory_record(self, svc):
        rec_result = MagicMock()
        rec_result.scalars.return_value.all.return_value = [
            mock_record(),
        ]
        db = MagicMock()

        async def execute(stmt):
            return rec_result

        db.execute = execute
        result = await svc.search_all("Record", tenant_id=None, sources=["memory_record"], limit=20, offset=0, db=db)
        assert result["total"] == 1
        assert result["results"][0]["source"] == "memory_record"

    async def test_search_only_entity(self, svc):
        ent_result = MagicMock()
        ent_result.scalars.return_value.all.return_value = [
            mock_entity(canonical_name="Unique Entity"),
        ]
        db = MagicMock()

        async def execute(stmt):
            return ent_result

        db.execute = execute
        result = await svc.search_all("Unique", tenant_id=None, sources=["entity"], limit=20, offset=0, db=db)
        assert result["total"] == 1
        assert result["results"][0]["source"] == "entity"

    async def test_search_with_tenant_filter(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = [
            mock_memory(title="Scoped Memory"),
        ]
        db = MagicMock()

        async def execute(stmt):
            return mem_result

        db.execute = execute
        result = await svc.search_all("Scoped", tenant_id="t-1", sources=["memory"], limit=20, offset=0, db=db)
        assert result["total"] == 1

    async def test_search_with_pagination(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = [
            mock_memory(title="A"),
            mock_memory(title="B"),
            mock_memory(title="C"),
        ]
        rec_result = MagicMock()
        rec_result.scalars.return_value.all.return_value = []
        ent_result = MagicMock()
        ent_result.scalars.return_value.all.return_value = []
        results = [mem_result, rec_result, ent_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        result = await svc.search_all("test", tenant_id=None, sources=None, limit=2, offset=1, db=db)
        assert result["total"] == 3
        assert len(result["results"]) == 2

    async def test_search_empty_results(self, svc):
        empty = MagicMock()
        empty.scalars.return_value.all.return_value = []
        results = [empty, empty, empty]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        result = await svc.search_all("nothing", tenant_id=None, sources=None, limit=20, offset=0, db=db)
        assert result["total"] == 0
        assert result["results"] == []

    async def test_search_memory_partial_title_score(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = [
            mock_memory(title="Something Else"),
        ]
        db = MagicMock()

        async def execute(stmt):
            return mem_result

        db.execute = execute
        result = await svc.search_all("hello", tenant_id=None, sources=["memory"], limit=20, offset=0, db=db)
        assert result["results"][0]["score"] == 1.0

    async def test_search_entity_partial_score(self, svc):
        ent_result = MagicMock()
        ent_result.scalars.return_value.all.return_value = [
            mock_entity(canonical_name="Other Entity"),
        ]
        db = MagicMock()

        async def execute(stmt):
            return ent_result

        db.execute = execute
        result = await svc.search_all("hello", tenant_id=None, sources=["entity"], limit=20, offset=0, db=db)
        assert result["results"][0]["score"] == 1.5

    async def test_search_record_with_non_dict_content(self, svc):
        rec_result = MagicMock()
        rec_result.scalars.return_value.all.return_value = [
            mock_record(content={"other_field": "data"}),
        ]
        db = MagicMock()

        async def execute(stmt):
            return rec_result

        db.execute = execute
        result = await svc.search_all("data", tenant_id=None, sources=["memory_record"], limit=20, offset=0, db=db)
        assert result["total"] == 1
        assert "data" in result["results"][0]["text"]
