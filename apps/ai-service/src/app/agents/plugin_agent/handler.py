"""
Plugin Agent — manage plugins, recommend extensions, handle updates.
Suggest autonomy. Verifies compatibility before recommending installations.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class PluginAgent(BaseAgent):
    mission = "Manage plugins, recommend extensions, handle updates"
    tools = [
        Tool(name="browse_plugins", description="Browse available plugins and extensions"),
        Tool(name="check_compatibility", description="Check plugin compatibility with current system"),
        Tool(name="manage_updates", description="Manage plugin updates and version tracking"),
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
        category: Optional[str] = None,
        query: Optional[str] = None,
        sort_by: str = "rating",
    ) -> Dict[str, Any]:
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
        environment: Dict[str, Any],
    ) -> Dict[str, Any]:
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
        installed_plugins: List[Dict[str, Any]],
        action: str = "check",
    ) -> Dict[str, Any]:
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

    def _fallback_browse(self, category: Optional[str]) -> Dict[str, Any]:
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

    def _fallback_compatibility(self, plugin_name: str) -> Dict[str, Any]:
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

    def _fallback_updates(self, installed: List[Dict[str, Any]]) -> Dict[str, Any]:
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
