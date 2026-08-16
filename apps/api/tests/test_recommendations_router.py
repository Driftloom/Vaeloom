import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from api.dependencies import get_current_user

pytestmark = pytest.mark.asyncio


class _MockRow:
    def __init__(self, **kw):
        self._mapping = kw


class TestRecommendationsRouter:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "rec-router@test.com", "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    @pytest.fixture(autouse=True)
    def _mock_svc(self):
        with patch("api.routers.recommendations.recommendation_service") as m:
            m.generate = AsyncMock()
            m.get_by_user = AsyncMock()
            m.record_feedback = AsyncMock()
            m.get_trending = AsyncMock()
            m.reindex = AsyncMock()
            self._svc = m
            yield

    async def _override_user_none(self, client: AsyncClient):
        client._transport.app.dependency_overrides[get_current_user] = lambda: None

    # --- 401 from middleware (no auth header) ---

    async def test_generate_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/recommendations", json={"user_id": str(uuid.uuid4())})
        assert res.status_code == 401

    async def test_get_by_user_requires_auth(self, client: AsyncClient):
        res = await client.get(f"/api/v1/recommendations/{uuid.uuid4()}")
        assert res.status_code == 401

    async def test_feedback_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/recommendations/feedback", json={
            "recommendation_id": str(uuid.uuid4()), "useful": True,
        })
        assert res.status_code == 401

    async def test_trending_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/recommendations/trending")
        assert res.status_code == 401

    async def test_index_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/recommendations/index", json={})
        assert res.status_code == 401

    # --- 401 from handler (get_current_user returns None) ---

    async def test_generate_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post("/api/v1/recommendations", json={"user_id": str(uuid.uuid4())}, headers=headers)
        assert res.status_code == 401

    async def test_get_by_user_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/recommendations/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 401

    async def test_feedback_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post("/api/v1/recommendations/feedback", json={
            "recommendation_id": str(uuid.uuid4()), "useful": True,
        }, headers=headers)
        assert res.status_code == 401

    async def test_index_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post("/api/v1/recommendations/index", json={}, headers=headers)
        assert res.status_code == 401

    # --- trending (shadowed by /{user_id}) is tested via direct function call ---

    async def test_trending_handler_direct(self):
        from api.routers.recommendations import get_trending
        now = datetime.now(timezone.utc)
        self._svc.get_trending.return_value = [
            {"id": str(uuid.uuid4()), "type": "memory", "title": "T1",
             "summary": None, "score": 5.0, "source": "memory", "metadata": {}},
        ]
        mock_db = AsyncMock()
        result = await get_trending(limit=10, tenant_id=None, db=mock_db, current_user={"sub": "u"})
        assert len(result) == 1
        assert result[0].title == "T1"

    async def test_trending_handler_401(self):
        from api.routers.recommendations import get_trending
        from fastapi import HTTPException
        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc:
            await get_trending(limit=10, tenant_id=None, db=mock_db, current_user=None)
        assert exc.value.status_code == 401

    # --- Success paths ---

    async def test_generate_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        now = datetime.now(timezone.utc)
        self._svc.generate.return_value = _MockRow(
            id=uuid.uuid4(), user_id="u1", tenant_id="default",
            items="[]", model_version="v1", created_at=now,
        )
        res = await client.post("/api/v1/recommendations", json={
            "user_id": str(uuid.uuid4()),
        }, headers=headers)
        assert res.status_code == 200
        assert "id" in res.json()

    async def test_get_by_user_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        now = datetime.now(timezone.utc)
        self._svc.get_by_user.return_value = [_MockRow(
            id=uuid.uuid4(), user_id="u1", tenant_id="default",
            items="[]", model_version="v1", created_at=now,
        )]
        res = await client.get(f"/api/v1/recommendations/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_feedback_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        now = datetime.now(timezone.utc)
        row = (uuid.uuid4(), uuid.uuid4(), True, now)
        self._svc.record_feedback.return_value = row
        res = await client.post("/api/v1/recommendations/feedback", json={
            "recommendation_id": str(uuid.uuid4()), "useful": True,
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["useful"] is True

    async def test_feedback_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        self._svc.record_feedback.return_value = None
        res = await client.post("/api/v1/recommendations/feedback", json={
            "recommendation_id": str(uuid.uuid4()), "useful": True,
        }, headers=headers)
        assert res.status_code == 404
        assert "not found" in res.json()["error"]["message"].lower()

    async def test_feedback_row_no_isoformat(self, client: AsyncClient):
        headers = await self._auth_header(client)
        row = (uuid.uuid4(), uuid.uuid4(), False, "2024-06-01T00:00:00")
        self._svc.record_feedback.return_value = row
        res = await client.post("/api/v1/recommendations/feedback", json={
            "recommendation_id": str(uuid.uuid4()), "useful": False,
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["useful"] is False

    async def test_trending_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        self._svc.get_trending.return_value = [
            {"id": str(uuid.uuid4()), "type": "memory", "title": "T1",
             "summary": None, "score": 5.0, "source": "memory", "metadata": {}},
        ]
        res = await client.get("/api/v1/recommendations/trending?limit=10", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_index_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        self._svc.reindex.return_value = [{"user_id": "u1", "status": "reindexed"}]
        res = await client.post("/api/v1/recommendations/index", json={
            "user_id": "u1", "tenant_id": "default",
        }, headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)
