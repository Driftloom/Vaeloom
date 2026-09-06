import json
import os
from pathlib import Path
from typing import Any, Literal

try:
    from dotenv import load_dotenv

    # 1. Load root .env if present (non-overriding baseline)
    root_env = Path(".env")
    if root_env.exists():
        load_dotenv(root_env, override=False)

    # 2. Prioritize apps/api/.env (overriding root defaults with API cloud credentials)
    for api_env in [Path("apps/api/.env"), Path(__file__).resolve().parent.parent.parent / ".env"]:
        if api_env.exists():
            load_dotenv(api_env, override=True)
except Exception:
    pass

from pydantic import field_validator
from pydantic_settings import BaseSettings

from .infrastructure.secrets import SecretManager


class Settings(BaseSettings):
    service_name: str = "vaeloom-api"
    service_version: str = "0.2.0"
    service_environment: str = "local"

    database__url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom"
    redis__url: str = "redis://localhost:6379/0"

    @field_validator("database__url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Any) -> str:
        if isinstance(v, str):
            if v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            if "sslmode=" in v:
                v = v.replace("sslmode=", "ssl=")
        return v

    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_token_ttl: int = 3600
    jwt_refresh_token_ttl: int = 2592000

    encryption_key: str = ""

    llm_provider: Literal["anthropic", "openai", "groq", "google", "openrouter", "mistral", "cohere", "azure", "ollama", "custom"] = "groq"
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-120b"
    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-2"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    google_calendar_id: str = "primary"

    ms_graph_client_id: str = ""
    ms_graph_client_secret: str = ""
    ms_graph_refresh_token: str = ""
    ms_graph_tenant_id: str = "common"

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
    storage_access_key: str = ""
    storage_secret_key: str = ""
    storage_bucket: str = "vaeloom"
    storage_region: str = "us-east-1"
    # Object-storage mirror on document upload — opt-in per temporal_enabled
    # precedent. When True, upload PUTs bytes to storage/{ws}/{doc}/{file}
    # and records raw_storage_key (converges upload path with pipeline
    # DocumentVersion storage keys). Fail-open when storage is unreachable.
    # Keep False in local/.env.example for offline tests; enable in prod.
    storage_mirror_enabled: bool = False

    ip_allowlist: str = ""
    retention_policies: str = ""

    db_pool_size: int = 20
    db_max_overflow: int = 10

    agent_timeout_seconds: int = 120
    agent_circuit_failure_threshold: int = 3
    agent_circuit_recovery_timeout: float = 30.0
    # ── Phase B per-run hard ceilings (§13). These bound every run even when
    # the workspace daily budget is 0.0 (unlimited) — a run is never unbounded.
    agent_max_iterations_per_run: int = 3
    agent_max_tool_calls_per_run: int = 12
    agent_max_tokens_per_run: int = 12000
    agent_max_cost_per_run_usd: float = 0.50
    agent_max_duration_s: float = 120.0
    agent_max_graph_replans: int = 2
    # JSON string or dict: {"memory": {"failure_threshold": 5, "recovery_timeout": 15}, ...}
    agent_circuit_config: dict[str, dict[str, Any]] | str = {}

    @field_validator("agent_circuit_config", mode="before")
    @classmethod
    def parse_circuit_config(cls, v: Any) -> dict[str, Any]:
        if isinstance(v, str):
            if not v.strip():
                return {}
            return json.loads(v)
        return v or {}

    @field_validator("agent_kill_switches", mode="before")
    @classmethod
    def parse_kill_switches(cls, v: Any) -> dict[str, bool]:
        if isinstance(v, str):
            if not v.strip():
                return {}
            return json.loads(v)
        return v or {}

    prompt_injection_check: bool = True
    prompt_dir: str = ""
    mvp_scope_enforced: bool = True
    enterprise_routes_enabled: bool = False
    # ReAct (LLM-driven dynamic tool calling) — opt-in per ADR-033.
    # Static dispatch is the deterministic primary path. Enable via
    # AGENT_REACT_ENABLED=1 (set in prod overlay; keep 0 in local/.env.example
    # for determinism and offline tests). When True but LLM_API_KEY missing,
    # _try_react_loop gracefully falls back to static, so ON is safe.
    # Convergence (ADR-037): both tiers now share executor audit/timeout.
    agent_react_enabled: bool = False
    # Agentic scale-safety ceilings (Wave 1, 2026-09-06).
    # Max ReAct tool-calling rounds per loop invocation (replaces hardcoded 3).
    agent_max_react_rounds: int = 5
    # Default daily USD spend budget per workspace enforced on the loop path.
    # 0.0 = disabled (no budget → unlimited, backward compatible).
    agent_default_daily_budget_usd: float = 0.0
    # Browser/scraping tools (browse_job_page etc.) — network-heavy fetches are
    # quota-limited per workspace (sliding hour window).
    browser_tools_enabled: bool = True
    scrape_quota_per_hour: int = 20

    # ── Temporal durable execution (ADR-038) ──────────────────────────
    temporal_enabled: bool = False
    temporal_host: str = "localhost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue_ingest: str = "vaeloom-ingest-q"
    temporal_task_queue_agent: str = "vaeloom-agent-q"
    temporal_task_queue_connectors: str = "vaeloom-connectors-q"
    temporal_task_queue_schedules: str = "vaeloom-schedules-q"
    temporal_task_queue_approvals: str = "vaeloom-approvals-q"
    temporal_task_queue_documents: str = "vaeloom-documents-q"
    temporal_task_queue_memory: str = "vaeloom-memory-q"
    temporal_task_queue_events: str = "vaeloom-events-q"
    temporal_api_key: str = ""  # for Temporal Cloud; empty = self-hosted mTLS/none
    temporal_tls: bool = False

    # ── LangGraph agent reasoning (ADR-039) — topology only (Temporal owns durability) ──
    # Controlled via LANGGRAPH_ENABLED flag; safe default False. Production must never
    # accidentally activate incomplete graph. Graph runs inside DurableAgentRunActivity.
    langgraph_enabled: bool = False
    langgraph_version: str = "v1"
    langgraph_shadow_mode: bool = False
    langgraph_agent_run_percent: int = 0  # 0=legacy, 100=graph, 1-99 shadow
    langgraph_checkpoint_backend: str = "memory"  # memory|postgres|redis (memory = MemorySaver)
    langgraph_max_messages: int = 20
    langgraph_max_state_bytes: int = 20480

    # ── CONT-P12 Agent/Model/Retrieval kill switches & lineage (ADR-040..043) ──
    agent_kill_switches: dict[str, bool] = {}  # {"memory": false, "retrieval": false}
    agent_shadow_enabled: bool = False  # WS-12.1 shadow compare 8->28 agents
    agent_shadow_percent: int = 0  # 0-100 percent via request_id hash
    retrieval_hybrid_enabled: bool = True  # WS-12.2: ILIKE + pgvector + KG + tsvector
    retrieval_provenance_required: bool = True  # WS-12.2 lineage
    eval_shadow_enabled: bool = False
    model_lineage_enabled: bool = True  # WS-12.3 cost/lineage
    ai_bill_of_materials_enabled: bool = True

    model_config = {"env_prefix": "", "case_sensitive": False}

    def __init__(self, **kwargs):
        secret_manager = kwargs.pop("secret_manager", None)
        super().__init__(**kwargs)
        # Alias: MICROSOFT_* → MS_GRAPH_* (both accepted)
        if not self.ms_graph_client_id:
            alias = os.environ.get("MICROSOFT_CLIENT_ID") or os.environ.get("MICROSOFT_GRAPH_CLIENT_ID") or ""
            if alias:
                object.__setattr__(self, "ms_graph_client_id", alias)
        if not self.ms_graph_client_secret:
            alias = os.environ.get("MICROSOFT_CLIENT_SECRET") or os.environ.get("MICROSOFT_GRAPH_CLIENT_SECRET") or ""
            if alias:
                object.__setattr__(self, "ms_graph_client_secret", alias)
        if not self.ms_graph_refresh_token:
            alias = os.environ.get("MICROSOFT_REFRESH_TOKEN") or os.environ.get("MICROSOFT_GRAPH_REFRESH_TOKEN") or ""
            if alias:
                object.__setattr__(self, "ms_graph_refresh_token", alias)
        if not self.ms_graph_tenant_id or self.ms_graph_tenant_id == "common":
            alias = os.environ.get("MICROSOFT_TENANT_ID") or os.environ.get("MS_TENANT_ID") or ""
            if alias:
                object.__setattr__(self, "ms_graph_tenant_id", alias)
        # Auto-wire Infisical when INFISICAL_ENABLED (fixes dead code 2026-08-21)
        if secret_manager is None and os.environ.get("INFISICAL_ENABLED", "").lower() in ("1", "true", "yes"):
            try:
                from .infrastructure.secrets import get_secret_manager

                secret_manager = get_secret_manager()
            except Exception:
                secret_manager = None
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

    if not settings.jwt_secret:
        errors.append("JWT_SECRET must be set — refusing to start with empty/missing secret")
    elif len(settings.jwt_secret) < 32:
        msg = "JWT_SECRET must be at least 32 characters (got %d) — weak secret" % len(settings.jwt_secret)
        if settings.service_environment != "local":
            errors.append(msg + " — refusing to start in non-local")
        else:
            warnings.append(msg + " — allowed in local, but set a stronger secret for prod")
    elif settings.jwt_secret.lower() in {"secret", "changeme", "dev-only", "super-secret"}:
        errors.append("JWT_SECRET is a known weak/default value — refusing to start")

    if not settings.storage_secret_key and settings.service_environment != "local":
        errors.append("STORAGE_SECRET_KEY must be set in non-local environments")

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

    if settings.temporal_enabled and not settings.temporal_host:
        errors.append("TEMPORAL_HOST must be set when TEMPORAL_ENABLED is true")

    if settings.service_environment != "local":
        localhost_origins = [o for o in settings.allowed_origins if "localhost" in o]
        if localhost_origins:
            errors.append(f"CORS allowed_origins contains localhost in non-local env: {localhost_origins} — set VAELOOM_ALLOWED_ORIGINS")

    if errors:
        raise RuntimeError(
            "Startup validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        )

    return {"errors": errors, "warnings": warnings}
