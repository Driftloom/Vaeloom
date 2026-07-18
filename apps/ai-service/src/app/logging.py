"""
Structured JSON logging for the ai-service (Docs/DevOps/Logging.md).

Mirrors the NestJS api's pino-based structured output:
- JSON lines to stdout in prod; human-readable in dev.
- Every line carries: level, time, service, trace_id, message.
- Sensitive fields (authorization, password, tokens) are redacted.
- Correlation ID propagated from upstream x-request-id header.
"""

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any

import json
from datetime import datetime, timezone

from ..config import settings

# ─── Context Vars ───

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="")
user_id_var: ContextVar[str] = ContextVar("user_id", default="")

# ─── Redaction ───

_REDACT_KEYS = frozenset({
    "password", "passwordhash", "password_hash",
    "token", "access_token", "accesstoken",
    "refresh_token", "refreshtoken",
    "authorization", "cookie", "set-cookie",
    "api_key", "apikey", "secret",
})


def _redact(obj: Any) -> Any:
    """Recursively redact sensitive keys from dicts."""
    if isinstance(obj, dict):
        return {
            k: "[REDACTED]" if k.lower() in _REDACT_KEYS else _redact(v)
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return [_redact(item) for item in obj]
    return obj


# ─── JSON Formatter ───

class StructuredJsonFormatter(logging.Formatter):
    """Emit one JSON line per log record matching the documented schema."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "level": record.levelname.lower(),
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "service": "ai-service",
            "message": record.getMessage(),
        }

        # Correlation / trace ID
        cid = correlation_id_var.get("")
        if cid:
            log_entry["trace_id"] = cid

        # Tenant context
        tid = tenant_id_var.get("")
        if tid:
            log_entry["tenant_id"] = tid

        uid = user_id_var.get("")
        if uid:
            log_entry["user_id"] = uid

        # Logger name
        if record.name:
            log_entry["logger"] = record.name

        # Extra fields (redacted)
        if hasattr(record, "extra_data"):
            log_entry["data"] = _redact(record.extra_data)

        # Exception info
        if record.exc_info and record.exc_info[1]:
            log_entry["error"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }

        return json.dumps(log_entry, default=str)


class PrettyFormatter(logging.Formatter):
    """Human-readable colored output for local development."""

    COLORS = {
        "DEBUG": "\033[36m",    # cyan
        "INFO": "\033[32m",     # green
        "WARNING": "\033[33m",  # yellow
        "ERROR": "\033[31m",    # red
        "CRITICAL": "\033[35m", # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        cid = correlation_id_var.get("")
        tid = tenant_id_var.get("")
        parts = [
            f"{color}{record.levelname:8s}{self.RESET}",
            f"[{record.name}]",
        ]
        if cid:
            parts.append(f"(req:{cid[:8]})")
        if tid:
            parts.append(f"(tenant:{tid[:8]})")
        parts.append(record.getMessage())
        line = " ".join(parts)
        if record.exc_info and record.exc_info[1]:
            line += f"\n  {type(record.exc_info[1]).__name__}: {record.exc_info[1]}"
        return line


def setup_logging() -> None:
    """Configure the root logger for structured output."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    is_dev = settings.service_environment in ("local", "development", "test")

    formatter: logging.Formatter
    if is_dev:
        formatter = PrettyFormatter()
    else:
        formatter = StructuredJsonFormatter()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Suppress noisy libraries
    for name in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger with the structured formatter already configured."""
    return logging.getLogger(name)
