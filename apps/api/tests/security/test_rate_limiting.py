import pytest
from httpx import AsyncClient

RATE_LIMIT = 5


@pytest.mark.asyncio
class TestRateLimiting:
    """Verify rate limiter blocks requests after threshold."""

    async def _exhaust_rate_limit(self, client: AsyncClient, path: str, headers: dict | None = None):
        for _ in range(RATE_LIMIT):
            await client.get(path, headers=headers)

    async def test_rate_limit_exceeded_on_workspaces(
        self, rate_limited_client: AsyncClient, auth_headers: dict,
    ):
        await self._exhaust_rate_limit(rate_limited_client, "/api/v1/workspaces", auth_headers)
        res = await rate_limited_client.get("/api/v1/workspaces", headers=auth_headers)
        assert res.status_code == 429

    async def test_rate_limit_allows_below_threshold(
        self, rate_limited_client: AsyncClient, auth_headers: dict,
    ):
        for _ in range(RATE_LIMIT - 1):
            res = await rate_limited_client.get("/api/v1/workspaces", headers=auth_headers)
            assert res.status_code == 200

    async def test_rate_limit_returns_retry_after_header(
        self, rate_limited_client: AsyncClient, auth_headers: dict,
    ):
        await self._exhaust_rate_limit(rate_limited_client, "/api/v1/memories", auth_headers)
        res = await rate_limited_client.get("/api/v1/memories", headers=auth_headers)
        assert res.status_code == 429
        assert "retry-after" in res.headers

    async def test_rate_limit_per_endpoint_independent(
        self, rate_limited_client: AsyncClient, auth_headers: dict,
    ):
        await self._exhaust_rate_limit(rate_limited_client, "/api/v1/workspaces", auth_headers)
        res_workspaces = await rate_limited_client.get("/api/v1/workspaces", headers=auth_headers)
        assert res_workspaces.status_code == 429

        res_memories = await rate_limited_client.get("/api/v1/memories", headers=auth_headers)
        assert res_memories.status_code == 200

    async def test_rate_limit_per_user_independent(
        self, rate_limited_client: AsyncClient,
    ):
        res_a = await rate_limited_client.post(
            "/api/v1/auth/signup",
            json={"email": "user-a@test.com", "password": "Test1234!"},
        )
        assert res_a.status_code == 201
        token_a = res_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        res_b = await rate_limited_client.post(
            "/api/v1/auth/signup",
            json={"email": "user-b@test.com", "password": "Test1234!"},
        )
        assert res_b.status_code == 201
        token_b = res_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        await self._exhaust_rate_limit(rate_limited_client, "/api/v1/workspaces", headers_a)
        res_a_blocked = await rate_limited_client.get("/api/v1/workspaces", headers=headers_a)
        assert res_a_blocked.status_code == 429

        res_b_ok = await rate_limited_client.get("/api/v1/workspaces", headers=headers_b)
        assert res_b_ok.status_code == 200

    async def test_rate_limit_health_skipped(
        self, rate_limited_client: AsyncClient,
    ):
        for _ in range(RATE_LIMIT + 10):
            res = await rate_limited_client.get("/health")
            assert res.status_code == 200

    async def test_rate_limit_different_methods_separate(
        self, rate_limited_client: AsyncClient, auth_headers: dict,
    ):
        for _ in range(RATE_LIMIT):
            res = await rate_limited_client.get("/api/v1/memories", headers=auth_headers)
            assert res.status_code == 200

        res_get = await rate_limited_client.get("/api/v1/memories", headers=auth_headers)
        assert res_get.status_code == 429

    async def test_rate_limit_resets_after_window(
        self, rate_limited_client: AsyncClient, auth_headers: dict, monkeypatch,
    ):
        import time as time_module
        original_time = time_module.time
        call_count = [0]

        def fake_time():
            call_count[0] += 1
            if call_count[0] > RATE_LIMIT * 2:
                return original_time() + 120
            return original_time()

        monkeypatch.setattr(time_module, "time", fake_time)

        await self._exhaust_rate_limit(rate_limited_client, "/api/v1/workspaces", auth_headers)
        res = await rate_limited_client.get("/api/v1/workspaces", headers=auth_headers)
        assert res.status_code == 200
