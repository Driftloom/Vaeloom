"""
Module 04 — Connectors: Comprehensive Zero-Trust Adversarial Verification Suite
Tests: CON-ZT-001 through CON-ZT-048.

Validates:
1. Multi-Tenant & Workspace Isolation (CON-ZT-001..010)
2. SSRF & Network Boundary Attacks (CON-ZT-011..020)
3. Command Injection & Stdio Sandboxing (CON-ZT-021..028)
4. Credential Encryption, Masking & Secret Leak Prevention (CON-ZT-029..036)
5. Composio SaaS Gateway & Builtin MCP Verification (CON-ZT-037..042)
6. Concurrency, Rate Limiting & Audit Trail (CON-ZT-043..048)
"""
import asyncio
import os
import re
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Connector
from api.services.connector_ext_service import ConnectorExtService, connector_ext_service
from api.services.encryption import is_encrypted
from api.services.mcp_client_service import (
    McpConfigError,
    mcp_client_service,
    validate_mcp_config,
)
from api.tools.executor import (
    DYNAMIC_HANDLERS,
    DYNAMIC_TOOL_DEFS,
    approval_gated_tools,
    unregister_dynamic_tools,
)
from api.utils.url_guard import UrlBlockedError

_original_test_connection = ConnectorExtService.test_connection

pytestmark = pytest.mark.asyncio


# ── Helpers & Fixtures ───────────────────────────────────────────────

async def _signup_and_get_workspace(client: AsyncClient, email_prefix: str) -> tuple[dict, str, str]:
    """Helper: sign up a user, create workspace, return (headers, user_id, workspace_id)."""
    email = f"{email_prefix}-{uuid.uuid4().hex[:8]}@vaeloom-audit.test"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "AuditPass1234!"},
    )
    assert res.status_code == 201, f"Signup failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_id = me_res.json()["user"]["id"]

    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": f"{email_prefix}-ws"},
        headers=headers,
    )
    assert ws_res.status_code in (200, 201)
    workspace_id = ws_res.json()["id"]
    return headers, user_id, workspace_id


@pytest.fixture(autouse=True)
def _cleanup_dynamic_mcp_bridges():
    yield
    unregister_dynamic_tools("mcp__")


# ══════════════════════════════════════════════════════════════════════
# SUITE 1: TENANT & WORKSPACE ISOLATION (CON-ZT-001 .. CON-ZT-010)
# ══════════════════════════════════════════════════════════════════════

class TestWorkspaceIsolation:
    async def test_con_zt_001_workspace_isolation_get(self, client: AsyncClient):
        """CON-ZT-001: User A cannot read User B's connector across workspaces."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt001-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt001-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "A-Private", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        # User B attempts to fetch User A's connector
        b_res = await client.get(f"/api/v1/connectors/{conn_id}", headers=headers_b)
        assert b_res.status_code == 404

    async def test_con_zt_002_workspace_isolation_put(self, client: AsyncClient):
        """CON-ZT-002: User A cannot mutate User B's connector across workspaces."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt002-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt002-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "A-Original", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.put(
            f"/api/v1/connectors/{conn_id}",
            json={"name": "Attacker Hijack", "config": {"url": "https://attacker.com"}},
            headers=headers_b,
        )
        assert b_res.status_code == 404

    async def test_con_zt_003_workspace_isolation_delete(self, client: AsyncClient):
        """CON-ZT-003: User A cannot delete User B's connector across workspaces."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt003-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt003-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "A-Preserved", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.delete(f"/api/v1/connectors/{conn_id}", headers=headers_b)
        assert b_res.status_code == 404

        # Verify still intact for User A
        a_check = await client.get(f"/api/v1/connectors/{conn_id}", headers=headers_a)
        assert a_check.status_code == 200

    async def test_con_zt_004_workspace_isolation_sync(self, client: AsyncClient):
        """CON-ZT-004: User A cannot trigger sync on User B's connector."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt004-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt004-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "A-Sync", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.post(f"/api/v1/connectors/{conn_id}/sync", headers=headers_b)
        assert b_res.status_code == 404

    async def test_con_zt_005_workspace_isolation_test(self, client: AsyncClient):
        """CON-ZT-005: User A cannot test connection on User B's connector."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt005-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt005-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "A-Test", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.post(f"/api/v1/connectors/{conn_id}/test", headers=headers_b)
        assert b_res.status_code == 404

    async def test_con_zt_006_workspace_isolation_mcp_list_tools(self, client: AsyncClient):
        """CON-ZT-006: User A cannot list MCP tools of User B's connector."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt006-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt006-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "A-MCP",
                "type": "mcp",
                "config": {"transport": "stdio", "command": "npx", "args": ["-y", "test-pkg"]},
            },
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.get(f"/api/v1/connectors/{conn_id}/mcp/tools", headers=headers_b)
        assert b_res.status_code == 404

    async def test_con_zt_007_workspace_isolation_mcp_refresh(self, client: AsyncClient):
        """CON-ZT-007: User A cannot force tool refresh on User B's MCP connector."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt007-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt007-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "A-MCP-Refresh",
                "type": "mcp",
                "config": {"transport": "stdio", "command": "npx", "args": ["-y", "test-pkg"]},
            },
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.post(f"/api/v1/connectors/{conn_id}/mcp/tools/refresh", headers=headers_b)
        assert b_res.status_code == 404

    async def test_con_zt_008_workspace_isolation_mcp_call(self, client: AsyncClient):
        """CON-ZT-008: User A cannot invoke tool calls on User B's MCP connector."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt008-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt008-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "A-MCP-Call",
                "type": "mcp",
                "config": {"transport": "stdio", "command": "npx", "args": ["-y", "test-pkg"]},
            },
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.post(
            f"/api/v1/connectors/{conn_id}/mcp/call",
            json={"tool_name": "dump_data", "arguments": {}},
            headers=headers_b,
        )
        assert b_res.status_code == 404

    async def test_con_zt_009_workspace_isolation_mcp_sync(self, client: AsyncClient):
        """CON-ZT-009: User A cannot bridge tools from User B's MCP connector."""
        headers_a, _, _ = await _signup_and_get_workspace(client, "zt009-a")
        headers_b, _, _ = await _signup_and_get_workspace(client, "zt009-b")

        create_res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "A-MCP-Sync",
                "type": "mcp",
                "config": {"transport": "stdio", "command": "npx", "args": ["-y", "test-pkg"]},
            },
            headers=headers_a,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        b_res = await client.post(f"/api/v1/connectors/{conn_id}/mcp/sync", headers=headers_b)
        assert b_res.status_code == 404

    async def test_con_zt_010_workspace_isolation_list(self, client: AsyncClient):
        """CON-ZT-010: Listing connectors filters strictly by the authenticated workspace."""
        headers_a, _, ws_a = await _signup_and_get_workspace(client, "zt010-a")
        headers_b, _, ws_b = await _signup_and_get_workspace(client, "zt010-b")

        await client.post(
            "/api/v1/connectors",
            json={"name": "A-Visible", "type": "rest", "config": {"url": "https://example.com/a"}},
            headers=headers_a,
        )
        await client.post(
            "/api/v1/connectors",
            json={"name": "B-Visible", "type": "rest", "config": {"url": "https://example.com/b"}},
            headers=headers_b,
        )

        list_a = await client.get("/api/v1/connectors", headers=headers_a)
        assert list_a.status_code == 200
        names_a = [c["name"] for c in list_a.json()]
        assert "A-Visible" in names_a
        assert "B-Visible" not in names_a

        list_b = await client.get("/api/v1/connectors", headers=headers_b)
        assert list_b.status_code == 200
        names_b = [c["name"] for c in list_b.json()]
        assert "B-Visible" in names_b
        assert "A-Visible" not in names_b


# ══════════════════════════════════════════════════════════════════════
# SUITE 2: SSRF & NETWORK BOUNDARY ATTACKS (CON-ZT-011 .. CON-ZT-020)
# ══════════════════════════════════════════════════════════════════════

class TestSsrfBoundaryProtection:
    async def test_con_zt_011_reject_loopback_ip(self, client: AsyncClient):
        """CON-ZT-011: Reject http://127.0.0.1:8000/admin on REST create."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt011")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "SSRF-127", "type": "rest", "config": {"url": "http://127.0.0.1:8000/admin"}},
            headers=headers,
        )
        assert res.status_code == 400
        assert "blocked" in res.text.lower() or "internal" in res.text.lower()

    async def test_con_zt_012_reject_localhost(self, client: AsyncClient):
        """CON-ZT-012: Reject http://localhost:3000/api on REST create."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt012")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "SSRF-Localhost", "type": "rest", "config": {"url": "http://localhost:3000/api"}},
            headers=headers,
        )
        assert res.status_code == 400

    async def test_con_zt_013_reject_aws_metadata(self, client: AsyncClient):
        """CON-ZT-013: Reject http://169.254.169.254/latest/meta-data/ on REST create."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt013")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "SSRF-AWS", "type": "rest", "config": {"url": "http://169.254.169.254/latest/meta-data/"}},
            headers=headers,
        )
        assert res.status_code == 400

    async def test_con_zt_014_reject_gcp_metadata(self, client: AsyncClient):
        """CON-ZT-014: Reject http://metadata.google.internal/computeMetadata/v1/ on REST create."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt014")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "SSRF-GCP", "type": "rest", "config": {"url": "http://metadata.google.internal/computeMetadata/v1/"}},
            headers=headers,
        )
        assert res.status_code == 400

    @pytest.mark.parametrize("bad_ip", ["http://10.0.0.1/intranet", "http://192.168.1.1/router", "http://172.16.0.1/admin"])
    async def test_con_zt_015_reject_private_subnets(self, client: AsyncClient, bad_ip: str):
        """CON-ZT-015: Reject private RFC-1918 subnets on REST create."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt015")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "SSRF-RFC1918", "type": "rest", "config": {"url": bad_ip}},
            headers=headers,
        )
        assert res.status_code == 400

    async def test_con_zt_016_reject_redirect_to_loopback_in_sync(self, client: AsyncClient):
        """CON-ZT-016: HTTP 302 redirect targeting 127.0.0.1 during trigger_sync is blocked."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt016")
        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "Sync-Redirect", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        with patch("httpx.AsyncClient") as mock_client:
            inst = AsyncMock()
            inst.get = AsyncMock(side_effect=UrlBlockedError("Host '127.0.0.1' is blocked"))
            mock_client.return_value.__aenter__.return_value = inst

            sync_res = await client.post(f"/api/v1/connectors/{conn_id}/sync", headers=headers)
            assert sync_res.status_code == 200
            data = sync_res.json()
            assert data["status"] == "error"
            assert "blocked" in data["error"].lower() or "sync_request_error" in data["error"].lower()

    async def test_con_zt_017_reject_redirect_to_metadata_in_test(self, client: AsyncClient, monkeypatch):
        """CON-ZT-017: HTTP 302 redirect targeting cloud metadata during test_connection is blocked."""
        monkeypatch.setattr(ConnectorExtService, "test_connection", _original_test_connection)
        headers, _, _ = await _signup_and_get_workspace(client, "zt017")
        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "Test-Redirect", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        assert create_res.status_code == 201
        conn_id = create_res.json()["id"]

        with patch("httpx.AsyncClient") as mock_client:
            inst = AsyncMock()
            inst.get = AsyncMock(side_effect=UrlBlockedError("Host '169.254.169.254' is blocked"))
            mock_client.return_value.__aenter__.return_value = inst

            test_res = await client.post(f"/api/v1/connectors/{conn_id}/test", headers=headers)
            assert test_res.status_code in (400, 502)

    async def test_con_zt_018_native_ats_mcp_blocks_loopback(self):
        """CON-ZT-018: Native ATS MCP tool fetch_job_details rejects loopback target."""
        import json
        from api.mcp_servers.job_search_mcp import fetch_job_details

        result_str = await fetch_job_details("http://127.0.0.1:8080/internal/job")
        result = json.loads(result_str)
        assert "error" in result
        assert "blocked" in result["error"].lower()

    async def test_con_zt_019_native_ats_mcp_blocks_cloud_metadata(self):
        """CON-ZT-019: Native ATS MCP tool fetch_job_details rejects cloud metadata target."""
        import json
        from api.mcp_servers.job_search_mcp import fetch_job_details

        result_str = await fetch_job_details("http://169.254.169.254/latest/meta-data/")
        result = json.loads(result_str)
        assert "error" in result
        assert "blocked" in result["error"].lower()

    async def test_con_zt_020_mcp_http_transport_blocks_cloud_metadata_even_if_insecure(self):
        """CON-ZT-020: MCP HTTP transport targeting cloud metadata is blocked even if allow_insecure=True."""
        with pytest.raises(McpConfigError, match="cloud metadata"):
            validate_mcp_config({
                "transport": "http",
                "url": "http://169.254.169.254/mcp",
                "allow_insecure": True,
            })


# ══════════════════════════════════════════════════════════════════════
# SUITE 3: COMMAND INJECTION & STDIO SANDBOXING (CON-ZT-021 .. CON-ZT-028)
# ══════════════════════════════════════════════════════════════════════

class TestCommandInjectionAndSandboxing:
    async def test_con_zt_021_reject_bash_command(self, client: AsyncClient):
        """CON-ZT-021: Reject MCP stdio command 'bash'."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt021")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Evil-Bash", "type": "mcp", "config": {"transport": "stdio", "command": "bash"}},
            headers=headers,
        )
        assert res.status_code == 400
        assert "interpreter" in res.text.lower()

    async def test_con_zt_022_reject_sh_command(self, client: AsyncClient):
        """CON-ZT-022: Reject MCP stdio command 'sh'."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt022")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Evil-Sh", "type": "mcp", "config": {"transport": "stdio", "command": "sh"}},
            headers=headers,
        )
        assert res.status_code == 400

    async def test_con_zt_023_reject_powershell_command(self, client: AsyncClient):
        """CON-ZT-023: Reject MCP stdio command 'powershell.exe'."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt023")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Evil-Pwsh", "type": "mcp", "config": {"transport": "stdio", "command": "powershell.exe"}},
            headers=headers,
        )
        assert res.status_code == 400

    async def test_con_zt_024_reject_cmd_command(self, client: AsyncClient):
        """CON-ZT-024: Reject MCP stdio command 'cmd.exe'."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt024")
        res = await client.post(
            "/api/v1/connectors",
            json={"name": "Evil-Cmd", "type": "mcp", "config": {"transport": "stdio", "command": "cmd.exe"}},
            headers=headers,
        )
        assert res.status_code == 400

    @pytest.mark.parametrize("meta", [";", "&", "|", "`", "$", "\n"])
    async def test_con_zt_025_reject_command_shell_metacharacters(self, meta: str):
        """CON-ZT-025: Reject MCP command containing shell metacharacters."""
        with pytest.raises(McpConfigError, match="metacharacters"):
            validate_mcp_config({
                "transport": "stdio",
                "command": f"node{meta}evil",
            })

    @pytest.mark.parametrize("meta_arg", ["foo && rm -rf /", "foo | cat", "foo > out.txt", "foo < in.txt"])
    async def test_con_zt_026_reject_args_shell_metacharacters(self, meta_arg: str):
        """CON-ZT-026: Reject MCP stdio args containing shell operators."""
        with pytest.raises(McpConfigError, match="metacharacters"):
            validate_mcp_config({
                "transport": "stdio",
                "command": "node",
                "args": ["server.js", meta_arg],
            })

    @pytest.mark.parametrize("win_meta", ["^", "%", "!"])
    async def test_con_zt_027_reject_windows_batch_metacharacters(self, win_meta: str):
        """CON-ZT-027: Reject Windows batch wrapper symbols (^, %, !)."""
        with pytest.raises(McpConfigError, match="metacharacters"):
            validate_mcp_config({
                "transport": "stdio",
                "command": f"npx{win_meta}run",
            })

    async def test_con_zt_028_reject_invalid_args_env_types(self):
        """CON-ZT-028: Reject non-list args or non-dict/non-string env in stdio config."""
        with pytest.raises(McpConfigError):
            validate_mcp_config({"transport": "stdio", "command": "npx", "args": "not-a-list"})
        with pytest.raises(McpConfigError):
            validate_mcp_config({"transport": "stdio", "command": "npx", "args": [123]})
        with pytest.raises(McpConfigError):
            validate_mcp_config({"transport": "stdio", "command": "npx", "env": ["not-a-dict"]})
        with pytest.raises(McpConfigError):
            validate_mcp_config({"transport": "stdio", "command": "npx", "env": {"PORT": 8080}})


# ══════════════════════════════════════════════════════════════════════
# SUITE 4: CREDENTIAL ENCRYPTION & MASKING (CON-ZT-029 .. CON-ZT-036)
# ══════════════════════════════════════════════════════════════════════

class TestCredentialEncryptionAndMasking:
    async def test_con_zt_029_rest_credentials_encrypted_in_db(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """CON-ZT-029: Credentials in REST config (apiKey, authToken) are encrypted in DB."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt029")
        res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Enc-Test",
                "type": "rest",
                "config": {
                    "url": "https://example.com/api",
                    "apiKey": "plaintext-super-secret-key-12345",
                    "authToken": "plaintext-bearer-token-67890",
                },
            },
            headers=headers,
        )
        assert res.status_code == 201
        conn_id = res.json()["id"]

        row = (await db_session.execute(select(Connector).where(Connector.id == uuid.UUID(conn_id)))).scalar_one()
        assert row.config["apiKey"] != "plaintext-super-secret-key-12345"
        assert row.config["authToken"] != "plaintext-bearer-token-67890"
        assert is_encrypted(row.config["apiKey"])
        assert is_encrypted(row.config["authToken"])

    async def test_con_zt_030_variant_keys_encrypted_in_db(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """CON-ZT-030: Case-insensitive variant credential keys (client_secret, private_key) are encrypted."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt030")
        res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Enc-Variants",
                "type": "rest",
                "config": {
                    "url": "https://example.com/api",
                    "client_secret": "my-client-secret-xyz",
                    "private_key": "my-private-key-abc",
                },
            },
            headers=headers,
        )
        assert res.status_code == 201
        conn_id = res.json()["id"]

        row = (await db_session.execute(select(Connector).where(Connector.id == uuid.UUID(conn_id)))).scalar_one()
        assert row.config["client_secret"] != "my-client-secret-xyz"
        assert row.config["private_key"] != "my-private-key-abc"
        assert is_encrypted(row.config["client_secret"])
        assert is_encrypted(row.config["private_key"])

    async def test_con_zt_031_headers_tokens_encrypted_in_db(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """CON-ZT-031: Headers dictionary keys containing tokens are encrypted in DB."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt031")
        res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Enc-Headers",
                "type": "rest",
                "config": {
                    "url": "https://example.com/api",
                    "headers": {
                        "Authorization": "Bearer secret-jwt-token-999",
                        "X-API-Key": "secret-custom-key-888",
                    },
                },
            },
            headers=headers,
        )
        assert res.status_code == 201
        conn_id = res.json()["id"]

        row = (await db_session.execute(select(Connector).where(Connector.id == uuid.UUID(conn_id)))).scalar_one()
        stored_hdrs = row.config["headers"]
        assert stored_hdrs["Authorization"] != "Bearer secret-jwt-token-999"
        assert stored_hdrs["X-API-Key"] != "secret-custom-key-888"
        assert is_encrypted(stored_hdrs["Authorization"])
        assert is_encrypted(stored_hdrs["X-API-Key"])

    async def test_con_zt_032_create_connector_response_masks_credentials(self, client: AsyncClient):
        """CON-ZT-032: Outbound POST /connectors response masks sensitive config fields with '******'."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt032")
        res = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Mask-Create",
                "type": "rest",
                "config": {
                    "url": "https://example.com/api",
                    "apiKey": "super-secret-password-123",
                    "headers": {"Authorization": "Bearer token"},
                },
            },
            headers=headers,
        )
        assert res.status_code == 201
        cfg = res.json()["config"]
        assert cfg["apiKey"] == "******"
        assert cfg["headers"]["Authorization"] == "******"

    async def test_con_zt_033_get_connector_response_masks_credentials(self, client: AsyncClient):
        """CON-ZT-033: Outbound GET /connectors/{id} response masks sensitive config fields."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt033")
        created = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Mask-Get",
                "type": "rest",
                "config": {"url": "https://example.com/api", "authToken": "secret-auth-token"},
            },
            headers=headers,
        )
        cid = created.json()["id"]

        res = await client.get(f"/api/v1/connectors/{cid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["config"]["authToken"] == "******"

    async def test_con_zt_034_list_connectors_response_masks_credentials(self, client: AsyncClient):
        """CON-ZT-034: Outbound GET /connectors listing masks credentials across all items."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt034")
        await client.post(
            "/api/v1/connectors",
            json={
                "name": "Mask-List",
                "type": "rest",
                "config": {"url": "https://example.com/api", "apiKey": "list-secret"},
            },
            headers=headers,
        )

        res = await client.get("/api/v1/connectors", headers=headers)
        assert res.status_code == 200
        conns = res.json()
        target = next((c for c in conns if c["name"] == "Mask-List"), None)
        assert target is not None
        assert target["config"]["apiKey"] == "******"

    async def test_con_zt_035_update_connector_response_masks_credentials(self, client: AsyncClient):
        """CON-ZT-035: Outbound PUT /connectors/{id} response masks credentials."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt035")
        created = await client.post(
            "/api/v1/connectors",
            json={"name": "Mask-Put-Orig", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        cid = created.json()["id"]

        res = await client.put(
            f"/api/v1/connectors/{cid}",
            json={"config": {"url": "https://example.com/api", "apiKey": "new-secret-key"}},
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["config"]["apiKey"] == "******"

    async def test_con_zt_036_health_endpoint_no_credential_leak(self, client: AsyncClient):
        """CON-ZT-036: GET /connectors/{id}/health provides status without leaking credentials."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt036")
        created = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Health-Conn",
                "type": "rest",
                "config": {"url": "https://example.com/api", "apiKey": "secret-123"},
            },
            headers=headers,
        )
        cid = created.json()["id"]

        res = await client.get(f"/api/v1/connectors/{cid}/health", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert "connector_id" in body
        assert "status" in body
        assert "auth_state" in body
        assert body["auth_state"] == "configured"
        assert "secret-123" not in str(body)


# ══════════════════════════════════════════════════════════════════════
# SUITE 5: COMPOSIO & BUILTIN MCP VERIFICATION (CON-ZT-037 .. CON-ZT-042)
# ══════════════════════════════════════════════════════════════════════

class TestComposioAndBuiltinMcp:
    async def test_con_zt_037_composio_status_returns_catalog(self, client: AsyncClient):
        """CON-ZT-037: GET /connectors/composio/status returns status and supported app catalog."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt037")
        res = await client.get("/api/v1/connectors/composio/status", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert "enabled" in body
        assert "popular_apps" in body
        app_ids = {a["id"] for a in body["popular_apps"]}
        assert {"slack", "notion", "github", "jira"} <= app_ids
        assert body.get("total_apps", 0) >= 250

    async def test_con_zt_037b_composio_apps_endpoint_catalog_and_filtering(self, client: AsyncClient):
        """CON-ZT-037B: GET /connectors/composio/apps lists 250+ enterprise apps and supports category filtering."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt037b")
        # 1. Fetch full catalog
        res = await client.get("/api/v1/connectors/composio/apps", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["total"] >= 250
        assert len(body["apps"]) >= 250
        assert "categories" in body
        assert len(body["categories"]) >= 5

        # 2. Filter by category
        res_cat = await client.get("/api/v1/connectors/composio/apps?category=Sales", headers=headers)
        assert res_cat.status_code == 200
        cat_body = res_cat.json()
        assert cat_body["total"] > 0
        assert all(a["category"].lower() == "sales" for a in cat_body["apps"])

        # 3. Search query
        res_search = await client.get("/api/v1/connectors/composio/apps?search=stripe", headers=headers)
        assert res_search.status_code == 200
        search_body = res_search.json()
        assert any(a["id"] == "stripe" for a in search_body["apps"])

        # 4. Pagination
        res_paginated = await client.get("/api/v1/connectors/composio/apps?limit=10&offset=0", headers=headers)
        assert res_paginated.status_code == 200
        pag_body = res_paginated.json()
        assert len(pag_body["apps"]) == 10
        assert pag_body["total"] >= 250


    async def test_con_zt_038_composio_auth_url_success(self, client: AsyncClient):
        """CON-ZT-038: POST /connectors/composio/auth-url generates OAuth connect URL."""
        headers, _, wid = await _signup_and_get_workspace(client, "zt038")
        res = await client.post(
            "/api/v1/connectors/composio/auth-url",
            json={"app": "slack", "workspace_id": wid},
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["app"] == "slack"
        assert "url" in body
        assert body["workspace_id"] == wid

    async def test_con_zt_039_composio_sync_bridges_tools(self, client: AsyncClient):
        """CON-ZT-039: POST /connectors/composio/sync bridges workspace SaaS tools."""
        headers, _, wid = await _signup_and_get_workspace(client, "zt039")
        res = await client.post(
            "/api/v1/connectors/composio/sync",
            json={"workspace_id": wid},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["workspace_id"] == wid
        assert isinstance(body["registered"], list)
        assert body["count"] == len(body["registered"])

    async def test_con_zt_040_builtin_mcp_catalog(self, client: AsyncClient):
        """CON-ZT-040: GET /connectors/mcp/builtin returns public ATS server definition."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt040")
        res = await client.get("/api/v1/connectors/mcp/builtin", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert "builtin_servers" in body
        servers = body["builtin_servers"]
        ats_server = next((s for s in servers if s["id"] == "job-search-mcp"), None)
        assert ats_server is not None
        assert ats_server["transport"] == "stdio"
        assert "search_public_ats_jobs" in ats_server["tools"]
        assert "fetch_job_details" in ats_server["tools"]

    async def test_con_zt_041_builtin_mcp_search_execution(self):
        """CON-ZT-041: Built-in MCP job search tool executes valid query safely."""
        import json
        from api.mcp_servers.job_search_mcp import search_public_ats_jobs

        with patch("httpx.AsyncClient") as mock_client:
            inst = AsyncMock()
            inst.get = AsyncMock(return_value=MagicMock(
                status_code=200,
                json=lambda: {"jobs": [{"id": "123", "title": "Staff Software Engineer", "location": {"name": "Remote"}}]}
            ))
            mock_client.return_value.__aenter__.return_value = inst

            result_str = await search_public_ats_jobs(company="stripe", ats_provider="greenhouse")
            result = json.loads(result_str)
            assert result.get("company") == "stripe"
            assert "jobs" in result

    async def test_con_zt_042_composio_unauthenticated_rejected(self, client: AsyncClient):
        """CON-ZT-042: Composio endpoints reject unauthenticated access with 401."""
        res_auth = await client.post("/api/v1/connectors/composio/auth-url", json={"app": "slack"})
        assert res_auth.status_code == 401

        res_sync = await client.post("/api/v1/connectors/composio/sync", json={"workspace_id": "dummy"})
        assert res_sync.status_code == 401


# ══════════════════════════════════════════════════════════════════════
# SUITE 6: CONCURRENCY, RATE LIMITING & AUDIT (CON-ZT-043 .. CON-ZT-048)
# ══════════════════════════════════════════════════════════════════════

class TestConcurrencyRateLimitingAndAudit:
    async def test_con_zt_043_sync_concurrency_lock(self, client: AsyncClient, db_session: AsyncSession):
        """CON-ZT-043: Concurrency lock prevents parallel sync runs (returns 'Sync already in progress')."""
        headers, _, _ = await _signup_and_get_workspace(client, "zt043")
        created = await client.post(
            "/api/v1/connectors",
            json={"name": "Conc-Sync", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        cid = created.json()["id"]

        # Manually put connector in "syncing" status in DB
        await db_session.execute(
            text("UPDATE connectors SET status = 'syncing' WHERE id = :id"),
            {"id": cid},
        )
        await db_session.commit()

        # Attempt second sync while first is active
        res = await client.post(f"/api/v1/connectors/{cid}/sync", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "syncing"
        assert "in progress" in (body.get("error") or "").lower()

    async def test_con_zt_044_sync_rate_limiting(self, rate_limited_client: AsyncClient):
        """CON-ZT-044: Rate limiting on POST /connectors/{id}/sync throttles excessive requests."""
        headers, _, _ = await _signup_and_get_workspace(rate_limited_client, "zt044")
        created = await rate_limited_client.post(
            "/api/v1/connectors",
            json={"name": "RL-Sync", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        cid = created.json()["id"]

        responses = []
        with patch("httpx.AsyncClient") as mock_client:
            inst = AsyncMock()
            inst.get = AsyncMock(return_value=MagicMock(status_code=200))
            mock_client.return_value.__aenter__.return_value = inst

            for _ in range(15):
                r = await rate_limited_client.post(f"/api/v1/connectors/{cid}/sync", headers=headers)
                responses.append(r.status_code)

        assert 429 in responses, f"Expected 429 in rate-limited responses, got: {responses}"

    async def test_con_zt_045_test_connection_rate_limiting(self, rate_limited_client: AsyncClient):
        """CON-ZT-045: Rate limiting on POST /connectors/{id}/test throttles excessive requests."""
        headers, _, _ = await _signup_and_get_workspace(rate_limited_client, "zt045")
        created = await rate_limited_client.post(
            "/api/v1/connectors",
            json={"name": "RL-Test", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        cid = created.json()["id"]

        responses = []
        with patch("httpx.AsyncClient") as mock_client:
            inst = AsyncMock()
            inst.get = AsyncMock(return_value=MagicMock(status_code=200))
            mock_client.return_value.__aenter__.return_value = inst

            for _ in range(15):
                r = await rate_limited_client.post(f"/api/v1/connectors/{cid}/test", headers=headers)
                responses.append(r.status_code)

        assert 429 in responses, f"Expected 429 in rate-limited responses, got: {responses}"

    async def test_con_zt_046_mcp_call_rate_limiting(self, rate_limited_client: AsyncClient):
        """CON-ZT-046: Rate limiting on POST /connectors/{id}/mcp/call throttles excessive calls."""
        headers, _, _ = await _signup_and_get_workspace(rate_limited_client, "zt046")
        created = await rate_limited_client.post(
            "/api/v1/connectors",
            json={
                "name": "RL-MCP-Call",
                "type": "mcp",
                "config": {"transport": "stdio", "command": "npx", "args": ["-y", "dummy"]},
            },
            headers=headers,
        )
        cid = created.json()["id"]

        responses = []
        with patch.object(mcp_client_service, "call_tool", new=AsyncMock(return_value={"text": "ok"})):
            for _ in range(15):
                r = await rate_limited_client.post(
                    f"/api/v1/connectors/{cid}/mcp/call",
                    json={"tool_name": "query", "arguments": {}},
                    headers=headers,
                )
                responses.append(r.status_code)

        assert 429 in responses, f"Expected 429 in rate-limited responses, got: {responses}"

    async def test_con_zt_047_audit_event_on_connector_lifecycle(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """CON-ZT-047: Audit records created on connector create, update, and delete."""
        headers, user_id, _ = await _signup_and_get_workspace(client, "zt047")
        create_res = await client.post(
            "/api/v1/connectors",
            json={"name": "Audit-Conn", "type": "rest", "config": {"url": "https://example.com/api"}},
            headers=headers,
        )
        assert create_res.status_code == 201
        cid = create_res.json()["id"]

        # Check create audit event
        res_create = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'connector.create' AND resource_id = :cid"),
            {"cid": cid},
        )
        assert res_create.scalar() >= 1

        # Update
        await client.put(f"/api/v1/connectors/{cid}", json={"name": "Audit-Conn-Updated"}, headers=headers)
        res_update = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'connector.update' AND resource_id = :cid"),
            {"cid": cid},
        )
        assert res_update.scalar() >= 1

        # Delete
        await client.delete(f"/api/v1/connectors/{cid}", headers=headers)
        res_del = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'connector.delete' AND resource_id = :cid"),
            {"cid": cid},
        )
        assert res_del.scalar() >= 1

    async def test_con_zt_048_audit_event_on_mcp_and_composio(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """CON-ZT-048: Audit records created on MCP call and Composio operations."""
        headers, _, wid = await _signup_and_get_workspace(client, "zt048")
        created = await client.post(
            "/api/v1/connectors",
            json={
                "name": "Audit-MCP",
                "type": "mcp",
                "config": {"transport": "stdio", "command": "npx", "args": ["-y", "dummy"]},
            },
            headers=headers,
        )
        cid = created.json()["id"]

        with patch.object(mcp_client_service, "call_tool", new=AsyncMock(return_value={"text": "ok"})):
            call_res = await client.post(
                f"/api/v1/connectors/{cid}/mcp/call",
                json={"tool_name": "query_db", "arguments": {}},
                headers=headers,
            )
            assert call_res.status_code == 200

        res_mcp_audit = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'connector.mcp.call' AND resource_id = :cid"),
            {"cid": cid},
        )
        assert res_mcp_audit.scalar() >= 1

        # Composio auth-url audit
        auth_res = await client.post(
            "/api/v1/connectors/composio/auth-url",
            json={"app": "notion", "workspace_id": wid},
            headers=headers,
        )
        assert auth_res.status_code == 200

        res_comp_audit = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'connector.composio.auth'")
        )
        assert res_comp_audit.scalar() >= 1
