"""Validation helpers for Temporal payloads — T-001, T-008, T-009.

- Secret detection (recursive) for fail-closed workflow history
- Payload size limiting (20KB)
"""

from __future__ import annotations

import json
from typing import Any

# Canonical secret keys — SINGLE SOURCE OF TRUTH for secret detection across the
# codebase (logging redaction, Temporal workflow-history validation, graph-state
# validation). Keep this frozenset the only definition; do not fork copies elsewhere.
SECRET_KEYS = frozenset(
    {
        "password",
        "passwordhash",
        "password_hash",
        "token",
        "access_token",
        "accesstoken",
        "refresh_token",
        "refreshtoken",
        "secret",
        "secret_reference",
        "authorization",
        "bearer",
        "jwt",
        "api_key",
        "apikey",
        "api-key",
        "x-api-key",
        "x_api_key",
        "client_secret",
        "client_id",  # client_id is not secret per se, but often paired — keep out of history if possible
        "oauth",
        "oauth_token",
        "credential",
        "credentials",
        "private_key",
        "cookie",
        "set-cookie",
        "session",
        "session_secret",
        "sso",
        "auth",
    }
)

# Normalized for lower-case comparison
_SECRET_LOWER = {k.lower() for k in SECRET_KEYS}


def _has_secret_keys_recursive(obj: Any, seen: set[int] | None = None) -> tuple[bool, str | None]:
    """Return (has_secret, offending_key) recursively."""
    if seen is None:
        seen = set()
    oid = id(obj)
    if oid in seen:
        return False, None
    seen.add(oid)

    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(k, str) and k.lower() in _SECRET_LOWER:
                return True, k
            # Also check values that are dicts/lists
            has, key = _has_secret_keys_recursive(v, seen)
            if has:
                return True, key
    elif isinstance(obj, (list, tuple, set)):
        for item in obj:
            has, key = _has_secret_keys_recursive(item, seen)
            if has:
                return True, key
    return False, None


def validate_no_secrets(payload: Any) -> None:
    """Fail-closed: raise ValueError if payload contains secret-like keys (recursive)."""
    has, key = _has_secret_keys_recursive(payload)
    if has:
        raise ValueError(f"payload contains forbidden secret key: {key!r} — secrets must be passed by reference, not in workflow history")


def validate_payload_size(payload: Any, limit_bytes: int = 20 * 1024, label: str = "payload") -> None:
    """Fail-closed: reject oversized payloads (>20KB by default) with 413-style error."""
    try:
        data = json.dumps(payload, default=str)
        size = len(data.encode("utf-8"))
        if size > limit_bytes:
            raise ValueError(f"{label} exceeds {limit_bytes} bytes (got {size}) — store large bodies by reference, not in workflow history")
    except ValueError:
        raise
    except Exception as e:
        # If payload not JSON serializable, treat as oversized/invalid
        raise ValueError(f"{label} validation failed: {e}")


def validate_workflow_payload(payload: Any, label: str = "payload") -> None:
    """Combined validation for workflow start — secrets + size."""
    if payload is None:
        return
    validate_no_secrets(payload)
    validate_payload_size(payload, label=label)
