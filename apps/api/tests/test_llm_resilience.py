"""Tests for LLM Inference Resilience (Retries on 429/5xx and Tier Failover)."""
from __future__ import annotations

import pytest
from api.services.llm_service import (
    LLMProviderError,
    LLMService,
    LLMTransientError,
    llm_service,
)


@pytest.fixture(autouse=True)
def restore_real_generate_completion(monkeypatch):
    """Restore the unmocked generate_completion so resilience logic is tested."""
    monkeypatch.setattr(LLMService, "generate_completion", LLMService._ORIGINAL_GENERATE_COMPLETION)


@pytest.mark.asyncio
async def test_llm_retry_on_transient_error(monkeypatch):
    service = LLMService()
    calls = 0

    async def mock_call(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise LLMTransientError("Rate limit exceeded 429", status_code=429)
        return {
            "content": "Success after retry",
            "role": "assistant",
            "finish_reason": "stop",
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }

    monkeypatch.setattr(service, "_openai_completion", mock_call)
    monkeypatch.setattr(service, "provider", "openai")
    monkeypatch.setattr(service, "model", "gpt-4o-mini")

    res = await service.generate_completion(
        messages=[{"role": "user", "content": "Hello"}],
        model="gpt-4o-mini",
        provider_override="openai",
        api_key_override="test-key",
    )

    assert res["content"] == "Success after retry"
    assert calls == 2


@pytest.mark.asyncio
async def test_llm_tier_failover(monkeypatch):
    service = LLMService()
    attempted_models = []

    async def mock_call(messages, effective_model, *args, **kwargs):
        attempted_models.append(effective_model)
        if effective_model == "gpt-4-turbo":
            # Primary 'powerful' tier completely fails
            raise LLMProviderError("Primary provider outage on gpt-4-turbo")
        return {
            "content": f"Success on fallback {effective_model}",
            "role": "assistant",
            "finish_reason": "stop",
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }

    monkeypatch.setattr(service, "_generate_completion_with_retry", mock_call)
    monkeypatch.setattr(service, "provider", "openai")

    res = await service.generate_completion(
        messages=[{"role": "user", "content": "Write strategic plan"}],
        model="gpt-4-turbo",  # powerful tier
        provider_override="openai",
        api_key_override="test-key",
    )

    assert "Success on fallback" in res["content"]
    assert "gpt-4-turbo" in attempted_models
    assert len(attempted_models) > 1
    # Check that fallback attempted a balanced model (e.g. gpt-4o)
    assert any(m != "gpt-4-turbo" for m in attempted_models)


@pytest.mark.asyncio
async def test_llm_all_tiers_exhausted_raises_error(monkeypatch):
    service = LLMService()

    async def mock_call(*args, **kwargs):
        raise LLMProviderError("Global provider outage")

    monkeypatch.setattr(service, "_generate_completion_with_retry", mock_call)

    with pytest.raises(LLMProviderError, match="Global provider outage"):
        await service.generate_completion(
            messages=[{"role": "user", "content": "Hello"}],
            model="gpt-4-turbo",
            provider_override="openai",
            api_key_override="test-key",
        )
