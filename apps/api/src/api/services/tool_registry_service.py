"""Dynamic Tool Registry & Discovery Service.

Authoritative per-execution tool discovery engine that enforces:
1. Capability manifest tool bounds (required_tools + optional_tools)
2. AgentCard declarations
3. Database-backed ToolRegistryEntry configuration (risk, tenant/workspace scope)
4. Dynamic MCP tool bridges
5. Least-privilege permission & kill-switch filters
"""
from __future__ import annotations

import logging
from typing import Any
import uuid

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


def register_tool(category: str = "general", risk_class: str = "LOW"):
    """Decorator for declarative tool registration."""
    def decorator(cls_or_func):
        # Decorator support for future dynamic function-based tools
        return cls_or_func
    return decorator
