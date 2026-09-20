import re

PATTERNS = [
    (re.compile(r"Bearer\s+[A-Za-z0-9\-_~+/]+=*", re.IGNORECASE), "Bearer [REDACTED_TOKEN]"),
    (re.compile(r"sk-[a-zA-Z0-9]{20,}", re.IGNORECASE), "[REDACTED_API_KEY]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b"), "[REDACTED_EMAIL]"),
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), "[REDACTED_CREDIT_CARD]"),
]


def scrub_pii(text: str) -> str:
    """Scrubs API tokens, bearer headers, emails, and credit cards from text."""
    if not text:
        return text
    sanitized = text
    for pattern, replacement in PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized
