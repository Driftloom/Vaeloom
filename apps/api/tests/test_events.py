import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestEvents:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "evt@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_publish_event(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/events", json={
            "type": "test.event", "source": "test", "category": "info",
        }, headers=headers)
        assert res.status_code == 201

    async def test_list_events(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/events", headers=headers)
        assert res.status_code == 200

    async def test_create_subscription(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/events/subscriptions", json={
            "event_type": "test.event",
            "handler_id": "00000000-0000-0000-0000-000000000001",
        }, headers=headers)
        assert res.status_code == 201

    async def test_list_subscriptions(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await client.post("/api/v1/events/subscriptions", json={
            "event_type": "test.event",
            "handler_id": "00000000-0000-0000-0000-000000000001",
        }, headers=headers)
        res = await client.get("/api/v1/events/subscriptions", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    async def test_get_user_id_returns_none(self):
        from api.routers.events import _get_user_id
        assert _get_user_id(None) is None
