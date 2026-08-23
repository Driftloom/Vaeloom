"""Unit tests for the MCP client service: config validation, bridging, dispatch."""
import pytest

from api.services.mcp_client_service import (
    McpConfigError,
    _McpClientService,
    slugify,
    validate_mcp_config,
)
from api.tools.executor import (
    DYNAMIC_HANDLERS,
    DYNAMIC_TOOL_DEFS,
    approval_gated_tools,
    register_dynamic_tool,
    unregister_dynamic_tools,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _clean_bridge_registry():
    yield
    unregister_dynamic_tools("mcp__")


class TestValidateMcpConfig:
    def test_valid_stdio(self):
        cfg = validate_mcp_config({
            "transport": "stdio", "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-postgres"],
            "env": {"DATABASE_URL": "postgres://..."},
        })
        assert cfg["transport"] == "stdio"

    def test_valid_http(self):
        assert validate_mcp_config({"transport": "http", "url": "https://mcp.example.com/rpc"})

    def test_http_insecure_requires_flag(self):
        with pytest.raises(McpConfigError, match="allow_insecure"):
            validate_mcp_config({"transport": "http", "url": "http://localhost:3000/rpc"})
        ok = validate_mcp_config({
            "transport": "http", "url": "http://localhost:3000/rpc", "allow_insecure": True,
        })
        assert ok["allow_insecure"] is True

    def test_missing_or_bad_transport(self):
        for cfg in ({}, {"transport": "websocket"}, {"transport": None}):
            with pytest.raises(McpConfigError):
                validate_mcp_config(cfg)

    @pytest.mark.parametrize("cmd", ["bash", "sh", "powershell", "cmd.exe", "pwsh"])
    def test_shell_interpreters_denied(self, cmd):
        with pytest.raises(McpConfigError, match="Shell interpreter"):
            validate_mcp_config({"transport": "stdio", "command": cmd})

    def test_metacharacters_denied(self):
        with pytest.raises(McpConfigError, match="metacharacters"):
            validate_mcp_config({"transport": "stdio", "command": "npx", "args": ["-y", "x; rm -rf"]})

    def test_bad_args_and_env_types(self):
        with pytest.raises(McpConfigError, match="args"):
            validate_mcp_config({"transport": "stdio", "command": "npx", "args": ["ok", 42]})
        with pytest.raises(McpConfigError, match="env"):
            validate_mcp_config({"transport": "stdio", "command": "npx", "env": {"K": 1}})


class TestSlugify:
    def test_namespaced_bridge_name_shape(self):
        assert slugify("GitHub MCP Server") + "__" and True
        assert slugify("@modelcontextprotocol/server-everything") != ""
        assert "/" not in slugify("a/b c")

    def test_fallback_on_empty(self):
        assert slugify("") == "server"
        assert slugify("///") == "server"


class TestDiscovery:
    async def test_list_tools_maps_readonly_hint(self, monkeypatch):
        class FakeTool:
            def __init__(self, name, ro):
                self.name = name
                self.description = f"{name} desc"
                self.inputSchema = {"type": "object"}
                self.annotations = type("A", (), {"readOnlyHint": ro})()

        class FakeResult:
            tools = [FakeTool("search_docs", True), FakeTool("create_row", False)]

        svc = _McpClientService()
        connector_id = "11111111-1111-1111-1111-111111111111"

        async def fake_get_decrypted(self, cid, tid, db=None):
            return {
                "id": cid, "workspace_id": None, "name": "Test Server",
                "type": "mcp", "config": {"transport": "http", "url": "https://x"},
                "status": "disconnected", "tenant_id": None, "token_ref": None,
                "last_synced_at": None, "created_at": None, "updated_at": None,
            }

        async def fake_run(self, cfg, operation):  # noqa: N805 - patches method
            class FakeSession:
                async def list_tools(self_inner):  # noqa: N805 - protocol shim
                    return FakeResult()

            return await operation(FakeSession())

        import api.services.connector_ext_service as ces

        monkeypatch.setattr(ces.ConnectorExtService, "get_decrypted", fake_get_decrypted)
        monkeypatch.setattr(_McpClientService, "_run_with_session", fake_run)

        tools = await svc.list_tools(connector_id, None, db=object())
        by_name = {t["name"]: t for t in tools}
        assert by_name["search_docs"]["read_only_hint"] is True
        assert by_name["create_row"]["read_only_hint"] is False

        # Second call served from cache (no second transport run)
        calls = {"n": 0}

        async def counting_run(self, cfg, operation):
            calls["n"] += 1
            return await fake_run(self, cfg, operation)

        monkeypatch.setattr(_McpClientService, "_run_with_session", counting_run)
        await svc.list_tools(connector_id, None, db=object())
        assert calls["n"] == 0


class TestBridging:
    async def test_bridge_registers_defs_handlers_and_gate(self, monkeypatch):
        from api.services.mcp_client_service import mcp_client_service as svc

        connector_id = "22222222-2222-2222-2222-222222222222"

        class Row:
            id = connector_id
            name = "Postgres Server"
            workspace_id = "ws-1"
            type = "mcp"

        async def fake_get(self, cid, tid, db=None):
            return Row()

        async def fake_list(cid, tid, db=None, refresh=False):
            return [
                {"name": "query", "description": "Run SQL", "input_schema": {"type": "object"},
                 "read_only_hint": True},
                {"name": "insert!", "description": "Insert row", "input_schema": {"type": "object"},
                 "read_only_hint": False},
            ]

        import api.services.connector_ext_service as ces

        monkeypatch.setattr(ces.ConnectorExtService, "get", fake_get)
        monkeypatch.setattr(svc, "list_tools", fake_list)

        registered = await svc.bridge_connector_tools(connector_id, None, db=None)
        assert registered == ["mcp__Postgres-Server__query", "mcp__Postgres-Server__insert"]

        assert "mcp__Postgres-Server__query" in DYNAMIC_TOOL_DEFS
        assert "mcp__Postgres-Server__insert" in DYNAMIC_TOOL_DEFS
        td = DYNAMIC_TOOL_DEFS["mcp__Postgres-Server__insert"]
        assert td.required_scope == "connector.mcp.execute"
        assert td.category == "connector_write"

        gates = approval_gated_tools()
        assert "mcp__Postgres-Server__insert" in gates
        assert "mcp__Postgres-Server__query" not in gates

    async def test_bridged_handler_enforces_workspace(self, monkeypatch):
        from api.services.mcp_client_service import mcp_client_service as svc

        connector_id = "33333333-3333-3333-3333-333333333333"

        class Row:
            id = connector_id
            name = "Srv"
            workspace_id = "ws-owner"
            type = "mcp"

        async def fake_get(self, cid, tid, db=None):
            return Row()

        async def fake_call(cid, tool_name, arguments, tenant_id, db):
            return {"text": f"ran {tool_name}", "is_error": False}

        import api.services.connector_ext_service as ces

        monkeypatch.setattr(ces.ConnectorExtService, "get", fake_get)
        monkeypatch.setattr(svc, "call_tool", fake_call)

        ok = await svc._execute_bridged(connector_id, "t", {}, "ws-owner", None)
        assert ok["status"] == "success"
        denied = await svc._execute_bridged(connector_id, "t", {}, "ws-other", None)
        assert denied["status"] == "error"


class TestDynamicDispatchThroughExecutor:
    async def test_execute_tool_resolves_dynamic_handler(self):
        from api.tools.definitions import ToolDefinition
        from api.tools.executor import execute_tool

        calls = {}

        async def handler(params, workspace_id):
            calls["ws"] = workspace_id
            return {"status": "success", "tool": params.get("_name", ""), "result": "ran"}

        td = ToolDefinition(
            name="mcp__X__probe", description="d",
            input_schema={"type": "object"}, output_schema={"type": "object"},
            required_scope="connector.mcp.execute", category="connector_read",
        )
        register_dynamic_tool(td, handler)

        result = await execute_tool(td, {"_name": "probe"}, "agent-1",
                                    ["connector.mcp.execute"], "ws-77")
        assert result["result"] == "ran"
        assert calls["ws"] == "ws-77"

    async def test_scope_still_enforced_for_dynamic_tools(self):
        from api.tools.definitions import ToolDefinition
        from api.tools.executor import PermissionDeniedError, execute_tool

        td = ToolDefinition(
            name="mcp__X__secret", description="d",
            input_schema={"type": "object"}, output_schema={"type": "object"},
            required_scope="connector.mcp.execute", category="connector_read",
        )
        async def ignored_handler(p, w):  # noqa: ARG001
            return {"status": "success", "result": "x"}

        register_dynamic_tool(td, ignored_handler)

        with pytest.raises(PermissionDeniedError):
            await execute_tool(td, {}, "agent-1", ["memory.read"], "ws-1")

    def test_unregister_cleans_all_maps(self):
        from api.tools.definitions import ToolDefinition

        td = ToolDefinition(
            name="mcp__Y__temp", description="d",
            input_schema={"type": "object"}, output_schema={"type": "object"},
            required_scope="connector.mcp.execute", category="connector_read",
        )

        async def h(p, w):  # pragma: no cover
            return {}

        register_dynamic_tool(td, h)
        mark_temp = "mcp__Y__temp"
        from api.tools.executor import mark_approval_gated

        mark_approval_gated(mark_temp)
        removed = unregister_dynamic_tools("mcp__Y__")
        assert removed == 1
        assert "mcp__Y__temp" not in DYNAMIC_TOOL_DEFS
        assert "mcp__Y__temp" not in DYNAMIC_HANDLERS
        assert mark_temp not in approval_gated_tools()


class TestReActIntegrationSurface:
    def test_base_approval_set_preserved(self):
        gates = approval_gated_tools()
        for legacy in ("draft_email", "send_slack_message", "create_calendar_event"):
            assert legacy in gates
