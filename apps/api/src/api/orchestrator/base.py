from typing import Any, Literal

from pydantic import BaseModel


class MemoryScopes(BaseModel):
    read_types: list[str]
    write_types: list[str]

class Tool(BaseModel):
    name: str
    description: str

class BaseAgent:
    mission: str
    tools: list[Tool]
    memory_scopes: MemoryScopes
    default_autonomy: Literal["suggest", "full", "read_only", "approval_gated"]

    async def fallback(self) -> Any:
        raise NotImplementedError("Every agent must implement a fallback method")
