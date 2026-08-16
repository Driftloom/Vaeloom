import uuid
import pytest
from httpx import AsyncClient

from api.dependencies import get_current_user

pytestmark = pytest.mark.asyncio


WEBHOOK_BODY = {
    "name": "Test Webhook",
    "url": "https://example.com/webhook",
    "secret": "whsec_test_secret_key",
    "events": ["memory.created", "agent.run"],
    "active": True,
    "retry_count": 3,
    "timeout_ms": 5000,
}


class TestWebhooksRouter:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "wh-test@test.com", "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _override_user_none(self, client: AsyncClient):
        client._transport.app.dependency_overrides[get_current_user] = lambda: None

    async def _create_webhook(self, client, headers, **overrides):
        body = {**WEBHOOK_BODY, **overrides}
        res = await client.post("/api/v1/webhooks", json=body, headers=headers)
        assert res.status_code == 201, res.text
        return res.json()["id"]

    # --- create ---

    async def test_create_webhook_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/webhooks", json=WEBHOOK_BODY, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Test Webhook"
        assert data["url"] == "https://example.com/webhook"
        assert "memory.created" in data["events"]
        assert data["active"] is True

    async def test_create_webhook_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/webhooks", json=WEBHOOK_BODY)
        assert res.status_code == 401

    async def test_create_webhook_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post("/api/v1/webhooks", json=WEBHOOK_BODY, headers=headers)
        assert res.status_code == 401

    # --- list ---

    async def test_list_webhooks_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_webhook(client, headers, name="WH1")
        await self._create_webhook(client, headers, name="WH2")
        res = await client.get("/api/v1/webhooks", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["webhooks"]) >= 2
        assert data["total"] >= 2

    async def test_list_webhooks_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/webhooks")
        assert res.status_code == 401

    # --- get ---

    async def test_get_webhook_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wh_id = await self._create_webhook(client, headers)
        res = await client.get(f"/api/v1/webhooks/{wh_id}", headers=headers)
        assert res.status_code == 200
        assert res.json()["id"] == wh_id

    async def test_get_webhook_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(f"/api/v1/webhooks/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    # --- update ---

    async def test_update_webhook_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wh_id = await self._create_webhook(client, headers)
        res = await client.put(f"/api/v1/webhooks/{wh_id}", json={"name": "Updated WH"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Updated WH"

    async def test_update_webhook_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.put(f"/api/v1/webhooks/{uuid.uuid4()}", json={"name": "Nope"}, headers=headers)
        assert res.status_code == 404

    # --- delete ---

    async def test_delete_webhook_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wh_id = await self._create_webhook(client, headers)
        res = await client.delete(f"/api/v1/webhooks/{wh_id}", headers=headers)
        assert res.status_code == 204
        res2 = await client.get(f"/api/v1/webhooks/{wh_id}", headers=headers)
        assert res2.status_code == 404

    async def test_delete_webhook_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(f"/api/v1/webhooks/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    # --- test fire ---

    async def test_fire_webhook_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wh_id = await self._create_webhook(client, headers)
        res = await client.post(f"/api/v1/webhooks/test/{wh_id}", headers=headers)
        assert res.status_code == 200
        assert res.json()["status"] == "fired"

    async def test_fire_webhook_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post(f"/api/v1/webhooks/test/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    # --- deliveries ---

    async def test_list_deliveries_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wh_id = await self._create_webhook(client, headers)
        await client.post(f"/api/v1/webhooks/test/{wh_id}", headers=headers)
        res = await client.get(f"/api/v1/webhooks/{wh_id}/deliveries", headers=headers)
        assert res.status_code == 200
        assert "deliveries" in res.json()

    async def test_list_deliveries_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(f"/api/v1/webhooks/{uuid.uuid4()}/deliveries", headers=headers)
        assert res.status_code == 404
