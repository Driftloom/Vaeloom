"""Connector usage rollup tests (CON-USE-01)."""

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _setup(client: AsyncClient):
    email = f"use_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPassword123!", "name": "Usage Tester"},
    )
    assert res.status_code == 201
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


class TestConnectorUsage:
    async def test_usage_reflects_lifecycle_events(self, client: AsyncClient):
        ha = await _setup(client)
        created = await client.post(
            "/api/v1/connectors",
            json={"name": f"U {uuid.uuid4().hex[:6]}", "type": "rest",
                  "config": {"url": "https://api.example.com/"}},
            headers=ha,
        )
        assert created.status_code == 201
        cid = created.json()["id"]
        await client.put(f"/api/v1/connectors/{cid}", json={"name": "U2"}, headers=ha)

        r = await client.get(f"/api/v1/connectors/{cid}/usage", headers=ha)
        assert r.status_code == 200
        body = r.json()
        assert body["connector_id"] == cid
        assert body["total_events"] >= 2
        assert body["events_by_action"].get("connector.create", 0) >= 1
        assert body["events_by_action"].get("connector.update", 0) >= 1
        assert body["last_activity_at"]
        assert body["config_version"] >= 1

    async def test_usage_cross_tenant_404_and_anon_401(self, client: AsyncClient):
        ha = await _setup(client)
        hb = await _setup(client)
        created = await client.post(
            "/api/v1/connectors",
            json={"name": f"U {uuid.uuid4().hex[:6]}", "type": "rest",
                  "config": {"url": "https://api.example.com/"}},
            headers=ha,
        )
        cid = created.json()["id"]
        assert (await client.get(f"/api/v1/connectors/{cid}/usage", headers=hb)).status_code == 404
        assert (await client.get(f"/api/v1/connectors/{cid}/usage")).status_code in (401, 403)
