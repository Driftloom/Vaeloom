from uuid import UUID
from typing import Any, Optional
from pydantic import BaseModel, Field


class BlackboardEntry(BaseModel):
    key: str
    value: Any
    created_by_agent: str
    provenance_hash: Optional[str] = None


class ScopedBlackboard:
    """Scoped shared state among collaborating sub-agents with strict isolation."""

    def __init__(self, session_id: UUID):
        self.session_id = session_id
        self._entries: dict[str, BlackboardEntry] = {}

    def write(self, key: str, value: Any, agent_id: str) -> None:
        self._entries[key] = BlackboardEntry(
            key=key,
            value=value,
            created_by_agent=agent_id,
        )

    def read(self, key: str) -> Optional[Any]:
        entry = self._entries.get(key)
        return entry.value if entry else None

    def list_keys(self) -> list[str]:
        return list(self._entries.keys())
