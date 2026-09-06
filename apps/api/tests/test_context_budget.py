"""
Unit tests for Context Budget and History Compaction (Wave 3).
"""
import pytest

from api.infrastructure.context_budget import (
    calculate_budget,
    compact_conversation_history,
    estimate_tokens,
    truncate_text_to_tokens,
)


class TestTokenEstimationAndBudget:
    def test_estimate_tokens_empty(self):
        assert estimate_tokens("") == 0
        assert estimate_tokens(None) == 0

    def test_estimate_tokens_proportional(self):
        text_100_chars = "x" * 100
        est = estimate_tokens(text_100_chars)
        assert 20 <= est <= 35

    def test_calculate_budget_defaults(self):
        budget = calculate_budget(total_budget=10000)
        assert budget.total_budget == 10000
        # 15% system, 25% history, 35% rag, 25% tools
        assert budget.system_cap == 1500
        assert budget.history_cap == 2500
        assert budget.rag_cap == 3500
        assert budget.tools_cap == 2500

    def test_calculate_budget_custom_ratios(self):
        budget = calculate_budget(
            total_budget=1000,
            system_ratio=0.1,
            history_ratio=0.3,
            rag_ratio=0.4,
            tools_ratio=0.2,
        )
        assert budget.system_cap == 100
        assert budget.history_cap == 300
        assert budget.rag_cap == 400
        assert budget.tools_cap == 200


class TestTruncateToTokens:
    def test_truncate_noop_when_under_budget(self):
        short = "This is a short sentence."
        assert truncate_text_to_tokens(short, max_tokens=100) == short

    def test_truncate_at_word_boundary(self):
        long_text = "The quick brown fox jumps over the lazy dog repeatedly and continues running into the forest."
        truncated = truncate_text_to_tokens(long_text, max_tokens=10)
        assert len(truncated) < len(long_text)
        assert "…[truncated context]" in truncated
        # Should not end with a broken mid-word before the indicator
        clean_part = truncated.replace(" …[truncated context]", "")
        assert not clean_part.endswith(" ")

    def test_truncate_preserve_end(self):
        long_text = "Beginning of the story. Middle of the story. The very important conclusion at the end."
        truncated = truncate_text_to_tokens(long_text, max_tokens=18, preserve_end=True)
        assert "truncated context" in truncated
        assert "conclusion at the end" in truncated


class TestCompactConversationHistory:
    @pytest.mark.asyncio
    async def test_compact_noop_when_fits(self):
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        compacted = await compact_conversation_history(messages, max_tokens=1000)
        assert compacted == messages

    @pytest.mark.asyncio
    async def test_compact_drops_and_summarizes_older_turns(self):
        system_msg = {"role": "system", "content": "You are a helpful assistant."}
        long_turns = [
            {"role": "user", "content": f"Turn {i}: I have extensive experience in Python and PostgreSQL architecture."}
            for i in range(20)
        ]
        all_messages = [system_msg] + long_turns

        # Cap history to small budget
        compacted = await compact_conversation_history(all_messages, max_tokens=150)
        assert len(compacted) < len(all_messages)
        # System prompt preserved as first message
        assert compacted[0]["role"] == "system"
        assert compacted[0]["content"] == "You are a helpful assistant."

        # Second message is the summary block
        assert compacted[1]["role"] == "system"
        assert "Summary of earlier conversation" in compacted[1]["content"]

        # Most recent turn is preserved
        assert compacted[-1]["content"] == long_turns[-1]["content"]

    @pytest.mark.asyncio
    async def test_compact_uses_custom_summarizer(self):
        messages = [
            {"role": "user", "content": f"Detailed step {i} with long description"}
            for i in range(15)
        ]

        async def mock_summarizer(raw: str) -> str:
            return "User discussed 15 detailed steps."

        compacted = await compact_conversation_history(messages, max_tokens=60, summarizer_fn=mock_summarizer)
        summary_msg = compacted[0]
        assert "User discussed 15 detailed steps." in summary_msg["content"]
