import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestRecommendations:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "recs@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _auth_header_and_uid(self, client: AsyncClient) -> tuple[dict, str]:
        """Return headers plus the caller's own id.

        POST /index rejects a user_id that is not the caller (403), so a test that
        exercises the happy path has to send the authenticated subject. The
        previous revision sent `{}` and asserted 200, which could not pass against
        that check.
        """
        headers = await self._auth_header(client)
        me = await client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200, me.text
        body = me.json()
        # /auth/me nests the subject under "user"; "workspaces" also has an "id",
        # so a flat lookup here would silently pick the workspace instead.
        uid = (body.get("user") or {}).get("id") or body.get("user_id") or body.get("sub")
        assert uid, f"no subject id in /auth/me: {body}"
        return headers, str(uid)

    async def test_recommendations_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/recommendations", json={
            "user_id": "00000000-0000-0000-0000-000000000000",
        })
        assert res.status_code == 401

    async def test_reindex(self, client: AsyncClient):
        headers, uid = await self._auth_header_and_uid(client)
        res = await client.post(
            "/api/v1/recommendations/index", json={"user_id": uid}, headers=headers
        )
        assert res.status_code == 200, res.text
        assert isinstance(res.json(), list)

    async def test_reindex_rejects_another_user(self, client: AsyncClient):
        """Negative control: the ownership gate must hold."""
        headers, _uid = await self._auth_header_and_uid(client)
        res = await client.post(
            "/api/v1/recommendations/index",
            json={"user_id": str(uuid.uuid4())},
            headers=headers,
        )
        assert res.status_code == 403

    async def test_reindex_ignores_body_tenant_id(self, client: AsyncClient):
        """A body-supplied tenant must never reach the rebuild.

        tenant_id used to be forwarded straight from the request body, so a
        caller could aim the write at another tenant's preference vector -- the
        cross-tenant steer the user_id check blocks, one dimension over.
        """
        headers, uid = await self._auth_header_and_uid(client)
        victim = str(uuid.uuid4())

        from api.services.recommendation_service import recommendation_service

        captured: dict = {}

        async def _fake_reindex(user_id, tenant_id, db, workspace_id=None):
            captured["user_id"] = user_id
            captured["tenant_id"] = tenant_id
            captured["workspace_id"] = workspace_id
            return []

        original = recommendation_service.reindex
        recommendation_service.reindex = _fake_reindex
        try:
            res = await client.post(
                "/api/v1/recommendations/index",
                json={"user_id": uid, "tenant_id": victim},
                headers=headers,
            )
            assert res.status_code == 200, res.text
        finally:
            recommendation_service.reindex = original

        assert captured["tenant_id"] != victim, "body tenant_id leaked into reindex"

    async def test_reindex_without_workspace_is_a_no_op(self, client: AsyncClient):
        """No workspace context must not write an orphan sentinel vector.

        A vector keyed to the all-zeros workspace cannot be read back by any
        workspace-scoped reader; it is storage that only resembles coverage.
        """
        from api.services.recommendation_service import recommendation_service

        class _Row:
            def __getitem__(self, index):
                return str(uuid.uuid4())

            def fetchall(self):
                return [_Row()]

        class _Result:
            def fetchone(self):
                return (None,)

        class _DB:
            def __init__(self):
                self.statements: list[str] = []

            async def execute(self, stmt, params=None):
                self.statements.append(str(stmt))
                return _Result()

        db = _DB()
        results = await recommendation_service.reindex(
            str(uuid.uuid4()), str(uuid.uuid4()), db, workspace_id=None
        )
        assert results == []
        writes = [s for s in db.statements if "INSERT" in s.upper()]
        assert not writes, f"wrote a preference vector with no workspace: {writes}"

    async def test_reindex_with_workspace_still_writes(self, client: AsyncClient):
        """Guard against the no-op fix regressing the real path."""
        from api.services.recommendation_service import recommendation_service

        class _Result:
            def fetchone(self):
                return ("[0.1,0.2]",)

        class _DB:
            def __init__(self):
                self.statements: list[str] = []

            async def execute(self, stmt, params=None):
                self.statements.append(str(stmt))
                if "SELECT DISTINCT" in str(stmt):
                    row = _Result()
                    row.fetchall = lambda: [(str(uuid.uuid4()),)]  # type: ignore[method-assign]
                    return row
                return _Result()

        db = _DB()
        wid = str(uuid.uuid4())
        results = await recommendation_service.reindex(
            str(uuid.uuid4()), str(uuid.uuid4()), db, workspace_id=wid
        )
        assert len(results) == 1
        assert results[0]["status"] == "reindexed"
        writes = [s for s in db.statements if "INSERT" in s.upper()]
        assert len(writes) == 1, f"expected exactly one insert, got {writes}"

    @pytest.mark.xfail(reason="PG syntax (::text) unsupported in SQLite", strict=False)
    async def test_get_recommendations_by_user_no_results(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(f"/api/v1/recommendations/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 200

    @pytest.mark.xfail(reason="PG syntax (::text) unsupported in SQLite", strict=False)
    async def test_get_trending_empty(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/recommendations/trending", headers=headers)
        assert res.status_code == 200
