import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestHealth:
    async def test_health_check(self, client: AsyncClient):
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "service" in data
