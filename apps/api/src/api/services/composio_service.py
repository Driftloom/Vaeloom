"""Enterprise Composio SaaS Integration Service.

Connects Vaeloom autonomous agents with Composio's tool catalog
(GitHub, Slack, Jira, Notion, Linear, Salesforce, Google Calendar, etc.).

Handles:
1. Workspace-scoped entity mapping (entity_id = str(workspace_id))
2. OAuth connection initiation and status checks
3. Live tool execution with fail-closed diagnostics (COMPOSIO_API_KEY_REQUIRED, COMPOSIO_AUTH_REQUIRED)
"""

import logging
import os
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger(__name__)


class ComposioService:
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self.base_url = os.environ.get("COMPOSIO_BASE_URL", "https://backend.composio.dev/api/v1")

    @property
    def api_key(self) -> Optional[str]:
        if self._api_key is not None:
            return self._api_key
        return os.environ.get("COMPOSIO_API_KEY")

    @property
    def is_configured(self) -> bool:
        k = self.api_key
        return bool(k and k.strip())

    @property
    def is_enabled(self) -> bool:
        return self.is_configured

    async def initiate_connection(
        self,
        workspace_id: uuid.UUID,
        user_id: uuid.UUID,
        app_name: str,
        redirect_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Initiate OAuth connection flow for a Composio app."""
        if not self.is_configured:
            logger.info("Composio API key not configured; returning setup instructions for app %s", app_name)
            return {
                "status": "error",
                "error_code": "COMPOSIO_API_KEY_REQUIRED",
                "message": "Composio API key is not configured. Add COMPOSIO_API_KEY to your environment or Infisical vault to connect live SaaS apps.",
                "app": app_name,
                "auth_url": None,
                "connection_status": "unconfigured",
            }

        try:
            import httpx

            entity_id = f"workspace_{workspace_id}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                }
                payload = {
                    "appName": app_name.lower(),
                    "entityId": entity_id,
                    "redirectUrl": redirect_url or f"https://vaeloom.app/workspace/{workspace_id}/marketplace?connected={app_name}",
                }
                resp = await client.post(
                    f"{self.base_url}/connectedAccounts",
                    headers=headers,
                    json=payload,
                )

                if resp.is_success:
                    data = resp.json()
                    logger.info("Composio OAuth flow initiated: app=%s workspace=%s", app_name, workspace_id)
                    return {
                        "status": "success",
                        "app": app_name,
                        "connection_id": data.get("connectionId") or data.get("id"),
                        "auth_url": data.get("redirectUrl") or data.get("connectionUrl"),
                        "connection_status": data.get("status", "initiating"),
                    }
                else:
                    logger.warning("Composio API returned error (%d): %s", resp.status_code, resp.text)
                    return {
                        "status": "error",
                        "error_code": "COMPOSIO_API_ERROR",
                        "message": f"Composio connection initiation failed: {resp.text}",
                        "app": app_name,
                        "auth_url": None,
                    }
        except Exception as exc:
            logger.error("Exception during Composio connection initiation: %s", exc)
            return {
                "status": "error",
                "error_code": "COMPOSIO_CONNECTION_FAILED",
                "message": str(exc),
                "app": app_name,
                "auth_url": None,
            }

    async def get_connection_status(
        self,
        workspace_id: uuid.UUID,
        app_name: str,
    ) -> Dict[str, Any]:
        """Check if an app is connected and authenticated for this workspace."""
        if not self.is_configured:
            return {
                "connected": False,
                "status": "unconfigured",
                "app": app_name,
                "error_code": "COMPOSIO_API_KEY_REQUIRED",
            }

        try:
            import httpx

            entity_id = f"workspace_{workspace_id}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {"x-api-key": self.api_key}
                resp = await client.get(
                    f"{self.base_url}/connectedAccounts",
                    headers=headers,
                    params={"entityId": entity_id, "appName": app_name.lower()},
                )
                if resp.is_success:
                    data = resp.json()
                    accounts = data.get("items", []) if isinstance(data, dict) else data
                    is_active = any(acc.get("status") == "ACTIVE" for acc in accounts)
                    return {
                        "connected": is_active,
                        "status": "active" if is_active else "inactive",
                        "app": app_name,
                        "accounts_count": len(accounts),
                    }
                return {"connected": False, "status": "unknown", "app": app_name}
        except Exception as exc:
            logger.debug("Error checking Composio connection status: %s", exc)
            return {"connected": False, "status": "error", "error": str(exc), "app": app_name}

    async def execute_composio_action(
        self,
        workspace_id: uuid.UUID,
        app_name: str,
        action_name: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a Composio tool action on behalf of a workspace."""
        if not self.is_configured:
            return {
                "status": "error",
                "error_code": "COMPOSIO_API_KEY_REQUIRED",
                "message": "Composio API key is required to execute Composio actions.",
            }

        try:
            import httpx

            entity_id = f"workspace_{workspace_id}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                }
                payload = {
                    "entityId": entity_id,
                    "appName": app_name.lower(),
                    "actionName": action_name,
                    "parameters": params,
                }
                resp = await client.post(
                    f"{self.base_url}/actions/execute",
                    headers=headers,
                    json=payload,
                )
                if resp.status_code == 401 or resp.status_code == 403:
                    return {
                        "status": "error",
                        "error_code": "COMPOSIO_AUTH_REQUIRED",
                        "message": f"Authentication required for Composio app '{app_name}'. Please connect the app in Marketplace.",
                    }
                if resp.is_success:
                    return {"status": "success", "result": resp.json()}
                return {
                    "status": "error",
                    "error_code": "COMPOSIO_EXECUTION_ERROR",
                    "message": resp.text,
                }
        except Exception as exc:
            logger.error("Error executing Composio action: %s", exc)
            return {
                "status": "error",
                "error_code": "COMPOSIO_EXECUTION_FAILED",
                "message": str(exc),
            }

    def get_auth_url(
        self,
        app_name: str,
        workspace_id: str,
        redirect_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synchronous helper to retrieve an auth URL or unconfigured error."""
        if not self.is_configured:
            return {
                "status": "error",
                "error_code": "COMPOSIO_API_KEY_REQUIRED",
                "message": "Composio API key is not configured. Add COMPOSIO_API_KEY to your environment or Infisical vault to connect live SaaS apps.",
                "app": app_name,
                "auth_url": None,
                "connection_status": "unconfigured",
            }
        try:
            ws_uuid = uuid.UUID(str(workspace_id))
        except (ValueError, TypeError):
            ws_uuid = uuid.uuid4()
        entity_id = f"workspace_{ws_uuid}"
        redirect = redirect_url or f"https://vaeloom.app/workspace/{ws_uuid}/marketplace?connected={app_name}"
        connect_url = f"{self.base_url}/apps/{app_name.lower()}/connect?entityId={entity_id}&redirectUrl={redirect}"
        return {
            "status": "success",
            "app": app_name,
            "auth_url": connect_url,
            "url": connect_url,
            "workspace_id": str(ws_uuid),
            "connection_status": "initiating",
        }

    def bridge_workspace_tools(self, workspace_id: str) -> List[str]:
        """Discover and bridge workspace SaaS tools from Composio into dynamic executor."""
        from ..tools.definitions import ToolDefinition
        from ..tools.executor import mark_approval_gated, register_dynamic_tool

        if not self.is_configured:
            return []

        popular_tools = [
            ("slack", "send_message", "Send Slack message to a channel", False),
            ("slack", "read_channel", "Read messages from a Slack channel", True),
            ("github", "create_issue", "Create a GitHub issue", False),
            ("github", "list_issues", "List GitHub issues", True),
            ("notion", "search_pages", "Search Notion workspace pages", True),
            ("notion", "create_page", "Create a new Notion page", False),
            ("jira", "create_ticket", "Create a Jira ticket", False),
            ("jira", "list_tickets", "List Jira tickets", True),
        ]
        registered: List[str] = []
        for app, action, desc, is_read in popular_tools:
            tool_name = f"composio__{app}__{action}"
            td = ToolDefinition(
                name=tool_name,
                description=f"[Composio:{app}] {desc}",
                input_schema={"type": "object"},
                output_schema={"type": "object"},
                required_scope="connector.composio.execute",
                category="connector_read" if is_read else "connector_write",
                trust_class="composio.read" if is_read else "composio.workspace.write",
            )

            def make_handler(_app=app, _action=action):
                async def handler(params: Dict[str, Any], wid: str) -> Dict[str, Any]:
                    try:
                        w_uuid = uuid.UUID(str(wid))
                    except (ValueError, TypeError):
                        w_uuid = uuid.uuid4()
                    return await self.execute_composio_action(w_uuid, _app, _action, params)
                return handler

            register_dynamic_tool(td, make_handler())
            if not is_read:
                mark_approval_gated(tool_name)
            registered.append(tool_name)
        return registered


composio_service = ComposioService()
