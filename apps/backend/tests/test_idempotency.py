import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestIdempotency:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "idem@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_replay_returns_stored_response(self, client: AsyncClient, db_session):
        from sqlalchemy import text

        headers = await self._auth_header(client)
        payload = {"scope": "data_processing"}
        headers_with_key = {**headers, "Idempotency-Key": "key-1"}

        first = await client.post("/api/v1/consent/grant", json=payload, headers=headers_with_key)
        assert first.status_code == 200
        assert "Idempotency-Replayed" not in first.headers

        second = await client.post("/api/v1/consent/grant", json=payload, headers=headers_with_key)
        assert second.status_code == 200
        assert second.headers.get("Idempotency-Replayed") == "true"
        assert second.json()["scope"] == "data_processing"

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM consent_records WHERE scope = 'data_processing'")
        )
        assert result.scalar_one() == 1

    async def test_same_key_different_payload_conflicts(self, client: AsyncClient):
        headers = await self._auth_header(client)
        headers_with_key = {**headers, "Idempotency-Key": "key-2"}

        first = await client.post("/api/v1/consent/grant", json={"scope": "data_processing"}, headers=headers_with_key)
        assert first.status_code == 200

        second = await client.post("/api/v1/consent/grant", json={"scope": "agent_access"}, headers=headers_with_key)
        assert second.status_code == 422

    async def test_different_key_executes_again(self, client: AsyncClient, db_session):
        from sqlalchemy import text

        headers = await self._auth_header(client)
        for i in range(2):
            res = await client.post(
                "/api/v1/consent/grant",
                json={"scope": "email_marketing"},
                headers={**headers, "Idempotency-Key": f"key-{i}"},
            )
            assert res.status_code == 200

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM consent_records WHERE scope = 'email_marketing'")
        )
        assert result.scalar_one() == 1

    async def test_non_consequential_path_ignores_key(self, client: AsyncClient):
        headers = await self._auth_header(client)
        headers_with_key = {**headers, "Idempotency-Key": "key-3"}
        payload = {"type": "note", "title": "No Idempotency"}

        first = await client.post("/api/v1/memories", json=payload, headers=headers_with_key)
        assert first.status_code == 201
        second = await client.post("/api/v1/memories", json=payload, headers=headers_with_key)
        assert second.status_code == 201
        assert "Idempotency-Replayed" not in second.headers
        assert second.json()["id"] != first.json()["id"]

    async def test_get_requests_pass_through(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/consent/scopes",
            headers={**headers, "Idempotency-Key": "key-4"},
        )
        assert res.status_code == 200
        assert "Idempotency-Replayed" not in res.headers

    async def test_approval_create_is_idempotent(self, client: AsyncClient, db_session):
        from sqlalchemy import text

        headers = await self._auth_header(client)
        payload = {"agent_name": "a", "action_type": "run", "reason": "idem"}
        headers_with_key = {**headers, "Idempotency-Key": "key-5"}

        first = await client.post("/api/v1/approvals", json=payload, headers=headers_with_key)
        assert first.status_code == 201
        second = await client.post("/api/v1/approvals", json=payload, headers=headers_with_key)
        assert second.status_code == 201
        assert second.headers.get("Idempotency-Replayed") == "true"
        assert second.json()["id"] == first.json()["id"]

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM agent_approvals WHERE reason = 'idem'")
        )
        assert result.scalar_one() == 1
