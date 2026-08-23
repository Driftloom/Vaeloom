"""Integration tests for MCP connector type + admin routes (transports mocked)."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio

STDIO_CONFIG = {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {"DATABASE_URL": "postgres://user:pass@localhost/db"},
}


class TestMcpConnectorRoutes:
    async def _signup_and_ws(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": f"mcp-user-{uuid.uuid4().hex[:8]}@test.com", "password": "McpTest1234!"},
        )
        assert res.status_code == 201
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = await client.post("/api/v1/workspaces", json={"name": "MCP WS"}, headers=headers)
        assert res.status_code == 201
        return headers, res.json()["id"]

    async def _create_mcp_connector(self, client, headers) -> dict:
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Postgres MCP", "type": "mcp", "config": STDIO_CONFIG},
            headers=headers,
        )
        assert res.status_code == 201, res.text
        return res.json()

    # ── CRUD with new type ────────────────────────────────────────────

    async def test_create_mcp_connector_encrypts_env(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        created = await self._create_mcp_connector(client, auth_headers)
        assert created["type"] == "mcp"
        env = created["config"].get("env", {})
        assert env.get("DATABASE_URL") != "postgres://user:pass@localhost/db"  # encrypted

        from sqlalchemy import select

        from api.models.schema import Connector

        res = await db_session.execute(
            select(Connector).where(Connector.id == uuid.UUID(created["id"]))
        )
        row = res.scalar_one()
        assert row.config["env"]["DATABASE_URL"] != "postgres://user:pass@localhost/db"

    async def test_create_mcp_connector_rejects_shell_command(
        self, client: AsyncClient, auth_headers: dict
    ):
        bad = dict(STDIO_CONFIG, command="bash")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Evil", "type": "mcp", "config": bad},
            headers=auth_headers,
        )
        assert res.status_code == 400
        assert "interpreter" in res.json()["error"]["message"].lower()

    async def test_create_mcp_connector_rejects_bad_transport(
        self, client: AsyncClient, auth_headers: dict
    ):
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Bad", "type": "mcp", "config": {"transport": "websocket"}},
            headers=auth_headers,
        )
        assert res.status_code == 400

    async def test_update_mcp_config_revalidates(
        self, client: AsyncClient, auth_headers: dict
    ):
        created = await self._create_mcp_connector(client, auth_headers)
        res = await client.put(
            f"/api/v1/connectors/{created['id']}",
            json={"config": {"transport": "stdio", "command": "powershell"}},
            headers=auth_headers,
        )
        assert res.status_code == 400

    # ── Tools / sync / call endpoints (service mocked) ────────────────

    @staticmethod
    def _mock_service(monkeypatch, tools=None):
        from api.services.mcp_client_service import mcp_client_service as svc

        tools = tools if tools is not None else [
            {"name": "query", "description": "Run SQL", "input_schema": {"type": "object"},
             "read_only_hint": True},
            {"name": "insert_row", "description": "Insert", "input_schema": {"type": "object"},
             "read_only_hint": False},
        ]
        calls = {"list": 0, "bridge": 0, "call": None}

        async def fake_list(cid, tid, db=None, refresh=False):
            calls["list"] += 1
            return tools

        async def fake_bridge(cid, tid, db=None):
            calls["bridge"] += 1
            return [f"mcp__Postgres-MCP__{t['name']}" for t in tools]

        async def fake_call(cid, tool_name, arguments, tid, db=None):
            calls["call"] = {"tool": tool_name, "args": arguments}
            return {"tool": tool_name, "text": "ok", "is_error": False}

        monkeypatch.setattr(svc, "list_tools", fake_list)
        monkeypatch.setattr(svc, "bridge_connector_tools", fake_bridge)
        monkeypatch.setattr(svc, "call_tool", fake_call)
        return svc, calls

    async def test_list_tools_endpoint(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        _, calls = self._mock_service(monkeypatch)
        created = await self._create_mcp_connector(client, auth_headers)
        res = await client.get(
            f"/api/v1/connectors/{created['id']}/mcp/tools", headers=auth_headers
        )
        assert res.status_code == 200, res.text
        names = {t["name"] for t in res.json()}
        assert {"query", "insert_row"} <= names

    async def test_refresh_endpoint_forces_bypass(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        svc, calls = self._mock_service(monkeypatch)
        created = await self._create_mcp_connector(client, auth_headers)
        res = await client.post(
            f"/api/v1/connectors/{created['id']}/mcp/tools/refresh", headers=auth_headers
        )
        assert res.status_code == 200
        assert len(res.json()) == 2

    async def test_sync_registers_bridge(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        # Mock only discovery — let the REAL bridge run so registration + gating happen
        from api.services.mcp_client_service import mcp_client_service as svc

        tools = [
            {"name": "query", "description": "Run SQL", "input_schema": {"type": "object"},
             "read_only_hint": True},
            {"name": "insert_row", "description": "Insert", "input_schema": {"type": "object"},
             "read_only_hint": False},
        ]

        async def fake_list(cid, tid, db=None, refresh=False):
            return tools

        monkeypatch.setattr(svc, "list_tools", fake_list)

        created = await self._create_mcp_connector(client, auth_headers)
        res = await client.post(
            f"/api/v1/connectors/{created['id']}/mcp/sync", headers=auth_headers
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["registered"] == [
            "mcp__Postgres-MCP__query", "mcp__Postgres-MCP__insert_row"
        ]
        from api.tools.executor import approval_gated_tools, unregister_dynamic_tools

        assert "mcp__Postgres-MCP__insert_row" in approval_gated_tools()
        assert "mcp__Postgres-MCP__query" not in approval_gated_tools()

        # cleanup registry for other tests
        unregister_dynamic_tools("mcp__")

    async def test_call_proxy(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        _, calls = self._mock_service(monkeypatch)
        created = await self._create_mcp_connector(client, auth_headers)
        res = await client.post(
            f"/api/v1/connectors/{created['id']}/mcp/call",
            json={"tool_name": "query", "arguments": {"sql": "SELECT 1"}},
            headers=auth_headers,
        )
        assert res.status_code == 200, res.text
        assert res.json()["text"] == "ok"
        assert calls["call"]["args"] == {"sql": "SELECT 1"}

    async def test_test_connection_uses_mcp_path(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        # conftest's autouse mock_connector_test patches ConnectorExtService.
        # test_connection — override it AFTER to route through the MCP service.
        import api.services.connector_ext_service as ces
        from api.services.mcp_client_service import mcp_client_service as svc

        created = await self._create_mcp_connector(client, auth_headers)
        seen = []

        async def fake_svc_test(cid, tid, db=None):
            seen.append(str(cid))
            return {"status": "ok", "tools": 2}

        async def fake_ext_test(self, cid, tid=None, db=None):
            return await fake_svc_test(cid, tid, db)

        monkeypatch.setattr(svc, "test_connection", fake_svc_test)
        monkeypatch.setattr(ces.ConnectorExtService, "test_connection", fake_ext_test)

        res = await client.post(f"/api/v1/connectors/{created['id']}/test", headers=auth_headers)
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "tools": 2}
        assert seen == [created["id"]]

    async def test_non_mcp_connector_rejected_on_mcp_route(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "REST Thing", "type": "rest", "config": {"url": "https://example.com"}},
            headers=auth_headers,
        )
        assert res.status_code == 201
        rest_id = res.json()["id"]
        r = await client.get(f"/api/v1/connectors/{rest_id}/mcp/tools", headers=auth_headers)
        # service raises HTTPException(400) — surfaced through unified handler
        assert r.status_code == 400
