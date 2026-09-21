import pytest
from httpx import AsyncClient


class TestSharing:
    async def _auth_header(self, client: AsyncClient, email: str = "sharing_user@example.com") -> dict:
        pwd = "SecurePassword123!"
        await client.post("/api/v1/auth/signup", json={"email": email, "password": pwd})
        login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        token = login_res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict, name: str = "WS") -> str:
        res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
        return res.json()["id"]

    async def test_cross_workspace_sharing_and_revocation(self, client: AsyncClient):
        headers = await self._auth_header(client, "test_share@example.com")
        ws_a = await self._create_workspace(client, headers, "Workspace A")
        ws_b = await self._create_workspace(client, headers, "Workspace B")

        # Upload document to Workspace A
        upload_res = await client.post(
            f"/api/v1/documents?workspace_id={ws_a}",
            files={"file": ("shared_brief.txt", b"Confidential Brief", "text/plain")},
            headers=headers,
        )
        assert upload_res.status_code == 201
        doc_id = upload_res.json()["id"]

        # Share with Workspace B
        share_res = await client.post(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            json={"target_workspace_id": ws_b, "permission": "READ"},
            headers=headers,
        )
        assert share_res.status_code == 201
        share = share_res.json()
        assert share["target_workspace_id"] == ws_b
        assert share["permission"] == "READ"
        share_id = share["id"]

        # List shares for document
        list_shares_res = await client.get(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            headers=headers,
        )
        assert list_shares_res.status_code == 200
        shares = list_shares_res.json()
        assert len(shares) == 1

        # Revoke share
        revoke_res = await client.delete(
            f"/api/v1/documents/{doc_id}/shares/{share_id}?workspace_id={ws_a}",
            headers=headers,
        )
        assert revoke_res.status_code == 204

        # Verify shares is now empty
        list_shares_res_2 = await client.get(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            headers=headers,
        )
        assert len(list_shares_res_2.json()) == 0
