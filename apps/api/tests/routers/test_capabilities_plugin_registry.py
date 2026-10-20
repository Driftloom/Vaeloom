"""Task 6 — one plugin registry.

`POST /capabilities` with `category: 'plugin'` writes the workspace capability
row AND binds an executable `plugins` row in one commit when
`settings.enterprise_routes_enabled`. Enterprise off → 403 with the exact gate
string and zero rows written.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from api.config import settings
from api.models.schema import Plugin, WorkspaceCapability

pytestmark = pytest.mark.asyncio

GATE_DETAIL = "Plugin runtime is enterprise-gated"
ENTRY_POINT_DETAIL = (
    "Plugin capabilities require config.entry_point; the server will not invent one."
)

PLUGIN_PAYLOAD = {
    "name": "plugin-alpha",
    "category": "plugin",
    "description": "Workspace plugin binding",
    "version": "1.0.0",
    "author": "Plugin Author",
    "config": {
        "hook": "on_tool_call",
        "sandbox": "isolated_subprocess",
        "target": "both",
        "entry_point": "plugin-alpha.py",
        "code": "def run(input: dict, context: dict) -> dict:\n    return input\n",
        "min_app_version": "0.0.0",
        "permissions": {"egress.inspect": True},
    },
}


async def _setup_workspace(client: AsyncClient) -> dict[str, str]:
    email = f"plugreg_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "TestPassword123!",
        "name": "Plugin Registry Tester",
    })
    assert res.status_code == 201
    token = res.json()["access_token"]
    ws_res = await client.post("/api/v1/workspaces", json={
        "name": "Plugin Registry Space",
    }, headers={"Authorization": f"Bearer {token}"})
    assert ws_res.status_code == 201
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": ws_res.json()["id"]}


async def _capability_rows(db, name: str) -> int:
    res = await db.execute(
        select(func.count()).select_from(WorkspaceCapability).where(
            WorkspaceCapability.name == name,
            WorkspaceCapability.category == "plugin",
        )
    )
    return int(res.scalar_one())


async def _plugin_row(db, name: str) -> Plugin | None:
    res = await db.execute(select(Plugin).where(Plugin.name == name))
    return res.scalar_one_or_none()


class TestPluginRegistryBinding:
    async def test_plugin_create_binds_registry_row_when_enterprise_enabled(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "enterprise_routes_enabled", True)
        headers = await _setup_workspace(client)

        res = await client.post("/api/v1/capabilities", json=PLUGIN_PAYLOAD, headers=headers)
        assert res.status_code == 201, res.text

        assert await _capability_rows(db_session, PLUGIN_PAYLOAD["name"]) == 1
        bound = await _plugin_row(db_session, PLUGIN_PAYLOAD["name"])
        assert bound is not None
        assert bound.name == PLUGIN_PAYLOAD["name"]
        assert bound.entry_point == PLUGIN_PAYLOAD["config"]["entry_point"]
        assert bound.version == PLUGIN_PAYLOAD["version"]
        assert bound.author == PLUGIN_PAYLOAD["author"]
        assert bound.status == "REGISTERED"
        assert bound.description == PLUGIN_PAYLOAD["description"]
        assert bound.permissions == {"egress.inspect": True}

    async def test_duplicate_plugin_capability_returns_409_without_rebinding_registry(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "enterprise_routes_enabled", True)
        headers = await _setup_workspace(client)

        first = await client.post("/api/v1/capabilities", json=PLUGIN_PAYLOAD, headers=headers)
        assert first.status_code == 201, first.text

        await db_session.execute(
            update(Plugin)
            .where(Plugin.name == PLUGIN_PAYLOAD["name"])
            .values(entry_point="mutated.py")
        )
        await db_session.commit()

        dup = await client.post("/api/v1/capabilities", json=PLUGIN_PAYLOAD, headers=headers)
        assert dup.status_code == 409

        still = await _plugin_row(db_session, PLUGIN_PAYLOAD["name"])
        assert still is not None
        assert still.entry_point == "mutated.py"

    async def test_plugin_without_entry_point_rejected_400_when_enterprise_enabled(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "enterprise_routes_enabled", True)
        headers = await _setup_workspace(client)

        payload = dict(PLUGIN_PAYLOAD)
        payload["config"] = {k: v for k, v in PLUGIN_PAYLOAD["config"].items() if k != "entry_point"}

        res = await client.post("/api/v1/capabilities", json=payload, headers=headers)
        assert res.status_code == 400
        assert res.json()["detail"] == ENTRY_POINT_DETAIL

        assert await _capability_rows(db_session, payload["name"]) == 0
        assert await _plugin_row(db_session, payload["name"]) is None

    async def test_plugin_create_403_when_enterprise_disabled_writes_nothing(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        monkeypatch.setattr(settings, "enterprise_routes_enabled", False)
        headers = await _setup_workspace(client)

        res = await client.post("/api/v1/capabilities", json=PLUGIN_PAYLOAD, headers=headers)
        assert res.status_code == 403
        assert res.json()["detail"] == GATE_DETAIL

        assert await _capability_rows(db_session, PLUGIN_PAYLOAD["name"]) == 0
        assert await _plugin_row(db_session, PLUGIN_PAYLOAD["name"]) is None

    async def _table_count(self, db, model) -> int:
        res = await db.execute(select(func.count()).select_from(model))
        return int(res.scalar_one())

    async def test_plugin_create_without_name_422_regardless_of_gate(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        headers = await _setup_workspace(client)

        capability_before = await self._table_count(db_session, WorkspaceCapability)
        plugin_before = await self._table_count(db_session, Plugin)
        res = await client.post("/api/v1/capabilities", json={"category": "plugin"}, headers=headers)
        assert res.status_code == 422
        assert await self._table_count(db_session, WorkspaceCapability) == capability_before
        assert await self._table_count(db_session, Plugin) == plugin_before

        monkeypatch.setattr(settings, "enterprise_routes_enabled", True)
        res_on = await client.post("/api/v1/capabilities", json={"category": "plugin"}, headers=headers)
        assert res_on.status_code == 422
        assert await self._table_count(db_session, WorkspaceCapability) == capability_before
        assert await self._table_count(db_session, Plugin) == plugin_before
