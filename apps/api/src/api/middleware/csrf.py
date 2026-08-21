import hashlib
import hmac
import secrets
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..config import settings

MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
SKIP_PATHS = frozenset({"/health", "/health/ready", "/docs", "/openapi.json", "/redoc", "/metrics", "/csrf-token"})
SKIP_PREFIXES = frozenset({"/api/v1/auth"})


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
        self._tokens[token] = time.monotonic() + self._ttl
        self._evict()
        return token

    def validate(self, token: str) -> bool:
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
