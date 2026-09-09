import logging

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

DEFAULT_MAX_BYTES = 25 * 1024 * 1024  # 25 MB


class PayloadTooLargeException(Exception):
    pass


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose body exceeds the size limit.

    Guards against DoS via oversized payloads (FIND-SEC-020). Checks Content-Length
    header upfront and wraps the streaming receive to guard against chunked transfers.
    """

    def __init__(self, app, max_bytes: int = DEFAULT_MAX_BYTES):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > self.max_bytes:
            logger.warning("Rejected request with Content-Length %s (limit %s)", content_length, self.max_bytes)
            return JSONResponse(status_code=413, content={"detail": "Payload too large"})

        # Guard for streaming / chunked bodies without declared Content-Length
        received_bytes = 0
        flag_too_large = False
        original_receive = request.receive

        async def limited_receive():
            nonlocal received_bytes, flag_too_large
            message = await original_receive()
            if message["type"] == "http.request":
                body = message.get("body", b"")
                received_bytes += len(body)
                if received_bytes > self.max_bytes:
                    flag_too_large = True
                    logger.warning("Rejected streamed request exceeding %s bytes", self.max_bytes)
                    raise PayloadTooLargeException("Payload too large")
            return message

        request._receive = limited_receive
        try:
            response = await call_next(request)
            if flag_too_large:
                return JSONResponse(status_code=413, content={"detail": "Payload too large"})
            return response
        except PayloadTooLargeException:
            return JSONResponse(status_code=413, content={"detail": "Payload too large"})
