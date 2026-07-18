import time
from collections import defaultdict

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.usage: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        client_key = request.state.user_id if request.state.user_id else request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - 60

        timestamps = self.usage[client_key]
        timestamps = [t for t in timestamps if t > window_start]
        self.usage[client_key] = timestamps

        if len(timestamps) >= self.requests_per_minute:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

        self.usage[client_key].append(now)
        return await call_next(request)
