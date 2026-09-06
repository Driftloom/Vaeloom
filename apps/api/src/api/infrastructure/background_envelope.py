"""Cryptographic execution envelope for background jobs and async workers.

Enforces authoritative security boundaries across background queues:
* Authoritative tenant, workspace, user, agent, and action identity
* Tamper-evident HMAC-SHA256 signature over canonical metadata
* Strict expiration and replay prevention via unique per-job nonce
* Fail-closed validation before worker execution
"""

import hashlib
import hmac
import json
import time
import uuid
from typing import Any

from api.config import settings


class BackgroundSecurityError(Exception):
    """Raised when background security envelope verification fails."""
    pass


def _canonical_bytes(data: dict[str, Any]) -> bytes:
    """Serialize dictionary canonically for deterministic signing."""
    # Omit signature if present in input
    clean = {k: v for k, v in data.items() if k != "signature"}
    return json.dumps(clean, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")


def _get_signing_key() -> bytes:
    key = getattr(settings, "jwt_secret", None) or getattr(settings, "encryption_key", "")
    if isinstance(key, str):
        return key.encode("utf-8")
    return bytes(key)


_SEEN_NONCES: dict[str, float] = {}


def _clean_expired_nonces(now: float) -> None:
    """Purge expired nonces from in-memory replay cache."""
    expired = [n for n, exp in _SEEN_NONCES.items() if exp < now]
    for n in expired:
        _SEEN_NONCES.pop(n, None)


def reset_nonce_cache() -> None:
    """Reset the replay cache (used in testing)."""
    _SEEN_NONCES.clear()


def create_background_envelope(
    tenant_id: str,
    workspace_id: str,
    user_id: str,
    agent_id: str,
    action: str,
    ttl_seconds: int = 3600,
    payload: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a signed background execution envelope."""
    if not tenant_id or not workspace_id or not user_id or not agent_id or not action:
        raise ValueError("tenant_id, workspace_id, user_id, agent_id, and action are required")

    now = time.time()
    envelope: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "workspace_id": str(workspace_id),
        "user_id": str(user_id),
        "agent_id": str(agent_id),
        "action": str(action),
        "payload": payload or {},
        "nonce": str(uuid.uuid4()),
        "issued_at": now,
        "expires_at": now + ttl_seconds,
        "metadata": metadata or {},
    }

    canonical_data = _canonical_bytes(envelope)
    key = _get_signing_key()
    sig = hmac.new(key, canonical_data, hashlib.sha256).hexdigest()
    envelope["signature"] = sig
    return envelope


def verify_background_envelope(
    envelope: dict[str, Any],
    check_replay: bool = True,
    redis_client: Any = None,
) -> tuple[bool, str, dict[str, Any] | None]:
    """Verify background execution envelope.

    Returns:
        (is_valid, reason, verified_payload)
    """
    if not isinstance(envelope, dict):
        return False, "envelope must be a dictionary", None

    required = ("tenant_id", "workspace_id", "user_id", "agent_id", "action", "nonce", "issued_at", "expires_at", "signature")
    for req in required:
        if not envelope.get(req):
            return False, f"missing required field: {req}", None

    # Check expiration
    now = time.time()
    if envelope["expires_at"] < now:
        return False, f"envelope expired at {envelope['expires_at']} (now={now})", None

    # Check signature
    provided_sig = str(envelope["signature"])
    canonical_data = _canonical_bytes(envelope)
    key = _get_signing_key()
    expected_sig = hmac.new(key, canonical_data, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(provided_sig, expected_sig):
        return False, "invalid signature: envelope tampered or forged", None

    # Check nonce replay
    nonce = str(envelope["nonce"])
    if check_replay:
        _clean_expired_nonces(now)
        if nonce in _SEEN_NONCES:
            return False, f"replay detected: nonce {nonce} already consumed", None
        _SEEN_NONCES[nonce] = envelope["expires_at"]

    return True, "valid", envelope
