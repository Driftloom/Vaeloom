"""Tests for Hybrid Router with fast keyword path and micro-LLM fallback."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from api.config import settings
from api.orchestrator.router import classify_intent, _llm_classify_intent
from api.services.llm_service import LLMService, llm_service


@pytest.mark.asyncio
async def test_fast_keyword_path_high_confidence():
    agent, conf = await classify_intent("organize my documents and clean folders")
    assert agent == "organization"
    assert conf >= 0.75


@pytest.mark.asyncio
async def test_llm_fallback_on_ambiguous_query(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    async def mock_llm_completion(*args, **kwargs):
        return {
            "content": '{"agent": "job_search", "confidence": 0.94}',
            "role": "assistant",
        }

    # Dual patch (class + singleton instance) with a self-agnostic signature.
    # Rationale: older suites (e.g. test_remaining_agents) patch the singleton
    # instance bare, leaving shadowing __dict__ entries that would otherwise
    # hijack this class-level patch. The instance patch wins during this test;
    # teardown restores the prior shadow. This file runs last in the runtime
    # suite so its own leftover shadow harms nothing. Long-term fix: never
    # patch the singleton instance (see Phase B report §19).
    monkeypatch.setattr(LLMService, "generate_completion", mock_llm_completion)
    monkeypatch.setattr(llm_service, "generate_completion", mock_llm_completion, raising=False)

    # Ambiguous phrase that has zero keyword matches
    agent, conf = await classify_intent("where should I take my talents next in tech?")
    assert agent == "job_search"
    assert conf == 0.94


@pytest.mark.asyncio
async def test_llm_fallback_handles_error_gracefully(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    async def mock_llm_completion(*args, **kwargs):
        raise RuntimeError("Provider timeout")

    monkeypatch.setattr(LLMService, "generate_completion", mock_llm_completion)
    monkeypatch.setattr(llm_service, "generate_completion", mock_llm_completion, raising=False)

    agent, conf = await classify_intent("completely unknown unstructured message")
    assert agent == "memory"
    assert conf == 0.5
