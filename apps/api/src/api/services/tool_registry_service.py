"""Dynamic Tool Registry & Discovery Service.

Authoritative per-execution tool discovery engine that enforces:
1. Capability manifest tool bounds (required_tools + optional_tools)
2. AgentCard declarations
3. Database-backed ToolRegistryEntry configuration (risk, tenant/workspace scope)
4. Dynamic MCP tool bridges
5. Least-privilege permission & kill-switch filters
"""
from __future__ import annotations

import contextlib
import functools
import inspect
import logging
import uuid
from collections.abc import Callable
from typing import Any, get_type_hints

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session_factory
from ..models.registries import ToolRegistryEntry
from ..orchestrator.capability_registry import capability_registry
from ..orchestrator.card_registry import get_agent_card
from ..tools.definitions import ALL_TOOLS, ToolDefinition
from ..tools.executor import dynamic_tool_definitions

logger = logging.getLogger(__name__)


class ToolRegistryService:
    """Enterprise dynamic tool discovery and validation service."""

    async def discover_tools(
        self,
        agent_name: str,
        workspace_id: str | None = None,
        tenant_id: str | None = None,
        user_permissions: list[str] | None = None,
        allow_side_effects: bool = True,
        session: AsyncSession | None = None,
        card: Any | None = None,
        declared_tools: set[str] | list[str] | None = None,
    ) -> list[ToolDefinition]:
        """Dynamically assemble the authorized tool definitions for an agent execution."""
        # 1. Collect declared tool names from Capability Manifests
        manifest_tools: set[str] = set()
        caps = capability_registry.get_by_agent(agent_name)
        for cap in caps:
            manifest_tools.update(cap.required_tools)
            manifest_tools.update(cap.optional_tools)

        # 2. Collect declared tools from AgentCard & agent instance
        card = card or get_agent_card(agent_name)
        card_tools: set[str] = set(card.tools) if (card and getattr(card, "tools", None)) else set()
        declared_set = set(declared_tools or [])

        candidate_names = manifest_tools | card_tools | declared_set

        # If agent has no specific declarations, default to safe read tools
        if not candidate_names:
            candidate_names = {"search_documents"}

        # 3. Fetch tool metadata from built-in ALL_TOOLS
        tools: dict[str, ToolDefinition] = {}
        for name in candidate_names:
            if name in ALL_TOOLS:
                tools[name] = ALL_TOOLS[name]

        # 4. Include MCP Dynamic Tools if available for this workspace
        try:
            mcp_defs = dynamic_tool_definitions()
            for mcp_tool in mcp_defs:
                # Include MCP tools declared in manifest/card or prefixed for agent
                if mcp_tool.name in candidate_names or mcp_tool.name.startswith(f"{agent_name}_"):
                    tools[mcp_tool.name] = mcp_tool
        except Exception as exc:
            logger.debug("MCP dynamic tool discovery skipped: %s", exc)

        # 5. Query DB Tool Registry for overrides & permissions
        ws_uuid = None
        if workspace_id:
            try:
                ws_uuid = uuid.UUID(workspace_id)
            except (ValueError, TypeError):
                ws_uuid = None

        db_inactive_tools: set[str] = set()
        try:
            async def _check_db(s: AsyncSession):
                stmt = select(ToolRegistryEntry).where(
                    ToolRegistryEntry.tool_id.in_(list(tools.keys()))
                )
                if ws_uuid:
                    stmt = stmt.where((ToolRegistryEntry.workspace_id == ws_uuid) | (ToolRegistryEntry.workspace_id.is_(None)))
                rows = await s.execute(stmt)
                for entry in rows.scalars():
                    if not entry.is_active:
                        db_inactive_tools.add(entry.tool_id)

            if session:
                await _check_db(session)
            else:
                async with async_session_factory() as new_session:
                    await _check_db(new_session)
        except Exception as exc:
            logger.debug("DB tool registry check non-fatal fallback: %s", exc)

        # 6. Apply least-privilege filtering
        authorized_tools: list[ToolDefinition] = []
        user_perms_set = set(user_permissions or [])

        for name, tool_def in tools.items():
            # Check DB active status
            if name in db_inactive_tools:
                continue

            # Check side effects
            is_write = "write" in tool_def.category or "execute" in name or "send" in name
            if is_write and not allow_side_effects:
                continue

            # Check permissions if specified
            if user_perms_set and tool_def.required_scope:
                if tool_def.required_scope not in user_perms_set and "*" not in user_perms_set:
                    # Permission denied
                    continue

            authorized_tools.append(tool_def)

        return authorized_tools

    def register_tool(self, tool_def: ToolDefinition) -> None:
        """Register a new in-memory tool definition."""
        ALL_TOOLS[tool_def.name] = tool_def

    def deregister_tool(self, tool_name: str) -> None:
        """Remove a tool from runtime registry."""
        ALL_TOOLS.pop(tool_name, None)


# Global singleton instance
tool_registry_service = ToolRegistryService()


def register_tool(
    name_or_fn: str | Callable[..., Any] | None = None,
    name: str | None = None,
    description: str | None = None,
    category: str = "general",
    required_scope: str = "tools.execute",
    risk_class: str = "LOW",
    trust_class: str = "first_party",
):
    """Declarative decorator for dynamic tool registration.

    Inspects function signature and type hints, builds an MCP-compliant ToolDefinition,
    and registers into ALL_TOOLS and TOOL_DISPATCH. Supports:
    - @register_tool
    - @register_tool()
    - @register_tool("custom_name")
    - @register_tool(name="custom_name", category="memory_read")
    """
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        tool_name = name or (name_or_fn if isinstance(name_or_fn, str) else None) or fn.__name__
        tool_desc = (description or fn.__doc__ or f"Execute {tool_name}").strip()

        # Build schema from signature & type hints
        sig = inspect.signature(fn)
        type_hints: dict[str, Any] = {}
        with contextlib.suppress(Exception):
            type_hints = get_type_hints(fn)

        properties: dict[str, Any] = {}
        required: list[str] = []

        type_map = {
            str: "string",
            int: "integer",
            float: "number",
            bool: "boolean",
            list: "array",
            dict: "object",
        }

        # Check if signature expects raw (params, workspace_id=None)
        params_list = list(sig.parameters.values())
        is_raw_params = (
            len(params_list) >= 1
            and params_list[0].name in ("params", "args", "payload")
            and (len(params_list) == 1 or params_list[1].name in ("workspace_id", "ws_id"))
        )

        if not is_raw_params:
            for param_name, param in sig.parameters.items():
                if param_name in ("self", "cls", "workspace_id", "ws_id", "context"):
                    continue
                hint = type_hints.get(param_name, param.annotation)
                json_type = "string"
                if hint in type_map:
                    json_type = type_map[hint]
                elif getattr(hint, "__origin__", None) in type_map:
                    json_type = type_map[hint.__origin__]

                prop_def: dict[str, Any] = {"type": json_type}
                if param.default is not inspect.Parameter.empty:
                    prop_def["default"] = param.default
                else:
                    required.append(param_name)
                properties[param_name] = prop_def

        input_schema = {
            "type": "object",
            "properties": properties,
            "required": required,
        }
        output_schema = {"type": "object"}

        td = ToolDefinition(
            name=tool_name,
            description=tool_desc,
            input_schema=input_schema,
            output_schema=output_schema,
            required_scope=required_scope,
            category=category,
            trust_class=trust_class,
        )

        # 1. Register in ALL_TOOLS
        ALL_TOOLS[tool_name] = td

        # 2. Build dispatch adapter
        @functools.wraps(fn)
        async def tool_handler(params: dict[str, Any], workspace_id: Any = None) -> Any:
            try:
                if is_raw_params:
                    res = fn(params, workspace_id) if len(params_list) >= 2 else fn(params)
                else:
                    call_kwargs = dict(params)
                    if "workspace_id" in sig.parameters:
                        call_kwargs["workspace_id"] = workspace_id
                    elif "ws_id" in sig.parameters:
                        call_kwargs["ws_id"] = workspace_id
                    res = fn(**call_kwargs)

                if inspect.iscoroutine(res):
                    res = await res

                if isinstance(res, dict) and "status" in res:
                    return res
                return {
                    "status": "success",
                    "tool": tool_name,
                    "result": res,
                }
            except Exception as exc:
                logger.warning("Error in dynamic tool %s: %s", tool_name, exc)
                return {
                    "status": "error",
                    "tool": tool_name,
                    "result": str(exc),
                    "error_code": "TOOL_EXECUTION_FAILED",
                }

        # 3. Register in executor
        from ..tools.executor import TOOL_DISPATCH, register_dynamic_tool
        TOOL_DISPATCH[tool_name] = tool_handler
        register_dynamic_tool(td, tool_handler)

        return fn

    if callable(name_or_fn):
        return decorator(name_or_fn)
    return decorator
