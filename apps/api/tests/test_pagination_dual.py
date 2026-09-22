"""Dual-spelling pagination (pagination-standard, Loop 2).

`limit`/`offset` is the documented standard; legacy `page`/`page_size` keeps
working (web client sends it in ~48 call sites). When `limit` is given it wins.
"""
import pytest
from httpx import AsyncClient

from api.utils.pagination import resolve_page_params

pytestmark = pytest.mark.asyncio


class TestResolvePageParams:
    def test_legacy_passthrough(self):
        assert resolve_page_params(2, 20, None, None) == (2, 20)

    def test_limit_offset_equivalence(self):
        # limit=2&offset=2  ===  page=2&page_size=2
        assert resolve_page_params(1, 20, 2, 2) == (2, 2)
        # limit=25&offset=0 === page=1&page_size=25
        assert resolve_page_params(1, 20, 25, 0) == (1, 25)

    def test_limit_wins_over_page(self):
        assert resolve_page_params(5, 50, 10, 0) == (1, 10)

    def test_offset_none_defaults_to_first_page(self):
        assert resolve_page_params(3, 20, 10, None) == (1, 10)

    def test_clamping(self):
        assert resolve_page_params(1, 20, 500, 0) == (1, 100)
        assert resolve_page_params(1, 20, 10, -5) == (1, 10)


class TestEndpointEquivalence:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "pagedual@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _seed(self, client: AsyncClient, headers: dict, n: int = 5):
        for i in range(n):
            res = await client.post("/api/v1/notifications/send", json={
                "channel": "email",
                "recipient": f"u{i}@test.com",
                "subject": f"Subj {i}",
                "body": "Hello",
            }, headers=headers)
            assert res.status_code == 201

    async def test_limit_offset_matches_page_spelling(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._seed(client, headers)
        legacy = await client.get("/api/v1/notifications?page=2&page_size=2", headers=headers)
        standard = await client.get("/api/v1/notifications?limit=2&offset=2", headers=headers)
        assert legacy.status_code == 200
        assert standard.status_code == 200
        assert [n["id"] for n in standard.json()] == [n["id"] for n in legacy.json()]

    async def test_legacy_default_unchanged(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._seed(client, headers, n=3)
        res = await client.get("/api/v1/notifications", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) == 3
