from typing import Any, Literal
from pydantic import BaseModel, Field


class MemoryScopes(BaseModel):
    read_types: list[str]
    write_types: list[str]


class Tool(BaseModel):
    name: str
    description: str


class AgentContext(BaseModel):
    workspace_id: str
    user_id: str | None = None
    profile: dict[str, Any] = Field(default_factory=dict)
    master_resume: dict[str, Any] = Field(default_factory=dict)
    preferences: list[dict[str, Any]] = Field(default_factory=list)
    rag_context: dict[str, Any] = Field(default_factory=dict)
    retained_history: list[dict[str, Any]] = Field(default_factory=list)


class BaseAgent:
    mission: str
    tools: list[Tool]
    memory_scopes: MemoryScopes
    default_autonomy: Literal["suggest", "full", "read_only", "approval_gated"]
    card: Any = None

    def get_system_prompt(self, context: AgentContext | None = None) -> str:
        """Render parameterized system prompt from AgentCard or fallback mission."""
        card = getattr(self, "card", None)
        if card is None:
            try:
                from .card_registry import get_agent_card

                cname = self.__class__.__name__.lower().replace("agent", "").replace("handler", "")
                card = get_agent_card(cname)
            except Exception:
                card = None
        if card is not None:
            return card.render_system_prompt(context=context)
        mission = (getattr(self, "mission", "") or "").strip()
        return mission or "You are a helpful AI assistant."

    def validate_output(self, output: dict[str, Any]) -> tuple[bool, list[str]]:
        """Validate output payload against AgentCard schema contract."""
        card = getattr(self, "card", None)
        if card is None:
            try:
                from .card_registry import get_agent_card

                cname = self.__class__.__name__.lower().replace("agent", "").replace("handler", "")
                card = get_agent_card(cname)
            except Exception:
                card = None
        if card is not None:
            return card.validate_output(output)
        return True, []

    async def execute(self, request: Any, context: AgentContext | None = None) -> Any:
        """Standardized entrypoint for agent execution.

        Subclasses implement their domain logic here or delegate to domain methods.
        """
        return await self.fallback()

    async def fallback(self) -> Any:
        raise NotImplementedError("Every agent must implement a fallback method")
