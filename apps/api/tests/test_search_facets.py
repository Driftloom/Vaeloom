import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from api.services.search_service import SearchService, _apply_filters, _extract_facets

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return SearchService()


def _make_result(**overrides):
    base = {
        "id": str(uuid.uuid4()),
        "text": "test result",
        "score": 1.0,
        "source": "memory",
        "metadata": {
            "type": "note",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tags": ["test"],
            "author": "user-1",
        },
    }
    base.update(overrides)
    if "metadata" in overrides:
        base["metadata"] = {**base["metadata"], **overrides["metadata"]}
    return base


class TestFacetExtraction:
    def test_facet_types(self):
        results = [
            _make_result(source="memory"),
            _make_result(source="memory"),
            _make_result(source="entity"),
        ]
        facets = _extract_facets(results)
        assert facets["types"]["memory"] == 2
        assert facets["types"]["entity"] == 1

    def test_facet_date_ranges(self):
        results = [
            _make_result(metadata={"created_at": "2026-01-15T10:00:00+00:00"}),
            _make_result(metadata={"created_at": "2026-01-20T10:00:00+00:00"}),
            _make_result(metadata={"created_at": "2026-02-01T10:00:00+00:00"}),
        ]
        facets = _extract_facets(results)
        assert facets["date_ranges"]["2026-01"] == 2
        assert facets["date_ranges"]["2026-02"] == 1

    def test_facet_tags(self):
        results = [
            _make_result(metadata={"tags": ["important", "urgent"]}),
            _make_result(metadata={"tags": ["important"]}),
            _make_result(metadata={"tags": []}),
        ]
        facets = _extract_facets(results)
        assert facets["tags"]["important"] == 2
        assert facets["tags"]["urgent"] == 1

    def test_facet_authors(self):
        results = [
            _make_result(metadata={"author": "user-1"}),
            _make_result(metadata={"author": "user-1"}),
            _make_result(metadata={"author": "user-2"}),
        ]
        facets = _extract_facets(results)
        assert facets["authors"]["user-1"] == 2
        assert facets["authors"]["user-2"] == 1

    def test_facet_empty_results(self):
        facets = _extract_facets([])
        assert facets == {"types": {}, "date_ranges": {}, "tags": {}, "authors": {}}

    def test_facet_results_without_dates_or_tags(self):
        results = [_make_result(metadata={})]
        facets = _extract_facets(results)
        assert "types" in facets


class TestFilterApplication:
    def test_filter_by_type(self):
        results = [
            _make_result(source="memory", id="1"),
            _make_result(source="entity", id="2"),
            _make_result(source="document", id="3"),
        ]
        filtered = _apply_filters(results, {"type": "memory"})
        assert len(filtered) == 1
        assert filtered[0]["id"] == "1"

    def test_filter_by_date_from(self):
        jan = _make_result(metadata={"created_at": "2026-01-15T10:00:00+00:00"}, id="jan")
        feb = _make_result(metadata={"created_at": "2026-02-15T10:00:00+00:00"}, id="feb")
        mar = _make_result(metadata={"created_at": "2026-03-15T10:00:00+00:00"}, id="mar")
        filtered = _apply_filters([jan, feb, mar], {"date_from": "2026-02-01"})
        assert len(filtered) == 2
        assert filtered[0]["id"] == "feb"
        assert filtered[1]["id"] == "mar"

    def test_filter_by_date_to(self):
        jan = _make_result(metadata={"created_at": "2026-01-15T10:00:00+00:00"}, id="jan")
        feb = _make_result(metadata={"created_at": "2026-02-15T10:00:00+00:00"}, id="feb")
        filtered = _apply_filters([jan, feb], {"date_to": "2026-02-01"})
        assert len(filtered) == 1
        assert filtered[0]["id"] == "jan"

    def test_filter_by_date_range(self):
        jan = _make_result(metadata={"created_at": "2026-01-15T10:00:00+00:00"}, id="jan")
        feb = _make_result(metadata={"created_at": "2026-02-15T10:00:00+00:00"}, id="feb")
        mar = _make_result(metadata={"created_at": "2026-03-15T10:00:00+00:00"}, id="mar")
        filtered = _apply_filters([jan, feb, mar], {"date_from": "2026-02-01", "date_to": "2026-03-01"})
        assert len(filtered) == 1
        assert filtered[0]["id"] == "feb"

    def test_filter_by_tags(self):
        results = [
            _make_result(metadata={"tags": ["important"]}, id="1"),
            _make_result(metadata={"tags": ["other"]}, id="2"),
            _make_result(metadata={"tags": []}, id="3"),
        ]
        filtered = _apply_filters(results, {"tags": "important"})
        assert len(filtered) == 1
        assert filtered[0]["id"] == "1"

    def test_filter_by_tags_list(self):
        results = [
            _make_result(metadata={"tags": ["important", "urgent"]}, id="1"),
            _make_result(metadata={"tags": ["other"]}, id="2"),
        ]
        filtered = _apply_filters(results, {"tags": ["urgent"]})
        assert len(filtered) == 1
        assert filtered[0]["id"] == "1"

    def test_filter_by_author(self):
        results = [
            _make_result(metadata={"author": "alice"}, id="1"),
            _make_result(metadata={"author": "bob"}, id="2"),
        ]
        filtered = _apply_filters(results, {"author": "alice"})
        assert len(filtered) == 1
        assert filtered[0]["id"] == "1"

    def test_filter_no_filters(self):
        results = [_make_result(id="1")]
        filtered = _apply_filters(results, None)
        assert len(filtered) == 1

    def test_filter_empty_filters(self):
        results = [_make_result(id="1")]
        filtered = _apply_filters(results, {})
        assert len(filtered) == 1

    def test_filter_invalid_date_ignored(self):
        results = [_make_result(id="1")]
        filtered = _apply_filters(results, {"date_from": "not-a-date"})
        assert len(filtered) == 1


class TestSearchAllWithFacets:
    async def test_search_returns_facet_counts(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = []
        rec_result = MagicMock()
        rec_result.scalars.return_value.all.return_value = []
        ent_result = MagicMock()
        ent_result.scalars.return_value.all.return_value = []
        results = [mem_result, rec_result, ent_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        result = await svc.search_all("hello", tenant_id=None, sources=None, limit=20, offset=0, db=db)
        assert "facet_counts" in result
        assert result["facet_counts"]["types"] == {}

    async def test_search_with_filters(self, svc):
        mem_result = MagicMock()
        mem_result.scalars.return_value.all.return_value = []
        ent_result = MagicMock()
        ent_result.scalars.return_value.all.return_value = []
        results = [mem_result, mem_result, ent_result]
        db = MagicMock()

        async def execute(stmt):
            return results.pop(0)

        db.execute = execute
        result = await svc.search_all("test", tenant_id=None, sources=["memory"], limit=20, offset=0, db=db, filters={"type": "entity"})
        assert result["total"] >= 0
        assert "facet_counts" in result
