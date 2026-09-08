"""Cryptographic execution envelope for background jobs and async workers.

Enforces authoritative security boundaries across background queues:
* Authoritative tenant, workspace, user, agent, and action identity
* Tamper-evident HMAC-SHA256 signature over canonical metadata
* Strict expiration and replay prevention via unique per-job nonce
* Fail-closed validation before worker execution

Nonce replay protection backends (honest fallback):
* Redis configured   -> distributed protection via atomic SET NX EX
  (first worker wins, all other workers reject as replay).
* Redis absent/unreachable -> process-local best-effort only
  (correct for single-worker local/dev, NOT distributed protection).
  Production deployments requiring cross-worker replay protection MUST
  configure REDIS_URL / REDIS__URL. See nonce_backend_status().
"""

import hashlib
import hmac
import inspect
import json
import logging
import time
import uuid
from typing import Any

from api.config import settings

logger = logging.getLogger(__name__)


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

_NONCE_KEY_PREFIX = "vaeloom:envelope_nonce:"
_NONCE_TTL_MAX_S = 86400


def _clean_expired_nonces(now: float) -> None:
    """Purge expired nonces from in-memory replay cache."""
    expired = [n for n, exp in _SEEN_NONCES.items() if exp < now]
    for n in expired:
        _SEEN_NONCES.pop(n, None)


def reset_nonce_cache() -> None:
    """Reset the replay cache (used in testing)."""
    _SEEN_NONCES.clear()


def _nonce_redis_url() -> str:
    """Resolve the Redis URL for distributed nonce claims ("" when unconfigured)."""
    import os

    url = os.environ.get("REDIS_URL") or os.environ.get("REDIS__URL") or ""
    if not url:
        try:
            url = getattr(settings, "redis__url", "") or ""
        except Exception:
            url = ""
    return url


_NONCE_REDIS_CACHE: dict[str, Any] = {"url": None, "client": None}


def _get_default_nonce_redis():
    """Best-effort shared sync Redis client for nonce claims, or None.

    The client is cached per URL (sync clients are thread-safe). A broken
    cached client is dropped so the next call rebuilds. Returns None when
    Redis is unconfigured or unreachable — callers MUST fall back to the
    process-local cache and MUST NOT claim distributed protection in that
    case (see nonce_backend_status()).
    """
    url = _nonce_redis_url()
    if not url:
        return None
    cached = _NONCE_REDIS_CACHE
    client = cached.get("client")
    if client is not None and cached.get("url") == url:
        try:
            client.ping()
            return client
        except Exception:
            try:
                client.close()
            except Exception:
                pass
            cached["client"] = None
    try:
        import redis as _redis

        client = _redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        cached["url"] = url
        cached["client"] = client
        return client
    except Exception as exc:
        logger.debug("nonce Redis unavailable, local fallback: %s", exc)
        return None


def nonce_backend_status() -> str:
    """Report which replay-protection backend is active: "redis" or "memory".

    Operators: "memory" means single-process best-effort only. Production
    multi-worker deployments MUST show "redis".
    """
    return "redis" if _get_default_nonce_redis() is not None else "memory"


def _claim_nonce_sync(client: Any, nonce: str, ttl_s: int) -> bool:
    """Atomically claim a nonce via SET NX EX. True = first winner, False = replay.

    Raises on connection errors so callers can fall back honestly.
    """
    res = client.set(f"{_NONCE_KEY_PREFIX}{nonce}", "1", nx=True, ex=ttl_s)
    if inspect.isawaitable(res):
        raise TypeError("async redis client passed to sync nonce claim; use averify_background_envelope")
    return bool(res)


async def _claim_nonce_async(client: Any, nonce: str, ttl_s: int) -> bool:
    """Async variant of _claim_nonce_sync (awaits coroutine results)."""
    res = client.set(f"{_NONCE_KEY_PREFIX}{nonce}", "1", nx=True, ex=ttl_s)
    if inspect.isawaitable(res):
        res = await res
    return bool(res)


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


def _check_envelope_integrity(
    envelope: dict[str, Any],
) -> tuple[bool, str, float]:
    """Validate shape, expiry, and HMAC. Returns (ok, reason, now)."""
    if not isinstance(envelope, dict):
        return False, "envelope must be a dictionary", time.time()

    required = ("tenant_id", "workspace_id", "user_id", "agent_id", "action", "nonce", "issued_at", "expires_at", "signature")
    for req in required:
        if not envelope.get(req):
            return False, f"missing required field: {req}", time.time()

    # Check expiration
    now = time.time()
    if envelope["expires_at"] < now:
        return False, f"envelope expired at {envelope['expires_at']} (now={now})", now

    # Check signature
    provided_sig = str(envelope["signature"])
    canonical_data = _canonical_bytes(envelope)
    key = _get_signing_key()
    expected_sig = hmac.new(key, canonical_data, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(provided_sig, expected_sig):
        return False, "invalid signature: envelope tampered or forged", now
    return True, "valid", now


def _nonce_ttl_s(envelope: dict[str, Any], now: float) -> int:
    try:
        return max(1, min(int(float(envelope["expires_at"]) - now), _NONCE_TTL_MAX_S))
    except Exception:
        return 3600


def _claim_nonce_memory(nonce: str, expires_at: float, now: float) -> bool:
    """Process-local claim. True = first winner, False = replay."""
    _clean_expired_nonces(now)
    if nonce in _SEEN_NONCES:
        return False
    _SEEN_NONCES[nonce] = expires_at
    return True


def verify_background_envelope(
    envelope: dict[str, Any],
    check_replay: bool = True,
    redis_client: Any = None,
) -> tuple[bool, str, dict[str, Any] | None]:
    """Verify background execution envelope.

    Nonce replay uses distributed Redis SET NX EX when a client is given
    (or discoverable via REDIS_URL/REDIS__URL); otherwise it falls back to
    the process-local cache (single-worker best-effort only).

    Returns:
        (is_valid, reason, verified_payload)
    """
    ok, reason, now = _check_envelope_integrity(envelope)
    if not ok:
        return False, reason, None

    # Check nonce replay
    nonce = str(envelope["nonce"])
    if check_replay:
        ttl_s = _nonce_ttl_s(envelope, now)
        client = redis_client if redis_client is not None else _get_default_nonce_redis()
        if client is not None:
            try:
                if not _claim_nonce_sync(client, nonce, ttl_s):
                    return False, f"replay detected: nonce {nonce} already consumed", None
            except TypeError:
                # Async client passed to sync API — cannot await here; use
                # memory fallback and direct async callers to averify_*.
                logger.debug("async redis client with sync verify; local fallback")
                if not _claim_nonce_memory(nonce, float(envelope["expires_at"]), now):
                    return False, f"replay detected: nonce {nonce} already consumed", None
            except Exception as exc:
                logger.warning("nonce Redis claim failed, local fallback: %s", exc)
                if not _claim_nonce_memory(nonce, float(envelope["expires_at"]), now):
                    return False, f"replay detected: nonce {nonce} already consumed", None
        else:
            if not _claim_nonce_memory(nonce, float(envelope["expires_at"]), now):
                return False, f"replay detected: nonce {nonce} already consumed", None

    return True, "valid", envelope


async def averify_background_envelope(
    envelope: dict[str, Any],
    check_replay: bool = True,
    redis_client: Any = None,
) -> tuple[bool, str, dict[str, Any] | None]:
    """Async variant of verify_background_envelope (awaits async Redis clients).

    Queue workers (async) MUST use this so cross-worker SET NX EX claims
    actually execute instead of falling back to process-local memory.
    """
    ok, reason, now = _check_envelope_integrity(envelope)
    if not ok:
        return False, reason, None

    nonce = str(envelope["nonce"])
    if check_replay:
        ttl_s = _nonce_ttl_s(envelope, now)
        client = redis_client
        if client is None:
            # Prefer an async client when the event loop is running.
            try:
                import os

                url = os.environ.get("REDIS_URL") or os.environ.get("REDIS__URL") or ""
                if not url:
                    try:
                        url = getattr(settings, "redis__url", "") or ""
                    except Exception:
                        url = ""
                if url:
                    import redis.asyncio as _aioredis

                    client = _aioredis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
                    await client.ping()
            except Exception as exc:
                logger.debug("nonce async Redis unavailable, local fallback: %s", exc)
                client = None
        if client is not None:
            try:
                if not await _claim_nonce_async(client, nonce, ttl_s):
                    return False, f"replay detected: nonce {nonce} already consumed", None
            except Exception as exc:
                logger.warning("nonce async Redis claim failed, local fallback: %s", exc)
                if not _claim_nonce_memory(nonce, float(envelope["expires_at"]), now):
                    return False, f"replay detected: nonce {nonce} already consumed", None
            finally:
                # Close loop-bound clients we created; leave caller-owned clients alone.
                if redis_client is None and client is not None:
                    try:
                        await client.aclose()
                    except Exception:
                        pass
        else:
            if not _claim_nonce_memory(nonce, float(envelope["expires_at"]), now):
                return False, f"replay detected: nonce {nonce} already consumed", None

    return True, "valid", envelope
