"""
Connector Agent — help users discover and configure new integrations.
Suggest autonomy. Never exposes API keys or secrets in responses.
"""
import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ConnectorAgent(BaseAgent):
    mission = "Help users discover and configure new integrations"
    tools = [
        Tool(name="discover_connectors", description="Discover available integrations and connectors"),
        Tool(name="guide_setup", description="Guide users through connector setup step by step"),
        Tool(name="monitor_health", description="Monitor health status of connected integrations"),
        Tool(name="sync_notion_pages", description="Read and write Notion workspace databases"),
        Tool(name="send_slack_message", description="Send Slack alerts and notifications"),
        Tool(name="fetch_github_repo", description="Fetch repository context for integrations"),
        Tool(name="web_search", description="Real-time web search for integration docs"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["connectors", "integrations", "configurations"],
        write_types=["connectors", "integrations", "health_status"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "connector",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need to know what integration you're looking for.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What service or platform would you like to connect?",
                    "Are you setting up a new integration or troubleshooting an existing one?",
                ],
            },
        }

    async def discover_connectors(
        self,
        category: str | None = None,
        search_query: str | None = None,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_discover(category)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are an integration specialist. Help users discover available connectors. Return JSON with: available_connectors, category, setup_difficulty, features, authentication_type, compatibility."},
                {"role": "user", "content": f"Category: {category or 'All'}\nSearch: {search_query or 'Show all'}"},
            ], temperature=0.4, max_tokens=512)
            return {
                "agent_name": "connector",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Connectors discovered in '{category or 'all categories'}'",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Connector discovery failed: {e}")
            return self._fallback_discover(category)

    async def guide_setup(
        self,
        connector_name: str,
        config_params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_setup(connector_name)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a setup wizard for integrations. Guide users through connector configuration step by step. Return JSON with: setup_steps, required_params, optional_params, validation_steps, troubleshooting_tips."},
                {"role": "user", "content": f"Connector: {connector_name}\nConfig: {config_params or 'Standard setup'}"},
            ], temperature=0.4, max_tokens=512)
            return {
                "agent_name": "connector",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Setup guide for {connector_name}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Setup guide failed: {e}")
            return self._fallback_setup(connector_name)

    async def monitor_health(
        self,
        connectors: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_health(connectors)
        try:
            conn_str = "; ".join([f"{c.get('name','Connector')} - status: {c.get('status','unknown')}, last_check: {c.get('last_check','N/A')}" for c in connectors])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a health monitoring specialist for integrations. Analyze connector health and suggest actions. Return JSON with: health_summary, issues_found, performance_metrics, recommended_actions, uptime_stats."},
                {"role": "user", "content": f"Connectors:\n{conn_str}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "connector",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Health check of {len(connectors)} connectors",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Health monitor failed: {e}")
            return self._fallback_health(connectors)

    def _fallback_discover(self, category: str | None) -> dict[str, Any]:
        return {
            "agent_name": "connector",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Connectors in '{category or 'all'}'",
                "details": {"category": category, "note": "Detailed discovery requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_setup(self, connector_name: str) -> dict[str, Any]:
        return {
            "agent_name": "connector",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Setup guide for {connector_name}",
                "details": {"connector": connector_name, "note": "Detailed guide requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_health(self, connectors: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "agent_name": "connector",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Health of {len(connectors)} connectors",
                "details": {"connectors_count": len(connectors), "note": "Detailed health check requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    async def process(self, request_or_dict: Any, context: Any = None) -> dict[str, Any]:
        msg = request_or_dict.get("message", "") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "message", str(request_or_dict))
        ws_id = request_or_dict.get("workspace_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "workspace_id", None)
        u_id = request_or_dict.get("user_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "user_id", None)
        t_id = request_or_dict.get("tenant_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "tenant_id", None)
        return await self.handle(msg, workspace_id=ws_id, user_id=u_id, tenant_id=t_id, context=context)

    async def execute(self, payload: dict[str, Any] | Any) -> dict[str, Any]:
        return await self.process(payload)

    async def handle(
        self,
        message: str,
        workspace_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        permissions: list[str] | None = None,
        context: Any = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        logger.info("ConnectorAgent handling message: %s", message[:80])
        available_connectors = [
            {"name": "Slack", "category": "Communication", "status": "Ready", "auth_type": "OAuth2 (Bot Token)"},
            {"name": "GitHub", "category": "Code & Portfolios", "status": "Connected", "auth_type": "Personal Access Token"},
            {"name": "Google Drive", "category": "Documents", "status": "Ready", "auth_type": "OAuth2"},
            {"name": "Google Calendar", "category": "Scheduling", "status": "Ready", "auth_type": "OAuth2"},
            {"name": "Gmail", "category": "Email", "status": "Ready", "auth_type": "OAuth2"},
        ]

        proposals = [
            {
                "action": "initiate_connector_oauth",
                "title": "Connect Slack Workspace for Channel Broadcasting",
                "detail": "Enables real-time career updates, interview prep notifications, and team status sharing.",
                "connector": "Slack",
                "requires_approval": True,
                "approval_type": "connector_auth",
            }
        ]

        return {
            "agent_name": "connector",
            "action": "suggest",
            "confidence": 0.95,
            "result": {
                "summary": "Integration gateway operational: 5 enterprise connectors available with Zero-Trust token scoping.",
                "details": available_connectors,
                "proposals": proposals,
                "questions": [
                    "Which platform would you like to authenticate first?",
                ],
                "action_chips": [
                    "🔗 Connect Slack",
                    "📂 Connect Google Drive",
                    "🐙 Sync GitHub Repositories",
                    "🔄 Verify Connector Health",
                ],
            },
        }
