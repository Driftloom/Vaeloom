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


class TestDocumentContentAndOperations:
    async def _auth_header(self, client: AsyncClient, email: str | None = None) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": email or f"docop{uuid.uuid4().hex[:8]}@test.com",
            "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Op WS"}, headers=headers)
        return res.json()["id"]

    async def _upload(self, client: AsyncClient, headers: dict, ws_id: str, filename="note.txt", content=b"hello world") -> str:
        res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": (filename, content, "text/plain")},
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["id"]

    async def test_upload_stores_content_and_fetches_it(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc_id = await self._upload(client, headers, ws_id, content=b"stored bytes here")
        res = await client.get(
            f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 200
        assert res.content == b"stored bytes here"
        assert "text/plain" in res.headers["content-type"]

    async def test_content_requires_workspace_access(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc_id = await self._upload(client, headers, ws_id)
        other_headers = await self._auth_header(client)
        await self._create_workspace(client, other_headers)
        res = await client.get(
            f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}",
            headers=other_headers,
        )
        assert res.status_code == 404

    async def test_rename_records_action_and_undo_restores(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc_id = await self._upload(client, headers, ws_id)

        renamed = await client.patch(
            f"/api/v1/documents/{doc_id}?workspace_id={ws_id}",
            json={"path": "renamed.txt"},
            headers=headers,
        )
        assert renamed.status_code == 200
        assert renamed.json()["path"] == "renamed.txt"

        actions = await client.get(
            f"/api/v1/documents/{doc_id}/actions?workspace_id={ws_id}",
            headers=headers,
        )
        assert actions.status_code == 200
        body = actions.json()
        assert body["total"] == 1
        action = body["actions"][0]
        assert action["action_type"] == "document_rename"
        assert action["old_path"] == "note.txt"
        assert action["new_path"] == "renamed.txt"

        undone = await client.post(
            f"/api/v1/documents/actions/{action['id']}/undo?workspace_id={ws_id}",
            headers=headers,
        )
        assert undone.status_code == 200
        assert undone.json()["path"] == "note.txt"

        second_undo = await client.post(
            f"/api/v1/documents/actions/{action['id']}/undo?workspace_id={ws_id}",
            headers=headers,
        )
        assert second_undo.status_code == 409

    async def test_archive_restore_and_list_filter(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc_id = await self._upload(client, headers, ws_id)

        archived = await client.post(
            f"/api/v1/documents/{doc_id}/archive?workspace_id={ws_id}",
            headers=headers,
        )
        assert archived.status_code == 200
        assert archived.json()["deleted_at"] is not None

        listed = await client.get(f"/api/v1/documents?workspace_id={ws_id}", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] == 0

        with_archived = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&include_archived=true",
            headers=headers,
        )
        assert with_archived.json()["total"] == 1

        restored = await client.post(
            f"/api/v1/documents/{doc_id}/restore?workspace_id={ws_id}",
            headers=headers,
        )
        assert restored.status_code == 200
        assert restored.json()["deleted_at"] is None

    async def test_undo_archive_restores_document(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc_id = await self._upload(client, headers, ws_id)

        await client.post(f"/api/v1/documents/{doc_id}/archive?workspace_id={ws_id}", headers=headers)
        actions = await client.get(
            f"/api/v1/documents/{doc_id}/actions?workspace_id={ws_id}",
            headers=headers,
        )
        action = actions.json()["actions"][0]
        assert action["action_type"] == "document_archive"

        undone = await client.post(
            f"/api/v1/documents/actions/{action['id']}/undo?workspace_id={ws_id}",
            headers=headers,
        )
        assert undone.status_code == 200
        assert undone.json()["deleted_at"] is None

    async def test_actions_require_document_in_workspace(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        res = await client.get(
            f"/api/v1/documents/{uuid.uuid4()}/actions?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 404
