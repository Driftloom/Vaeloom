"""
Provider registry — pluggable IntegrationProvider framework (ADR-037).

Each provider is one folder under integrations/providers/<id>/ with:
  - provider.py defining IntegrationProvider
  - tools referenced via definitions.py (static) or dynamic bridging

Registry startup:
  `from api.integrations.registry import provider_registry`
  `provider_registry.discover_and_register()` — called once at app startup (main.py)
  It auto-discovers providers on disk and registers their ToolDefinitions via
  the executor dynamic registry so they participate in approval gating / timeouts.

For static tools (drive, github, greenhouse, lever, graph, onedrive) the
definitions already live in tools/definitions.py; registry simply records
them for discovery and docs (integration-matrix.md). Future providers can be
pure-dynamic (they register at runtime).
"""
from __future__ import annotations

import importlib
import logging
import pkgutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class IntegrationProvider(Protocol):
    id: str
    display_name: str
    scopes: list[str]

    def tool_definitions(self) -> list[Any]:
        ...

    def validate_config(self, config: dict[str, Any]) -> None:
        ...

    async def handle(self, tool: str, params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
        ...


@dataclass
class _ProviderEntry:
    id: str
    display_name: str
    scopes: list[str] = field(default_factory=list)
    tool_names: list[str] = field(default_factory=list)
    module: str = ""


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, _ProviderEntry] = {}
        self._bootstrapped = False

    def register(
        self,
        id: str,
        display_name: str,
        scopes: list[str] | None = None,
        tool_names: list[str] | None = None,
        module: str = "",
    ) -> None:
        entry = _ProviderEntry(
            id=id,
            display_name=display_name,
            scopes=scopes or [],
            tool_names=tool_names or [],
            module=module,
        )
        self._providers[id] = entry
        logger.info(f"Provider registered: {id} ({display_name}) tools={tool_names}")

    def get(self, provider_id: str) -> _ProviderEntry | None:
        return self._providers.get(provider_id)

    def list_all(self) -> list[_ProviderEntry]:
        return list(self._providers.values())

    def all_tool_names(self) -> list[str]:
        out: list[str] = []
        for p in self._providers.values():
            out.extend(p.tool_names)
        return out

    def discover_and_register(self) -> int:
        """Idempotent discovery: import each providers.<id>.provider and register."""
        if self._bootstrapped:
            return len(self._providers)
        # Built-in static providers — correspond to definitions.py / executor handlers
        builtins: list[tuple[str, str, list[str], list[str]]] = [
            ("gmail", "Gmail (Google)", ["connector.gmail.read", "connector.gmail.write"], ["search_gmail", "draft_email"]),
            ("google_calendar", "Google Calendar", ["connector.calendar.read", "connector.calendar.write"], ["list_calendar_events", "create_calendar_event"]),
            ("google_drive", "Google Drive", ["connector.drive.read"], ["list_drive_files", "search_drive", "download_drive_file"]),
            ("github", "GitHub", ["connector.github.read", "connector.github.write"], ["fetch_github_repo", "search_github_repos", "get_github_profile", "list_github_issues", "read_github_file", "create_github_issue", "create_github_pull_request"]),
            ("greenhouse", "Greenhouse Boards", ["connector.jobs.read"], ["search_greenhouse_jobs", "search_jobs_board"]),
            ("lever", "Lever Postings", ["connector.jobs.read"], ["search_lever_jobs", "search_jobs_board"]),
            ("jobs_board", "Jobs Board Aggregator", ["connector.jobs.read"], ["search_jobs", "search_jobs_board", "search_greenhouse_jobs", "search_lever_jobs"]),
            ("outlook", "Outlook Mail (Graph)", ["connector.outlook.read", "connector.outlook.write"], ["search_outlook_mail", "draft_outlook_mail"]),
            ("graph_calendar", "Outlook Calendar (Graph)", ["connector.calendar.read", "connector.calendar.write"], ["list_outlook_calendar_events", "create_outlook_calendar_event"]),
            ("onedrive", "OneDrive (Graph)", ["connector.drive.read"], ["list_onedrive_files", "search_onedrive", "download_onedrive_file"]),
            ("mcp", "MCP Custom Servers", ["connector.mcp.execute"], ["mcp__* (dynamic)"]),
            ("slack", "Slack", ["connector.slack.write"], ["send_slack_message"]),
            ("notion", "Notion", ["connector.notion.read_write"], ["sync_notion_pages"]),
            ("browser", "Browser / Scraping", ["system.browser.read"], ["browse_job_page", "scrape_company_insights", "verify_application_link"]),
        ]
        for pid, name, scopes, tools in builtins:
            if pid not in self._providers:
                self.register(pid, name, scopes=scopes, tool_names=tools, module=f"builtin:{pid}")

        # Dynamic providers on disk: providers/<id>/provider.py
        pkg_path = Path(__file__).parent / "providers"
        if pkg_path.exists():
            for pkg in pkgutil.iter_modules([str(pkg_path)]):
                if pkg.name.startswith("_"):
                    continue
                try:
                    mod = importlib.import_module(f"api.integrations.providers.{pkg.name}.provider")
                    # provider.py may call registry.register at import time
                    logger.info(f"Discovered provider module: {pkg.name}")
                except ModuleNotFoundError:
                    continue
                except Exception as e:
                    logger.warning(f"Provider {pkg.name} discovery failed: {e}")

        self._bootstrapped = True
        return len(self._providers)


provider_registry = ProviderRegistry()
