"""Enterprise-grade tests for memory agent retrieval and merge modules."""

import math
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.asyncio

# ─── Helpers ──────────────────────────────────────────────────────────────────


class FakeRow:
    def __init__(self, id_: str, source_type: str, source_id: str, distance: float = 0.1):
        self.id = id_
        self.source_type = source_type
        self.source_id = source_id
        self.distance = distance


class FakeEntityObj:
    def __init__(self, id_: uuid.UUID | None = None, canonical_name: str = "TestEntity",
                 type_: str = "test_type", aliases: list[str] | None = None,
                 workspace_id: str | None = None):
        self.id = id_ if id_ is not None else uuid.uuid4()
        self.canonical_name = canonical_name
        self.type = type_
        self.aliases = aliases or []
        self.workspace_id = workspace_id or str(uuid.uuid4())


class FakeMemoryRecordObj:
    def __init__(self, id_: uuid.UUID | None = None, content: dict | None = None,
                 source_document_id: uuid.UUID | None = None,
                 workspace_id: str | None = None):
        self.id = id_ if id_ is not None else uuid.uuid4()
        self.content = content if content is not None else {"text": "test memory content"}
        self.source_document_id = source_document_id
        self.workspace_id = workspace_id or str(uuid.uuid4())


class FakeEmbeddingObj:
    def __init__(self, id_: uuid.UUID | None = None, source_type: str = "entity",
                 source_id: uuid.UUID | None = None,
                 vector: list[float] | None = None,
                 workspace_id: str | None = None):
        self.id = id_ if id_ is not None else uuid.uuid4()
        self.source_type = source_type
        self.source_id = source_id if source_id is not None else uuid.uuid4()
        self.vector = vector
        self.workspace_id = workspace_id or str(uuid.uuid4())


def _make_mock_result(*, fetchall=None, scalar_one_or_none=None,
                      scalars_all=None):
    r = MagicMock()
    if fetchall is not None:
        r.fetchall.return_value = fetchall
    r.scalar_one_or_none.return_value = scalar_one_or_none
    scalar_mock = MagicMock()
    if scalars_all is not None:
        scalar_mock.all.return_value = scalars_all
    r.scalars = MagicMock(return_value=scalar_mock)
    return r


def _make_session_and_factory(*, execute_side_effect=None, get_side_effect=None):
    session = AsyncMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)

    if execute_side_effect is not None:
        session.execute = AsyncMock(side_effect=execute_side_effect)
    else:
        session.execute = AsyncMock(return_value=_make_mock_result())

    if get_side_effect is not None:
        session.get = AsyncMock(side_effect=get_side_effect)
    else:
        session.get = AsyncMock(return_value=None)

    def factory():
        return session

    return session, factory


def _make_execute_dispatcher(
    raw_rows=None, raise_on_raw=False,
    embeddings_for_fallback=None, raise_on_fallback=False,
    entity_for_resolution=None, entity_list_for_query=None,
    mr_for_resolution=None, mr_list_for_query=None,
    relationship_list=None,
):
    raw_rows = raw_rows if raw_rows is not None else []
    embeddings_for_fallback = embeddings_for_fallback if embeddings_for_fallback is not None else []
    entity_list_for_query = entity_list_for_query if entity_list_for_query is not None else []
    mr_list_for_query = mr_list_for_query if mr_list_for_query is not None else []
    relationship_list = relationship_list if relationship_list is not None else []

    async def side_effect(stmt, *args, **kwargs):
        from sqlalchemy.sql.expression import TextClause
        s = str(stmt) if not isinstance(stmt, TextClause) else ""
        cls_name = type(stmt).__name__

        if isinstance(stmt, TextClause) or cls_name == "TextClause":
            if raise_on_raw:
                raise Exception("Simulated raw SQL failure")
            return _make_mock_result(fetchall=raw_rows)

        if "from embeddings" in s.lower():
            if raise_on_fallback:
                raise Exception("Simulated fallback failure")
            return _make_mock_result(scalars_all=embeddings_for_fallback)

        if "from entities" in s.lower():
            return _make_mock_result(
                scalar_one_or_none=entity_for_resolution,
                scalars_all=entity_list_for_query,
            )

        if "from memory_records" in s.lower():
            return _make_mock_result(
                scalar_one_or_none=mr_for_resolution,
                scalars_all=mr_list_for_query,
            )

        if "from relationships" in s.lower():
            return _make_mock_result(scalars_all=relationship_list)

        return _make_mock_result()

    return side_effect


def _clear_cached_imports(monkeypatch, *module_names):
    """Remove modules from sys.modules so lazy imports trigger ImportError."""
    import builtins
    real_import = builtins.__import__

    for name in module_names:
        monkeypatch.delitem(sys.modules, name, raising=False)

    def mock_import(name, *args, **kwargs):
        if name in module_names or any(name.startswith(m + ".") for m in module_names):
            raise ImportError(f"No module named {name}")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", mock_import)


# ─── 1. _cosine_similarity ────────────────────────────────────────────────────


class TestCosineSimilarity:
    def test_identical_vectors(self):
        from api.agents.memory_agent.retrieval import _cosine_similarity
        v = [0.5, 0.5, 0.5, 0.5]
        assert _cosine_similarity(v, v) == 1.0

    def test_orthogonal_vectors(self):
        from api.agents.memory_agent.retrieval import _cosine_similarity
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert _cosine_similarity(a, b) == 0.0

    def test_opposite_vectors(self):
        from api.agents.memory_agent.retrieval import _cosine_similarity
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert _cosine_similarity(a, b) == -1.0

    def test_zero_vector(self):
        from api.agents.memory_agent.retrieval import _cosine_similarity
        assert _cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0
        assert _cosine_similarity([1.0, 0.0], [0.0, 0.0]) == 0.0

    def test_partial_match(self):
        from api.agents.memory_agent.retrieval import _cosine_similarity
        a = [1.0, 0.0]
        b = [0.5, 0.5]
        result = _cosine_similarity(a, b)
        expected = 0.5 / math.sqrt(0.5)
        assert abs(result - expected) < 1e-6


# ─── 2. vector_search ─────────────────────────────────────────────────────────


class TestVectorSearch:

    async def test_pg_vector_path_entity_source(self, monkeypatch):
        sid = uuid.uuid4()
        entity = FakeEntityObj(id_=sid, canonical_name="ReactFramework")
        row = FakeRow(str(sid), "entity", str(sid), distance=0.15)
        dispatcher = _make_execute_dispatcher(
            raw_rows=[row], entity_for_resolution=entity,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("react", str(uuid.uuid4()), 5)

        assert len(results) == 1
        assert results[0].content == "ReactFramework"
        assert results[0].source_document_id == str(entity.id)
        assert results[0].relevance_score == 0.85

    async def test_pg_vector_path_memory_record_source(self, monkeypatch):
        mid = uuid.uuid4()
        doc_id = uuid.uuid4()
        mr = FakeMemoryRecordObj(
            id_=mid, content={"text": "key insight"},
            source_document_id=doc_id,
        )
        row = FakeRow(str(mid), "memory_record", str(mid), distance=0.05)
        dispatcher = _make_execute_dispatcher(
            raw_rows=[row], mr_for_resolution=mr,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("insight", str(uuid.uuid4()), 5)

        assert len(results) == 1
        assert "key insight" in results[0].content
        assert results[0].source_document_id == str(doc_id)
        assert results[0].relevance_score == 0.95

    async def test_fallback_vector_search_path(self, monkeypatch):
        sid = uuid.uuid4()
        entity = FakeEntityObj(id_=sid, canonical_name="FallbackEntity")
        emb = FakeEmbeddingObj(source_type="entity", source_id=sid, vector=[0.1] * 1536)
        dispatcher = _make_execute_dispatcher(
            raise_on_raw=True,
            embeddings_for_fallback=[emb],
            entity_for_resolution=entity,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("test", str(uuid.uuid4()), 5)

        assert len(results) == 1
        assert results[0].content == "FallbackEntity"

    async def test_full_db_failure_in_memory_fallback(self, monkeypatch):
        dispatcher = _make_execute_dispatcher(
            raise_on_raw=True, raise_on_fallback=True,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("test", str(uuid.uuid4()), 5)

        assert len(results) == 1
        assert "Vector search unavailable" in results[0].content

    async def test_entity_source_type_resolution(self, monkeypatch):
        sid = uuid.uuid4()
        entity = FakeEntityObj(id_=sid, canonical_name="TypeResolution")
        row = FakeRow(str(sid), "entity", str(sid))
        dispatcher = _make_execute_dispatcher(
            raw_rows=[row], entity_for_resolution=entity,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("type", str(uuid.uuid4()), 5)

        assert len(results) == 1
        assert results[0].source_document_id == str(entity.id)

    async def test_memory_record_source_type_resolution(self, monkeypatch):
        mid = uuid.uuid4()
        doc_id = uuid.uuid4()
        mr = FakeMemoryRecordObj(
            id_=mid, content={"text": "record content"},
            source_document_id=doc_id,
        )
        row = FakeRow(str(mid), "memory_record", str(mid))
        dispatcher = _make_execute_dispatcher(
            raw_rows=[row], mr_for_resolution=mr,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("record", str(uuid.uuid4()), 5)

        assert len(results) == 1
        assert results[0].source_document_id == str(doc_id)

    async def test_empty_results(self, monkeypatch):
        dispatcher = _make_execute_dispatcher(raw_rows=[])
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("nothing", str(uuid.uuid4()), 5)
        assert results == []

    async def test_import_error_returns_empty(self, monkeypatch):
        _clear_cached_imports(monkeypatch, "api.database")
        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("test", str(uuid.uuid4()), 5)
        assert results == []

    async def test_embedding_exception_falls_back_to_in_memory(self, monkeypatch):
        dispatcher = _make_execute_dispatcher()
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)
        monkeypatch.setattr("api.services.llm_service.llm_service.generate_embedding", AsyncMock(side_effect=Exception("API error")))
        from api.agents.memory_agent.retrieval import vector_search
        results = await vector_search("test", str(uuid.uuid4()), 5)
        assert len(results) == 1
        assert "Vector search unavailable" in results[0].content


# ─── 3. _fallback_vector_search ────────────────────────────────────────────────


class TestFallbackVectorSearch:

    async def test_scores_and_returns_top_k(self):
        from api.agents.memory_agent.retrieval import _fallback_vector_search

        emb1 = FakeEmbeddingObj(vector=[1.0, 0.0])
        emb2 = FakeEmbeddingObj(vector=[0.0, 1.0])
        emb3 = FakeEmbeddingObj(vector=[0.5, 0.5])

        dispatcher = _make_execute_dispatcher(
            embeddings_for_fallback=[emb1, emb2, emb3],
        )
        session, _ = _make_session_and_factory(execute_side_effect=dispatcher)

        results = await _fallback_vector_search(
            session, [1.0, 0.0], str(uuid.uuid4()), 2,
        )
        assert len(results) == 2
        assert results[0].id == emb1.id
        assert results[1].id == emb3.id

    async def test_skips_none_vectors(self):
        from api.agents.memory_agent.retrieval import _fallback_vector_search

        emb1 = FakeEmbeddingObj(vector=[1.0, 0.0])
        emb2 = FakeEmbeddingObj(vector=None)
        emb3 = FakeEmbeddingObj(vector=[0.5, 0.5])

        dispatcher = _make_execute_dispatcher(
            embeddings_for_fallback=[emb1, emb2, emb3],
        )
        session, _ = _make_session_and_factory(execute_side_effect=dispatcher)

        results = await _fallback_vector_search(
            session, [1.0, 0.0], str(uuid.uuid4()), 5,
        )
        assert len(results) == 2
        assert emb2.id not in {r.id for r in results}


# ─── 4. _in_memory_vector_search ──────────────────────────────────────────────


class TestInMemoryVectorSearch:
    def test_returns_fallback_result(self):
        from api.agents.memory_agent.retrieval import _in_memory_vector_search
        results = _in_memory_vector_search("hello", "ws1", 10)
        assert len(results) == 1
        assert results[0].id == "vec_fallback"
        assert "hello" in results[0].content
        assert results[0].relevance_score == 0.5


# ─── 5. keyword_search ───────────────────────────────────────────────────────


def _patch_memory_record_content(monkeypatch):
    """Monkeypatch MemoryRecord.content to avoid cast('text') validation error."""
    import api.models.schema as schema
    from sqlalchemy import true

    class MockColumn:
        def cast(self, type_):
            return self
        def ilike(self, pattern):
            return true()

    monkeypatch.setattr(schema.MemoryRecord, "content", MockColumn())


class TestKeywordSearch:

    async def test_entity_matching_via_ilike(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(
            id_=eid, canonical_name="React", type_="framework",
        )
        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)
        _patch_memory_record_content(monkeypatch)

        from api.agents.memory_agent.retrieval import keyword_search
        results = await keyword_search("react", str(uuid.uuid4()), 1)

        assert len(results) == 1
        assert results[0].content == "React (framework)"
        assert results[0].relevance_score == 0.7

    async def test_memory_record_matching_when_entities_below_limit(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="React", type_="framework")
        mid = uuid.uuid4()
        mr = FakeMemoryRecordObj(
            id_=mid, content={"text": "react documentation"},
        )
        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
            mr_list_for_query=[mr],
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)
        _patch_memory_record_content(monkeypatch)

        from api.agents.memory_agent.retrieval import keyword_search
        results = await keyword_search("react", str(uuid.uuid4()), 5)

        assert len(results) == 2
        assert results[0].relevance_score == 0.7
        assert results[1].relevance_score == 0.65

    async def test_exception_path_returns_empty(self, monkeypatch):
        session, factory = _make_session_and_factory()
        monkeypatch.setattr("api.database.async_session_factory", factory)
        session.execute = AsyncMock(side_effect=Exception("DB error"))

        from api.agents.memory_agent.retrieval import keyword_search
        results = await keyword_search("error", str(uuid.uuid4()), 10)
        assert results == []

    async def test_import_error_returns_empty(self, monkeypatch):
        _clear_cached_imports(monkeypatch, "api.database")
        from api.agents.memory_agent.retrieval import keyword_search
        results = await keyword_search("react", str(uuid.uuid4()), 5)
        assert results == []


# ─── 6. graph_traversal ────────────────────────────────────────────────────────


class TestGraphTraversal:

    async def test_entity_matching(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="React")
        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import graph_traversal
        results = await graph_traversal("react", str(uuid.uuid4()), 10)

        assert len(results) == 1
        assert results[0].content == "React"
        assert results[0].relevance_score == 0.75

    async def test_relationship_traversal(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="React")
        other_id = uuid.uuid4()
        other_entity = FakeEntityObj(id_=other_id, canonical_name="Redux")

        rel = MagicMock()
        rel.from_entity_id = eid
        rel.to_entity_id = other_id
        rel.relation_type = "depends_on"

        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
            relationship_list=[rel],
        )
        session, factory = _make_session_and_factory(
            execute_side_effect=dispatcher,
            get_side_effect=lambda *a, **kw: other_entity,
        )
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import graph_traversal
        results = await graph_traversal("react", str(uuid.uuid4()), 10)

        assert len(results) == 1
        assert "Redux" in results[0].content
        assert "depends_on" in results[0].content

    async def test_related_entity_name_resolution(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="React")
        other_id = uuid.uuid4()
        other_entity = FakeEntityObj(id_=other_id, canonical_name="Router")

        rel = MagicMock()
        rel.from_entity_id = other_id
        rel.to_entity_id = eid
        rel.relation_type = "uses"

        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
            relationship_list=[rel],
        )
        session, factory = _make_session_and_factory(
            execute_side_effect=dispatcher,
            get_side_effect=lambda *a, **kw: other_entity,
        )
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import graph_traversal
        results = await graph_traversal("react", str(uuid.uuid4()), 10)

        assert len(results) == 1
        assert "Router" in results[0].content

    async def test_exception_path_returns_empty(self, monkeypatch):
        session, factory = _make_session_and_factory()
        monkeypatch.setattr("api.database.async_session_factory", factory)
        session.execute = AsyncMock(side_effect=Exception("Graph error"))

        from api.agents.memory_agent.retrieval import graph_traversal
        results = await graph_traversal("error", str(uuid.uuid4()), 10)
        assert results == []

    async def test_import_error_returns_empty(self, monkeypatch):
        _clear_cached_imports(monkeypatch, "api.database")
        from api.agents.memory_agent.retrieval import graph_traversal
        results = await graph_traversal("react", str(uuid.uuid4()), 10)
        assert results == []

    async def test_get_exception_skips_entity(self, monkeypatch):
        eid = uuid.uuid4()
        eid2 = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="Router")
        rel = MagicMock()
        rel.from_entity_id = eid
        rel.to_entity_id = eid2
        rel.relation_type = "related_to"
        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
            relationship_list=[rel],
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher, get_side_effect=Exception("Get failed"))
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import graph_traversal
        results = await graph_traversal("react", str(uuid.uuid4()), 10)
        assert len(results) == 1
        assert "Router" in results[0].content


# ─── 7. rerank ────────────────────────────────────────────────────────────────


class TestRerank:
    async def test_dedup_by_id(self):
        from api.agents.memory_agent.retrieval import RetrievedMemory, rerank
        r1 = RetrievedMemory(id="a", content="A", relevance_score=0.5)
        r2 = RetrievedMemory(id="a", content="A dup", relevance_score=0.5)
        r3 = RetrievedMemory(id="b", content="B", relevance_score=0.8)
        results = await rerank([r1, r2, r3], "query", 10)
        assert len(results) == 2
        ids = [r.id for r in results]
        assert ids == ["b", "a"]

    async def test_sorts_by_relevance_score_descending(self):
        from api.agents.memory_agent.retrieval import RetrievedMemory, rerank
        r1 = RetrievedMemory(id="a", content="low", relevance_score=0.3)
        r2 = RetrievedMemory(id="b", content="high", relevance_score=0.9)
        r3 = RetrievedMemory(id="c", content="mid", relevance_score=0.6)
        results = await rerank([r1, r2, r3], "query", 10)
        assert [r.id for r in results] == ["b", "c", "a"]

    async def test_limits_results(self):
        from api.agents.memory_agent.retrieval import RetrievedMemory, rerank
        items = [RetrievedMemory(id=str(i), content=str(i), relevance_score=float(i))
                 for i in range(1, 11)]
        results = await rerank(items, "query", 3)
        assert len(results) == 3
        assert results[0].relevance_score == 10.0
        assert results[-1].relevance_score == 8.0


# ─── 8. retrieve ──────────────────────────────────────────────────────────────


class TestRetrieve:

    async def test_vector_strategy(self, monkeypatch):
        sid = uuid.uuid4()
        entity = FakeEntityObj(id_=sid, canonical_name="VecRes")
        row = FakeRow(str(sid), "entity", str(sid))
        dispatcher = _make_execute_dispatcher(
            raw_rows=[row], entity_for_resolution=entity,
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import retrieve
        results = await retrieve("vec", str(uuid.uuid4()), strategy="vector", limit=5)
        assert len(results) == 1
        assert results[0].content == "VecRes"

    async def test_keyword_strategy(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="KeywordRes", type_="lib")
        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)
        _patch_memory_record_content(monkeypatch)

        from api.agents.memory_agent.retrieval import retrieve
        results = await retrieve("keyword", str(uuid.uuid4()), strategy="keyword", limit=5)
        assert len(results) == 1
        assert "KeywordRes" in results[0].content

    async def test_graph_strategy(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(id_=eid, canonical_name="GraphRes")
        dispatcher = _make_execute_dispatcher(
            entity_list_for_query=[entity],
        )
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.retrieval import retrieve
        results = await retrieve("graph", str(uuid.uuid4()), strategy="graph", limit=5)
        assert len(results) == 1
        assert results[0].content == "GraphRes"

    async def test_hybrid_strategy_combines_all_and_reranks(self, monkeypatch):
        eid_kw = uuid.uuid4()
        entity_for_keyword = FakeEntityObj(id_=eid_kw, canonical_name="HybridKW", type_="lib")
        eid_gr = uuid.uuid4()
        entity_for_graph = FakeEntityObj(id_=eid_gr, canonical_name="HybridGR")
        sid = uuid.uuid4()
        entity_for_vector = FakeEntityObj(id_=sid, canonical_name="HybridVec")
        row = FakeRow(str(sid), "entity", str(sid))

        def hybrid_dispatcher(stmt, *args, **kwargs):
            from sqlalchemy.sql.expression import TextClause
            s = str(stmt) if not isinstance(stmt, TextClause) else ""
            if isinstance(stmt, TextClause) or type(stmt).__name__ == "TextClause":
                return _make_mock_result(fetchall=[row])
            if "from embeddings" in s.lower():
                return _make_mock_result(scalars_all=[])
            if "from entities" in s.lower():
                return _make_mock_result(
                    scalar_one_or_none=entity_for_vector,
                    scalars_all=[entity_for_keyword, entity_for_graph],
                )
            if "from memory_records" in s.lower():
                return _make_mock_result(scalars_all=[])
            if "from relationships" in s.lower():
                return _make_mock_result(scalars_all=[])
            return _make_mock_result()

        session, factory = _make_session_and_factory(
            execute_side_effect=hybrid_dispatcher,
        )
        monkeypatch.setattr("api.database.async_session_factory", factory)
        _patch_memory_record_content(monkeypatch)

        from api.agents.memory_agent.retrieval import retrieve
        results = await retrieve("hybrid", str(uuid.uuid4()), strategy="hybrid", limit=10)

        assert len(results) >= 2

    async def test_unknown_strategy_returns_empty(self):
        from api.agents.memory_agent.retrieval import retrieve
        results = await retrieve("x", "ws", strategy="unknown")  # type: ignore
        assert results == []


# ─── 9. _fuzzy_score ──────────────────────────────────────────────────────────


class TestFuzzyScore:
    def test_exact_match(self):
        from api.agents.memory_agent.merge import _fuzzy_score
        assert _fuzzy_score("React", "React") == 1.0

    def test_no_match_returns_lower_score(self):
        from api.agents.memory_agent.merge import _fuzzy_score
        score = _fuzzy_score("React", "Angular")
        assert score < 0.5

    def test_case_insensitive(self):
        from api.agents.memory_agent.merge import _fuzzy_score
        assert _fuzzy_score("REACT", "react") == 1.0


# ─── 10. _compute_confidence ──────────────────────────────────────────────────


class TestComputeConfidence:
    def test_same_type_gets_boost(self):
        from api.agents.memory_agent.merge import _compute_confidence
        c = _compute_confidence("React", [], "React", ["ReactJS"], same_type=True)
        assert c == 1.0

    def test_different_type_no_boost(self):
        from api.agents.memory_agent.merge import _compute_confidence
        c = _compute_confidence("React", [], "Angular", [], same_type=False)
        assert c < 0.5

    def test_alias_scoring_improves_best_match(self):
        from api.agents.memory_agent.merge import _compute_confidence
        c = _compute_confidence("React.js", ["ReactJS", "React"], "React", [], same_type=True)
        assert c == 1.0

    def test_aliases_matching_existing_aliases(self):
        from api.agents.memory_agent.merge import _compute_confidence
        c = _compute_confidence("React.js", ["RJS"], "React", ["RJS"], same_type=False)
        assert c == 0.7


# ─── 11. merge_check ─────────────────────────────────────────────────────────


class TestMergeCheck:

    async def test_merge_action_when_confidence_high(self, monkeypatch):
        eid = uuid.uuid4()
        entity = FakeEntityObj(
            id_=eid, canonical_name="React", type_="framework",
        )
        dispatcher = _make_execute_dispatcher(entity_list_for_query=[entity])
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.merge import merge_check
        result = await merge_check("React", [], str(uuid.uuid4()), "framework")

        assert result.action == "merge"
        assert result.target_id == str(eid)
        assert result.confidence >= 0.8

    async def test_create_new_when_confidence_low(self, monkeypatch):
        entity = FakeEntityObj(
            canonical_name="Alice", type_="person",
        )
        dispatcher = _make_execute_dispatcher(entity_list_for_query=[entity])
        session, factory = _make_session_and_factory(execute_side_effect=dispatcher)
        monkeypatch.setattr("api.database.async_session_factory", factory)

        from api.agents.memory_agent.merge import merge_check
        result = await merge_check("Bob", [], str(uuid.uuid4()), "person")

        assert result.action == "create_new"
        assert result.confidence < 0.8

    async def test_db_import_error_falls_back(self, monkeypatch):
        monkeypatch.delattr("api.database.async_session_factory")

        from api.agents.memory_agent.merge import merge_check
        result = await merge_check("react", [], str(uuid.uuid4()), "framework")

        assert result.action == "merge"
        assert result.target_id == "entity_react_123"

    async def test_db_query_error_falls_back(self, monkeypatch):
        session, factory = _make_session_and_factory()
        monkeypatch.setattr("api.database.async_session_factory", factory)
        session.execute = AsyncMock(side_effect=Exception("DB error"))

        from api.agents.memory_agent.merge import merge_check
        result = await merge_check("react", [], str(uuid.uuid4()), "framework")

        assert result.action == "merge"
        assert result.target_id == "entity_react_123"


# ─── 12. _fallback_merge_check ────────────────────────────────────────────────


class TestFallbackMergeCheck:
    def test_react_returns_merge(self):
        from api.agents.memory_agent.merge import _fallback_merge_check
        result = _fallback_merge_check("React", [], "framework")
        assert result.action == "merge"
        assert result.target_id == "entity_react_123"
        assert result.confidence == 0.95

    def test_react_variants(self):
        from api.agents.memory_agent.merge import _fallback_merge_check
        assert _fallback_merge_check("React.js", [], "framework").action == "merge"
        assert _fallback_merge_check("reactjs", [], "framework").action == "merge"

    def test_alice_returns_create_new(self):
        from api.agents.memory_agent.merge import _fallback_merge_check
        result = _fallback_merge_check("Alice", [], "person")
        assert result.action == "create_new"
        assert result.confidence == 0.6

    def test_unknown_returns_create_new_zero_confidence(self):
        from api.agents.memory_agent.merge import _fallback_merge_check
        result = _fallback_merge_check("unknown", [], "other")
        assert result.action == "create_new"
        assert result.confidence == 0.0
