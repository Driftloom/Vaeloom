import pytest

pytestmark = pytest.mark.asyncio


class TestSmokeHealth:
    async def test_health_returns_200(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert "status" in body or "ok" in body or "healthy" in body or body.get("status") == "ok"

    async def test_health_ready_returns_200(self, client):
        resp = await client.get("/health/ready")
        # /health/ready may be 200 or 503 depending on DB, but should not be 500
        assert resp.status_code in (200, 503)
        assert resp.headers.get("content-type", "").startswith("application/json")
