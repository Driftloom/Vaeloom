import io
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

    async def test_upload_document(self, client: AsyncClient):
        headers = await self._auth_header(client)
        content = b"Hello, this is a test document"
        res = await client.post(
            "/api/v1/documents?workspace_id=00000000-0000-0000-0000-000000000001",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
            headers=headers,
        )
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_documents(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/documents?workspace_id=00000000-0000-0000-0000-000000000001",
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
