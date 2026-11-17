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
        # Durable store proof: the middleware only writes after the request
        # transaction commits, so the record must exist before the replay.
        assert first.headers.get("Idempotency-Stored") == "true"
        stored = await db_session.execute(
            text("SELECT COUNT(*) FROM idempotency_records WHERE idempotency_key = 'key-1'")
        )
        assert stored.scalar_one() == 1

        second = await client.post("/api/v1/consent/grant", json=payload, headers=headers_with_key)
        assert second.status_code == 200
        assert second.headers.get("Idempotency-Replayed") == "true"
        assert second.json()["scope"] == "data_processing"

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM consent_records WHERE scope = 'data_processing'")
        )
        assert result.scalar_one() == 1

    async def test_store_runs_after_request_transaction_commits(
        self, client: AsyncClient, db_session, monkeypatch,
    ):
        """Regression: the store must not open a second SQLite writer while the
        request transaction still holds the write lock (database is locked)."""
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from api.middleware.idempotency import IdempotencyMiddleware

        headers = await self._auth_header(client)
        headers_with_key = {**headers, "Idempotency-Key": "key-commit-order"}
        observed: dict[str, int] = {}
        original_store = IdempotencyMiddleware._store

        async def observing_store(self, key, path, req_hash, response, tenant_id,
                                  workspace_id, actor, body_bytes=None):
            probe_factory = async_sessionmaker(db_session.bind, expire_on_commit=False)
            async with probe_factory() as probe:
                result = await probe.execute(
                    text("SELECT COUNT(*) FROM consent_records WHERE scope = 'data_processing'")
                )
                observed["consent_rows"] = result.scalar_one()
            return await original_store(
                self, key, path, req_hash, response, tenant_id,
                workspace_id, actor, body_bytes=body_bytes,
            )

        monkeypatch.setattr(IdempotencyMiddleware, "_store", observing_store)
        res = await client.post(
            "/api/v1/consent/grant",
            json={"scope": "data_processing"},
            headers=headers_with_key,
        )
        assert res.status_code == 200
        assert res.headers.get("Idempotency-Stored") == "true"
        assert observed["consent_rows"] == 1, (
            "idempotency store ran before the request transaction committed"
        )

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
        # Phase A requires an authoritative workspace for memory writes.
        ws_res = await client.get("/api/v1/workspaces", headers=headers)
        assert ws_res.status_code == 200
        workspace_id = ws_res.json()[0]["id"]
        headers_with_key = {**headers, "Idempotency-Key": "key-3", "X-Workspace-ID": workspace_id}
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
        assert first.headers.get("Idempotency-Stored") == "true"
        second = await client.post("/api/v1/approvals", json=payload, headers=headers_with_key)
        assert second.status_code == 201
        assert second.headers.get("Idempotency-Replayed") == "true"
        assert second.json()["id"] == first.json()["id"]

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM agent_approvals WHERE reason = 'idem'")
        )
        assert result.scalar_one() == 1
