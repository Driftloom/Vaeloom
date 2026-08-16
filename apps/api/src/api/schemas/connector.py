import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ConnectorResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    type: str
    scopes: list[str] | None = None
    status: str
    token_ref: str | None = None
    last_synced_at: datetime | None = None
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
