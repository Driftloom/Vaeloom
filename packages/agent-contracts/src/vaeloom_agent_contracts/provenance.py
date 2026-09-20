import hashlib
import json
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field


class ProvenanceRecord(BaseModel):
    record_id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    agent_id: str
    action_type: str
    parent_hash: Optional[str] = None
    payload_hash: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    current_hash: str = ""

    def compute_hash(self) -> str:
        data = f"{self.record_id}:{self.session_id}:{self.agent_id}:{self.action_type}:{self.parent_hash}:{self.payload_hash}:{self.timestamp.isoformat()}"
        return hashlib.sha256(data.encode("utf-8")).hexdigest()
