import io
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDocuments:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "doc@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Test WS"}, headers=headers)
        if res.status_code == 201:
            return res.json()["id"]
        res2 = await client.get("/api/v1/workspaces", headers=headers)
        if res2.status_code == 200:
            ws = res2.json()
            if isinstance(ws, list) and ws:
                return ws[0]["id"]
            if isinstance(ws, dict) and ws.get("workspaces"):
                return ws["workspaces"][0]["id"]
        return str(uuid.uuid4())

    async def test_upload_document(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        content = b"Hello, this is a test document"
        res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
            headers=headers,
        )
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_documents(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        res = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 200
        assert "documents" in res.json()

    async def test_document_requires_workspace_id(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/documents", headers=headers)
        assert res.status_code == 400

    async def test_upload_document_requires_workspace_id(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post(
            "/api/v1/documents",
            files={"file": ("test.txt", b"hello", "text/plain")},
            headers=headers,
        )
        assert res.status_code == 400
