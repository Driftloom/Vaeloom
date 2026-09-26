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
# Zero-trust: CSRF skip is explicit per-path only. The old blanket
# SKIP_PREFIXES={"/api/v1/auth"} skipped every current AND future auth endpoint.
# Bearer-header APIs are CSRF-immune by design; cookie-authenticated mutating
# calls still require the double-submit token. /csrf-token itself must stay
# skipped (it issues the token).
#
# /api/v1/auth/refresh used to be skipped unconditionally. That was correct when
# refresh only accepted a body token. Now the browser client presents its refresh
# credential as an ambient HttpOnly cookie, which makes the endpoint
# CSRF-reachable: an attacker page could force a rotation, and because rotation
# invalidates the previous token, repeatedly forcing it locks the victim out.
# It is no longer skipped here; the cookie rule below decides, so bearer-based
# SDK refreshes stay exempt while cookie-based browser refreshes are challenged.
SKIP_PATHS = frozenset({"/health", "/health/ready", "/docs", "/openapi.json", "/redoc", "/metrics", "/csrf-token", "/api/v1/gmail/webhook", "/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password"})
SKIP_PREFIXES = frozenset({"/scim"})

# /api/v1/auth/refresh used to be skipped outright. That was safe only while the
# refresh credential arrived exclusively in the request body, because a body
# field is one the browser will not populate on a cross-site request. The cookie
# migration changes that: the browser now presents its refresh credential as an
# ambient HttpOnly cookie, which an attacker page can cause the browser to send.
# Rotation makes this materially worse than a plain read — it invalidates the
# previous token, so forcing it repeatedly locks the victim out.
#
# Rather than re-adding a blanket skip, the exemption below is conditional on the
# credential actually being explicit. An SDK or CLI caller sending a body token is
# exempt exactly as before; a browser caller arriving on the cookie is challenged.
REFRESH_PATH = "/api/v1/auth/refresh"


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

        if path in SKIP_PATHS or any(path.startswith(p) for p in SKIP_PREFIXES) or (path.startswith("/api/v1/connectors/") and path.endswith("/inbound-webhook")):
            return await call_next(request)

        if request.method in MUTATING_METHODS:
            from .exception_handler import denial as _denial

            # The posture for every endpoint is unchanged: a mutating request
            # must present the double-submit token, whatever it authenticates
            # with. The single exception is /auth/refresh, and only when the
            # caller used the explicit body token rather than the ambient
            # session cookie. Narrowing the exemption this way keeps the SDK
            # working without re-opening a cross-site rotation path.
            from ..services.session_cookies import reads_session_cookie

            if path == REFRESH_PATH and not reads_session_cookie(request):
                return await call_next(request)

            csrf_header = request.headers.get("X-CSRF-Token", "")
            csrf_cookie = request.cookies.get("csrf_token", "")

            if not csrf_header or not csrf_cookie:
                return _denial(403, "CSRF token missing — GET /csrf-token then send X-CSRF-Token header + csrf_token cookie", request)

            cookie_parts = csrf_cookie.split(":", 1)
            if len(cookie_parts) != 2:
                return _denial(403, "Invalid CSRF token", request)

            cookie_token, cookie_sig = cookie_parts

            if not _verify_token(cookie_token, cookie_sig, settings.jwt_secret):
                return _denial(403, "Invalid CSRF token", request)

            if not _token_store.validate(cookie_token):
                return _denial(403, "CSRF token expired", request)

            if not hmac.compare_digest(csrf_header.encode(), cookie_token.encode()):
                return _denial(403, "CSRF token mismatch", request)

        return await call_next(request)


def create_csrf_token() -> tuple[str, str]:
    token = _token_store.generate()
    sig = _sign_token(token, settings.jwt_secret)
    cookie_value = f"{token}:{sig}"
    return token, cookie_value
