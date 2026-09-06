import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestChat:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "chat@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_send_message(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws = await client.post("/api/v1/workspaces", json={"name": "chat-ws"}, headers=headers)
        assert ws.status_code in (200, 201), ws.text
        ws_id = ws.json().get("id") or ws.json().get("workspace_id")
        res = await client.post(
            f"/api/v1/chat/workspaces/{ws_id}/chat",
            json={"message": "hello"},
            headers=headers,
        )
        assert res.status_code == 200
        assert "reply" in res.json()

    async def test_chat_cross_workspace_denied(self, client: AsyncClient):
        headers_a = await self._auth_header(client)
        ws = await client.post("/api/v1/workspaces", json={"name": "chat-ws-a"}, headers=headers_a)
        ws_id = ws.json().get("id") or ws.json().get("workspace_id")
        res2 = await client.post("/api/v1/auth/signup", json={
            "email": "chat-b@test.com", "password": "Test1234!",
        })
        headers_b = {"Authorization": f"Bearer {res2.json()['access_token']}"}
        denied = await client.post(
            f"/api/v1/chat/workspaces/{ws_id}/chat",
            json={"message": "hello"},
            headers=headers_b,
        )
        assert denied.status_code == 404, denied.text

    async def test_chat_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/chat/workspaces/00000000-0000-0000-0000-000000000000/chat",
            json={"message": "hello"},
        )
        assert res.status_code == 401

    async def test_chat_auth_no_middleware(self, db_session):
        from api.database import get_db
        from api.dependencies import get_current_user
        from api.routers import chat
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(chat.router, prefix="/api/v1/chat")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def no_user():
            return None
        app.dependency_overrides[get_current_user] = no_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/chat/workspaces/default/chat", json={"message": "hello"})
            assert res.status_code == 401
