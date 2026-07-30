import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestNotifications:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "notif@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_send_notification(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/notifications/send", json={
            "channel": "email",
            "recipient": "test@test.com",
            "subject": "Test",
            "body": "Hello",
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_notifications(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/notifications", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_get_notification(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/notifications/send", json={
            "channel": "email",
            "recipient": "get@test.com",
            "subject": "Get Test",
            "body": "Body",
        }, headers=headers)
        assert created.status_code == 201
        nid = created.json()["id"]
        res = await client.get(f"/api/v1/notifications/{nid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["subject"] == "Get Test"

    async def test_notification_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/notifications/send", json={
            "channel": "email",
            "recipient": "test@test.com",
            "subject": "Test",
            "body": "Hello",
        })
        assert res.status_code == 401

    async def test_create_template(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/notifications/templates", json={
            "name": "welcome",
            "body": "Hello {{name}}",
            "channel": "email",
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_templates(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/notifications/templates", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_subscribe_webhook(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/notifications/subscribe", json={
            "url": "https://example.com/webhook",
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_webhook_receipt(self, client: AsyncClient):
        headers = await self._auth_header(client)
        sent = await client.post("/api/v1/notifications/send", json={
            "channel": "email",
            "recipient": "wh@test.com",
            "subject": "Webhook Receipt",
            "body": "Test body",
        }, headers=headers)
        assert sent.status_code == 201
        nid = sent.json()["id"]
        res = await client.post(f"/api/v1/notifications/webhooks/{nid}", json={
            "status": "delivered",
        }, headers=headers)
        assert res.status_code == 200

    async def test_endpoints_require_auth(self, db_session):
        from backend.database import get_db
        from backend.dependencies import get_current_user
        from backend.routers import notifications
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(notifications.router, prefix="/api/v1/notifications")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def no_user():
            return None
        app.dependency_overrides[get_current_user] = no_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.post("/api/v1/notifications/send", json={"channel": "email", "recipient": "x@x.com", "subject": "x", "body": "x"})).status_code == 401
            assert (await ac.get("/api/v1/notifications")).status_code == 401
            assert (await ac.post("/api/v1/notifications/templates", json={"name": "x", "body": "x", "channel": "email"})).status_code == 401
            assert (await ac.get("/api/v1/notifications/templates")).status_code == 401
            assert (await ac.get(f"/api/v1/notifications/{uuid.uuid4()}")).status_code == 401
            assert (await ac.post("/api/v1/notifications/subscribe", json={"url": "https://x.com"})).status_code == 401
            assert (await ac.post(f"/api/v1/notifications/webhooks/{uuid.uuid4()}", json={"status": "delivered"})).status_code == 401
