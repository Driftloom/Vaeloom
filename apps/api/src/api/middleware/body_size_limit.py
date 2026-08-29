import logging

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

DEFAULT_MAX_BYTES = 25 * 1024 * 1024  # 25 MB


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose declared Content-Length exceeds the limit.

    Guards against DoS via oversized payloads (FIND-SEC-020). Streamed/chunked
    uploads without a Content-Length rely on the app's own streaming limits.
    """

    def __init__(self, app, max_bytes: int = DEFAULT_MAX_BYTES):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > self.max_bytes:
            logger.warning("Rejected request with Content-Length %s (limit %s)", content_length, self.max_bytes)
            return JSONResponse(status_code=413, content={"detail": "Payload too large"})
        return await call_next(request)
