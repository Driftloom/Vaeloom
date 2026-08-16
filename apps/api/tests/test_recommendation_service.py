import uuid
from unittest.mock import MagicMock, AsyncMock
import pytest

pytestmark = pytest.mark.asyncio


def _row(**kwargs):
    obj = MagicMock()
    for k, v in kwargs.items():
        setattr(obj, k, v)
    return obj


def _fetchone(val):
    m = MagicMock()
    m.fetchone = MagicMock(return_value=val)
    return m


def _fetchall(vals):
    m = MagicMock()
    m.fetchall = MagicMock(return_value=vals)
    return m


def _user_row(uid):
    m = MagicMock()
    m.__getitem__ = MagicMock(return_value=uid)
    return m


def _str_row(val):
    m = MagicMock()
    m.__getitem__ = MagicMock(return_value=val)
    return m


class TestComputeEmbedding:
    async def test_returns_embedding_from_llm(self, monkeypatch):
        from api.services.recommendation_service import RecommendationService
        monkeypatch.setattr(
            "api.services.recommendation_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )
        svc = RecommendationService()
        result = await svc._compute_embedding("hello")
        assert result == [0.5] * 1536

    async def test_returns_zero_vector_on_failure(self, monkeypatch):
        from api.services.recommendation_service import RecommendationService
        llm_mock = AsyncMock(generate_embedding=AsyncMock(side_effect=Exception("API down")))
        monkeypatch.setattr("api.services.recommendation_service.llm_service", llm_mock)
        svc = RecommendationService()
        result = await svc._compute_embedding("anything")
        assert result == [0.0] * 1536


class TestBuildItem:
    def test_builds_dict_with_all_fields(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        row = _row(
            id="abc-123",
            type="memory",
            title="My Memory",
            summary="A test memory",
            metadata={"tags": ["test"], "usageCount": 50},
            distance=0.85,
            importance=0.9,
            recency=30.0,
            usage_count=50,
        )
        item = svc._build_item(row, "memory")
        assert item["id"] == "abc-123"
        assert item["type"] == "memory"
        assert item["title"] == "My Memory"
        assert item["summary"] == "A test memory"
        assert item["metadata"] == {"tags": ["test"], "usageCount": 50}
        assert item["distance"] == 0.85
        assert item["importance"] == 0.9
        assert item["recency_score"] == pytest.approx(1.0 - 30.0 / 365.0)
        assert item["usage_score"] == pytest.approx(50 / 100.0)
        assert item["source"] == "memory"

    def test_handles_none_values(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        row = _row(
            id="xyz", type="knowledge_node", title="Node",
            summary=None, metadata=None,
            distance=None, importance=None, recency=None, usage_count=None,
        )
        item = svc._build_item(row, "knowledge_node")
        assert item["summary"] is None
        assert item["metadata"] == {}
        assert item["distance"] == 0.0
        assert item["importance"] == 0.5
        assert item["recency_score"] == 0.0
        assert item["usage_score"] == 0.0

    def test_handles_missing_metadata(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        row = _row(
            id="abc", type="memory", title="T",
            summary="S", metadata=None,
            distance=0.5, importance=0.6, recency=10.0, usage_count=5,
        )
        item = svc._build_item(row, "memory")
        assert item["metadata"] == {}


class TestGenerate:
    async def _make_dto(self, **overrides):
        from api.schemas.recommendation import GenerateRecommendationRequest
        return GenerateRecommendationRequest(
            user_id=overrides.get("user_id", "u1"),
            tenant_id=overrides.get("tenant_id", "t1"),
            top_n=overrides.get("top_n", 10),
            personalize=overrides.get("personalize", False),
            context_tags=overrides.get("context_tags", None),
        )

    async def test_generates_with_context_tags(self, monkeypatch):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchone(_str_row("[0.1,0.2]")),
            _fetchall([
                _row(id="m1", type="memory", title="Mem1", summary="s1",
                     metadata={"tags": ["tag1"]}, importance=0.8,
                     recency=10.0, usage_count=20, distance=0.9),
            ]),
            _fetchall([
                _row(id="n1", type="knowledge_node", title="Node1", summary="s2",
                     metadata={"tags": ["tag2"]}, importance=0.6,
                     recency=5.0, usage_count=10, distance=0.85),
            ]),
            _fetchone(_row(
                id=uuid.uuid4(), user_id="u1", tenant_id="t1",
                items='[{"id":"m1"}]', model_version="v1", created_at="2025-01-01",
            )),
        ])

        monkeypatch.setattr(
            "api.services.recommendation_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )

        dto = await self._make_dto(context_tags=["tag1"])
        result = await svc.generate(dto, db)
        assert result is not None
        assert result.id is not None

    async def test_generates_without_context_tags(self, monkeypatch):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchone(None),
            _fetchall([_row(
                id="m1", type="memory", title="Mem1", summary="s",
                metadata={}, importance=0.5,
                recency=100.0, usage_count=5, distance=0.8,
            )]),
            _fetchall([]),
            _fetchone(_row(
                id=str(uuid.uuid4()), user_id="u1", tenant_id="t1",
                items="[]", model_version="v1", created_at="2025-01-01",
            )),
        ])

        monkeypatch.setattr(
            "api.services.recommendation_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )

        dto = await self._make_dto(context_tags=None)
        result = await svc.generate(dto, db)
        assert result is not None

    async def test_generates_no_pref_vector_falls_back_to_zero(self, monkeypatch):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchone(None),
            _fetchall([]),
            _fetchall([]),
            _fetchone(_row(
                id=str(uuid.uuid4()), user_id="u2", tenant_id="default",
                items="[]", model_version="v1", created_at="2025-01-01",
            )),
        ])

        monkeypatch.setattr(
            "api.services.recommendation_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )

        from api.schemas.recommendation import GenerateRecommendationRequest
        dto = GenerateRecommendationRequest(user_id="u2", tenant_id=None, top_n=5)
        result = await svc.generate(dto, db)
        assert result is not None


class TestGetByUser:
    async def test_returns_rows(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_fetchall([
            _row(id="r1", user_id="u1", tenant_id="t1", items="[]", model_version="v1", created_at="2025-01-01"),
        ]))
        rows = await svc.get_by_user("u1", db)
        assert len(rows) == 1


class TestRecordFeedback:
    async def test_existing_recommendation_inserts_feedback(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchone(_row(id=uuid.uuid4())),
            _fetchone(_row(
                id=str(uuid.uuid4()), recommendation_id=str(uuid.uuid4()), useful=True,
                created_at="2025-01-01",
            )),
        ])
        from api.schemas.recommendation import FeedbackRequest
        dto = FeedbackRequest(recommendation_id=str(uuid.uuid4()), useful=True)
        result = await svc.record_feedback(dto, db)
        assert result is not None

    async def test_missing_recommendation_returns_none(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_fetchone(None))
        from api.schemas.recommendation import FeedbackRequest
        dto = FeedbackRequest(recommendation_id=str(uuid.uuid4()), useful=False)
        result = await svc.record_feedback(dto, db)
        assert result is None


class TestGetTrending:
    async def test_without_tenant(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchall([_row(
                item_id="m1", item_type="memory", title="Mem1", summary="s",
                metadata={}, usage_count=10,
            )]),
            _fetchall([_row(
                item_id="n1", item_type="knowledge_node", title="Node1", summary="s2",
                metadata={}, usage_count=5,
            )]),
        ])
        result = await svc.get_trending(limit=10, tenant_id=None, db=db)
        assert len(result) == 2
        assert result[0]["score"] >= result[1]["score"]

    async def test_with_tenant(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchall([]),
            _fetchall([]),
        ])
        result = await svc.get_trending(limit=5, tenant_id="t1", db=db)
        assert result == []

    async def test_sorts_by_usage_count_desc(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchall([_row(
                item_id="m1", item_type="memory", title="High", summary="s",
                metadata={}, usage_count=100,
            )]),
            _fetchall([_row(
                item_id="n1", item_type="knowledge_node", title="Low", summary="s",
                metadata={}, usage_count=10,
            )]),
        ])
        result = await svc.get_trending(limit=10, tenant_id=None, db=db)
        assert result[0]["id"] == "m1"


class TestReindex:
    async def test_full_reindex(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchall([_user_row("u1")]),
            _fetchone(_str_row("[0.1,0.2,0.3]")),
            MagicMock(),
        ])
        results = await svc.reindex(user_id=None, tenant_id=None, db=db)
        assert results == [{"user_id": "u1", "status": "reindexed"}]

    async def test_with_user_id_filter(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchall([_user_row("u42")]),
            _fetchone(_str_row("[0.5,0.5]")),
            MagicMock(),
        ])
        results = await svc.reindex(user_id="u42", tenant_id=None, db=db)
        assert results == [{"user_id": "u42", "status": "reindexed"}]

    async def test_with_tenant_id_filter(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            _fetchall([_user_row("u1")]),
            _fetchone(_str_row("[0.1,0.2]")),
            MagicMock(),
        ])
        results = await svc.reindex(user_id=None, tenant_id="t1", db=db)
        assert results == [{"user_id": "u1", "status": "reindexed"}]

    async def test_no_users_found(self):
        from api.services.recommendation_service import RecommendationService
        svc = RecommendationService()
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_fetchall([]))
        results = await svc.reindex(user_id=None, tenant_id=None, db=db)
        assert results == []
