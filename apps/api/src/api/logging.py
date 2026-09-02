from contextvars import ContextVar

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="")
user_id_var: ContextVar[str] = ContextVar("user_id", default="")

# Single source of truth for secret detection lives in temporal.validation so
# redaction, workflow-history validation, and graph-state validation never drift.
from api.temporal.validation import SECRET_KEYS as _REDACT_KEYS  # noqa: E402


def _redact(obj):
    if isinstance(obj, dict):
        return {
            k: "[REDACTED]" if k.lower() in _REDACT_KEYS else _redact(v)
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return [_redact(item) for item in obj]
    return obj


# Re-export canonical logging impl for legacy import path `api.logging.*`
# (tests import StructuredJsonFormatter etc from api.logging; canonical lives in
# api.infrastructure.logging — no duplicate implementation, just shim).
try:
    from api.infrastructure.logging import (  # noqa: F401,E402
        CorrelationIDMiddleware,
        PrettyFormatter,
        RequestLoggingMiddleware,
        StructuredJsonFormatter,
        get_logger,
        setup_logging,
    )
except Exception:  # pragma: no cover
    pass
