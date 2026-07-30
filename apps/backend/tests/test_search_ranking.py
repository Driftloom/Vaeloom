import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.search_ranking import SearchRankingService, _load_weights

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return SearchRankingService()


@pytest.fixture
def recent_result():
    return {
        "id": "r1",
        "text": "Team meeting notes",
        "score": 2.0,
        "source": "memory",
        "metadata": {
            "type": "note",
            "summary": "Meeting about Q1 goals",
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "importance": 0.8,
            "tags": ["meeting", "q1"],
        },
    }


@pytest.fixture
def old_result():
    return {
        "id": "r2",
        "text": "Old project plan",
        "score": 1.5,
        "source": "document",
        "metadata": {
            "type": "document",
            "summary": "Legacy plan",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=60)).isoformat(),
            "importance": 0.3,
            "tags": ["legacy"],
        },
    }


class TestLoadWeights:
    def test_default_weights(self):
        with patch.dict("os.environ", {}, clear=True):
            w = _load_weights()
            assert w["relevance"] == 0.4
            assert w["recency"] == 0.3
            assert w["importance"] == 0.2
            assert w["user_preference"] == 0.1

    def test_custom_weights_from_env(self):
        custom = json.dumps({"relevance": 0.5, "recency": 0.2, "importance": 0.2, "user_preference": 0.1})
        with patch.dict("os.environ", {"RANKING_WEIGHTS": custom}):
            w = _load_weights()
            assert w["relevance"] == 0.5

    def test_invalid_weights_falls_back(self):
        with patch.dict("os.environ", {"RANKING_WEIGHTS": "not-json"}):
            w = _load_weights()
            assert w == {"relevance": 0.4, "recency": 0.3, "importance": 0.2, "user_preference": 0.1}


class TestCalculateScore:
    def test_perfect_match(self, svc, recent_result):
        score = svc.calculate_score(recent_result, "team meeting")
        assert 0.8 <= score <= 1.0

    def test_no_match_old(self, svc, old_result):
        score = svc.calculate_score(old_result, "completely unrelated query")
        assert score < 0.5

    def test_user_preference_boost(self, svc, recent_result):
        ctx = {"preferred_types": ["memory"]}
        score_with = svc.calculate_score(recent_result, "team", ctx)
        score_without = svc.calculate_score(recent_result, "team", None)
        assert score_with >= score_without

    def test_tag_preference_partial(self, svc, recent_result):
        ctx = {"preferred_tags": ["meeting"]}
        score = svc.calculate_score(recent_result, "team", ctx)
        assert score > 0.5

    def test_none_created_at(self, svc):
        result = {"id": "x", "text": "foo", "score": 1.0, "source": "memory", "metadata": {}}
        score = svc.calculate_score(result, "foo")
        assert score > 0


class TestRankResults:
    def test_ranks_by_combined_score(self, svc, recent_result, old_result):
        results = [old_result, recent_result]
        ranked = svc.rank_results(results, "team meeting")
        assert ranked[0]["id"] == "r1"
        assert ranked[1]["id"] == "r2"
        assert "_combined_score" in ranked[0]

    def test_maintains_total_count(self, svc):
        results = [
            {"id": "a", "text": "hello world", "score": 1.0, "source": "memory", "metadata": {}},
            {"id": "b", "text": "goodbye world", "score": 2.0, "source": "memory", "metadata": {}},
        ]
        ranked = svc.rank_results(results, "hello")
        assert len(ranked) == 2


class TestReRankWithLLM:
    async def test_rerank_with_llm(self, svc):
        results = [{"id": str(i), "text": f"result {i}", "source": "memory", "score": 1.0, "metadata": {}} for i in range(15)]
        mock_llm = AsyncMock()
        mock_llm.generate_completion.return_value = {
            "content": json.dumps(["2", "1", "0", "3", "4", "5", "6", "7", "8", "9"]),
            "role": "assistant",
        }
        svc._llm = mock_llm
        ranked = await svc.rerank_with_llm(results, "test query")
        assert ranked[0]["id"] == "2"
        assert len(ranked) == 15

    async def test_rerank_empty_results(self, svc):
        ranked = await svc.rerank_with_llm([], "test")
        assert ranked == []

    async def test_rerank_no_llm(self, svc):
        svc._llm = None
        results = [{"id": "1", "text": "hello", "source": "memory", "score": 1.0, "metadata": {}}]
        ranked = await svc.rerank_with_llm(results, "test")
        assert ranked == results

    async def test_rerank_llm_failure_graceful(self, svc):
        results = [{"id": "1", "text": "hello", "source": "memory", "score": 1.0, "metadata": {}}]
        mock_llm = AsyncMock()
        mock_llm.generate_completion.side_effect = Exception("LLM down")
        svc._llm = mock_llm
        ranked = await svc.rerank_with_llm(results, "test")
        assert ranked == results

    async def test_rerank_json_parse_failure_graceful(self, svc):
        results = [{"id": "1", "text": "hello", "source": "memory", "score": 1.0, "metadata": {}}]
        mock_llm = AsyncMock()
        mock_llm.generate_completion.return_value = {"content": "not json at all", "role": "assistant"}
        svc._llm = mock_llm
        ranked = await svc.rerank_with_llm(results, "test")
        assert ranked == results


class TestRelevanceScore:
    def test_exact_match(self, svc):
        r = {"text": "Team Meeting Notes", "metadata": {}}
        assert svc._relevance_score(r, "Team Meeting") == 1.0

    def test_partial_word_match(self, svc):
        r = {"text": "Notes from standup", "metadata": {}}
        assert svc._relevance_score(r, "standup") == 1.0

    def test_summary_match(self, svc):
        r = {"text": "Title", "metadata": {"summary": "Deep summary about AI"}}
        assert svc._relevance_score(r, "AI") == 1.0

    def test_no_match(self, svc):
        r = {"text": "Something else", "metadata": {}}
        assert svc._relevance_score(r, "zzzzzz") == 0.0


class TestRecencyScore:
    def test_less_than_one_hour(self, svc):
        r = {"metadata": {"created_at": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()}}
        assert svc._recency_score(r) == 1.0

    def test_within_a_day(self, svc):
        r = {"metadata": {"created_at": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()}}
        assert svc._recency_score(r) == 0.9

    def test_within_a_week(self, svc):
        r = {"metadata": {"created_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()}}
        assert svc._recency_score(r) == 0.7

    def test_within_a_month(self, svc):
        r = {"metadata": {"created_at": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()}}
        assert svc._recency_score(r) == 0.4

    def test_older_than_month(self, svc):
        r = {"metadata": {"created_at": (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()}}
        assert svc._recency_score(r) == 0.1

    def test_no_created_at(self, svc):
        r = {"metadata": {}}
        assert svc._recency_score(r) == 0.5


class TestImportanceScore:
    def test_uses_metadata_importance(self, svc):
        r = {"metadata": {"importance": 0.75}}
        assert svc._importance_score(r) == 0.75

    def test_falls_back_to_score(self, svc):
        r = {"metadata": {}, "score": 1.5}
        assert svc._importance_score(r) == 0.75

    def test_clamps_to_one(self, svc):
        r = {"metadata": {"importance": 2.0}}
        assert svc._importance_score(r) == 1.0


class TestPreferenceScore:
    def test_preferred_type_match(self, svc):
        r = {"source": "memory", "metadata": {}}
        ctx = {"preferred_types": ["memory", "document"]}
        assert svc._preference_score(r, ctx) == 1.0

    def test_preferred_tag_match(self, svc):
        r = {"source": "memory", "metadata": {"tags": ["important", "meeting"]}}
        ctx = {"preferred_tags": ["meeting"]}
        assert svc._preference_score(r, ctx) == 0.8

    def test_no_context(self, svc):
        r = {"source": "memory", "metadata": {}}
        assert svc._preference_score(r, None) == 0.5

    def test_no_match(self, svc):
        r = {"source": "entity", "metadata": {}}
        ctx = {"preferred_types": ["memory"]}
        assert svc._preference_score(r, ctx) == 0.5
