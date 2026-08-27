import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from .config import settings

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="")
user_id_var: ContextVar[str] = ContextVar("user_id", default="")

_REDACT_KEYS = frozenset({
    "password", "passwordhash", "password_hash",
    "token", "access_token", "accesstoken", "refresh_token", "refreshtoken",
    "authorization", "cookie", "set-cookie", "bearer", "jwt",
    "api_key", "apikey", "api-key", "secret", "client_secret", "client_id",
    "oauth", "oauth_token", "credential", "credentials", "private_key", "session", "sso",
})


def _redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {
            k: "[REDACTED]" if k.lower() in _REDACT_KEYS else _redact(v)
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return [_redact(item) for item in obj]
    return obj


class StructuredJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "level": record.levelname.lower(),
            "time": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "service": settings.service_name,
            "environment": settings.service_environment,
            "version": settings.service_version,
            "message": record.getMessage(),
        }
        cid = correlation_id_var.get("")
        if cid:
            log_entry["trace_id"] = cid
        tid = tenant_id_var.get("")
        if tid:
            log_entry["tenant_id"] = tid
        uid = user_id_var.get("")
        if uid:
            log_entry["user_id"] = uid
        if record.name:
            log_entry["logger"] = record.name
        if hasattr(record, "extra_data"):
            log_entry["data"] = _redact(record.extra_data)
        if record.exc_info and record.exc_info[1]:
            log_entry["error"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }
        return json.dumps(log_entry, default=str)


class PrettyFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
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
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    fmt = settings.log_format or (
        "pretty" if settings.service_environment in ("local", "development", "test") else "json"
    )

    formatter: logging.Formatter
    formatter = StructuredJsonFormatter() if fmt == "json" else PrettyFormatter()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    for name in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
