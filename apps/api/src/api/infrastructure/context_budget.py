"""
Context Budget & Token Engineering.

Provides structured token budget allocation, word-boundary truncation,
and sliding-window conversation history compaction.
Prevents arbitrary character slicing and attention dilution ('lost in the middle').
"""
import logging
import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# Default budget percentages
DEFAULT_SYSTEM_RATIO = 0.15   # 15% system prompt & mission
DEFAULT_HISTORY_RATIO = 0.25  # 25% conversation history
DEFAULT_RAG_RATIO = 0.35      # 35% retrieved memory & knowledge graph
DEFAULT_TOOLS_RATIO = 0.25    # 25% scratchpad & tool outputs

# Approximate characters per token across common LLM tokenizers (tiktoken, sentencepiece)
CHARS_PER_TOKEN = 3.8


def estimate_tokens(text: str | None) -> int:
    """Fast, dependency-free token estimation.

    Approximately 3.8-4.0 characters per token for English and structured JSON.
    """
    if not text:
        return 0
    return max(1, math.ceil(len(text) / CHARS_PER_TOKEN))


@dataclass
class ContextPartition:
    total_budget: int
    system_cap: int
    history_cap: int
    rag_cap: int
    tools_cap: int

    def to_dict(self) -> dict[str, int]:
        return {
            "total_budget": self.total_budget,
            "system_cap": self.system_cap,
            "history_cap": self.history_cap,
            "rag_cap": self.rag_cap,
            "tools_cap": self.tools_cap,
        }


def calculate_budget(
    total_budget: int = 8192,
    system_ratio: float = DEFAULT_SYSTEM_RATIO,
    history_ratio: float = DEFAULT_HISTORY_RATIO,
    rag_ratio: float = DEFAULT_RAG_RATIO,
    tools_ratio: float = DEFAULT_TOOLS_RATIO,
) -> ContextPartition:
    """Calculate token caps for each context partition."""
    # Normalize ratios if they don't sum to 1.0
    total_ratio = system_ratio + history_ratio + rag_ratio + tools_ratio
    s_r = system_ratio / total_ratio
    h_r = history_ratio / total_ratio
    r_r = rag_ratio / total_ratio
    t_r = tools_ratio / total_ratio

    return ContextPartition(
        total_budget=total_budget,
        system_cap=int(total_budget * s_r),
        history_cap=int(total_budget * h_r),
        rag_cap=int(total_budget * r_r),
        tools_cap=int(total_budget * t_r),
    )


def truncate_text_to_tokens(
    text: str,
    max_tokens: int,
    preserve_end: bool = False,
    indicator: str = " …[truncated context]",
) -> str:
    """Truncate text to fit within max_tokens cleanly without breaking mid-word.

    If preserve_end is True, truncates from the beginning (useful for logs/history).
    """
    if not text or max_tokens <= 0:
        return ""

    est_tokens = estimate_tokens(text)
    if est_tokens <= max_tokens:
        return text

    target_chars = int(max_tokens * CHARS_PER_TOKEN) - len(indicator)
    if target_chars <= 0:
        return indicator.strip()

    if preserve_end:
        # Keep end
        trimmed = text[-target_chars:]
        # Find first whitespace to avoid mid-word start
        space_idx = trimmed.find(" ")
        if space_idx != -1 and space_idx < 30:
            trimmed = trimmed[space_idx + 1:]
        return f"{indicator.strip()} {trimmed}"
    else:
        # Keep start
        trimmed = text[:target_chars]
        # Find last whitespace to avoid mid-word cut
        space_idx = trimmed.rfind(" ")
        if space_idx != -1 and space_idx > target_chars - 30:
            trimmed = trimmed[:space_idx]
        return f"{trimmed}{indicator}"


async def compact_conversation_history(
    messages: list[dict[str, Any]],
    max_tokens: int,
    summarizer_fn: Callable[[str], Any] | None = None,
) -> list[dict[str, Any]]:
    """Compacts conversation history to fit within max_tokens.

    Preserves:
    - System message (if present as first message)
    - Most recent turns (most relevant to immediate context)
    Older turns exceeding the budget are summarized into a single context block
    with retained provenance message indices.
    """
    if not messages or max_tokens <= 0:
        return []

    # Separate system message if at index 0
    system_msg = None
    chat_turns = list(messages)
    if chat_turns and chat_turns[0].get("role") == "system":
        system_msg = chat_turns.pop(0)

    # Calculate token size per message
    turn_tokens = [estimate_tokens(m.get("content", "")) for m in chat_turns]
    total_tokens = sum(turn_tokens)

    if total_tokens <= max_tokens:
        return ([system_msg] if system_msg else []) + chat_turns

    # Greedily retain the most recent messages that fit
    retained_turns: list[dict[str, Any]] = []
    used_tokens = 0
    split_idx = len(chat_turns)

    for i in range(len(chat_turns) - 1, -1, -1):
        cost = turn_tokens[i]
        if used_tokens + cost <= max_tokens * 0.8:  # reserve 20% budget for summary
            retained_turns.insert(0, chat_turns[i])
            used_tokens += cost
            split_idx = i
        else:
            break

    # If at least 2 older messages were dropped, generate a summary block
    dropped_turns = chat_turns[:split_idx]
    if dropped_turns:
        summary_lines = []
        for i, dt in enumerate(dropped_turns):
            role = dt.get("role", "unknown")
            snippet = (dt.get("content", "") or "")[:120].replace("\n", " ").strip()
            summary_lines.append(f"- [msg_{i} {role}]: {snippet}")

        raw_summary_body = "\n".join(summary_lines)
        if summarizer_fn:
            try:
                llm_summary = await summarizer_fn(raw_summary_body)
                if isinstance(llm_summary, str) and llm_summary.strip():
                    summary_content = f"[Summary of earlier conversation (retains {len(dropped_turns)} turns):\n{llm_summary.strip()}]"
                else:
                    summary_content = f"[Summary of earlier conversation (retains {len(dropped_turns)} turns):\n{raw_summary_body}]"
            except Exception as e:
                logger.warning(f"History summarizer failed: {e}")
                summary_content = f"[Summary of earlier conversation (retains {len(dropped_turns)} turns):\n{raw_summary_body}]"
        else:
            summary_content = f"[Summary of earlier conversation (retains {len(dropped_turns)} turns):\n{raw_summary_body}]"

        summary_msg = {"role": "system", "content": summary_content}
        result = []
        if system_msg:
            result.append(system_msg)
        result.append(summary_msg)
        result.extend(retained_turns)
        return result

    return ([system_msg] if system_msg else []) + retained_turns
