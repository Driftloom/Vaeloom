"""GDPR + consent end-to-end tests — verifies data export, deletion, and consent flows."""
import pytest
from httpx import AsyncClient


async def _signup(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPass1234!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


@pytest.mark.asyncio
class TestConsentFlow:
    """Verify consent grant, revoke, and check flows."""

    async def test_list_scopes(self, client: AsyncClient):
        """GET /consent/scopes returns available consent scopes."""
        res = await client.get("/api/v1/consent/scopes")
        assert res.status_code == 200
        scopes = res.json()["scopes"]
        assert len(scopes) >= 3
        scope_names = {s["name"] for s in scopes}
        assert "data_processing" in scope_names
        assert "agent_access" in scope_names
        assert "email_marketing" in scope_names

    async def test_grant_consent(self, client: AsyncClient):
        """POST /consent/grant records consent successfully."""
        token = await _signup(client, "consent-grant@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/consent/grant",
            headers=headers,
            json={"scope": "data_processing"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["scope"] == "data_processing"
        assert "granted_at" in body
        assert "id" in body

    async def test_grant_then_revoke(self, client: AsyncClient):
        """Grant then revoke consent — should be reflected in status."""
        token = await _signup(client, "consent-revoke@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/consent/grant",
            headers=headers,
            json={"scope": "email_marketing"},
        )
        assert res.status_code == 200

        res = await client.post(
            "/api/v1/consent/revoke/email_marketing",
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["revoked_at"] is not None

    async def test_list_consents_after_grant(self, client: AsyncClient):
        """GET /consent/me shows granted consents."""
        token = await _signup(client, "consent-list@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        for scope in ("data_processing", "agent_access"):
            await client.post(
                "/api/v1/consent/grant",
                headers=headers,
                json={"scope": scope},
            )

        res = await client.get("/api/v1/consent/me", headers=headers)
        assert res.status_code == 200
        items = res.json()["items"]
        granted_scopes = {i["scope"] for i in items if i["revoked_at"] is None}
        assert "data_processing" in granted_scopes
        assert "agent_access" in granted_scopes

    async def test_grant_requires_auth(self, client: AsyncClient):
        """Unauthenticated consent grant should fail."""
        res = await client.post(
            "/api/v1/consent/grant",
            json={"scope": "data_processing"},
        )
        assert res.status_code == 401


@pytest.mark.asyncio
class TestGDPRExport:
    """Verify GDPR data export endpoint."""

    async def test_export_own_data(self, client: AsyncClient):
        """GET /gdpr/export returns user's data."""
        token = await _signup(client, "gdpr-export@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/gdpr/export", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert "user_id" in body
        assert "exported_at" in body
        assert "data" in body
        assert "total_records" in body

    async def test_export_creates_audit_event(self, client: AsyncClient):
        """Export should create an audit event."""
        token = await _signup(client, "gdpr-audit@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        await client.get("/api/v1/gdpr/export", headers=headers)

        res = await client.get("/api/v1/audit/events", headers=headers)
        assert res.status_code == 200
        items = res.json().get("items", [])
        gdpr_events = [e for e in items if "gdpr" in e.get("action", "")]
        assert len(gdpr_events) >= 1, "No GDPR audit event found after export"

    async def test_export_requires_auth(self, client: AsyncClient):
        """Unauthenticated export should fail."""
        res = await client.get("/api/v1/gdpr/export")
        assert res.status_code == 401


@pytest.mark.asyncio
class TestGDPRDelete:
    """Verify GDPR data deletion endpoint."""

    async def test_delete_own_data(self, client: AsyncClient):
        """POST /gdpr/delete anonymizes user data."""
        token = await _signup(client, "gdpr-delete@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post("/api/v1/gdpr/delete", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["action"] == "anonymized"
        assert "tables" in body

    async def test_delete_requires_auth(self, client: AsyncClient):
        """Unauthenticated delete should fail."""
        res = await client.post("/api/v1/gdpr/delete")
        assert res.status_code == 401

    async def test_user_cannot_delete_other_users_data(self, client: AsyncClient):
        """Non-admin user cannot delete another user's data."""
        token_a = await _signup(client, "gdpr-del-a@test.com")
        token_b = await _signup(client, "gdpr-del-b@test.com")
        headers_b = {"Authorization": f"Bearer {token_b}"}

        res_a = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"})
        user_a_id = res_a.json()["user"]["id"]

        res = await client.post(
            f"/api/v1/gdpr/delete?user_id={user_a_id}",
            headers=headers_b,
        )
        assert res.status_code == 403
