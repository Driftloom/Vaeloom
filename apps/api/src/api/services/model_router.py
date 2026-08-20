"""Model router and cost tracking.

Selects the appropriate LLM model based on task complexity and tracks
per-agent token usage and cost.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    name: str
    provider: str  # "openai" or "anthropic"
    max_tokens: int
    cost_per_1k_input: float  # USD per 1K input tokens
    cost_per_1k_output: float  # USD per 1K output tokens
    tier: str  # "fast", "balanced", "powerful"


# Model catalog — extend as new models are added
MODEL_CATALOG: dict[str, ModelConfig] = {
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
}

# Task complexity mapping — which tier to use for each agent task type
TASK_MODEL_MAP: dict[str, str] = {
    # Simple tasks — use fast models
    "email_classify": "fast",
    "email_draft": "fast",
    "reminder_check": "fast",
    "document_tag": "fast",
    "calendar_check": "fast",
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


class ModelRouter:
    """Selects model based on task complexity and tracks cost."""

    def __init__(self, default_provider: str = "openai"):
        self._default_provider = default_provider
        self._cost_log: list[dict] = []

    def select_model(
        self,
        task_type: str,
        provider: Optional[str] = None,
        force_tier: Optional[str] = None,
    ) -> ModelConfig:
        """Select the best model for a given task type."""
        provider = provider or self._default_provider
        tier = force_tier or TASK_MODEL_MAP.get(task_type, "balanced")

        # Find best match: tier + provider
        for model in MODEL_CATALOG.values():
            if model.tier == tier and model.provider == provider:
                return model

        # Fallback: any model in the tier
        for model in MODEL_CATALOG.values():
            if model.tier == tier:
                return model

        # Ultimate fallback
        return MODEL_CATALOG.get("gpt-4o-mini", list(MODEL_CATALOG.values())[0])

    def record_usage(
        self,
        agent_name: str,
        task_type: str,
        model: ModelConfig,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float = 0.0,
    ) -> dict:
        """Record token usage and compute cost."""
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
            agent_name, model.name, input_tokens, output_tokens, cost,
        )
        return record

    def get_agent_summary(self, agent_name: Optional[str] = None) -> dict:
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

    def get_global_summary(self) -> dict:
        """Get global cost/usage across all agents."""
        return self.get_agent_summary(None)


# Singleton
model_router = ModelRouter()
