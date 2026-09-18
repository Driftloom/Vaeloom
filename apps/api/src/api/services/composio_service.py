"""Composio SaaS Gateway Service for Vaeloom.

Bridges 250+ SaaS tools (Slack, Notion, GitHub, LinkedIn, Jira, Linear, etc.)
directly into Vaeloom's dynamic agent tool registry, with full multi-tenancy
scoped by mapping Vaeloom `workspace_id` to Composio `entity_id`.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from ..config import settings
from ..tools.definitions import ToolDefinition
from ..tools.executor import mark_approval_gated, register_dynamic_tool

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"[^a-zA-Z0-9_-]")


def _slugify(text: str) -> str:
    return _SLUG_RE.sub("_", (text or "").strip()).lower()[:60]


class ComposioService:
    """Manages SaaS tool integration through Composio with per-workspace isolation."""

    def __init__(self, api_key: str | None = None) -> None:
        if api_key is not None:
            self._api_key = api_key
        else:
            self._api_key = (
                os.environ.get("COMPOSIO_API_KEY")
                or getattr(settings, "composio_api_key", "")
                or ""
            )
        self._client: Any = None
        self._initialized = False

    @property
    def is_enabled(self) -> bool:
        return bool(self._api_key and str(self._api_key).strip())

    def _get_client(self) -> Any | None:
        if not self.is_enabled:
            return None
        if self._client is not None:
            return self._client
        try:
            from composio import Composio

            self._client = Composio(api_key=self._api_key)
            return self._client
        except ImportError:
            logger.debug("composio SDK not installed; composio integration disabled")
            return None
        except Exception as e:
            logger.warning("Failed to initialize Composio client: %s", e)
            return None

    def get_auth_url(self, app_name: str, workspace_id: str) -> dict[str, Any]:
        """Generate an OAuth authorization link for a workspace user to connect a SaaS tool."""
        if not self.is_enabled:
            return {
                "status": "error",
                "message": "Composio is not enabled. Set COMPOSIO_API_KEY in .env",
            }
        client = self._get_client()
        if not client:
            return {
                "status": "error",
                "message": "Composio SDK unavailable",
            }
        try:
            if hasattr(client, "toolkits"):
                auth_resp = client.toolkits.authorize(
                    user_id=str(workspace_id),
                    toolkit=app_name.lower(),
                )
                redirect_url = (
                    getattr(auth_resp, "redirect_url", None)
                    or getattr(auth_resp, "url", None)
                    or getattr(auth_resp, "redirectUrl", "")
                )
                connection_id = (
                    getattr(auth_resp, "connection_id", None)
                    or getattr(auth_resp, "connected_account_id", "")
                    or getattr(auth_resp, "id", "")
                )
                return {
                    "status": "success",
                    "app": app_name,
                    "redirect_url": str(redirect_url or ""),
                    "connection_id": str(connection_id or ""),
                }
            elif hasattr(client, "initiate_connection"):
                conn_req = client.initiate_connection(app=app_name.upper())
                return {
                    "status": "success",
                    "app": app_name,
                    "redirect_url": getattr(conn_req, "redirectUrl", None) or getattr(conn_req, "url", ""),
                    "connection_id": getattr(conn_req, "connectedAccountId", ""),
                }
            return {
                "status": "error",
                "message": "Unsupported Composio client interface",
            }
        except Exception as e:
            logger.warning("Composio initiate_connection failed: %s", e)
            msg = str(e)
            if "401" in msg or "Invalid API key" in msg:
                return {
                    "status": "error",
                    "message": "Composio Authentication Failed: The configured COMPOSIO_API_KEY was rejected as invalid by Composio. Please check your API key in dashboard.composio.dev.",
                }
            return {"status": "error", "message": msg}

    def bridge_workspace_tools(self, workspace_id: str, app_names: list[str] | None = None) -> list[str]:
        """Discover connected apps for this workspace and register tools into dynamic executor."""
        if not self.is_enabled:
            return []

        client = self._get_client()
        if not client:
            return []

        registered_names: list[str] = []
        try:
            if hasattr(client, "tools") and hasattr(client.tools, "get"):
                apps = [a.lower() for a in (app_names or ["slack", "notion", "github"])]
                composio_tools = client.tools.get(user_id=str(workspace_id), toolkits=apps)
            elif hasattr(client, "get_tools"):
                apps = app_names or ["SLACK", "NOTION", "GITHUB", "LINKEDIN"]
                composio_tools = client.get_tools(apps=apps)
            else:
                composio_tools = []

            for tool in composio_tools:
                raw_name = getattr(tool, "slug", None) or getattr(tool, "name", None) or str(tool)
                app_prefix = _slugify(raw_name.split("_")[0]) if "_" in raw_name else "app"
                tool_slug = _slugify(raw_name)
                bridged_name = f"composio__{app_prefix}__{tool_slug}"

                description = getattr(tool, "description", "") or f"[Composio:{app_prefix}] {raw_name}"
                schema = getattr(tool, "parameters", None) or getattr(tool, "input_schema", None) or {"type": "object"}

                # Classify write vs read for approval gating
                is_read = any(kw in raw_name.lower() for kw in ("get", "list", "fetch", "search", "read"))
                category = "connector_read" if is_read else "connector_write"
                trust_class = "composio.read" if is_read else "composio.workspace.write"

                td = ToolDefinition(
                    name=bridged_name,
                    description=str(description)[:300],
                    input_schema=schema if isinstance(schema, dict) else {},
                    output_schema={"type": "object"},
                    required_scope="connector.composio.execute",
                    category=category,
                    trust_class=trust_class,
                )

                def make_handler(action_id=raw_name, wid=workspace_id):
                    async def handler(params: dict[str, Any], call_workspace_id: str) -> dict[str, Any]:
                        return await self.execute_action(action_id, params, call_workspace_id or wid)
                    return handler

                register_dynamic_tool(td, make_handler())
                if not is_read:
                    mark_approval_gated(bridged_name)
                registered_names.append(bridged_name)

            logger.info("Composio: bridged %d tools for workspace %s", len(registered_names), workspace_id)
        except Exception as e:
            logger.debug("Composio tool bridging skipped: %s", e)

        return registered_names

    async def execute_action(self, action_name: str, params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
        """Execute a Composio action scoped to the workspace entity_id."""
        if not self.is_enabled:
            return {"status": "error", "error": "Composio is not enabled"}

        client = self._get_client()
        if not client:
            return {"status": "error", "error": "Composio client unavailable"}

        try:
            if hasattr(client, "tools") and hasattr(client.tools, "execute"):
                result = client.tools.execute(
                    slug=action_name,
                    arguments=params,
                    user_id=str(workspace_id),
                )
            elif hasattr(client, "execute_action"):
                result = client.execute_action(
                    action=action_name,
                    params=params,
                    entity_id=str(workspace_id),
                )
            else:
                return {"status": "error", "error": "Unsupported Composio execute method"}

            return {
                "status": "success",
                "action": action_name,
                "result": result if isinstance(result, (dict, list, str)) else str(result),
            }
        except Exception as e:
            logger.error("Composio action %s failed: %s", action_name, e)
            return {"status": "error", "action": action_name, "error": str(e)}


composio_service = ComposioService()
