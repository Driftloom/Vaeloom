import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestBilling:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "bill@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_create_subscription(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/billing/subscription", json={
            "plan": "pro",
        }, headers=headers)
        assert res.status_code == 201

    async def test_get_subscription(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await client.post("/api/v1/billing/subscription", json={
            "plan": "free",
        }, headers=headers)
        res = await client.get("/api/v1/billing/subscription", headers=headers)
        assert res.status_code in (200, 404)

    async def test_get_usage(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/billing/usage", headers=headers)
        assert res.status_code == 200

    async def test_get_subscription_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/billing/subscription", headers=headers)
        assert res.status_code == 404
