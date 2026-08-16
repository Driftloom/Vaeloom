import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAnalytics:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "analytics@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_track_event(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/analytics/events", json={
            "name": "page_view",
            "properties": {"page": "/home"},
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_get_metrics(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/analytics/metrics", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_memories" in data
        assert "total_agents" in data

    async def test_get_usage(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/analytics/usage", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_analytics_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/analytics/events", json={
            "name": "page_view",
        })
        assert res.status_code == 401

    async def test_get_dashboard(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/analytics", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "kpis" in data
        assert "usage" in data
        assert "generated_at" in data

    async def test_aggregate(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/analytics/aggregate", json={
            "metric": "events",
            "aggregation": "count",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
        }, headers=headers)
        assert res.status_code == 201

    async def test_dashboard_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/analytics")
        assert res.status_code == 401
