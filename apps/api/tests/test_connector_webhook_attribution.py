"""Unit and integration tests for Connector Inbound Webhook Attribution and Binding (GAP-CON-04)."""
import hashlib
import hmac
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def _signup_and_get_workspace(client: AsyncClient, prefix: str) -> tuple[dict, str, str]:
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@test.vaeloom"
    res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "SecurePassword123!"})
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    uid = me_res.json()["user"]["id"]
    ws_res = await client.post("/api/v1/workspaces", json={"name": f"{prefix}-ws"}, headers=headers)
    assert ws_res.status_code in (200, 201)
    wid = ws_res.json()["id"]
    return headers, uid, wid


class TestConnectorWebhookAttribution:
    async def test_inbound_webhook_received_and_audited(self, client: AsyncClient, db_session: AsyncSession):
        """Verify inbound webhook event receipt and audit event attribution to connector."""
        headers, uid, wid = await _signup_and_get_workspace(client, "inbound-wh")

        # 1. Create connector
        conn_res = await client.post(
            "/api/v1/connectors",
            json={"name": "Webhook-Target-Conn", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        assert conn_res.status_code == 201
        cid = conn_res.json()["id"]

        # 2. Dispatch inbound webhook payload as operator (JWT, unsigned delivery)
        wh_payload = {
            "event": "document.updated",
            "payload": {"doc_id": "doc-123", "action": "reindex"},
        }
        res = await client.post(
            f"/api/v1/connectors/{cid}/inbound-webhook",
            json=wh_payload,
            headers={"Authorization": headers["Authorization"]},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["status"] == "received"
        assert body["connector_id"] == cid
        assert body["event"] == "document.updated"
        assert body["dispatched"] is True

        # 3. Check audit event recorded
        audit_res = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'connector.webhook_received' AND resource_id = :cid"),
            {"cid": cid},
        )
        assert audit_res.scalar() >= 1

    async def test_inbound_webhook_nonexistent_connector_404(self, client: AsyncClient):
        """Verify 404 when inbound webhook targets non-existent connector."""
        headers, _, _ = await _signup_and_get_workspace(client, "missing-wh")
        fake_id = str(uuid.uuid4())
        # Anonymous without HMAC signature -> 401 at auth middleware
        res = await client.post(
            f"/api/v1/connectors/{fake_id}/inbound-webhook",
            json={"event": "ping", "payload": {}},
        )
        assert res.status_code == 401
        # Authenticated operator -> 404 for unknown connector
        res = await client.post(
            f"/api/v1/connectors/{fake_id}/inbound-webhook",
            json={"event": "ping", "payload": {}},
            headers={"Authorization": headers["Authorization"]},
        )
        assert res.status_code == 404

    async def test_inbound_webhook_hmac_signature_validation(self, client: AsyncClient):
        """Verify HMAC signature validation when connector has secret configured."""
        headers, _, wid = await _signup_and_get_workspace(client, "sig-wh")
        secret = "super-secret-webhook-key"

        conn_res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "HMAC-Webhook-Conn",
                "type": "rest",
                "token_ref": secret,
                "config": {"url": "https://example.com/api"},
            },
            headers=headers,
        )
        assert conn_res.status_code == 201
        cid = conn_res.json()["id"]

        payload_bytes = b'{"event": "ping", "payload": {}}'

        # 1. Invalid signature returns 401
        bad_sig_headers = {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": "sha256=invalidbadhash123",
            "X-Workspace-Id": wid,
        }
        res_bad = await client.post(
            f"/api/v1/connectors/{cid}/inbound-webhook",
            content=payload_bytes,
            headers=bad_sig_headers,
        )
        assert res_bad.status_code == 401

        # 2. Valid signature returns 200
        valid_sig = "sha256=" + hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
        good_sig_headers = {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": valid_sig,
            "X-Workspace-Id": wid,
        }
        res_good = await client.post(
            f"/api/v1/connectors/{cid}/inbound-webhook",
            content=payload_bytes,
            headers=good_sig_headers,
        )
        assert res_good.status_code == 200
        assert res_good.json()["status"] == "received"

    async def test_inbound_webhook_anonymous_hmac_matrix(self, client: AsyncClient):
        """External senders authenticate with HMAC alone (no user JWT)."""
        headers, _, _ = await _signup_and_get_workspace(client, "anon-wh")
        secret = "external-sender-key"

        conn_res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Anon-HMAC-Conn",
                "type": "rest",
                "token_ref": secret,
                "config": {"url": "https://example.com/api"},
            },
            headers=headers,
        )
        assert conn_res.status_code == 201
        cid = conn_res.json()["id"]
        payload_bytes = b'{"event": "ping", "payload": {}}'

        # Anonymous + valid HMAC -> delivered (external sender flow)
        valid_sig = "sha256=" + hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
        res = await client.post(
            f"/api/v1/connectors/{cid}/inbound-webhook",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": valid_sig},
        )
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "received"

        # Anonymous + forged HMAC -> 401
        res = await client.post(
            f"/api/v1/connectors/{cid}/inbound-webhook",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=forged"},
        )
        assert res.status_code == 401

        # Anonymous + no HMAC at all -> 401 at auth middleware
        res = await client.post(
            f"/api/v1/connectors/{cid}/inbound-webhook",
            content=payload_bytes,
            headers={"Content-Type": "application/json"},
        )
        assert res.status_code == 401
