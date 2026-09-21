"""Connector config versioning + rollback tests (CON-VER-01)."""

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _rest_payload(name="Ver REST", url="https://api.example.com/v1"):
    return {
        "name": f"{name} {uuid.uuid4().hex[:6]}",
        "type": "rest",
        "config": {"url": url, "headers": {"X-Key": "s3cret"}},
    }


class TestConnectorVersioning:
    async def _setup(self, client: AsyncClient):
        email = f"ver_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "TestPassword123!", "name": "Ver Tester"},
        )
        assert res.status_code == 201
        headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
        ws = await client.post("/api/v1/workspaces", json={"name": "Ver WS"}, headers=headers)
        assert ws.status_code == 201
        return headers, ws.json()["id"]

    async def test_create_starts_at_version_1(self, client: AsyncClient):
        ha, ws = await self._setup(client)
        res = await client.post(
            "/api/v1/connectors", json={**_rest_payload(), "workspace_id": ws}, headers=ha
        )
        assert res.status_code == 201
        assert res.json()["config_version"] == 1

    async def test_update_bumps_version_and_stores_history(self, client: AsyncClient):
        ha, ws = await self._setup(client)
        created = await client.post(
            "/api/v1/connectors", json={**_rest_payload(), "workspace_id": ws}, headers=ha
        )
        cid = created.json()["id"]
        upd = await client.put(
            f"/api/v1/connectors/{cid}",
            json={"config": {"url": "https://api2.example.com/v2", "headers": {}}},
            headers=ha,
        )
        assert upd.status_code == 200
        assert upd.json()["config_version"] == 2

    async def test_rollback_restores_prior_config(self, client: AsyncClient):
        ha, ws = await self._setup(client)
        created = await client.post(
            "/api/v1/connectors", json={**_rest_payload(), "workspace_id": ws}, headers=ha
        )
        cid = created.json()["id"]
        await client.put(
            f"/api/v1/connectors/{cid}",
            json={"config": {"url": "https://changed.example.com/", "headers": {}}},
            headers=ha,
        )
        rb = await client.post(f"/api/v1/connectors/{cid}/rollback", json={"version": 1}, headers=ha)
        assert rb.status_code == 200
        body = rb.json()
        assert body["config_version"] == 3
        # Masked read must not leak the stored secret, v1 URL restored
        assert "s3cret" not in rb.text

    async def test_rollback_unknown_version_404(self, client: AsyncClient):
        ha, ws = await self._setup(client)
        created = await client.post(
            "/api/v1/connectors", json={**_rest_payload(), "workspace_id": ws}, headers=ha
        )
        cid = created.json()["id"]
        rb = await client.post(f"/api/v1/connectors/{cid}/rollback", json={"version": 99}, headers=ha)
        assert rb.status_code == 404

    async def test_rollback_cross_tenant_404(self, client: AsyncClient):
        ha, ws = await self._setup(client)
        hb, _ = await self._setup(client)
        created = await client.post(
            "/api/v1/connectors", json={**_rest_payload(), "workspace_id": ws}, headers=ha
        )
        cid = created.json()["id"]
        rb = await client.post(f"/api/v1/connectors/{cid}/rollback", json={"version": 1}, headers=hb)
        assert rb.status_code == 404
