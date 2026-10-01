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

    async def test_get_document_by_id_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        content = b"Content for single document test"
        upload_res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": ("single_doc.txt", io.BytesIO(content), "text/plain")},
            headers=headers,
        )
        assert upload_res.status_code == 201
        doc_id = upload_res.json()["id"]

        get_res = await client.get(
            f"/api/v1/documents/{doc_id}?workspace_id={ws_id}",
            headers=headers,
        )
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["id"] == doc_id
        assert "single_doc.txt" in data["path"]

    async def test_get_document_by_id_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        fake_id = str(uuid.uuid4())
        res = await client.get(
            f"/api/v1/documents/{fake_id}?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_get_document_by_id_cross_workspace_isolated(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id1 = await self._create_workspace(client, headers)
        ws_id2 = str(uuid.uuid4())
        upload_res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id1}",
            files={"file": ("isolated.txt", io.BytesIO(b"Secret content"), "text/plain")},
            headers=headers,
        )
        assert upload_res.status_code == 201
        doc_id = upload_res.json()["id"]

        # Attempt to access doc_id using another workspace that does not own or share it
        res = await client.get(
            f"/api/v1/documents/{doc_id}?workspace_id={ws_id2}",
            headers=headers,
        )
        assert res.status_code in (403, 404)

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
        assert res.status_code == 403

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


class TestDocumentStorageMirror:
    """Upload <-> object-storage convergence (storage_mirror_enabled flag)."""

    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": f"mirror{uuid.uuid4().hex[:8]}@test.com", "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Mirror WS"}, headers=headers)
        return res.json()["id"]

    async def _upload(self, client: AsyncClient, headers: dict, ws_id: str) -> dict:
        res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": ("mirror.txt", b"mirror bytes", "text/plain")},
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()

    async def test_mirror_disabled_by_default(self, client: AsyncClient):
        from api.config import settings

        assert settings.storage_mirror_enabled is False
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        body = await self._upload(client, headers, ws_id)
        assert body["raw_storage_key"] is None

    async def test_mirror_enabled_sets_key(self, client: AsyncClient, monkeypatch):
        from api.config import settings

        monkeypatch.setattr(settings, "storage_mirror_enabled", True)
        calls = []

        async def fake_upload(key: str, data: bytes) -> str:
            calls.append((key, data))
            return key

        monkeypatch.setattr(
            "api.services.storage_service.storage_service.upload", fake_upload)
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        body = await self._upload(client, headers, ws_id)
        expected = f"storage/{ws_id}/{body['id']}/mirror.txt"
        assert body["raw_storage_key"] == expected
        assert calls == [(expected, b"mirror bytes")]

    async def test_mirror_failure_still_uploads(self, client: AsyncClient, monkeypatch):
        from api.config import settings

        monkeypatch.setattr(settings, "storage_mirror_enabled", True)

        async def boom(key: str, data: bytes) -> str:
            raise RuntimeError("minio down")

        monkeypatch.setattr(
            "api.services.storage_service.storage_service.upload", boom)
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        body = await self._upload(client, headers, ws_id)
        assert body["raw_storage_key"] is None


class TestDocumentAutoOrganizeAndMemorySync:
    async def _auth_header(self, client: AsyncClient) -> dict[str, str]:
        email = f"autoorg-{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={
            "email": email, "password": "TestPassword123!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict[str, str]) -> str:
        res = await client.post(
            "/api/v1/workspaces",
            json={"name": "Org Workspace"},
            headers=headers,
        )
        return res.json()["id"]

    async def test_upload_syncs_with_memory(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        # Upload a document
        files = {
            "file": (
                "Bappadala_Rohith_Kumar_Naidu_Resume.pdf",
                io.BytesIO(b"%PDF-1.4 sample resume content with Python and React skills"),
                "application/pdf",
            )
        }
        res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
        assert res.status_code == 201
        doc_data = res.json()

        # Verify Memory row was dynamically created and is retrievable via memory API
        mem_res = await client.get(f"/api/v1/memories?workspace_id={ws_id}", headers=headers)
        assert mem_res.status_code == 200
        items = mem_res.json().get("memories") or mem_res.json().get("items") or []
        doc_mems = [m for m in items if m.get("type") == "document"]
        assert len(doc_mems) >= 1
        assert any("Resume" in (m.get("title") or "") or "Resume" in (m.get("summary") or "") for m in doc_mems)

    async def test_auto_organize_documents(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        # Upload 3 unorganized documents
        doc1 = {"file": ("Candidate_Resume.pdf", io.BytesIO(b"%PDF-1.4 resume text"), "application/pdf")}
        doc2 = {"file": ("OSCI_Badge_Certificate.pdf", io.BytesIO(b"%PDF-1.4 badge text"), "application/pdf")}
        doc3 = {"file": ("tech_architecture_spec.json", io.BytesIO(b'{"service": "pipeline"}'), "application/json")}

        for d in (doc1, doc2, doc3):
            r = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=d, headers=headers)
            assert r.status_code == 201

        # Run auto-organize
        org_res = await client.post(f"/api/v1/documents/auto-organize?workspace_id={ws_id}", headers=headers)
        assert org_res.status_code == 200
        data = org_res.json()
        assert data["organized_count"] == 3
        assert "Resumes & Career" in data["folders_created"]
        assert "Certificates & Credentials" in data["folders_created"]
        assert "Technical & Code" in data["folders_created"]

        # Verify folders exist in workspace
        folders_res = await client.get(f"/api/v1/documents/folders?workspace_id={ws_id}", headers=headers)
        assert folders_res.status_code == 200
        folder_names = [f["name"] for f in folders_res.json()]
        assert "Resumes & Career" in folder_names
        assert "Certificates & Credentials" in folder_names
        assert "Technical & Code" in folder_names


class TestDocumentDelete:
    """Tests for single document deletion and bulk deletion."""

    async def _auth_header(self, client: AsyncClient) -> dict[str, str]:
        email = f"doc_del_{uuid.uuid4().hex[:8]}@example.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict[str, str]) -> str:
        res = await client.post(
            "/api/v1/workspaces",
            json={"name": "Delete Test Workspace"},
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["id"]

    async def _upload(self, client: AsyncClient, headers: dict[str, str], ws_id: str, path: str = "to_delete.txt") -> str:
        files = {"file": (path, io.BytesIO(b"content to be deleted"), "text/plain")}
        res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files=files,
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["id"]

    async def test_delete_document_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc_id = await self._upload(client, headers, ws_id)

        # Permanent Delete
        delete_res = await client.delete(f"/api/v1/documents/{doc_id}?workspace_id={ws_id}", headers=headers)
        assert delete_res.status_code == 204

        # Verify document is no longer in database
        get_res = await client.get(f"/api/v1/documents/{doc_id}?workspace_id={ws_id}", headers=headers)
        assert get_res.status_code == 404

    async def test_bulk_delete_documents(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        doc1_id = await self._upload(client, headers, ws_id, "bulk1.txt")
        doc2_id = await self._upload(client, headers, ws_id, "bulk2.txt")

        # Bulk delete
        del_res = await client.post(
            f"/api/v1/documents/bulk/delete?workspace_id={ws_id}",
            json={"document_ids": [doc1_id, doc2_id]},
            headers=headers,
        )
        assert del_res.status_code == 200
        assert del_res.json()["deleted_count"] == 2

        # Verify neither document exists
        for d_id in (doc1_id, doc2_id):
            r = await client.get(f"/api/v1/documents/{d_id}?workspace_id={ws_id}", headers=headers)
            assert r.status_code == 404


class TestDocumentMoveAndTags:
    """Tests for moving documents to folders/root and updating tags."""

    async def _auth_header(self, client: AsyncClient) -> dict[str, str]:
        email = f"doc_move_{uuid.uuid4().hex[:8]}@example.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict[str, str]) -> str:
        res = await client.post(
            "/api/v1/workspaces",
            json={"name": "Move Test Workspace"},
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["id"]

    async def test_move_document_to_folder_and_root(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        # Create folder
        f_res = await client.post(
            f"/api/v1/documents/folders?workspace_id={ws_id}",
            json={"name": "Finance"},
            headers=headers,
        )
        assert f_res.status_code == 201
        folder_id = f_res.json()["id"]

        # Upload document in root
        files = {"file": ("invoice.txt", io.BytesIO(b"invoice content"), "text/plain")}
        up_res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
        assert up_res.status_code == 201
        doc_id = up_res.json()["id"]
        assert up_res.json()["folder_id"] is None

        # Move to Finance folder
        move_res = await client.post(
            f"/api/v1/documents/{doc_id}/move?workspace_id={ws_id}",
            json={"folder_id": folder_id},
            headers=headers,
        )
        assert move_res.status_code == 200
        assert move_res.json()["folder_id"] == folder_id

        # Move back to root (null)
        move_root_res = await client.post(
            f"/api/v1/documents/{doc_id}/move?workspace_id={ws_id}",
            json={"folder_id": None},
            headers=headers,
        )
        assert move_root_res.status_code == 200
        assert move_root_res.json()["folder_id"] is None

    async def test_update_document_tags(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        # Upload document
        files = {"file": ("contract.txt", io.BytesIO(b"contract content"), "text/plain")}
        up_res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
        assert up_res.status_code == 201
        doc_id = up_res.json()["id"]

        # Update tags
        tags_res = await client.patch(
            f"/api/v1/documents/{doc_id}/tags?workspace_id={ws_id}",
            json={"tags": ["Legal", "Confidential", "Q3"]},
            headers=headers,
        )
        assert tags_res.status_code == 200
        doc_meta = tags_res.json().get("metadata") or {}
        assert "tags" in doc_meta
        assert "legal" in doc_meta["tags"]
        assert "confidential" in doc_meta["tags"]



