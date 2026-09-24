"""Dynamic Agent Discovery & Lifecycle Registry.

Replaces static import chains with dynamic filesystem and module-based discovery,
lazy-loading of agent handler classes, and metadata synchronization with AgentCards.
"""
from __future__ import annotations

import importlib
import inspect
import logging
from collections.abc import MutableMapping
from pathlib import Path
from typing import Any

from .card_registry import get_agent_card, list_agent_cards

logger = logging.getLogger(__name__)

# Known naming overrides where directory or class name doesn't match standard camelcase
AGENT_MODULE_MAP: dict[str, tuple[str, str]] = {
    "conversation": ("api.agents.conversation_agent.handler", "ConversationAgent"),
    "organization": ("api.agents.organization_agent.handler", "OrganizationAgent"),
    "memory": ("api.agents.memory_agent.handler", "MemoryAgentHandler"),
    "resume": ("api.agents.resume_agent.handler", "ResumeAgent"),
    "ats": ("api.agents.ats_agent.handler", "ATSAgent"),
    "job_search": ("api.agents.job_search_agent.handler", "JobSearchAgent"),
    "application": ("api.agents.application_agent.handler", "ApplicationAgent"),
    "gmail": ("api.agents.gmail_agent.handler", "GmailAgent"),
    "scheduler": ("api.agents.scheduler_agent.handler", "SchedulerAgent"),
    "planning": ("api.agents.planning_agent.handler", "PlanningAgent"),
    "research": ("api.agents.research_agent.handler", "ResearchAgent"),
    "career": ("api.agents.career_agent.handler", "CareerAgent"),
    "learning": ("api.agents.learning_agent.handler", "LearningAgent"),
    "github": ("api.agents.github_agent.handler", "GitHubAgent"),
    "coding": ("api.agents.coding_agent.handler", "CodingAgent"),
    "reminder": ("api.agents.reminder_agent.handler", "ReminderAgent"),
    "analytics": ("api.agents.analytics_agent.handler", "AnalyticsAgent"),
    "recommendation": ("api.agents.recommendation_agent.handler", "RecommendationAgent"),
    "reflection": ("api.agents.reflection_agent.handler", "ReflectionAgent"),
    "security": ("api.agents.security_agent.handler", "SecurityAgent"),
    "connector": ("api.agents.connector_agent.handler", "ConnectorAgent"),
    "plugin": ("api.agents.plugin_agent.handler", "PluginAgent"),
    "drive": ("api.agents.drive_agent.handler", "DriveAgent"),
    "workspace": ("api.agents.workspace_agent.handler", "WorkspaceAgent"),
    "calendar": ("api.agents.calendar_agent.handler", "CalendarAgent"),
    "internship": ("api.agents.internship_agent.handler", "InternshipAgent"),
    "document": ("api.agents.document_agent.handler", "DocumentAgent"),
    "pdf": ("api.agents.pdf_agent.handler", "PDFAgent"),
    "self_improvement": ("api.agents.self_improvement_agent.handler", "SelfImprovementAgent"),
    "qa": ("api.agents.qa_agent.handler", "QAAgent"),
    # Aliases
    "interview": ("api.agents.career_agent.handler", "CareerAgent"),
    "market_intelligence": ("api.agents.career_agent.handler", "CareerAgent"),
    "network": ("api.agents.career_agent.handler", "CareerAgent"),
    "wellness": ("api.agents.conversation_agent.handler", "ConversationAgent"),
}


class DynamicAgentRegistry(MutableMapping[str, type]):
    """Dynamic dict-like registry for agents with lazy-loading and discovery.

    Implements MutableMapping so that legacy code using AGENT_REGISTRY[name]
    or 'name in AGENT_REGISTRY' works seamlessly with zero static imports.
    """

    def __init__(self) -> None:
        self._cache: dict[str, type] = {}
        self._custom_registered: dict[str, type] = {}
        self._discover_from_filesystem()

    def _discover_from_filesystem(self) -> None:
        """Scan api/agents/ directory for additional agents."""
        agents_dir = Path(__file__).resolve().parent.parent / "agents"
        if not agents_dir.exists():
            return

        for item in agents_dir.iterdir():
            if item.is_dir() and (item / "handler.py").exists():
                folder_name = item.name
                agent_name = folder_name.removesuffix("_agent")
                if agent_name not in AGENT_MODULE_MAP:
                    module_path = f"api.agents.{folder_name}.handler"
                    # Default class name assumption
                    class_name = "".join(part.capitalize() for part in folder_name.split("_"))
                    AGENT_MODULE_MAP[agent_name] = (module_path, class_name)

    def _load_agent_class(self, key: str) -> type | None:
        """Lazy-load the agent class from its declared module."""
        if key in self._custom_registered:
            return self._custom_registered[key]

        if key not in AGENT_MODULE_MAP:
            return None

        module_path, class_name = AGENT_MODULE_MAP[key]
        try:
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name, None)
            if cls is None:
                # Search for any subclass of BaseAgent or class with name ending in Agent/Handler
                for attr_name, attr_val in inspect.getmembers(mod, inspect.isclass):
                    if attr_name.endswith("Agent") or attr_name.endswith("Handler"):
                        cls = attr_val
                        break
            if cls:
                self._cache[key] = cls
                return cls
        except Exception as exc:
            logger.warning("Failed to dynamically load agent '%s' from %s: %s", key, module_path, exc)
            return None

        return None

    def __getitem__(self, key: str) -> type:
        if key in self._cache:
            return self._cache[key]
        cls = self._load_agent_class(key)
        if cls is not None:
            return cls
        raise KeyError(f"Agent '{key}' is not registered in DynamicAgentRegistry")

    def __setitem__(self, key: str, value: type) -> None:
        self._cache[key] = value
        self._custom_registered[key] = value

    def __delitem__(self, key: str) -> None:
        self._cache.pop(key, None)
        self._custom_registered.pop(key, None)
        AGENT_MODULE_MAP.pop(key, None)

    def __iter__(self):
        all_keys = set(AGENT_MODULE_MAP.keys()) | set(self._custom_registered.keys())
        return iter(all_keys)

    def __len__(self) -> int:
        all_keys = set(AGENT_MODULE_MAP.keys()) | set(self._custom_registered.keys())
        return len(all_keys)

    def __contains__(self, key: object) -> bool:
        if not isinstance(key, str):
            return False
        return key in AGENT_MODULE_MAP or key in self._custom_registered or key in self._cache

    def get_agent_card_info(self, key: str) -> dict[str, Any]:
        """Return rich metadata from AgentCard and Capability Registry."""
        card = get_agent_card(key)
        return {
            "name": key,
            "version": card.version if card else "1.0.0",
            "description": card.description if card else "",
            "tools": card.tools if card else [],
            "status": card.status if card else "ACTIVE",
        }

    def list_all_metadata(self) -> list[dict[str, Any]]:
        """Return enriched list of all discovered agents."""
        result = []
        for key in self:
            result.append(self.get_agent_card_info(key))
        return result


# Singleton dynamic agent registry
agent_registry = DynamicAgentRegistry()
dynamic_agent_registry = agent_registry
