import json
import os
from typing import Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings

from .infrastructure.secrets import SecretManager


class Settings(BaseSettings):
    service_name: str = "vaeloom-backend"
    service_version: str = "0.2.0"
    service_environment: str = "local"

    database__url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom"
    redis__url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_token_ttl: int = 3600
    jwt_refresh_token_ttl: int = 2592000

    encryption_key: str = ""

    llm_provider: Literal["anthropic", "openai"] = "anthropic"
    llm_api_key: str = ""
    llm_model: str = "claude-3-5-sonnet-20241022"
    embedding_model: str = "text-embedding-3-small"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    google_calendar_id: str = "primary"

    job_board_api_url: str = ""
    job_board_api_key: str = ""

    sso_providers: dict[str, Any] = {}

    @field_validator("sso_providers", mode="before")
    @classmethod
    def parse_sso_providers(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, str):
            return json.loads(v)
        return v or {}

    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    log_level: str = "INFO"
    log_format: str = ""

    rate_limit_redis_url: str = ""
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    api_key_rate_limit: int = 1000

    storage_endpoint: str = "http://localhost:9000"
    storage_access_key: str = "minioadmin"
    storage_secret_key: str = "minioadmin"
    storage_bucket: str = "vaeloom"
    storage_region: str = "us-east-1"

    ip_allowlist: str = ""
    retention_policies: str = ""

    agent_timeout_seconds: int = 120
    prompt_injection_check: bool = True
    prompt_dir: str = ""
    mvp_scope_enforced: bool = True
    enterprise_routes_enabled: bool = False

    model_config = {"env_prefix": "", "case_sensitive": False}

    def __init__(self, **kwargs):
        secret_manager = kwargs.pop("secret_manager", None)
        super().__init__(**kwargs)
        if secret_manager is not None:
            self._resolve_from_secret_manager(secret_manager)

    def _resolve_from_secret_manager(self, sm: SecretManager) -> None:
        secret_keys = {
            "jwt_secret": sm.get_secret("JWT_SECRET"),
            "llm_api_key": sm.get_secret("LLM_API_KEY"),
            "encryption_key": sm.get_secret("ENCRYPTION_KEY"),
            "storage_access_key": sm.get_secret("STORAGE_ACCESS_KEY"),
            "storage_secret_key": sm.get_secret("STORAGE_SECRET_KEY"),
            "database__url": sm.get_secret("DATABASE_URL"),
        }
        for attr, value in secret_keys.items():
            if value is not None:
                object.__setattr__(self, attr, value)


settings = Settings()


def validate_settings() -> dict[str, list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if settings.jwt_secret in ("change-me-in-production", "change-me"):
        errors.append("JWT_SECRET must be changed from the default value")

    if not settings.database__url:
        errors.append("DATABASE_URL must be set")

    if len(settings.encryption_key) < 32:
        errors.append("ENCRYPTION_KEY must be set and at least 32 characters long")

    if not settings.llm_api_key:
        warnings.append("LLM_API_KEY is not set — LLM features will fail at runtime")

    infisical_enabled = os.environ.get("INFISICAL_ENABLED", "").lower() in ("1", "true", "yes")
    if infisical_enabled:
        if not os.environ.get("INFISICAL_CLIENT_ID"):
            errors.append("INFISICAL_CLIENT_ID is required when INFISICAL_ENABLED is true")
        if not os.environ.get("INFISICAL_CLIENT_SECRET"):
            errors.append("INFISICAL_CLIENT_SECRET is required when INFISICAL_ENABLED is true")

    if not settings.redis__url:
        warnings.append("REDIS_URL is not set — will use in-memory fallback")
    if not settings.rate_limit_redis_url:
        warnings.append("RATE_LIMIT_REDIS_URL is not set — rate limiting will use in-memory fallback")

    meilisearch_url = os.environ.get("MEILISEARCH_URL")
    if not meilisearch_url:
        warnings.append("MEILISEARCH_URL is not set — search will use database fallback")

    qdrant_url = os.environ.get("QDRANT_URL")
    if not qdrant_url:
        warnings.append("QDRANT_URL is not set — vector search will use in-process fallback")

    if not settings.storage_endpoint or "localhost" in settings.storage_endpoint:
        warnings.append("STORAGE_ENDPOINT is set to localhost — verify this is intentional for non-production")

    if errors:
        raise RuntimeError(
            "Startup validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        )

    return {"errors": errors, "warnings": warnings}
