import hashlib
import hmac
import logging
import os
import secrets
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..config import settings

logger = logging.getLogger(__name__)

# ── Redis fallback for multi-worker (F-06 / EXC-P13-07) ──────────────────
# In-memory dict is single-process only (uvicorn --workers 1). When REDIS_URL
# is set (PaaS / multi-worker), tokens are stored in Redis with TTL 3600 so
# any worker can validate. Falls back to in-memory for local/test.
_redis_client = None
_redis_checked = False


def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    redis_url = os.environ.get("REDIS_URL") or getattr(settings, "redis__url", "") or getattr(settings, "rate_limit_redis_url", "")
    if not redis_url or redis_url == "redis://localhost:6379/0":
        # Don't use default localhost in test/dev without explicit REDIS_URL — keep in-memory
        # Only use Redis when explicitly configured via REDIS_URL env for multi-worker
        if not os.environ.get("REDIS_URL"):
            return None
    try:
        import redis  # type: ignore

        client = redis.Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        _redis_client = client
        logger.info("CSRF store using Redis at %s", redis_url.split("@")[-1])
        return _redis_client
    except Exception as e:
        logger.debug("CSRF Redis unavailable, using in-memory: %s", e)
        return None

MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
SKIP_PATHS = frozenset({"/health", "/health/ready", "/docs", "/openapi.json", "/redoc", "/metrics", "/csrf-token"})
SKIP_PREFIXES = frozenset({"/api/v1/auth", "/scim"})


def _sign_token(token: str, secret: str) -> str:
    return hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()


def _verify_token(token: str, signature: str, secret: str) -> bool:
    expected = _sign_token(token, secret)
    return hmac.compare_digest(expected, signature)


class CSRFTokenStore:
    def __init__(self):
        self._tokens: dict[str, float] = {}
        self._ttl: float = 3600.0

    def generate(self) -> str:
        token = secrets.token_urlsafe(32)
        # Try Redis first (multi-worker)
        redis_client = _get_redis()
        if redis_client is not None:
            try:
                redis_client.setex(f"csrf:{token}", int(self._ttl), "1")
                return token
            except Exception as e:
                logger.debug("CSRF Redis setex failed, fallback to memory: %s", e)
        self._tokens[token] = time.monotonic() + self._ttl
        self._evict()
        return token

    def validate(self, token: str) -> bool:
        redis_client = _get_redis()
        if redis_client is not None:
            try:
                if redis_client.exists(f"csrf:{token}"):
                    return True
                # Fallback check memory in case token was generated before Redis was available
            except Exception as e:
                logger.debug("CSRF Redis exists failed: %s", e)
        self._evict()
        return token in self._tokens

    def _evict(self) -> None:
        now = time.monotonic()
        expired = [k for k, expiry in self._tokens.items() if now >= expiry]
        for k in expired:
            del self._tokens[k]


_token_store = CSRFTokenStore()


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        if path in SKIP_PATHS or any(path.startswith(p) for p in SKIP_PREFIXES):
            return await call_next(request)

        if request.method in MUTATING_METHODS:
            csrf_header = request.headers.get("X-CSRF-Token", "")
            csrf_cookie = request.cookies.get("csrf_token", "")

            if not csrf_header or not csrf_cookie:
                return JSONResponse(status_code=403, content={"detail": "CSRF token missing"})

            cookie_parts = csrf_cookie.split(":", 1)
            if len(cookie_parts) != 2:
                return JSONResponse(status_code=403, content={"detail": "Invalid CSRF token"})

            cookie_token, cookie_sig = cookie_parts

            if not _verify_token(cookie_token, cookie_sig, settings.jwt_secret):
                return JSONResponse(status_code=403, content={"detail": "Invalid CSRF token"})

            if not _token_store.validate(cookie_token):
                return JSONResponse(status_code=403, content={"detail": "CSRF token expired"})

            if not hmac.compare_digest(csrf_header.encode(), cookie_token.encode()):
                return JSONResponse(status_code=403, content={"detail": "CSRF token mismatch"})

        return await call_next(request)


def create_csrf_token() -> tuple[str, str]:
    token = _token_store.generate()
    sig = _sign_token(token, settings.jwt_secret)
    cookie_value = f"{token}:{sig}"
    return token, cookie_value
