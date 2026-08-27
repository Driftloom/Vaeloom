"""
MCP Client Service — native Python Model Context Protocol integration.

Connects Vaeloom agents to external MCP servers (Browser, Postgres/pgvector,
Google Workspace, Obsidian, ...) declared as `mcp`-type external connectors.

Design:
- Official `mcp` SDK for transports: stdio (subprocess) + streamable HTTP.
- One-shot sessions per operation (servers stay stateless from our side);
  discovery results cached per connector with TTL.
- Tool bridging: discovered tools register into the tool executor's dynamic
  registry as `mcp__<server>__<tool>` with scope `connector.mcp.execute`.
  Tools whose server does not hint readOnly are approval-gated.
- Multi-tenancy enforced at CALL time: the handler loads the connector row and
  rejects execution if it does not belong to the calling workspace.

Fail-closed everywhere: invalid configs rejected at create/update; transport
errors surface as error results, never silent success.
"""
import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException

from .connector_ext_service import connector_ext_service

logger = logging.getLogger(__name__)

DISCOVERY_TTL_S = 300.0
CALL_TIMEOUT_S = 30.0
CONNECT_TIMEOUT_S = 10.0

# Shell interpreters are never allowed as MCP stdio commands — argv only.
_DENIED_COMMANDS = {"sh", "bash", "dash", "zsh", "cmd", "cmd.exe", "powershell",
                    "powershell.exe", "pwsh", "pwsh.exe"}
# P2-41: include cmd.exe-active metachars ^ % ! (batch-wrapper expansion)
_SHELL_METACHARS = re.compile(r"[;&|`$><\n\r^%!]")
_MAX_STRUCTURED_CHARS = 20_000
_MAX_ARGS_CHARS = 20_000
_NAME_SLUG_RE = re.compile(r"[^a-zA-Z0-9_-]")


def slugify(text: str, fallback: str = "server") -> str:
    cleaned = _NAME_SLUG_RE.sub("-", (text or "").strip())[:60].strip("-")
    return cleaned or fallback


@dataclass
class McpToolInfo:
    name: str
    description: str = ""
    input_schema: dict = field(default_factory=dict)
    read_only_hint: bool = False


class McpConfigError(ValueError):
    """Invalid MCP connector configuration."""


class McpTransportError(RuntimeError):
    """Server could not be reached / protocol failure."""


def validate_mcp_config(config: dict) -> dict:
    """Validate an mcp connector config; returns normalized copy."""
    cfg = dict(config or {})
    transport = cfg.get("transport")
    if transport not in ("stdio", "http"):
        raise McpConfigError("mcp config requires transport: 'stdio' | 'http'")

    if transport == "stdio":
        command = cfg.get("command")
        if not command or not isinstance(command, str):
            raise McpConfigError("stdio transport requires a 'command' string")
        base = command.strip().strip('"').lower().replace("\\", "/").split("/")[-1]
        if base in _DENIED_COMMANDS:
            raise McpConfigError(f"Shell interpreter '{base}' is not allowed as MCP command")
        args = cfg.get("args", [])
        if not isinstance(args, list) or not all(isinstance(a, str) for a in args):
            raise McpConfigError("'args' must be a list of strings")
        for part in [command] + args:
            if _SHELL_METACHARS.search(part):
                raise McpConfigError("Shell metacharacters are not allowed in command/args")
        env = cfg.get("env", {})
        if not isinstance(env, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in env.items()
        ):
            raise McpConfigError("'env' must be a dict of strings")
    else:  # http
        url = cfg.get("url") or ""
        parsed = urlparse(url)
        insecure = bool(cfg.get("allow_insecure"))
        if parsed.scheme == "http" and not insecure:
            raise McpConfigError("http:// URLs require allow_insecure=true (dev only)")
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise McpConfigError("http transport requires a valid 'url'")
        headers = cfg.get("headers", None)
        if headers is not None:
            if not isinstance(headers, dict) or not all(
                isinstance(k, str) and isinstance(v, str) for k, v in headers.items()
            ):
                raise McpConfigError("'headers' must be a dict of strings")
            # Validate header names are plausible (RFC 7230 token)
            _hdr_name_re = re.compile(r"^[A-Za-z0-9!#$%&'*+.\-^_`|~]+$")
            for hk, hv in headers.items():
                if not _hdr_name_re.match(hk):
                    raise McpConfigError(f"Invalid header name: {hk!r}")
                if "\n" in hv or "\r" in hv:
                    raise McpConfigError(f"Header value for {hk!r} contains line break")
                if len(hv) > 4096:
                    raise McpConfigError(f"Header value for {hk!r} too large")
            # Also reject shell metachars in values? Bearer tokens are safe alphanum
            # but we enforce size bound only — tokens may contain -. Underscore.
        # also handle env for http (optional)
        env = cfg.get("env", None)
        if env is not None:
            if not isinstance(env, dict) or not all(
                isinstance(k, str) and isinstance(v, str) for k, v in env.items()
            ):
                raise McpConfigError("'env' must be a dict of strings for http transport")
    return cfg


class _McpClientService:
    def __init__(self) -> None:
        self._discovery_cache: dict[str, tuple[float, list[McpToolInfo]]] = {}

    # ── Session plumbing ──────────────────────────────────────────────
    # Minimal parent-env allowlist passed to stdio servers — never leak
    # JWT secrets / encryption keys to third-party server processes.
    _ALLOWED_PARENT_ENV = (
        "PATH", "PATHEXT", "SYSTEMROOT", "SYSTEMDRIVE", "COMSPEC", "TEMP",
        "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
        "PROGRAMFILES", "PROGRAMFILES(X86)", "LANG", "TZ", "TERM",
    )

    @classmethod
    def _server_params(cls, cfg: dict):
        import os

        from mcp import StdioServerParameters

        command = cls._resolve_command(cfg["command"])
        merged_env = {k: os.environ[k] for k in cls._ALLOWED_PARENT_ENV if k in os.environ}
        merged_env.update(cfg.get("env") or {})
        return StdioServerParameters(
            command=command, args=list(cfg.get("args") or []), env=merged_env,
        )

    @staticmethod
    def _resolve_command(command: str) -> str:
        """Resolve bare executable names on PATH; wrap .cmd/.bat in cmd.exe.

        Windows CreateProcess will not execute .cmd/.bat directly (npx!,
        uvx!), so they need `cmd.exe /c`. argv stays validated (no shell
        metacharacters) before this wrapping.
        """
        resolved = command
        has_sep = ("/" in command) or ("\\" in command)
        if not has_sep:
            import shutil as _shutil

            resolved = _shutil.which(command) or command
        lower = resolved.lower()
        if lower.endswith((".cmd", ".bat")):
            return "cmd.exe"
        return resolved

    @staticmethod
    def _stdio_argv(cfg: dict) -> list[str]:
        """Full argv for Windows batch wrappers (command becomes an arg)."""
        import shutil

        command = cfg["command"]
        resolved = command if ("/" in command or "\\" in command) else (shutil.which(command) or command)
        if resolved.lower().endswith((".cmd", ".bat")):
            return [resolved, *list(cfg.get("args") or [])]
        return list(cfg.get("args") or [])

    @staticmethod
    def _validate_command(command: str) -> None:
        base = command.strip().lower().replace("\\", "/").split("/")[-1]
        if base in _DENIED_COMMANDS:
            raise McpConfigError(f"Shell interpreter '{base}' is not allowed")

    async def _run_with_session(self, cfg: dict, operation):
        from mcp import ClientSession, StdioServerParameters

        if cfg.get("transport") == "stdio":
            self._validate_command(cfg["command"])
            import os

            from mcp.client.stdio import stdio_client

            params = StdioServerParameters(
                command=self._resolve_command(cfg["command"]),
                args=self._stdio_argv(cfg),
                env={k: os.environ[k] for k in self._ALLOWED_PARENT_ENV if k in os.environ}
                | dict(cfg.get("env") or {}),
            )
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    return await operation(session)
        else:
            from mcp.client.streamable_http import streamable_http_client

            headers = cfg.get("headers")
            if headers:
                from mcp.shared._httpx_utils import create_mcp_http_client

                async with create_mcp_http_client(headers=headers) as http_client:
                    async with streamable_http_client(cfg["url"], http_client=http_client) as streams:
                        read, write = streams[0], streams[1]
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            return await operation(session)
            else:
                async with streamable_http_client(cfg["url"]) as streams:
                    read, write = streams[0], streams[1]
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        return await operation(session)

    # ── Connector access ──────────────────────────────────────────────
    async def _load_mcp_connector(self, connector_id, tenant_id: str | None, db) -> tuple[Any, dict]:
        data = await connector_ext_service.get_decrypted(connector_id, tenant_id, db)
        if data["type"] != "mcp":
            raise HTTPException(400, f"Connector {connector_id} is not an MCP connector")
        try:
            cfg = validate_mcp_config(data["config"])
        except McpConfigError as e:
            raise HTTPException(400, f"Invalid MCP config: {e}") from e
        return data, cfg

    # ── Discovery ─────────────────────────────────────────────────────
    async def list_tools(self, connector_id, tenant_id: str | None, db,
                         refresh: bool = False) -> list[dict]:
        key = str(connector_id)
        if not refresh:
            cached = self._discovery_cache.get(key)
            if cached and (time.monotonic() - cached[0]) < DISCOVERY_TTL_S:
                return [
                    {"name": t.name, "description": t.description,
                     "input_schema": t.input_schema, "read_only_hint": t.read_only_hint}
                    for t in cached[1]
                ]

        _data, cfg = await self._load_mcp_connector(connector_id, tenant_id, db)

        async def op(session):
            result = await session.list_tools()
            tools = []
            for t in result.tools:
                hints = getattr(t, "annotations", None)
                ro = bool(getattr(hints, "readOnlyHint", False)) if hints else False
                tools.append(McpToolInfo(
                    name=t.name,
                    description=t.description or "",
                    input_schema=t.inputSchema or {"type": "object"},
                    read_only_hint=ro,
                ))
            return tools

        try:
            tools = await asyncio.wait_for(
                self._run_with_session(cfg, op), timeout=CONNECT_TIMEOUT_S + 5,
            )
        except (McpConfigError, HTTPException):
            raise
        except TimeoutError as e:
            raise McpTransportError(f"MCP server timed out during discovery ({CONNECT_TIMEOUT_S}s)") from e
        except Exception as e:
            raise McpTransportError(f"MCP discovery failed: {e}") from e

        self._discovery_cache[key] = (time.monotonic(), tools)
        return [
            {"name": t.name, "description": t.description,
             "input_schema": t.input_schema, "read_only_hint": t.read_only_hint}
            for t in tools
        ]

    def invalidate_cache(self, connector_id) -> None:
        self._discovery_cache.pop(str(connector_id), None)

    # ── Invocation ────────────────────────────────────────────────────
    async def call_tool(self, connector_id, tool_name: str, arguments: dict | None,
                        tenant_id: str | None, db) -> dict:
        # P2-42: bound arguments size to prevent context blowout
        if arguments is not None:
            import json as _json

            try:
                _args_json = _json.dumps(arguments, ensure_ascii=False)
            except (TypeError, ValueError) as exc:
                raise HTTPException(400, f"Invalid MCP arguments: {exc}") from exc
            if len(_args_json) > _MAX_ARGS_CHARS:
                raise HTTPException(400, f"MCP arguments too large ({len(_args_json)} > {_MAX_ARGS_CHARS})")
        _data, cfg = await self._load_mcp_connector(connector_id, tenant_id, db)

        async def op(session):
            return await session.call_tool(tool_name, arguments or {})

        try:
            result = await asyncio.wait_for(
                self._run_with_session(cfg, op), timeout=CALL_TIMEOUT_S + 5,
            )
        except (McpConfigError, HTTPException):
            raise
        except TimeoutError as e:
            raise McpTransportError(f"MCP tool '{tool_name}' timed out after {CALL_TIMEOUT_S}s") from e
        except Exception as e:
            raise McpTransportError(f"MCP tool call failed: {e}") from e

        text_parts: list[str] = []
        structured = getattr(result, "structuredContent", None)
        for item in getattr(result, "content", []) or []:
            kind = getattr(item, "type", "")
            if kind == "text":
                text_parts.append(getattr(item, "text", ""))
            elif kind == "resource":
                uri = str(getattr(item, "uri", ""))
                text_parts.append(f"[resource:{uri}]")
            else:
                text_parts.append(f"[{kind or 'unknown'} content]")
        is_error = bool(getattr(result, "isError", False))
        payload: dict[str, Any] = {
            "tool": tool_name,
            "text": "\n".join(p for p in text_parts if p)[:_MAX_STRUCTURED_CHARS],
            "is_error": is_error,
        }
        if structured is not None:
            # P2-42: cap structuredContent to same budget as text
            try:
                import json as _json2

                _s = _json2.dumps(structured, ensure_ascii=False)
                if len(_s) > _MAX_STRUCTURED_CHARS:
                    # Truncate and mark; keep as string to avoid broken JSON shape
                    payload["structured"] = _s[:_MAX_STRUCTURED_CHARS] + "...[truncated]"
                    payload["structured_truncated"] = True
                else:
                    payload["structured"] = structured
            except Exception:
                payload["structured"] = str(structured)[:_MAX_STRUCTURED_CHARS]
        return payload

    # ── Health ────────────────────────────────────────────────────────
    async def test_connection(self, connector_id, tenant_id: str | None, db) -> dict:
        try:
            tools = await self.list_tools(connector_id, tenant_id, db, refresh=True)
            return {"status": "ok", "tools": len(tools)}
        except McpTransportError as e:
            return {"status": "failed", "error": str(e)}

    # ── Bridging into the tool executor ──────────────────────────────
    async def bridge_connector_tools(self, connector_id, tenant_id: str | None, db) -> list[str]:
        """Discover tools and register them into the executor's dynamic registry.

        Returns the list of registered namespaced tool names.
        """
        from ..tools.executor import mark_approval_gated, register_dynamic_tool

        connector_row = await connector_ext_service.get(connector_id, tenant_id, db)
        server_slug = slugify(connector_row.name)
        data = await self.list_tools(connector_id, tenant_id, db, refresh=True)

        registered: list[str] = []
        for t in data:
            bridged_name = f"mcp__{server_slug}__{slugify(t['name'])}"
            td = _make_tool_definition(bridged_name, server_slug, t)

            def make_handler(cid=connector_id, orig=t["name"]):
                async def handler(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
                    return await self._execute_bridged(cid, orig, params, workspace_id, tenant_id)
                return handler

            register_dynamic_tool(td, make_handler())
            if not t["read_only_hint"]:
                mark_approval_gated(bridged_name)
            registered.append(bridged_name)
        return registered

    async def _execute_bridged(self, connector_id, tool_name: str,
                               params: dict[str, Any], workspace_id: str,
                               tenant_id: str | None) -> dict[str, Any]:
        """Handler body for bridged tools: enforce workspace ownership, execute."""
        from ..database import async_session_factory

        async with async_session_factory() as session:
            connector = await connector_ext_service.get(connector_id, tenant_id, session)
            if str(connector.workspace_id) != str(workspace_id):
                return {
                    "status": "error",
                    "tool": tool_name,
                    "result": f"MCP server not available to workspace {workspace_id}",
                }
            try:
                out = await self.call_tool(connector_id, tool_name, params, tenant_id, session)
            except McpTransportError as e:
                return {"status": "error", "tool": tool_name, "result": str(e)}
        return {
            "status": "error" if out.get("is_error") else "success",
            "tool": tool_name,
            "result": out.get("text") or out.get("structured") or "",
        }


def _make_tool_definition(bridged_name: str, server_slug: str, t: dict):
    from ..tools.definitions import ToolDefinition

    return ToolDefinition(
        name=bridged_name,
        description=f"[MCP:{server_slug}] {t.get('description') or t['name']}"[:300],
        input_schema=t.get("input_schema") or {"type": "object"},
        output_schema={"type": "object"},
        required_scope="connector.mcp.execute",
        category="connector_read" if t.get("read_only_hint") else "connector_write",
    )


# Re-export for the ReAct loop / admin routes
def get_bridge_definitions() -> dict[str, Any]:
    """Namespaced ToolDefinitions currently bridged (delegates to executor)."""
    from ..tools.executor import dynamic_tool_definitions

    return dynamic_tool_definitions()


mcp_client_service = _McpClientService()
