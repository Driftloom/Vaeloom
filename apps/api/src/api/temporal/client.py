"""Temporal client singleton with TLS support + graceful disabled-mode.

Fail-closed in non-local when TEMPORAL_ENABLED is required; local/tests may run
without a server via is_temporal_enabled() guard. Tests use
temporalio.testing.WorkerEnv instead of a real server.
"""

import logging
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)

_client: Any | None = None


class TemporalUnavailableError(Exception):
    """Raised when Temporal is explicitly enabled but cannot be reached.

    This is a fail-CLOSED signal: an operator who turned durability on must NOT
    get a silent non-durable execution path. Callers should surface this as a
    503 (service unavailable), never fall back to a legacy non-durable run.
    """


def is_temporal_enabled() -> bool:
    try:
        return bool(getattr(settings, "temporal_enabled", False))
    except Exception:
        return False


def _tls_config() -> Any | None:
    if not getattr(settings, "temporal_tls", False):
        return None
    try:
        from temporalio.client import TLSConfig

        # Self-host default is plaintext; Cloud requires TLS with API key.
        # Keep stub: deploy injects mTLS certs via env when needed.
        return TLSConfig()
    except Exception:
        return None


async def get_temporal_client() -> Any | None:
    """Return a connected Client or None when disabled.

    Cached singleton; first call connects. Subsequent calls reuse.
    When disabled returns None so callers can branch to degraded path
    or raise a typed error at the API boundary.
    """
    global _client
    if _client is not None:
        return _client
    if not is_temporal_enabled():
        # Disabled mode: expected to run without a server. Callers branch to the
        # legacy (non-durable) path deliberately, not as a failure.
        return None
    try:
        from temporalio.client import Client

        target = getattr(settings, "temporal_host", "localhost:7233")
        namespace = getattr(settings, "temporal_namespace", "default")
        tls = _tls_config()
        api_key = getattr(settings, "temporal_api_key", "") or None
        kwargs: dict[str, Any] = {"target_host": target, "namespace": namespace}
        if tls is not None:
            kwargs["tls"] = tls
        if api_key:
            # Temporal Cloud API key header (supported by SDK)
            kwargs["api_key"] = api_key  # type: ignore[arg-type]
        # Some SDK variants accept rpc_metadata for headers; keep both.
        _client = await Client.connect(**kwargs)  # type: ignore[arg-type]
        logger.info("Temporal client connected host=%s ns=%s", target, namespace)
        return _client
    except Exception as e:
        # Operator explicitly enabled durability (temporal_enabled=True) but the
        # server is unreachable. Fail CLOSED: do NOT return None and let callers
        # silently degrade to a non-durable run (that would fake durability).
        logger.error("Temporal enabled but client connect FAILED (%s) — refusing non-durable fallback", e)
        raise TemporalUnavailableError(
            f"Temporal is enabled but unreachable at {getattr(settings, 'temporal_host', 'localhost:7233')}: {e}"
        ) from e


async def close_temporal_client() -> None:
    global _client
    _client = None
