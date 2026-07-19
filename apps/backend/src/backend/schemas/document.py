import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    path: str
    type: str
    summary: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
    page: int = 1
    page_size: int = 20
