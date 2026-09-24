"""Enterprise Model Router, Circuit Breaker, and Cost Tracking.

Selects the appropriate LLM model dynamically based on task complexity, provider health,
circuit-breaker telemetry, and workspace/tenant policies.
Tracks per-agent token usage and cost with audit-grade precision.
"""

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    name: str
    provider: str  # "openai", "anthropic", "groq", "google", "ollama"
    max_tokens: int
    cost_per_1k_input: float  # USD per 1K input tokens
    cost_per_1k_output: float  # USD per 1K output tokens
    tier: str  # "fast", "balanced", "powerful"
    health_status: str = "healthy"  # "healthy", "degraded", "unhealthy"
    is_active: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


# Default built-in model catalog
DEFAULT_MODEL_CATALOG: dict[str, ModelConfig] = {
    # OpenAI
    "gpt-4o-mini": ModelConfig("gpt-4o-mini", "openai", 128000, 0.00015, 0.0006, "fast"),
    "gpt-4o": ModelConfig("gpt-4o", "openai", 128000, 0.0025, 0.01, "balanced"),
    "gpt-4-turbo": ModelConfig("gpt-4-turbo", "openai", 128000, 0.01, 0.03, "powerful"),
    "text-embedding-3-small": ModelConfig("text-embedding-3-small", "openai", 8191, 0.00002, 0.0, "fast"),
    "text-embedding-3-large": ModelConfig("text-embedding-3-large", "openai", 8191, 0.00013, 0.0, "balanced"),
    # Anthropic
    "claude-3-haiku-20240307": ModelConfig("claude-3-haiku-20240307", "anthropic", 200000, 0.00025, 0.00125, "fast"),
    "claude-3-5-sonnet-20241022": ModelConfig("claude-3-5-sonnet-20241022", "anthropic", 200000, 0.003, 0.015, "balanced"),
    "claude-3-opus-20240229": ModelConfig("claude-3-opus-20240229", "anthropic", 200000, 0.015, 0.075, "powerful"),
    # Groq Cloud
    "openai/gpt-oss-120b": ModelConfig("openai/gpt-oss-120b", "groq", 131072, 0.00015, 0.0006, "balanced"),
    "openai/gpt-oss-20b": ModelConfig("openai/gpt-oss-20b", "groq", 131072, 0.00008, 0.0002, "fast"),
    "qwen/qwen3.8-27b": ModelConfig("qwen/qwen3.8-27b", "groq", 131072, 0.00010, 0.0003, "fast"),
    # Google Gemini
    "gemini-3.5-flash": ModelConfig("gemini-3.5-flash", "google", 1000000, 0.000075, 0.0003, "fast"),
    "gemini-3.6-flash": ModelConfig("gemini-3.6-flash", "google", 1000000, 0.000075, 0.0003, "fast"),
    "gemini-embedding-2": ModelConfig("gemini-embedding-2", "google", 8192, 0.0, 0.0, "fast"),
}

# Authoritative catalog instance
MODEL_CATALOG: dict[str, ModelConfig] = dict(DEFAULT_MODEL_CATALOG)

# Fallback provider chain in order of preference
DEFAULT_PROVIDER_FALLBACK_CHAIN = ["openai", "anthropic", "groq", "google"]

# Task complexity mapping — which tier to use for each agent task type
TASK_MODEL_MAP: dict[str, str] = {
    # Simple tasks — use fast models
    "email_classify": "fast",
    "email_draft": "fast",
    "reminder_check": "fast",
    "document_tag": "fast",
    "calendar_check": "fast",
    "intent_classify": "fast",
    "qa_validate": "fast",
    "adversarial_scan": "fast",
    # Moderate tasks — use balanced models
    "memory_extract": "balanced",
    "memory_merge": "balanced",
    "resume_generate": "balanced",
    "ats_score": "balanced",
    "job_search": "balanced",
    "document_summarize": "balanced",
    "entity_dedup": "balanced",
    # Complex tasks — use powerful models
    "cover_letter_generate": "powerful",
    "memory_consolidate": "powerful",
    "conflict_resolution": "powerful",
    "plan_generate": "powerful",
}

# Agent method → task_type mapping
AGENT_TASK_TYPE_MAP: dict[str, str] = {
    "organization": "document_tag",
    "memory": "memory_extract",
    "resume": "resume_generate",
    "ats": "ats_score",
    "job_search": "job_search",
    "application": "cover_letter_generate",
    "gmail": "email_classify",
    "scheduler": "calendar_check",
    "planning": "plan_generate",
    "research": "document_summarize",
    "career": "document_summarize",
    "learning": "document_summarize",
    "github": "document_summarize",
    "coding": "document_summarize",
    "reminder": "reminder_check",
    "analytics": "document_summarize",
    "recommendation": "document_summarize",
    "reflection": "memory_consolidate",
    "security": "adversarial_scan",
    "connector": "document_summarize",
    "plugin": "document_summarize",
    "drive": "document_tag",
    "workspace": "document_tag",
    "calendar": "calendar_check",
    "internship": "job_search",
    "document": "document_summarize",
    "pdf": "document_tag",
    "self_improvement": "qa_validate",
}


class ProviderCircuitBreaker:
    """Manages failure detection and circuit tripping per LLM provider."""

    def __init__(self, failure_threshold: int = 3, recovery_time_sec: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_time_sec = recovery_time_sec
        self.consecutive_failures: dict[str, int] = {}
        self.last_failure_time: dict[str, float] = {}

    def report_success(self, provider: str) -> None:
        """Reset failure counter on healthy request."""
        self.consecutive_failures[provider] = 0

    def report_failure(self, provider: str) -> None:
        """Record provider error and potentially trip circuit."""
        now = time.time()
        self.consecutive_failures[provider] = self.consecutive_failures.get(provider, 0) + 1
        self.last_failure_time[provider] = now
        logger.warning(
            "Provider %s failure count: %d (threshold: %d)",
            provider,
            self.consecutive_failures[provider],
            self.failure_threshold,
        )

    def is_available(self, provider: str) -> bool:
        """Check if provider circuit is closed (available) or half-open."""
        failures = self.consecutive_failures.get(provider, 0)
        if failures < self.failure_threshold:
            return True

        last_fail = self.last_failure_time.get(provider, 0.0)
        if (time.time() - last_fail) > self.recovery_time_sec:
            # Recovery period elapsed, allow probe (half-open)
            return True

        return False


class ModelRouter:
    """Enterprise dynamic model router with circuit breakers and tenant policy overrides."""

    def __init__(self, default_provider: str = "openai"):
        self._default_provider = default_provider
        self._circuit_breaker = ProviderCircuitBreaker()
        self._cost_log: list[dict[str, Any]] = []
        self._tenant_policies: dict[str, dict[str, Any]] = {}

    @property
    def circuit_breaker(self) -> ProviderCircuitBreaker:
        return self._circuit_breaker

    def report_provider_success(self, provider: str) -> None:
        self._circuit_breaker.report_success(provider)

    def report_provider_failure(self, provider: str) -> None:
        self._circuit_breaker.report_failure(provider)

    def is_provider_available(self, provider: str) -> bool:
        return self._circuit_breaker.is_available(provider)

    def set_tenant_policy(self, tenant_id: str, policy: dict[str, Any]) -> None:
        """Set in-memory tenant model policy override."""
        self._tenant_policies[tenant_id] = policy

    async def sync_from_db(self, session: AsyncSession | None = None) -> int:
        """Synchronize active models and policies from PostgreSQL ModelProviderEntry."""
        try:
            from ..database import async_session_factory
            from ..models.registries import ModelProviderEntry

            async def _fetch(s: AsyncSession) -> list[ModelProviderEntry]:
                stmt = select(ModelProviderEntry).where(ModelProviderEntry.is_active.is_(True))
                res = await s.execute(stmt)
                return list(res.scalars().all())

            entries: list[ModelProviderEntry] = []
            if session:
                entries = await _fetch(session)
            else:
                async with async_session_factory() as s:
                    entries = await _fetch(s)

            synced_count = 0
            for entry in entries:
                MODEL_CATALOG[entry.model_id] = ModelConfig(
                    name=entry.name,
                    provider=entry.provider,
                    max_tokens=entry.context_window,
                    cost_per_1k_input=entry.cost_per_1k_input,
                    cost_per_1k_output=entry.cost_per_1k_output,
                    tier=entry.tier,
                    health_status=entry.health_status,
                    is_active=entry.is_active,
                    metadata=entry.capabilities or {},
                )
                synced_count += 1

            logger.info("Synchronized %d models from database registry", synced_count)
            return synced_count
        except Exception as exc:
            logger.debug("Database model sync skipped/fallback: %s", exc)
            return len(MODEL_CATALOG)

    def resolve_tier(
        self,
        task_type: str,
        force_tier: str | None = None,
        agent_name: str | None = None,
    ) -> str:
        """Determine required complexity tier."""
        if force_tier:
            return force_tier
        if task_type in TASK_MODEL_MAP:
            return TASK_MODEL_MAP[task_type]
        if agent_name and agent_name in AGENT_TASK_TYPE_MAP:
            return TASK_MODEL_MAP.get(AGENT_TASK_TYPE_MAP[agent_name], "balanced")
        return "balanced"

    def select_model(
        self,
        task_type: str,
        provider: str | None = None,
        force_tier: str | None = None,
        agent_name: str | None = None,
        workspace_id: str | None = None,
        tenant_id: str | None = None,
    ) -> ModelConfig:
        """Synchronously select the optimal model respecting health, fallback chain, and policies."""
        tier = self.resolve_tier(task_type, force_tier, agent_name)

        # 1. Check tenant policy restrictions
        allowed_providers = None
        if tenant_id and tenant_id in self._tenant_policies:
            policy = self._tenant_policies[tenant_id]
            allowed_providers = policy.get("allowed_providers")
            if not provider and policy.get("preferred_provider"):
                provider = policy["preferred_provider"]

        # 2. Determine target provider with circuit breaker check
        target_provider = provider or self._default_provider
        if not self.is_provider_available(target_provider):
            logger.warning("Provider %s is degraded/circuit-tripped, finding fallback", target_provider)
            # Find first available fallback in chain
            for fb in DEFAULT_PROVIDER_FALLBACK_CHAIN:
                if fb != target_provider and self.is_provider_available(fb):
                    if allowed_providers is None or fb in allowed_providers:
                        target_provider = fb
                        break

        # 3. Match model by provider + tier + active
        candidates = [
            m for m in MODEL_CATALOG.values()
            if m.is_active and m.health_status != "unhealthy"
        ]

        if allowed_providers:
            candidates = [m for m in candidates if m.provider in allowed_providers]

        # Best match: matching target provider and tier
        for model in candidates:
            if model.provider == target_provider and model.tier == tier:
                return model

        # Fallback 1: any model from target provider
        for model in candidates:
            if model.provider == target_provider:
                return model

        # Fallback 2: any model from another healthy provider matching tier
        for fb in DEFAULT_PROVIDER_FALLBACK_CHAIN:
            if self.is_provider_available(fb):
                for model in candidates:
                    if model.provider == fb and model.tier == tier:
                        return model

        # Fallback 3: any active candidate in the tier
        for model in candidates:
            if model.tier == tier:
                return model

        # Ultimate fallback: safe fast default
        if "gpt-4o-mini" in MODEL_CATALOG:
            return MODEL_CATALOG["gpt-4o-mini"]

        return list(MODEL_CATALOG.values())[0]

    async def select_model_dynamic(
        self,
        task_type: str,
        provider: str | None = None,
        force_tier: str | None = None,
        agent_name: str | None = None,
        workspace_id: str | None = None,
        tenant_id: str | None = None,
        session: AsyncSession | None = None,
    ) -> ModelConfig:
        """Asynchronously select model querying database policies when available."""
        # Query DB policy if tenant_id or workspace_id is provided
        if tenant_id or workspace_id:
            try:
                from ..database import async_session_factory
                from ..models.registries import PolicyEntry

                async def _query_policy(s: AsyncSession) -> dict[str, Any] | None:
                    stmt = select(PolicyEntry).where(
                        PolicyEntry.scope == "model",
                        PolicyEntry.is_active.is_(True),
                    )
                    if tenant_id:
                        try:
                            t_uuid = uuid.UUID(tenant_id)
                            stmt = stmt.where((PolicyEntry.tenant_id == t_uuid) | (PolicyEntry.tenant_id.is_(None)))
                        except (ValueError, TypeError):
                            pass
                    res = await s.execute(stmt)
                    entry = res.scalars().first()
                    return entry.rules if entry else None

                rules = None
                if session:
                    rules = await _query_policy(session)
                else:
                    async with async_session_factory() as s:
                        rules = await _query_policy(s)

                if rules and tenant_id:
                    self._tenant_policies[tenant_id] = rules
            except Exception as exc:
                logger.debug("Model policy DB check skipped: %s", exc)

        return self.select_model(
            task_type=task_type,
            provider=provider,
            force_tier=force_tier,
            agent_name=agent_name,
            workspace_id=workspace_id,
            tenant_id=tenant_id,
        )

    def record_usage(
        self,
        agent_name: str,
        task_type: str,
        model: ModelConfig,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float = 0.0,
    ) -> dict[str, Any]:
        """Record token usage and compute cost with audit precision."""
        cost = (
            (input_tokens / 1000.0) * model.cost_per_1k_input
            + (output_tokens / 1000.0) * model.cost_per_1k_output
        )
        record = {
            "timestamp": time.time(),
            "agent_name": agent_name,
            "task_type": task_type,
            "model": model.name,
            "provider": model.provider,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost, 6),
            "latency_ms": latency_ms,
        }
        self._cost_log.append(record)
        logger.info(
            "LLM usage: agent=%s model=%s in=%d out=%d cost=$%.6f",
            agent_name,
            model.name,
            input_tokens,
            output_tokens,
            cost,
        )
        return record

    def get_agent_summary(self, agent_name: str | None = None) -> dict[str, Any]:
        """Get aggregated cost/usage stats."""
        records = self._cost_log
        if agent_name:
            records = [r for r in records if r["agent_name"] == agent_name]

        if not records:
            return {"total_cost_usd": 0, "total_input_tokens": 0, "total_output_tokens": 0, "call_count": 0}

        return {
            "total_cost_usd": round(sum(r["cost_usd"] for r in records), 6),
            "total_input_tokens": sum(r["input_tokens"] for r in records),
            "total_output_tokens": sum(r["output_tokens"] for r in records),
            "call_count": len(records),
            "avg_latency_ms": round(sum(r["latency_ms"] for r in records) / len(records), 1),
        }

    def get_global_summary(self) -> dict[str, Any]:
        """Get global cost/usage across all agents."""
        return self.get_agent_summary(None)


# Singleton
model_router = ModelRouter()
