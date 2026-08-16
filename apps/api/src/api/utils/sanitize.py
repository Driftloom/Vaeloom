import re

_TAG_RE = re.compile(r"<[^>]*>", re.IGNORECASE)
_SCRIPT_BLOCK_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", re.IGNORECASE)
_JAVASCRIPT_URI_RE = re.compile(r"\bjavascript\s*:", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s{2,}")


def sanitize_text(value: str | None) -> str:
    """Strip HTML/JS injection vectors from user-provided text.

    Removes script blocks, markup tags, event-handler attributes and
    javascript: URIs. Applied server-side on all user-controlled free-text
    fields before persistence.
    """
    if not value:
        return value or ""

    cleaned = _SCRIPT_BLOCK_RE.sub("", value)
    cleaned = _TAG_RE.sub("", cleaned)
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)
    cleaned = _JAVASCRIPT_URI_RE.sub("", cleaned)
    cleaned = _WHITESPACE_RE.sub(" ", cleaned)
    return cleaned.strip()
