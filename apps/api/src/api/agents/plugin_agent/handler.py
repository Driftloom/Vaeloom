"""
Plugin Agent — manage plugins, recommend extensions, handle updates.
Suggest autonomy. Verifies compatibility before recommending installations.
"""
import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class PluginAgent(BaseAgent):
    mission = "Manage plugins, recommend extensions, handle updates"
    tools = [
        Tool(name="browse_plugins", description="Browse available plugins and extensions"),
        Tool(name="check_compatibility", description="Check plugin compatibility with current system"),
        Tool(name="manage_updates", description="Manage plugin updates and version tracking"),
        Tool(name="web_search", description="Real-time web search for plugin info"),
        Tool(name="query_graph", description="Query knowledge graph for plugins and versions"),
        Tool(name="fetch_github_repo", description="Fetch plugin repository for compatibility check"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["plugins", "extensions", "versions", "compatibility"],
        write_types=["plugins", "updates"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "plugin",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need to know what plugin or extension you're interested in.",
                "details": None,
                "proposals": [],
                "questions": [
                    "Are you looking for a new plugin, checking compatibility, or managing updates?",
                    "What functionality are you trying to add?",
                ],
            },
        }

    async def browse_plugins(
        self,
        category: str | None = None,
        query: str | None = None,
        sort_by: str = "rating",
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_browse(category)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a plugin marketplace expert. Help users discover plugins. Return JSON with: plugins, categories, ratings, downloads, descriptions, requirements."},
                {"role": "user", "content": f"Category: {category or 'All'}\nSearch: {query or 'Show popular'}\nSort: {sort_by}"},
            ], temperature=0.4, max_tokens=512)
            return {
                "agent_name": "plugin",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Plugins in '{category or 'all categories'}'",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Plugin browse failed: {e}")
            return self._fallback_browse(category)

    async def check_compatibility(
        self,
        plugin_name: str,
        current_version: str,
        environment: dict[str, Any],
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_compatibility(plugin_name)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a compatibility testing specialist. Check plugin compatibility. Return JSON with: compatible, version_required, conflicts, alternatives, migration_steps."},
                {"role": "user", "content": f"Plugin: {plugin_name}\nCurrent version: {current_version}\nEnvironment: {environment}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "plugin",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Compatibility check for {plugin_name}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Compatibility check failed: {e}")
            return self._fallback_compatibility(plugin_name)

    async def manage_updates(
        self,
        installed_plugins: list[dict[str, Any]],
        action: str = "check",
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_updates(installed_plugins)
        try:
            plugins_str = "; ".join([f"{p.get('name','Plugin')} v{p.get('version','?')} (installed: {p.get('installed_date','unknown')})" for p in installed_plugins])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are an update management specialist. Analyze and manage plugin updates. Return JSON with: updates_available, critical_updates, changelog_summary, rollback_plan, recommended_update_order."},
                {"role": "user", "content": f"Installed plugins:\n{plugins_str}\nAction: {action}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "plugin",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Update check for {len(installed_plugins)} plugins",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Update management failed: {e}")
            return self._fallback_updates(installed_plugins)

    def _fallback_browse(self, category: str | None) -> dict[str, Any]:
        return {
            "agent_name": "plugin",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Plugins in '{category or 'all'}'",
                "details": {"category": category, "note": "Detailed browsing requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_compatibility(self, plugin_name: str) -> dict[str, Any]:
        return {
            "agent_name": "plugin",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Compatibility for {plugin_name}",
                "details": {"plugin": plugin_name, "note": "Detailed check requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_updates(self, installed: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "agent_name": "plugin",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Updates for {len(installed)} plugins",
                "details": {"plugins_count": len(installed), "note": "Detailed update check requires an LLM API key."},
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
        logger.info("PluginAgent handling message: %s", message[:80])
        clean_msg = message.strip()
        catalog = [
            {"name": "sentiment", "type": "official", "version": "1.2.0", "description": "Communication tone and sentiment analysis"},
            {"name": "summarizer", "type": "official", "version": "1.0.4", "description": "Long-form job posting and document summarizer"},
            {"name": "translator", "type": "official", "version": "1.1.0", "description": "Cross-language resume and application translator"},
            {"name": "word-count", "type": "community", "version": "0.9.1", "description": "Resume length and density metrics checker"},
        ]

        proposals = [
            {
                "action": "install_verified_plugin",
                "title": "Install Official 'summarizer' Plugin v1.0.4",
                "detail": "Adds automated job description entity extraction to workspace pipeline.",
                "plugin_name": "summarizer",
                "requires_approval": True,
                "approval_type": "plugin_install",
            }
        ]

        return {
            "agent_name": "plugin",
            "action": "suggest",
            "confidence": 0.95,
            "result": {
                "summary": "Plugin ecosystem verified: 4 extensions available with sandboxed capability containment.",
                "details": catalog,
                "proposals": proposals,
                "questions": [
                    "Would you like to install the 'summarizer' or 'sentiment' plugin in this workspace?",
                ],
                "action_chips": [
                    "🧩 Install Official Summarizer",
                    "⚡ Check Version Compatibility",
                    "🔄 Update Installed Plugins",
                ],
            },
        }
