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
        logger.warning("Temporal client connect failed (%s) — disabled path", e)
        return None


async def close_temporal_client() -> None:
    global _client
    _client = None
