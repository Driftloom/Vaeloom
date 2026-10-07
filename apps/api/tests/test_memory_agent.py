"""Enterprise-grade tests for the memory agent merge module.

The retrieval half of this file previously covered
`api.agents.memory_agent.retrieval`, which was never imported by any production
module and has been deleted. Retrieval behaviour is covered where it actually
runs -- see `tests/test_memory_vector_correctness.py` for
`MemoryService.search_memories` and `tests/test_document_rag_e2e.py` for the
ContextEngine ranking/budget policy.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

pytestmark = pytest.mark.asyncio

# ─── Helpers ──────────────────────────────────────────────────────────────────


class FakeEntityObj:
    def __init__(self, id_: uuid.UUID | None = None, canonical_name: str = "TestEntity",
                 type_: str = "test_type", aliases: list[str] | None = None,
                 workspace_id: str | None = None):
        self.id = id_ if id_ is not None else uuid.uuid4()
        self.canonical_name = canonical_name
        self.type = type_
        self.aliases = aliases or []
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
    raw_rows=None,
    raise_on_raw=False,
    entity_for_resolution=None,
    entity_list_for_query=None,
):
    raw_rows = raw_rows if raw_rows is not None else []
    entity_list_for_query = entity_list_for_query if entity_list_for_query is not None else []

    async def side_effect(stmt, *args, **kwargs):
        from sqlalchemy.sql.expression import TextClause
        s = str(stmt) if not isinstance(stmt, TextClause) else ""
        cls_name = type(stmt).__name__

        if isinstance(stmt, TextClause) or cls_name == "TextClause":
            if raise_on_raw:
                raise Exception("Simulated raw SQL failure")
            return _make_mock_result(fetchall=raw_rows)

        if "from entities" in s.lower():
            return _make_mock_result(
                scalar_one_or_none=entity_for_resolution,
                scalars_all=entity_list_for_query,
            )

        return _make_mock_result()

    return side_effect


def _clear_cached_imports(monkeypatch, *module_names):
    """Remove modules from sys.modules so lazy imports trigger ImportError."""
    import builtins
    import sys

    real_import = builtins.__import__

    for name in module_names:
        monkeypatch.delitem(sys.modules, name, raising=False)

    def mock_import(name, *args, **kwargs):
        if name in module_names or any(name.startswith(m + ".") for m in module_names):
            raise ImportError(f"No module named {name}")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", mock_import)

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
