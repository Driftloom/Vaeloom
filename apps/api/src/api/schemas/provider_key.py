import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ProviderLiteral = Literal["openai", "anthropic", "google", "mistral", "cohere", "azure", "openrouter", "groq", "ollama", "custom"]
ALLOWED_PROVIDERS = {"openai", "anthropic", "google", "mistral", "cohere", "azure", "openrouter", "groq", "ollama", "custom"}


class ProviderKeyCreate(BaseModel):
    provider: str = Field(..., description="LLM provider key id: openai | anthropic | google | mistral | cohere | azure | openrouter | groq | ollama | custom")
    api_key: str = Field(..., min_length=8, max_length=500, description="Raw provider API key (never returned plaintext)")
    workspace_id: uuid.UUID | None = Field(None, description="If null => user-global key; if set => workspace-scoped override")

    def validate_provider(self) -> str:
        p = self.provider.strip().lower()
        if p not in ALLOWED_PROVIDERS:
            raise ValueError(f"Unsupported provider '{self.provider}'. Allowed: {sorted(ALLOWED_PROVIDERS)}")
        return p


class ProviderKeyUpdate(BaseModel):
    api_key: str | None = Field(None, min_length=8, max_length=500)
    is_active: bool | None = None


class ProviderKeyResponse(BaseModel):
    id: uuid.UUID
    provider: str
    key_hint: str
    key_prefix: str
    is_active: bool
    is_valid: bool | None = None
    last_validated_at: datetime | None = None
    last_used_at: datetime | None = None
    validation_error: str | None = None
    workspace_id: uuid.UUID | None = None
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProviderKeyListResponse(BaseModel):
    keys: list[ProviderKeyResponse]
    total: int


class EffectiveKeyResponse(BaseModel):
    provider: str
    has_custom_key: bool
    source: str  # workspace | user | system | none
    key_hint: str | None = None
    is_valid: bool | None = None
    is_active: bool = True
    last_validated_at: datetime | None = None
    fallback_provider: str | None = None


class ValidateKeyResponse(BaseModel):
    is_valid: bool
    provider: str
    message: str
    latency_ms: int | None = None
