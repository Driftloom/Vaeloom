from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ServiceConfig(BaseSettings):
    name: str = "vaeloom-service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    environment: Literal["local", "dev", "staging", "prod"] = "local"
    log_level: str = "INFO"
    request_timeout: int = 30
    max_connections: int = 100
    graceful_shutdown_seconds: int = 30


class DatabaseConfig(BaseSettings):
    url: str = Field(default="postgresql+asyncpg://localhost:5432/vaeloom")
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30
    pool_recycle: int = 1800
    echo: bool = False
    migration_dir: str = "database/migrations"


class RedisConfig(BaseSettings):
    url: str = Field(default="redis://localhost:6379/0")
    socket_timeout: int = 5
    retry_on_timeout: bool = True
    max_connections: int = 50


class AIConfig(BaseSettings):
    provider: str = "anthropic"
    api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    default_model: str = "claude-sonnet-4-20250514"
    embedding_model: str = "text-embedding-3-large"
    max_tokens: int = 4096
    temperature: float = 0.3
    rate_limit_rpm: int = 100
    rate_limit_tpm: int = 100000


class LoggingConfig(BaseSettings):
    format: Literal["json", "console"] = "json"
    level: str = "INFO"
    include_trace: bool = True
    include_caller: bool = False


class ObservabilityConfig(BaseSettings):
    otlp_endpoint: str = ""
    service_name: str = "vaeloom"
    sample_rate: float = 0.1
    metrics_enabled: bool = True
    traces_enabled: bool = True


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
    )

    service: ServiceConfig = ServiceConfig()
    database: DatabaseConfig = DatabaseConfig()
    redis: RedisConfig = RedisConfig()
    ai: AIConfig = AIConfig()
    logging: LoggingConfig = LoggingConfig()
    observability: ObservabilityConfig = ObservabilityConfig()

    base_dir: Path = Path.cwd()
    data_dir: Path = Field(default=Path("data"))
    temp_dir: Path = Field(default=Path("/tmp/vaeloom"))
    secret_key: str = Field(default="", alias="SECRET_KEY")
    encryption_key: str = Field(default="", alias="ENCRYPTION_KEY")
    allowed_origins: list[str] = ["http://localhost:3000"]


class BaseConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

    environment: str = "local"
    debug: bool = False
    log_level: str = "INFO"
