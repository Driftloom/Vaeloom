import uuid
from datetime import datetime
from typing import Annotated, Any

import email_validator
from pydantic import AfterValidator, BaseModel, Field, field_validator


def _normalize_email(value: Any) -> str:
    """Normalise an address before format validation.

    Pydantic's EmailStr strips whitespace and lowercases the domain but leaves
    the local part's case intact; addresses are compared case-insensitively
    elsewhere in the auth flow, so lowercase the whole thing to keep one
    canonical form.
    """
    return str(value).strip().lower()


def _validate_email(value: str) -> str:
    """Reject anything that is not a syntactically valid address.

    The previous check was only `has an @ and a dot in the domain`, which
    accepted `xss-<script>alert(1)</script>@test.com` — a stored-XSS vector
    wherever the address is rendered without escaping.

    `test_environment=True` is required because the reserved `.test` TLD is used
    throughout the test suites and the Playwright harness; it relaxes only the
    special-use *domain* check, not local-part validation, so markup in the
    local part is still rejected.
    """
    normalized = _normalize_email(value)
    email_validator.validate_email(
        normalized, check_deliverability=False, test_environment=True
    )
    return normalized


# Reusable validated address type. Use this for every user-supplied email field.
NormalizedEmail = Annotated[str, AfterValidator(_validate_email)]


class SignupRequest(BaseModel):
    email: NormalizedEmail = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="User password (min 8 characters)")
    display_name: str | None = None
    terms_accepted: bool = Field(True, description="Explicit agreement to Terms of Service and Privacy Policy")

    @field_validator("terms_accepted")
    @classmethod
    def validate_terms_accepted(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("You must accept the Terms of Service and Privacy Policy to create an account")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Password cannot contain null bytes")
        common_weak = {
            "password", "12345678", "123456789", "1234567890", "qwertyuiop",
            "admin123", "admin12345", "welcome123", "letmein123", "password123",
            "iloveyou", "monkey123", "dragon123", "football", "master123"
        }
        if v.lower() in common_weak:
            raise ValueError("Password is too common or easily guessable")
        import re
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"[\d\W_]", v):
            raise ValueError("Password must contain at least one digit or special character")
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
    mfa_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int = 3600
    user: PublicUser
    mfa_required: bool = False
    mfa_token: str | None = None


class MeResponse(BaseModel):
    user: PublicUser
    workspaces: list[Any] = []

    model_config = {"from_attributes": True}


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Email verification token")


class ResendVerificationRequest(BaseModel):
    email: NormalizedEmail = Field(..., description="User email address")


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


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    recovery_codes: list[str]


class MfaVerifyRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    mfa_token: str | None = None


