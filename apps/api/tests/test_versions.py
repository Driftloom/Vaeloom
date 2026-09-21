import pytest
from httpx import AsyncClient


class TestVersions:
    async def _auth_header(self, client: AsyncClient, email: str = "version_user@example.com") -> dict:
        pwd = "SecurePassword123!"
        await client.post("/api/v1/auth/signup", json={"email": email, "password": pwd})
        login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        token = login_res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict, name: str = "Version WS") -> str:
        res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
        return res.json()["id"]

    async def test_document_versioning_and_restore(self, client: AsyncClient):
        headers = await self._auth_header(client, "test_v1@example.com")
        ws_id = await self._create_workspace(client, headers)

        # 1. Upload initial doc (Version 1)
        v1_content = b"Initial draft version 1"
        upload_res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": ("spec.txt", v1_content, "text/plain")},
            headers=headers,
        )
        assert upload_res.status_code == 201
        doc = upload_res.json()
        doc_id = doc["id"]

        # 2. Check versions list (should have version 1)
        versions_res = await client.get(
            f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}",
            headers=headers,
        )
        assert versions_res.status_code == 200
        versions = versions_res.json()
        assert len(versions) == 1
        assert versions[0]["version_number"] == 1

        # 3. Upload Version 2
        v2_content = b"Updated revision version 2 with added sections"
        create_v2_res = await client.post(
            f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}",
            files={"file": ("spec.txt", v2_content, "text/plain")},
            headers=headers,
        )
        assert create_v2_res.status_code == 201
        v2 = create_v2_res.json()
        assert v2["version_number"] == 2

        # Verify versions list has 2 versions
        versions_res_2 = await client.get(
            f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}",
            headers=headers,
        )
        assert len(versions_res_2.json()) == 2

        # Content should now be version 2
        content_res = await client.get(
            f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}",
            headers=headers,
        )
        assert content_res.content == v2_content

        # 4. Restore Version 1
        restore_res = await client.post(
            f"/api/v1/documents/{doc_id}/versions/1/restore?workspace_id={ws_id}",
            headers=headers,
        )
        assert restore_res.status_code == 200

        # Verify content is back to version 1
        restored_content_res = await client.get(
            f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}",
            headers=headers,
        )
        assert restored_content_res.content == v1_content
