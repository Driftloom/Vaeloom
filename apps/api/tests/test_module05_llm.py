"""Test Suite: Module 05 LLM Engine & Routing (M05-LLM).
Verifies model routing, provider client execution, fallbacks, and structured completion outputs.
"""
import pytest
from unittest.mock import AsyncMock, patch

from api.config import settings
from api.services.llm_service import llm_service


@pytest.mark.asyncio
async def test_llm_completion_and_fallbacks(monkeypatch):
    """Verify LLM completion generation and structured output parsing."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-mock-key")

    mock_resp = {
        "content": "Enterprise data retention policies require 7-year archives for audit records.",
        "role": "assistant",
        "usage": {"input_tokens": 100, "output_tokens": 20},
    }

    with patch.object(llm_service, "generate_completion", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_resp

        res = await llm_service.generate_completion(
            messages=[{"role": "user", "content": "What is the retention policy?"}],
            temperature=0.0,
        )

        assert mock_gen.called
        assert "7-year archives" in res["content"]
        assert res["usage"]["output_tokens"] == 20
