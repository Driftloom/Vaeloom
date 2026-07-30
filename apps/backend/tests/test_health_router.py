from unittest.mock import AsyncMock, patch

import pytest

from backend.database import get_db
from backend.routers.health import router as health_router


class TestHealthRouter:
    def test_liveness_schema(self):
        assert health_router is not None

    @pytest.mark.asyncio
    async def test_liveness_returns_ok(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "service" in data
        assert "version" in data
        assert "timestamp" in data

    @pytest.mark.asyncio
    async def test_readiness_database_ok(self, client):
        resp = await client.get("/health/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "dependencies" in data
        assert data["dependencies"]["database"]["status"] == "ok"

    @pytest.mark.asyncio
    async def test_readiness_database_failure(self, client):
        fake_db = AsyncMock()
        fake_db.execute = AsyncMock(side_effect=Exception("connection refused"))

        async def _get_db():
            yield fake_db

        app = client._transport.app
        app.dependency_overrides[get_db] = _get_db
        try:
            resp = await client.get("/health/ready")
        finally:
            app.dependency_overrides.pop(get_db, None)
        assert resp.status_code == 200
        data = resp.json()
        assert data["dependencies"]["database"]["status"] == "down"
        assert "error" in data["dependencies"]["database"]

    @pytest.mark.asyncio
    async def test_readiness_redis_ok(self, client):
        fake_redis = AsyncMock()
        fake_redis.ping = AsyncMock(return_value=True)
        fake_redis.aclose = AsyncMock(return_value=None)

        with patch("redis.asyncio.from_url", return_value=fake_redis):
            resp = await client.get("/health/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["dependencies"]["redis"]["status"] == "ok"

    @pytest.mark.asyncio
    async def test_readiness_redis_disabled(self, client):
        with patch("redis.asyncio.from_url", side_effect=Exception("no redis")):
            resp = await client.get("/health/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["dependencies"]["redis"]["status"] == "degraded"

    @pytest.mark.asyncio
    async def test_startup_probe(self, client):
        resp = await client.get("/health/startup")
        assert resp.status_code == 200
        data = resp.json()
        assert "dependencies" in data
        assert all(k in data["dependencies"] for k in ("database", "redis", "infisical"))
        assert data["dependencies"]["database"]["status"] == "ok"
