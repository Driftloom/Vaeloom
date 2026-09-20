from typing import Callable, Any, Optional
from vaeloom_agent_contracts import ToolDefinition, ToolRiskLevel


class ToolRegistryError(Exception):
    pass


class ToolRegistry:
    """Central registry mapping tool names to schemas and async callable handlers."""

    def __init__(self):
        self._definitions: dict[str, ToolDefinition] = {}
        self._handlers: dict[str, Callable] = {}

    def register(self, definition: ToolDefinition, handler: Callable) -> None:
        if definition.name in self._definitions:
            raise ToolRegistryError(f"Tool '{definition.name}' is already registered.")
        self._definitions[definition.name] = definition
        self._handlers[definition.name] = handler

    def get_definition(self, name: str) -> Optional[ToolDefinition]:
        return self._definitions.get(name)

    def get_handler(self, name: str) -> Optional[Callable]:
        return self._handlers.get(name)

    def list_tools(self) -> list[ToolDefinition]:
        return list(self._definitions.values())
