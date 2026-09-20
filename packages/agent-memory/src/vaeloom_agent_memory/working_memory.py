from uuid import UUID
from typing import Any, Optional
import time


class WorkingMemoryStore:
    """Tier-1 in-memory / Redis cache for session turn memory with TTL."""

    def __init__(self, default_ttl_seconds: int = 3600):
        self._store: dict[str, tuple[Any, float]] = {}
        self._ttl = default_ttl_seconds

    def _key(self, workspace_id: UUID, session_id: UUID, key: str) -> str:
        return f"{workspace_id}:{session_id}:{key}"

    def set(self, workspace_id: UUID, session_id: UUID, key: str, value: Any) -> None:
        expiry = time.time() + self._ttl
        self._store[self._key(workspace_id, session_id, key)] = (value, expiry)

    def get(self, workspace_id: UUID, session_id: UUID, key: str) -> Optional[Any]:
        k = self._key(workspace_id, session_id, key)
        if k not in self._store:
            return None
        val, expiry = self._store[k]
        if time.time() > expiry:
            del self._store[k]
            return None
        return val

    def delete(self, workspace_id: UUID, session_id: UUID, key: str) -> bool:
        k = self._key(workspace_id, session_id, key)
        if k in self._store:
            del self._store[k]
            return True
        return False
