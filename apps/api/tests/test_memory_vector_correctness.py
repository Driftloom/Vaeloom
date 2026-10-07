"""Vector-store correctness tests for memory search and correction.

Regression coverage for two confirmed bugs in the vector path:

1. ``MemoryService.supersede_memory`` never touched the vector store, so the
   successor was unreachable by vector search and the superseded predecessor's
   vector kept ranking forever. Corrections silently did nothing.
2. ``MemoryService.search_memories`` re-queried the ``Memory`` table with no
   status filter, so ``include_superseded=False`` did not actually exclude
   superseded/deleted rows that the vector store still held.
   It also omitted ``source_type``, letting ``document_chunk`` rows (which share
   the ``embeddings`` table with placeholder source_ids) consume top_k slots.

It also pins the honesty rule: relevance scores come from the real cosine
distance the vector store reports, never a hardcoded constant.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.infrastructure.vector_store import FallbackVectorStore, VectorRecord
from api.models.schema import Memory
from api.schemas.memory import MemorySearch, MemorySupersedeRequest, MemoryUpdate
from api.services import llm_service as llm_module
from api.services.memory_service import MemoryService

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def patch_tags_overlap(monkeypatch):
    mock_tags = MagicMock()
    mock_tags.overlap.return_value = True
    monkeypatch.setattr(Memory, "tags", mock_tags)


@pytest.fixture
def svc():
    return MemoryService()


def make_db(execute_results=None):
    """AsyncSession double. execute() returns queued results in order."""
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    db.executed = []
    queue = list(execute_results or [])

    async def execute(stmt):
        db.executed.append(stmt)
        if queue:
            return queue.pop(0)
        empty = MagicMock()
        empty.all.return_value = []
        empty.scalars.return_value.all.return_value = []
        empty.scalar_one_or_none.return_value = None
        empty.scalar_one.return_value = 0
        return empty

    db.execute = execute
    return db


def vec_record(mem_id, distance):
    return VectorRecord(
        id=str(mem_id),
        vector=[0.1] * 8,
        metadata={
            "source_type": "memory",
            "source_id": str(mem_id),
            "workspace_id": "",
            "distance": distance,
        },
    )


class TestSupersedeSyncsVectorStore:
    """P0-1: corrections must be visible to vector search."""

    async def test_supersede_indexes_successor_and_purges_predecessor(self, svc, monkeypatch):
        ws_id = uuid.uuid4()
        old = MagicMock(spec=Memory)
        old.id = uuid.uuid4()
        old.status = "active"
        old.title = "Old fact"
        old.summary = None
        old.content = "old content"
        old.type = "note"
        old.domain = None
        old.tags = []
        old.metadata_ = {}
        old.tenant_id = ws_id
        old.user_id = None
        old.workspace_id = ws_id

        async def fake_embedding(*args, **kwargs):
            return [0.2] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.upsert = AsyncMock()
        store.delete = AsyncMock()

        get_result = MagicMock()
        get_result.scalar_one_or_none.return_value = old
        db = make_db(execute_results=[get_result])

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        new = await svc.supersede_memory(
            db,
            old.id,
            MemorySupersedeRequest(content="corrected content", reason="was wrong"),
            tenant_id=str(ws_id),
            workspace_id=str(ws_id),
            user_id=None,
        )

        assert new is not None, "supersede must return the successor"
        assert old.status == "superseded"

        # Successor must be indexed under source_type='memory'.
        store.upsert.assert_awaited_once()
        records = store.upsert.await_args.args[0]
        assert len(records) == 1
        rec = records[0]
        assert rec.id == str(new.id)
        assert rec.metadata["source_type"] == "memory"
        assert rec.metadata["source_id"] == str(new.id)
        assert rec.metadata["workspace_id"] == str(ws_id)
        assert rec.vector == [0.2] * 8

        # Predecessor's stale vector must be removed.
        store.delete.assert_awaited_once()
        assert store.delete.await_args.args[0] == [str(old.id)]

        # Both ops must ride the caller's transaction.
        assert store.upsert.await_args.kwargs.get("session") is db
        assert store.delete.await_args.kwargs.get("session") is db

    async def test_supersede_purges_stale_vector_even_when_embedding_fails(self, svc, monkeypatch):
        """A provider failure must not leave the old vector ranking forever."""
        ws_id = uuid.uuid4()
        old = MagicMock(spec=Memory)
        old.id = uuid.uuid4()
        old.status = "active"
        old.title = "Old"
        old.summary = None
        old.content = "old"
        old.type = "note"
        old.domain = None
        old.tags = []
        old.metadata_ = {}
        old.tenant_id = ws_id
        old.user_id = None
        old.workspace_id = ws_id

        async def failing_embedding(*args, **kwargs):
            raise llm_module.LLMProviderError("provider down")

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", failing_embedding)

        store = MagicMock()
        store.upsert = AsyncMock()
        store.delete = AsyncMock()

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        get_result = MagicMock()
        get_result.scalar_one_or_none.return_value = old
        db = make_db(execute_results=[get_result])

        new = await svc.supersede_memory(
            db,
            old.id,
            MemorySupersedeRequest(content="corrected", reason="fix"),
            tenant_id=str(ws_id),
            workspace_id=str(ws_id),
        )

        assert new is not None
        store.upsert.assert_not_awaited()
        store.delete.assert_awaited_once_with([str(old.id)], session=db)

    async def test_supersede_vector_failure_does_not_break_correction(self, svc, monkeypatch):
        """Vector sync is best-effort; the DB correction must still commit."""
        ws_id = uuid.uuid4()
        old = MagicMock(spec=Memory)
        old.id = uuid.uuid4()
        old.status = "active"
        old.title = "Old"
        old.summary = None
        old.content = "old"
        old.type = "note"
        old.domain = None
        old.tags = []
        old.metadata_ = {}
        old.tenant_id = ws_id
        old.user_id = None
        old.workspace_id = ws_id

        async def fake_embedding(*args, **kwargs):
            return [0.3] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.upsert = AsyncMock(side_effect=RuntimeError("vector store down"))
        store.delete = AsyncMock(side_effect=RuntimeError("vector store down"))

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        get_result = MagicMock()
        get_result.scalar_one_or_none.return_value = old
        db = make_db(execute_results=[get_result])

        new = await svc.supersede_memory(
            db,
            old.id,
            MemorySupersedeRequest(content="corrected", reason="fix"),
            tenant_id=str(ws_id),
            workspace_id=str(ws_id),
        )

        assert new is not None
        assert old.status == "superseded"
        assert new.supersedes_id == old.id
        db.flush.assert_awaited()


async def _seed_memory(session, ws_id, status, title):
    row = Memory(
        id=uuid.uuid4(),
        type="note",
        domain=None,
        status=status,
        title=title,
        summary=title,
        content=title,
        content_hash="h",
        size=0,
        embedding=None,
        metadata_={},
        tags=[],
        tenant_id=ws_id,
        user_id=None,
        workspace_id=ws_id,
        source_type=None,
        source_uri=None,
        source_label=None,
        connector_id=None,
    )
    session.add(row)
    await session.flush()
    return row


class TestSearchHonoursStatusFilter:
    """P0-2: vector hits must respect the caller's visibility rules.

    These run against a real SQLite session with real ``Memory`` rows so the
    SQL predicate is genuinely evaluated. A MagicMock session cannot prove a
    WHERE clause works -- it can only prove the code called ``execute``.
    """

    async def test_superseded_memory_excluded_by_default(self, svc, db_session, monkeypatch):
        ws_id = uuid.uuid4()
        active = await _seed_memory(db_session, ws_id, "active", "active fact")
        superseded = await _seed_memory(db_session, ws_id, "superseded", "old fact")

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        # The vector store still holds the stale superseded vector.
        store.search = AsyncMock(
            side_effect=lambda *a, **k: [
                vec_record(active.id, 0.10),
                vec_record(superseded.id, 0.01),
            ]
        )

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        results = await svc.search_memories(
            db_session,
            MemorySearch(query="fact", workspace_id=ws_id, strategy="vector"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        ids = {m.id for m, _ in results}
        assert superseded.id not in ids, "superseded memory must not be returned"
        assert active.id in ids, "active memory must still be returned"

    async def test_deleted_memory_excluded_by_default(self, svc, db_session, monkeypatch):
        ws_id = uuid.uuid4()
        active = await _seed_memory(db_session, ws_id, "active", "active fact")
        deleted = await _seed_memory(db_session, ws_id, "deleted", "deleted fact")

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(
            side_effect=lambda *a, **k: [
                vec_record(deleted.id, 0.01),
                vec_record(active.id, 0.10),
            ]
        )

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        results = await svc.search_memories(
            db_session,
            MemorySearch(query="fact", workspace_id=ws_id, strategy="vector"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        ids = {m.id for m, _ in results}
        assert deleted.id not in ids, "deleted memory must not be returned"
        assert active.id in ids

    async def test_superseded_memory_visible_when_requested(self, svc, db_session, monkeypatch):
        ws_id = uuid.uuid4()
        active = await _seed_memory(db_session, ws_id, "active", "active fact")
        superseded = await _seed_memory(db_session, ws_id, "superseded", "old fact")

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(
            side_effect=lambda *a, **k: [
                vec_record(active.id, 0.10),
                vec_record(superseded.id, 0.01),
            ]
        )

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        results = await svc.search_memories(
            db_session,
            MemorySearch(
                query="fact", workspace_id=ws_id, strategy="vector", include_superseded=True
            ),
            tenant_id=None,
            workspace_id=ws_id,
        )

        ids = {m.id for m, _ in results}
        assert superseded.id in ids, "include_superseded must surface the superseded row"
        assert active.id in ids

    async def test_deleted_memory_stays_hidden_even_with_include_superseded(
        self, svc, db_session, monkeypatch
    ):
        """Negative control: include_superseded must not resurrect deletions."""
        ws_id = uuid.uuid4()
        active = await _seed_memory(db_session, ws_id, "active", "active fact")
        deleted = await _seed_memory(db_session, ws_id, "deleted", "deleted fact")

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(
            side_effect=lambda *a, **k: [
                vec_record(deleted.id, 0.01),
                vec_record(active.id, 0.10),
            ]
        )

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        results = await svc.search_memories(
            db_session,
            MemorySearch(
                query="fact", workspace_id=ws_id, strategy="vector", include_superseded=True
            ),
            tenant_id=None,
            workspace_id=ws_id,
        )

        ids = {m.id for m, _ in results}
        assert deleted.id not in ids, "include_superseded must not resurrect deleted rows"
        assert active.id in ids

    async def test_other_workspace_vector_hit_excluded(self, svc, db_session, monkeypatch):
        """A vector hit pointing at another workspace must never leak."""
        ws_a = uuid.uuid4()
        ws_b = uuid.uuid4()
        mine = await _seed_memory(db_session, ws_a, "active", "mine")
        theirs = await _seed_memory(db_session, ws_b, "active", "theirs")

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(
            side_effect=lambda *a, **k: [
                vec_record(theirs.id, 0.01),
                vec_record(mine.id, 0.10),
            ]
        )

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        results = await svc.search_memories(
            db_session,
            MemorySearch(query="fact", workspace_id=ws_a, strategy="vector"),
            tenant_id=None,
            workspace_id=ws_a,
        )

        ids = {m.id for m, _ in results}
        assert theirs.id not in ids, "cross-workspace vector hit must be filtered out"
        assert mine.id in ids

    async def test_search_requests_source_type_memory_filter(self, svc, monkeypatch):
        """document_chunk rows share the embeddings table; they must be filtered out."""
        ws_id = uuid.uuid4()
        mem = MagicMock(spec=Memory)
        mem.id = uuid.uuid4()
        mem.status = "active"

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(return_value=[])
        store.upsert = AsyncMock()
        store.delete = AsyncMock()

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        db = make_db()

        await svc.search_memories(
            db,
            MemorySearch(query="fact", workspace_id=ws_id, strategy="vector"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        filters = store.search.await_args.kwargs["filters"]
        assert filters["source_type"] == "memory"
        assert filters["workspace_id"] == str(ws_id)

class TestTaxonomyLedgerProvenance:
    """The 0027 ledger table must actually be written (it previously had zero writers)."""

    async def test_type_remap_records_ledger_row(self, svc, db_session, monkeypatch):
        from api.models.schema import MemoryTaxonomyLedger

        ws_id = uuid.uuid4()
        mem = await _seed_memory(db_session, ws_id, "active", "typed fact")
        mem.type = "note"

        added = []
        orig_add = db_session.add

        def spy(obj):
            added.append(obj)
            return orig_add(obj)

        monkeypatch.setattr(db_session, "add", spy)

        updated = await svc.update_memory(
            db_session,
            mem.id,
            MemoryUpdate(type="insight"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        assert updated is not None
        ledger_rows = [o for o in added if isinstance(o, MemoryTaxonomyLedger)]
        assert len(ledger_rows) == 1, "a type remap must write exactly one ledger row"
        row = ledger_rows[0]
        assert row.from_type == "note"
        assert row.to_type == "insight"
        assert row.memory_id == mem.id
        assert row.taxonomy_version == 2, "insight is an enterprise type"
        assert row.checksum

    async def test_same_type_change_records_nothing(self, svc, db_session, monkeypatch):
        ws_id = uuid.uuid4()
        mem = await _seed_memory(db_session, ws_id, "active", "typed fact")
        mem.type = "note"

        added = []
        orig_add = db_session.add

        def spy(obj):
            added.append(obj)
            return orig_add(obj)

        monkeypatch.setattr(db_session, "add", spy)

        await svc.update_memory(
            db_session,
            mem.id,
            MemoryUpdate(type="note"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        from api.models.schema import MemoryTaxonomyLedger

        assert not [o for o in added if isinstance(o, MemoryTaxonomyLedger)]

    async def test_ledger_write_failure_does_not_break_update(self, svc, db_session, monkeypatch):
        """Provenance is best-effort and must never fail the user's write."""
        ws_id = uuid.uuid4()
        mem = await _seed_memory(db_session, ws_id, "active", "typed fact")
        mem.type = "note"

        import api.models.schema as schema_mod

        def boom(*args, **kwargs):
            raise RuntimeError("ledger unavailable")

        monkeypatch.setattr(schema_mod, "MemoryTaxonomyLedger", boom)

        updated = await svc.update_memory(
            db_session,
            mem.id,
            MemoryUpdate(type="insight"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        assert updated is not None
        assert updated.type == "insight"


class TestScoreProvenance:
    async def test_score_comes_from_real_distance_not_constant(self, svc, monkeypatch):
        ws_id = uuid.uuid4()
        near = MagicMock(spec=Memory)
        near.id = uuid.uuid4()
        near.status = "active"
        far = MagicMock(spec=Memory)
        far.id = uuid.uuid4()
        far.status = "active"

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(
            side_effect=lambda *a, **k: [vec_record(near.id, 0.05), vec_record(far.id, 0.60)]
        )

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        mem_rows = MagicMock()
        mem_rows.scalars.return_value.all.return_value = [near, far]
        db = make_db(execute_results=[mem_rows])

        results = await svc.search_memories(
            db,
            MemorySearch(query="fact", workspace_id=ws_id, strategy="vector"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        by_id = {m.id: s for m, s in results}
        assert by_id[near.id] == pytest.approx(0.95)
        assert by_id[far.id] == pytest.approx(0.40)
        assert len({round(s, 4) for _, s in results}) == 2, "scores must be distinct"
        assert all(s != 0.95 or m is near for m, s in results), "0.95 must not be a constant"

    async def test_missing_distance_scores_zero_not_fabricated(self, svc, monkeypatch):
        ws_id = uuid.uuid4()
        mem = MagicMock(spec=Memory)
        mem.id = uuid.uuid4()
        mem.status = "active"

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        rec = VectorRecord(
            id=str(mem.id),
            vector=[0.1] * 8,
            metadata={"source_type": "memory", "source_id": str(mem.id), "workspace_id": ""},
        )
        store.search = AsyncMock(return_value=[rec])

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        mem_rows = MagicMock()
        mem_rows.scalars.return_value.all.return_value = [mem]
        db = make_db(execute_results=[mem_rows])

        results = await svc.search_memories(
            db,
            MemorySearch(query="fact", workspace_id=ws_id, strategy="vector"),
            tenant_id=None,
            workspace_id=ws_id,
        )

        assert results == [(mem, 0.0)]

    async def test_tenant_scoping_applied_to_vector_hits(self, svc, monkeypatch):
        """A vector hit outside the tenant must never be returned."""
        ws_id = uuid.uuid4()
        mem = MagicMock(spec=Memory)
        mem.id = uuid.uuid4()
        mem.status = "active"

        async def fake_embedding(*args, **kwargs):
            return [0.1] * 8

        monkeypatch.setattr(llm_module.llm_service, "generate_embedding", fake_embedding)

        store = MagicMock()
        store.search = AsyncMock(return_value=[vec_record(mem.id, 0.1)])

        import api.infrastructure.vector_store as vs_mod

        monkeypatch.setattr(vs_mod, "get_vector_store", lambda: store)

        # DB returns nothing for this tenant -> vector hit must be dropped.
        mem_rows = MagicMock()
        mem_rows.scalars.return_value.all.return_value = []
        db = make_db(execute_results=[mem_rows])

        results = await svc.search_memories(
            db,
            MemorySearch(query="fact", workspace_id=ws_id, strategy="vector"),
            tenant_id="other-tenant",
            workspace_id=ws_id,
        )

        assert results == []

        # Negative control: the tenant predicate must be in the SQL, not just
        # relied upon for the workspace_id filter on the vector store.
        stmt = db.executed[0]
        assert "tenant_id" in str(stmt), "vector-path lookup must enforce tenant scoping"


class TestVectorStoreDistanceReporting:
    async def test_fallback_store_reports_real_distance(self):
        store = FallbackVectorStore()
        rec = VectorRecord(
            id="m1",
            vector=[1.0, 0.0],
            metadata={"source_type": "memory", "workspace_id": "ws"},
        )
        await store.upsert([rec])
        results = await store.search(
            [1.0, 0.0], limit=5, filters={"source_type": "memory", "workspace_id": "ws"}
        )

        assert len(results) == 1
        assert results[0].metadata["distance"] == pytest.approx(0.0, abs=1e-9)

    async def test_fallback_store_distance_reflects_orthogonal_vectors(self):
        store = FallbackVectorStore()
        rec = VectorRecord(
            id="m1",
            vector=[0.0, 1.0],
            metadata={"source_type": "memory", "workspace_id": "ws"},
        )
        await store.upsert([rec])
        results = await store.search(
            [1.0, 0.0], limit=5, filters={"source_type": "memory", "workspace_id": "ws"}
        )

        assert results[0].metadata["distance"] == pytest.approx(1.0, abs=1e-9)

    async def test_fallback_store_filters_by_source_type(self):
        store = FallbackVectorStore()
        await store.upsert(
            [
                VectorRecord(
                    id="a",
                    vector=[1.0, 0.0],
                    metadata={"source_type": "memory", "workspace_id": "ws"},
                ),
                VectorRecord(
                    id="b",
                    vector=[1.0, 0.0],
                    metadata={"source_type": "document_chunk", "workspace_id": "ws"},
                ),
            ]
        )
        results = await store.search(
            [1.0, 0.0], limit=5, filters={"source_type": "memory", "workspace_id": "ws"}
        )
        assert [r.id for r in results] == ["a"]

    async def test_fallback_store_delete_removes_vector(self):
        """Supersede relies on delete actually removing the record."""
        store = FallbackVectorStore()
        await store.upsert(
            [
                VectorRecord(
                    id="a",
                    vector=[1.0, 0.0],
                    metadata={"source_type": "memory", "workspace_id": "ws"},
                )
            ]
        )
        await store.delete(["a"])
        results = await store.search(
            [1.0, 0.0], limit=5, filters={"source_type": "memory", "workspace_id": "ws"}
        )
        assert results == []

    async def test_fallback_store_requires_scoping_filter(self):
        """Negative control: the Zero-Trust guard must still reject unscoped search."""
        store = FallbackVectorStore()
        await store.upsert(
            [
                VectorRecord(
                    id="a",
                    vector=[1.0, 0.0],
                    metadata={"source_type": "memory", "workspace_id": "ws"},
                )
            ]
        )
        with pytest.raises(ValueError, match="Zero-Trust violation"):
            await store.search([1.0, 0.0], limit=5, filters={"source_type": "memory"})
