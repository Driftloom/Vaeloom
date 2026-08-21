import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from ..logging import correlation_id_var, tenant_id_var, user_id_var

logger = logging.getLogger("vaeloom-api.infrastructure.logging")


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
