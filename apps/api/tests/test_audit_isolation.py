import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAuditIsolation:
    async def _create_user(self, client: AsyncClient, email: str) -> dict:
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "SecurePassword123!"},
        )
        assert res.status_code == 201, res.text
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_personal_user_cannot_read_other_users_events(self, client: AsyncClient):
        # User A signs up (no tenant_id)
        user_a_headers = await self._create_user(client, f"user_a_{uuid.uuid4().hex[:8]}@test.com")
        # User B signs up (no tenant_id)
        user_b_headers = await self._create_user(client, f"user_b_{uuid.uuid4().hex[:8]}@test.com")

        # User A creates an audit event
        res_a = await client.post(
            "/api/v1/audit/events",
            json={"actor_id": "user-a-declared", "action": "secret_doc_created", "resource": "document", "resource_id": "doc-999"},
            headers=user_a_headers,
        )
        assert res_a.status_code == 201, res_a.text
        event_a_id = res_a.json()["id"]

        # User B lists events: MUST NOT see User A's event
        res_b_list = await client.get("/api/v1/audit/events", headers=user_b_headers)
        assert res_b_list.status_code == 200
        b_items = res_b_list.json()["items"]
        b_event_ids = [item["id"] for item in b_items]
        assert event_a_id not in b_event_ids, "Cross-user audit leakage detected!"

        # User B attempts to fetch User A's event by ID: MUST receive 404
        res_b_get = await client.get(f"/api/v1/audit/events/{event_a_id}", headers=user_b_headers)
        assert res_b_get.status_code == 404, "User B was able to fetch User A's audit event by ID!"

        # User A CAN fetch their own event
        res_a_get = await client.get(f"/api/v1/audit/events/{event_a_id}", headers=user_a_headers)
        assert res_a_get.status_code == 200
        assert res_a_get.json()["id"] == event_a_id
        assert res_a_get.json()["action"] == "secret_doc_created"

    async def test_export_and_compliance_isolation(self, client: AsyncClient):
        user_a_headers = await self._create_user(client, f"export_a_{uuid.uuid4().hex[:8]}@test.com")
        user_b_headers = await self._create_user(client, f"export_b_{uuid.uuid4().hex[:8]}@test.com")

        # Create unique action for User A
        unique_action = f"action_{uuid.uuid4().hex[:12]}"
        await client.post(
            "/api/v1/audit/events",
            json={"actor_id": "user-a-declared", "action": unique_action, "resource": "report"},
            headers=user_a_headers,
        )

        # User B exports events: User A's unique action must not be present
        export_b = await client.post("/api/v1/audit/export?format=json", headers=user_b_headers)
        assert export_b.status_code == 200
        assert unique_action not in export_b.text

        # User B compliance report: User A's actions must not contribute to count
        report_b = await client.get("/api/v1/audit/compliance/report", headers=user_b_headers)
        assert report_b.status_code == 200
        actions = [a["action"] for a in report_b.json().get("by_action", [])]
        assert unique_action not in actions
