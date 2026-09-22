"""Prometheus endpoint (Loop 3): hand-rolled middleware, no pfi dependency."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestMetricsEndpoint:
    async def test_metrics_is_public(self, client: AsyncClient):
        res = await client.get("/metrics")
        assert res.status_code == 200
        assert "text/plain" in res.headers["content-type"]

    async def test_dashboard_series_present(self, client: AsyncClient):
        # One authed request so the histogram observes at least once.
        res = await client.post("/api/v1/auth/signup", json={
            "email": "metrics@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        await client.get("/api/v1/memories",
                         headers={"Authorization": f"Bearer {token}"})
        body = (await client.get("/metrics")).text
        assert "http_requests_total" in body
        assert "http_request_duration_seconds_bucket" in body
