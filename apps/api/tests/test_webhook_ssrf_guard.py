import uuid
import pytest
from httpx import AsyncClient

from api.services.webhook_service import webhook_service
from api.models.schema import Webhook, WebhookDelivery

pytestmark = pytest.mark.asyncio


class TestWebhookSsrfGuard:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": f"ssrf-test-{uuid.uuid4().hex[:6]}@test.com", "password": "TestPassword123!"},
        )
        assert res.status_code == 201, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    @pytest.mark.parametrize(
        "blocked_url",
        [
            "http://169.254.169.254/latest/meta-data/",
            "https://169.254.169.254/latest/meta-data/",
            "http://127.0.0.1:8000/internal",
            "https://127.0.0.1/admin",
            "http://localhost:3000",
            "https://localhost/api",
            "https://10.0.0.1/secrets",
            "https://192.168.1.1/gateway",
            "https://172.16.0.5/vpc",
        ],
    )
    async def test_blocked_webhook_urls_rejected_on_create(self, client: AsyncClient, blocked_url: str):
        headers = await self._auth_header(client)
        payload = {
            "name": "SSRF Test",
            "url": blocked_url,
            "secret": "test-secret-123456",
            "events": ["*"],
        }
        res = await client.post("/api/v1/webhooks", json=payload, headers=headers)
        # Should be rejected with 400 or 422 (validation error / SSRF policy violation)
        assert res.status_code in (400, 422), f"Blocked URL {blocked_url} was accepted! Status: {res.status_code}"

    async def test_webhook_send_catches_ssrf(self, db_session):
        # Even if a blocked URL somehow existed in DB, _send must abort and mark delivery as FAILED
        tenant_id = uuid.uuid4()
        webhook = Webhook(
            tenant_id=tenant_id,
            name="Rogue Webhook",
            url="https://127.0.0.1/malicious",
            secret="whsec_rogue",
            events=["*"],
        )
        db_session.add(webhook)
        await db_session.flush()

        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type="test.event",
            payload={"msg": "hello"},
            status="PENDING",
            attempt=1,
            max_attempts=3,
        )
        db_session.add(delivery)
        await db_session.commit()

        # Invoke _send directly
        await webhook_service._send(delivery.id, db_session)
        await db_session.refresh(delivery)

        assert delivery.status == "FAILED"
        assert "SSRF" in (delivery.response_body or "")
