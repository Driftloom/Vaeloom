import io
import zipfile
import pytest
from httpx import AsyncClient


class TestBulkOperations:
    async def _auth_header(self, client: AsyncClient, email: str = "bulk_user@example.com") -> dict:
        pwd = "SecurePassword123!"
        await client.post("/api/v1/auth/signup", json={"email": email, "password": pwd})
        login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        token = login_res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict, name: str = "Bulk WS") -> str:
        res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
        return res.json()["id"]

    async def test_bulk_upload_and_download(self, client: AsyncClient):
        headers = await self._auth_header(client, "test_bulk@example.com")
        ws_id = await self._create_workspace(client, headers)

        # 1. Bulk upload 3 files
        files = [
            ("files", ("file1.txt", b"Content of file 1", "text/plain")),
            ("files", ("file2.txt", b"Content of file 2", "text/plain")),
            ("files", ("file3.txt", b"Content of file 3", "text/plain")),
        ]

        upload_res = await client.post(
            f"/api/v1/documents/bulk/upload?workspace_id={ws_id}",
            files=files,
            headers=headers,
        )
        assert upload_res.status_code == 200
        data = upload_res.json()
        assert data["total_attempted"] == 3
        assert len(data["succeeded"]) == 3
        assert len(data["failed"]) == 0

        doc_ids = [d["id"] for d in data["succeeded"]]

        # 2. Bulk download as ZIP
        download_res = await client.post(
            f"/api/v1/documents/bulk/download?workspace_id={ws_id}",
            json={"document_ids": doc_ids},
            headers=headers,
        )
        assert download_res.status_code == 200
        assert download_res.headers["content-type"] == "application/zip"

        # Verify ZIP contains the 3 files
        zip_buffer = io.BytesIO(download_res.content)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            namelist = zf.namelist()
            assert len(namelist) == 3
            assert "file1.txt" in namelist
            assert zf.read("file1.txt") == b"Content of file 1"
            assert zf.read("file2.txt") == b"Content of file 2"
            assert zf.read("file3.txt") == b"Content of file 3"
