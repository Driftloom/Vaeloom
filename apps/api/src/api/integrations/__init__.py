"""
Vaeloom Integration Provider Framework — hybrid native + MCP (ADR-037).

Providers implement IntegrationProvider and register ToolDefinitions into the
executor's static registry at import time. Adding N+1 = drop a folder.
"""
from .registry import IntegrationProvider, provider_registry

__all__ = ["IntegrationProvider", "provider_registry"]
