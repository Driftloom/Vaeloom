import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SignupRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="User password (min 8 characters)")
    display_name: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Password cannot contain null bytes")
        return v

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str | None) -> str | None:
        if v is not None:
            if "\x00" in v:
                raise ValueError("Display name cannot contain null bytes")
            import re
            v = re.sub(r"<[^>]*>", "", v).strip()
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Password cannot contain null bytes")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()



class ResetPasswordRequest(BaseModel):
    token: str | None = None
    email: str | None = None
    password: str | None = None
    new_password: str | None = None

    @field_validator("password", "new_password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        if v is not None and "\x00" in v:
            raise ValueError("Password cannot contain null bytes")
        return v


class PublicUser(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    avatar_url: str | None = None
    auth_provider: str = "email"
    email_verified: bool = False
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


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Email verification token")


class ResendVerificationRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, description="User email address")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v


class SessionItemResponse(BaseModel):
    id: uuid.UUID
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: datetime
    expires_at: datetime
    is_current: bool = False
    status: str = "ACTIVE"

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: list[SessionItemResponse]

