import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestHealth:
    async def test_liveness(self, client: AsyncClient):
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "service" in data
        assert "version" in data
        assert "timestamp" in data

    async def test_readiness(self, client: AsyncClient):
        res = await client.get("/health/ready")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "dependencies" in data
        assert "database" in data["dependencies"]
        assert "latency_ms" in data["dependencies"]["database"]

    async def test_startup(self, client: AsyncClient):
        res = await client.get("/health/startup")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "dependencies" in data
        assert all(k in data["dependencies"] for k in ("database", "redis", "infisical"))
