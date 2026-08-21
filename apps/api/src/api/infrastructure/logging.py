import json
import logging
import sys
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from ..config import settings
from ..logging import _redact, correlation_id_var, tenant_id_var, user_id_var

logger = logging.getLogger("vaeloom-api.infrastructure.logging")


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


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        cid = (
            request.headers.get("X-Correlation-ID", "")
            or request.headers.get("X-Request-ID", "")
            or str(uuid.uuid4())
        )
        tid = request.headers.get("X-Tenant-ID", "")
        uid = request.headers.get("X-User-ID", "")

        cid_token = correlation_id_var.set(cid)
        tid_token = tenant_id_var.set(tid)
        uid_token = user_id_var.set(uid)
        request.state.correlation_id = cid

        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = cid
            if not response.headers.get("X-Request-ID"):
                response.headers["X-Request-ID"] = cid
            return response
        finally:
            correlation_id_var.reset(cid_token)
            tenant_id_var.reset(tid_token)
            user_id_var.reset(uid_token)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        duration = time.monotonic() - start
        cid = getattr(request.state, "correlation_id", None) or correlation_id_var.get("") or "-"
        logger.info(
            "request  method=%s  path=%s  status=%d  duration=%.3f  correlation_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration,
            cid,
        )
        return response
