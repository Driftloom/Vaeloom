from typing import List, Literal, Callable, Any
from pydantic import BaseModel

class MemoryScopes(BaseModel):
    read_types: List[str]
    write_types: List[str]

class Tool(BaseModel):
    name: str
    description: str

class BaseAgent:
    mission: str
    tools: List[Tool]
    memory_scopes: MemoryScopes
    default_autonomy: Literal["suggest", "full", "read_only", "approval_gated"]

    async def fallback(self) -> Any:
        raise NotImplementedError("Every agent must implement a fallback method")
