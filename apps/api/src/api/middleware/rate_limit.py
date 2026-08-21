import logging
import time
from collections import defaultdict
from functools import wraps

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("vaeloom-api.middleware.rate_limit")

RATE_LIMIT_ATTR = "_rate_limit_config"
SKIP_PATHS = frozenset({"/health", "/health/ready", "/docs", "/openapi.json", "/redoc", "/metrics", "/csrf-token"})

API_KEY_HEADER = "X-API-Key"


def rate_limit(max_requests: int, window_seconds: int = 60):
    """Override the default rate limit for a specific endpoint."""
    def decorator(func):
        setattr(func, RATE_LIMIT_ATTR, (max_requests, window_seconds))
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def _resolve_rate_limit(endpoint) -> tuple[int, int] | None:
    """Walk through decorator wrappers to find a rate-limit override."""
    seen: set[int] = set()
    fn = endpoint
    while fn is not None and id(fn) not in seen:
        seen.add(id(fn))
        config = getattr(fn, RATE_LIMIT_ATTR, None)
        if config is not None:
            return config
        fn = getattr(fn, "__wrapped__", None)
    return None


class MemoryBackend:
    """In-memory sliding-window rate-limit store."""

    def __init__(self) -> None:
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def check_and_record(
        self, key: str, max_requests: int, window_seconds: int,
    ) -> tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds
        timestamps = self._buckets[key]
        timestamps[:] = [t for t in timestamps if t > cutoff]

        if len(timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - timestamps[0]))
            return False, max(1, retry_after)

        timestamps.append(now)
        return True, 0


class RedisBackend:
    """Redis-backed sliding-window rate-limit store (sorted sets)."""

    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as aioredis
        self._redis = aioredis.from_url(redis_url, decode_responses=True)

    async def check_and_record(
        self, key: str, max_requests: int, window_seconds: int,
    ) -> tuple[bool, int]:
        now = time.time()
        min_score = now - window_seconds

        await self._redis.zremrangebyscore(key, 0, min_score)
        count = await self._redis.zcard(key)

        if count >= max_requests:
            oldest = await self._redis.zrange(key, 0, 0, withscores=True)
            retry_after = oldest[0][1] - min_score if oldest else window_seconds
            return False, max(1, int(retry_after))

        pipe = self._redis.pipeline()
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window_seconds)
        await pipe.execute()
        return True, 0


class APIKeyRateLimiter:
    def __init__(self, backend, api_key_limit: int, window_seconds: int = 60):
        self._backend = backend
        self._api_key_limit = api_key_limit
        self._window_seconds = window_seconds

    async def check(self, api_key: str) -> tuple[bool, int]:
        key = f"apikey:{api_key}"
        return await self._backend.check_and_record(key, self._api_key_limit, self._window_seconds)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        requests_per_minute: int = 100,
        window_seconds: int = 60,
        redis_url: str | None = None,
        api_key_rate_limit: int = 1000,
    ):
        super().__init__(app)
        self.default_max_requests = requests_per_minute
        self.default_window_seconds = window_seconds
        self.backend = RedisBackend(redis_url) if redis_url else MemoryBackend()
        self._api_key_limiter = APIKeyRateLimiter(self.backend, api_key_rate_limit, window_seconds)

    def _get_limits(self, request: Request) -> tuple[int, int]:
        route = request.scope.get("route")
        if route and route.endpoint:
            config = _resolve_rate_limit(route.endpoint)
            if config:
                return config
        return self.default_max_requests, self.default_window_seconds

    async def _add_rate_limit_headers(self, request: Request, response: Response, client_key: str) -> None:
        max_req, window_sec = self._get_limits(request)
        key = f"rl:{client_key}:{request.url.path}"
        timestamps = getattr(self.backend, "_buckets", {}).get(key, [])
        remaining = max(0, max_req - len(timestamps))
        reset_time = int(time.time()) + window_sec
        response.headers["X-RateLimit-Limit"] = str(max_req)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)
        user_id = getattr(request.state, "user_id", None)
        response.headers["X-RateLimit-By"] = "api_key" if user_id else "ip"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)

        api_key = request.headers.get(API_KEY_HEADER)
        if api_key:
            allowed, retry_after = await self._api_key_limiter.check(api_key)
            if not allowed:
                logger.warning(
                    "API key rate limit exceeded  key_prefix=%s  path=%s",
                    api_key[:8], request.url.path,
                )
                return JSONResponse(
                    status_code=429,
                    content={"detail": "API key rate limit exceeded"},
                    headers={"Retry-After": str(retry_after)},
                )

        user_id = getattr(request.state, "user_id", None)
        client_key: str = user_id or (
            request.client.host if request.client else "unknown"
        )
        max_req, window_sec = self._get_limits(request)
        key = f"rl:{client_key}:{request.url.path}"

        allowed, retry_after = await self.backend.check_and_record(key, max_req, window_sec)

        if not allowed:
            logger.warning(
                "Rate limit exceeded  client=%s  path=%s  limit=%d  window=%ds",
                client_key, request.url.path, max_req, window_sec,
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        await self._add_rate_limit_headers(request, response, client_key)
        return response
