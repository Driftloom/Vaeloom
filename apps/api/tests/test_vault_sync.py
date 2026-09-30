import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestVaultSync:
    async def _auth_header(self, client: AsyncClient) -> dict:
        unique_email = f"vault-{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={
            "email": unique_email, "password": "TestPassword123!",
        })
        assert res.status_code == 201
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Vault Test WS"}, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    async def test_download_client_installer_windows(self, client: AsyncClient):
        res = await client.get("/api/v1/vault-sync/download-client?os=windows")
        assert res.status_code == 200
        assert "install-vaultsync.ps1" in res.headers.get("content-disposition", "")
        assert "vaultsync" in res.text

    async def test_download_client_installer_linux(self, client: AsyncClient):
        res = await client.get("/api/v1/vault-sync/download-client?os=linux")
        assert res.status_code == 200
        assert "install-vaultsync.sh" in res.headers.get("content-disposition", "")
        assert "vaultsync" in res.text

    async def test_get_status_requires_auth(self, client: AsyncClient):
        fake_ws = str(uuid.uuid4())
        res = await client.get(f"/api/v1/vault-sync/status?workspace_id={fake_ws}")
        assert res.status_code == 401

    async def test_vault_sync_lifecycle(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        # 1. Check initial status
        res = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["workspace_id"] == ws_id
        assert data["total_notes"] == 0
        assert data["status"] == "in_sync"

        # 2. Update config
        cfg_res = await client.post("/api/v1/vault-sync/config", json={
            "workspace_id": ws_id,
            "remote_url": "git@github.com:vaeloom/my-vault.git",
            "branch": "main",
            "vault_path": "/Users/test/Vault",
            "auto_ingest": True,
        }, headers=headers)
        assert cfg_res.status_code == 200
        assert cfg_res.json()["config"]["branch"] == "main"
        assert cfg_res.json()["config"]["remote_url"] == "git@github.com:vaeloom/my-vault.git"

        # 3. Ingest notes
        ingest_res = await client.post("/api/v1/vault-sync/ingest", json={
            "workspace_id": ws_id,
            "notes": [
                {
                    "filename": "Project-Atlas.md",
                    "content": "# Project Atlas\n\nAtlas is our core distributed memory graph architecture.",
                    "relative_path": "Architecture/Project-Atlas.md",
                    "tags": ["architecture", "scale"],
                },
                {
                    "filename": "Daily-Notes.md",
                    "content": "# Daily Log 2026-10-01\n\nImplemented zero-data-loss vault synchronization.",
                    "tags": ["daily", "work"],
                },
            ],
        }, headers=headers)
        assert ingest_res.status_code == 200
        ingest_data = ingest_res.json()
        assert ingest_data["success"] is True
        assert ingest_data["ingested_documents"] == 2
        assert ingest_data["created_or_updated_memories"] == 2

        # 4. Check status reflects ingested notes
        res_after = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert res_after.status_code == 200
        assert res_after.json()["total_notes"] == 2
        assert res_after.json()["vault_memories"] == 2

        # 5. Conflicts endpoint
        conflicts_res = await client.get(f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers)
        assert conflicts_res.status_code == 200
        assert isinstance(conflicts_res.json(), list)

        # 6. Manual sync trigger
        sync_res = await client.post("/api/v1/vault-sync/sync", json={"workspace_id": ws_id}, headers=headers)
        assert sync_res.status_code == 200
        assert sync_res.json()["success"] is True
        assert sync_res.json()["status"] == "in_sync"

        # 7. Sync activity logs
        logs_res = await client.get(f"/api/v1/vault-sync/logs?workspace_id={ws_id}", headers=headers)
        assert logs_res.status_code == 200
        logs = logs_res.json()
        assert len(logs) > 0
        assert any("Manual rebase pull" in l.get("message", "") for l in logs)
