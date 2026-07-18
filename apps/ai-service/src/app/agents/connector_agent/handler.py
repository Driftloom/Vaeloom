"""
Connector Agent — help users discover and configure new integrations.
Suggest autonomy. Never exposes API keys or secrets in responses.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ConnectorAgent(BaseAgent):
    mission = "Help users discover and configure new integrations"
    tools = [
        Tool(name="discover_connectors", description="Discover available integrations and connectors"),
        Tool(name="guide_setup", description="Guide users through connector setup step by step"),
        Tool(name="monitor_health", description="Monitor health status of connected integrations"),
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
        category: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> Dict[str, Any]:
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
        config_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
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
        connectors: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
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

    def _fallback_discover(self, category: Optional[str]) -> Dict[str, Any]:
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

    def _fallback_setup(self, connector_name: str) -> Dict[str, Any]:
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

    def _fallback_health(self, connectors: List[Dict[str, Any]]) -> Dict[str, Any]:
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
