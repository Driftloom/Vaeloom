import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PublicUser(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    auth_provider: str = "email"
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int = 3600
    user: PublicUser


class MeResponse(BaseModel):
    user: PublicUser
    workspaces: list[Any] = []

    model_config = {"from_attributes": True}
