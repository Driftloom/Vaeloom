import html
import re
import urllib.parse

_TAG_RE = re.compile(r"<[^>]*>", re.IGNORECASE)
_SCRIPT_BLOCK_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_STYLE_BLOCK_RE = re.compile(r"<\s*style[^>]*>.*?<\s*/\s*style\s*>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", re.IGNORECASE)
_JAVASCRIPT_URI_RE = re.compile(r"\b(javascript|vbscript|data\s*:\s*text/html)\s*:", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s{2,}")


def _decode_evasions(value: str) -> str:
    """Unwrap one layer of encoding evasions before stripping.

    Attackers hide `<script>` as %3Cscript%3E, &lt;script&gt;, \\u003cscript\\u003e,
    or `&#x3C;script&#x3E;`. Decode repeatedly (max 3 rounds) so the strip regexes
    below see the real payload. Runs before — never after — tag removal.
    """
    decoded = value
    for _ in range(3):
        prev = decoded
        try:
            decoded = urllib.parse.unquote(decoded)
        except Exception:
            pass
        try:
            decoded = html.unescape(decoded)
        except Exception:
            pass
        try:
            decoded = decoded.encode("utf-8").decode("unicode_escape", errors="ignore")
        except Exception:
            pass
        if decoded == prev:
            break
    return decoded


def sanitize_text(value: str | None) -> str:
    """Strip HTML/JS injection vectors from user-provided text.

    Removes script blocks, markup tags, event-handler attributes and
    javascript: URIs. Applied server-side on all user-controlled free-text
    fields before persistence.
    """
    if not value:
        return value or ""

    cleaned = _decode_evasions(value)
    cleaned = _SCRIPT_BLOCK_RE.sub("", cleaned)
    cleaned = _STYLE_BLOCK_RE.sub("", cleaned)
    cleaned = _TAG_RE.sub("", cleaned)
    # Second pass: tag removal can expose nested payloads (<<script>script>).
    cleaned = _SCRIPT_BLOCK_RE.sub("", cleaned)
    cleaned = _TAG_RE.sub("", cleaned)
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)
    cleaned = _JAVASCRIPT_URI_RE.sub("", cleaned)
    cleaned = _WHITESPACE_RE.sub(" ", cleaned)
    return cleaned.strip()


# ── TOOL-002: Tool output trust boundary ───────────────────────────
# Tool outputs are untrusted data (connector content, web, documents).
# They must NEVER be fed to the LLM as instructions. We:
# 1) Strip control/instruction-like markers
# 2) Wrap with untrusted provenance tags so LLM can learn to treat as data
# 3) Optionally detect adversarial prompts inside tool output (reuses agent_eval)

_INSTRUCTION_RE = re.compile(
    r"(ignore\s+(all\s+)?previous\s+instructions|system\s*prompt|forget\s+everything|"
    r"disregard\s+previous|you\s+are\s+now\s+a\s+|new\s+instructions\s*:)",
    re.IGNORECASE,
)
_CONTROL_TAG_RE = re.compile(r"(<\s*/?\s*system\s*>|\[\[SYSTEM\]\]|\{\{\s*system\s*\}\})", re.IGNORECASE)


def sanitize_tool_output(value: str, tool_name: str = "tool") -> str:
    """Harden tool output before it is appended to LLM messages.

    - Strips HTML/JS as in sanitize_text
    - Neutralizes instruction-override patterns
    - Caps size (4000 chars is enforced at call-site too)
    - Returns provenance-tagged data block so future detectors can distinguish.
    """
    if not value:
        return ""
    # Base HTML/JS strip
    cleaned = sanitize_text(value)
    # Neutralize instruction-like payloads (replace with bracketed notice, don't just drop — traceability)
    if _INSTRUCTION_RE.search(cleaned):
        cleaned = _INSTRUCTION_RE.sub("[filtered instruction-like content]", cleaned)
    cleaned = _CONTROL_TAG_RE.sub("[filtered control tag]", cleaned)
    # Enforce size cap
    if len(cleaned) > 4000:
        cleaned = cleaned[:4000] + " …[truncated]"
    # Provenance wrap — supervisor already does this for context, but ReAct needs it per tool
    return f"[from:{tool_name} untrusted]\n{cleaned}\n[end:{tool_name}]"


def looks_like_prompt_injection(text: str) -> bool:
    """Lightweight check for tool-output-borne injection (uses same heuristics as agent_eval)."""
    try:
        from ..infrastructure.agent_eval import detect_adversarial_prompt

        hits = detect_adversarial_prompt(text)
        return any(h.get("severity") == "critical" for h in (hits or []))
    except Exception:
        # Fallback to local regex if infra not available
        return bool(_INSTRUCTION_RE.search(text) or _CONTROL_TAG_RE.search(text))
