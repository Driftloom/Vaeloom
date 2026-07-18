from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    service_name: str = "vaeloom-ai-service"
    service_version: str = "0.1.0"
    service_environment: str = "local"

    database__url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom"
    redis__url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

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

    allowed_origins: list[str] = ["*"]

    log_level: str = "INFO"

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
