import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestMetrics:
    async def test_metrics_endpoint_returns_prometheus_format(self, client: AsyncClient):
        resp = await client.get("/metrics")
        assert resp.status_code == 200
        assert resp.headers.get("content-type", "").startswith("text/plain")
        body = resp.text
        assert "http_requests_total" in body
        assert "http_request_duration_seconds" in body
        assert "active_users" in body


class TestMetricsMiddleware:
    async def test_records_request_metric(self, client: AsyncClient):
        await client.get("/health")
        resp = await client.get("/metrics")
        body = resp.text
        assert 'http_requests_total{method="GET",path="/health",status="200"}' in body

    async def test_records_histogram_metric(self, client: AsyncClient):
        await client.get("/health/ready")
        resp = await client.get("/metrics")
        body = resp.text
        assert 'http_request_duration_seconds_count{method="GET",path="/health/ready"}' in body

    async def test_active_users_gauge_registered(self, client: AsyncClient):
        from api.infrastructure.metrics import active_users

        active_users.set(42)
        resp = await client.get("/metrics")
        body = resp.text
        assert "active_users 42.0" in body
        active_users.set(0)
