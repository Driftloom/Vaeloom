from datetime import datetime

from pydantic import BaseModel, Field


class DraftCreateRequest(BaseModel):
    to: str = Field(..., min_length=3, max_length=320)
    subject: str = Field(..., min_length=1, max_length=998)
    body: str = Field(..., min_length=1, max_length=100_000)


class DraftResponse(BaseModel):
    id: str
    message: dict | None = None


class DraftListResponse(BaseModel):
    items: list[DraftResponse]
    total: int


class WatchStartRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=512)


class WatchStatusResponse(BaseModel):
    active: bool
    workspace_id: str | None = None
    channel_id: str | None = None
    resource_id: str | None = None
    history_id: str | None = None
    expiration: datetime | None = None
    status: str | None = None
    message: str | None = None


class PushNotificationRequest(BaseModel):
    history_id: int | None = Field(default=None, alias="historyId")
    message: dict | None = None

    model_config = {"populate_by_name": True}
