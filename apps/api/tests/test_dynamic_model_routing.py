"""Enterprise Dynamic Model Routing & Circuit Breaker Test Suite.

Verifies:
- Task complexity tier resolution
- Provider fallback chain on circuit breaker trip
- Circuit breaker recovery
- Tenant policy overrides
- DB synchronization into MODEL_CATALOG
- Cost tracking and audit records
"""
import pytest
from api.models.registries import ModelProviderEntry
from api.services.model_router import (
    MODEL_CATALOG,
    ModelConfig,
    ModelRouter,
    ProviderCircuitBreaker,
)

pytestmark = pytest.mark.asyncio


async def test_tier_resolution():
    """Verify tasks map to appropriate complexity tiers."""
    router = ModelRouter()
    # Simple tasks -> fast tier
    assert router.resolve_tier("email_classify") == "fast"
    # Moderate tasks -> balanced tier
    assert router.resolve_tier("resume_generate") == "balanced"
    # Complex tasks -> powerful tier
    assert router.resolve_tier("cover_letter_generate") == "powerful"
    # Forced tier override
    assert router.resolve_tier("email_classify", force_tier="powerful") == "powerful"
    # Agent mapping
    assert router.resolve_tier("unknown_task", agent_name="planning") == "powerful"


async def test_circuit_breaker_and_fallback():
    """Verify circuit breaker trips and auto-routes to fallback provider."""
    router = ModelRouter(default_provider="openai")

    # Initially OpenAI is selected
    model = router.select_model("resume_generate")
    assert model.provider == "openai"

    # Report 3 consecutive failures for OpenAI
    router.report_provider_failure("openai")
    router.report_provider_failure("openai")
    assert router.is_provider_available("openai") is True  # 2 < 3

    router.report_provider_failure("openai")
    assert router.is_provider_available("openai") is False  # Tripped

    # Model router should now seamlessly fallback to next provider in chain (e.g. anthropic)
    model_fallback = router.select_model("resume_generate")
    assert model_fallback.provider != "openai"
    assert model_fallback.tier == "balanced"

    # Reset upon recovery / success
    router.report_provider_success("openai")
    assert router.is_provider_available("openai") is True
    model_recovered = router.select_model("resume_generate")
    assert model_recovered.provider == "openai"


async def test_tenant_policy_overrides():
    """Verify tenant policy restricts allowed providers."""
    router = ModelRouter(default_provider="openai")

    # Tenant 1 enforces only Anthropic
    router.set_tenant_policy("tenant-anthropic-only", {
        "allowed_providers": ["anthropic"],
        "preferred_provider": "anthropic",
    })

    model = router.select_model("resume_generate", tenant_id="tenant-anthropic-only")
    assert model.provider == "anthropic"

    # Unknown tenant gets default provider
    model_default = router.select_model("resume_generate", tenant_id="tenant-regular")
    assert model_default.provider == "openai"


async def test_db_sync_model_registry(db_session):
    """Verify synchronizing models from PostgreSQL ModelProviderEntry."""
    # Insert custom model into DB
    custom_model = ModelProviderEntry(
        model_id="custom-fine-tuned-v1",
        name="Custom Fine-Tuned Gemma",
        provider="custom_corp",
        version="1.0.0",
        tier="balanced",
        context_window=64000,
        cost_per_1k_input=0.0005,
        cost_per_1k_output=0.001,
        capabilities={"tool_calling": True},
        is_active=True,
    )
    db_session.add(custom_model)
    await db_session.commit()

    router = ModelRouter()
    synced = await router.sync_from_db(session=db_session)
    assert synced > 0
    assert "custom-fine-tuned-v1" in MODEL_CATALOG
    assert MODEL_CATALOG["custom-fine-tuned-v1"].provider == "custom_corp"


async def test_record_usage_and_costs():
    """Verify cost calculation and audit logging."""
    router = ModelRouter()
    cfg = ModelConfig(
        name="test-model",
        provider="test-prov",
        max_tokens=100000,
        cost_per_1k_input=0.002,
        cost_per_1k_output=0.010,
        tier="balanced",
    )
    rec = router.record_usage(
        agent_name="career_architect",
        task_type="resume_generate",
        model=cfg,
        input_tokens=2000,
        output_tokens=500,
        latency_ms=250.0,
    )
    # Expected cost: (2 * 0.002) + (0.5 * 0.010) = 0.004 + 0.005 = 0.009
    assert rec["cost_usd"] == 0.009
    assert rec["latency_ms"] == 250.0

    summary = router.get_agent_summary("career_architect")
    assert summary["call_count"] == 1
    assert summary["total_cost_usd"] == 0.009
    assert summary["avg_latency_ms"] == 250.0
