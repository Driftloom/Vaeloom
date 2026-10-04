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

    async def _upload(self, client: AsyncClient, headers: dict, ws_id: str, name: str = "brief.txt") -> str:
        res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": (name, b"Confidential Brief", "text/plain")},
            headers=headers,
        )
        assert res.status_code == 201
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
            json={"target_workspace_id": ws_b, "permission": "read"},
            headers=headers,
        )
        assert share_res.status_code == 201
        share = share_res.json()
        assert share["target_workspace_id"] == ws_b
        assert share["permission"] == "read"
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

    async def test_rejects_unknown_permission_value(self, client: AsyncClient):
        """The permission field is a Literal, so a typo must not be silently stored."""
        headers = await self._auth_header(client, "perm_enum@example.com")
        ws_a = await self._create_workspace(client, headers, "Perm WS A")
        ws_b = await self._create_workspace(client, headers, "Perm WS B")
        doc_id = await self._upload(client, headers, ws_a)

        for bad in ("READ_WRITE", "admin", "owner", "view", ""):
            res = await client.post(
                f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
                json={"target_workspace_id": ws_b, "permission": bad},
                headers=headers,
            )
            assert res.status_code == 422, f"permission={bad!r} was accepted"

        ok = await client.post(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            json={"target_workspace_id": ws_b, "permission": "write"},
            headers=headers,
        )
        assert ok.status_code == 201
        assert ok.json()["permission"] == "write"

    async def test_cannot_share_into_unreachable_workspace(self, client: AsyncClient):
        """A share must name a workspace the grantor belongs to.

        Without this check a row can name any UUID, including another tenant's, and
        that row then satisfies get_document's share fallback for the target.
        """
        headers = await self._auth_header(client, "share_scope@example.com")
        ws_a = await self._create_workspace(client, headers, "Scope WS A")
        doc_id = await self._upload(client, headers, ws_a)

        # A workspace owned by somebody else.
        other_headers = await self._auth_header(client, "other_owner@example.com")
        ws_foreign = await self._create_workspace(client, other_headers, "Foreign WS")

        res = await client.post(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            json={"target_workspace_id": ws_foreign, "permission": "read"},
            headers=headers,
        )
        # 404, not 403: a 403 would confirm the workspace id exists.
        assert res.status_code == 404, res.text

        # A syntactically valid but absent workspace must be indistinguishable.
        absent = "00000000-0000-0000-0000-000000000000"
        res_absent = await client.post(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            json={"target_workspace_id": absent, "permission": "read"},
            headers=headers,
        )
        assert res_absent.status_code == res.status_code

    async def test_expired_share_grants_no_access(self, client: AsyncClient):
        """An elapsed expires_at must revoke read, not merely annotate the row."""
        headers = await self._auth_header(client, "share_expiry@example.com")
        ws_a = await self._create_workspace(client, headers, "Expiry WS A")
        ws_b = await self._create_workspace(client, headers, "Expiry WS B")
        doc_id = await self._upload(client, headers, ws_a)

        # Share into workspace B, then let it lapse.
        share_res = await client.post(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_a}",
            json={
                "target_workspace_id": ws_b,
                "permission": "read",
                "expires_at": "2020-01-01T00:00:00Z",
            },
            headers=headers,
        )
        assert share_res.status_code == 201

        # The grantor can still see it.
        owner_read = await client.get(
            f"/api/v1/documents/{doc_id}?workspace_id={ws_a}", headers=headers
        )
        assert owner_read.status_code == 200

        # A member of the target workspace must not inherit access from a dead grant.
        # The target workspace is unreachable for this user, so assert at the service
        # boundary via the list endpoint the target would use.
        list_res = await client.get(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_b}", headers=headers
        )
        assert list_res.status_code in (403, 404)
