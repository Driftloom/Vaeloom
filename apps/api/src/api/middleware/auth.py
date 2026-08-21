import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..config import settings

PUBLIC_PATHS = frozenset({
    "/health",
    "/health/ready",
    "/health/startup",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/csrf-token",
    "/api/v1/auth/signup",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/gmail/webhook",
    "/api/v1/consent/scopes",
})
PUBLIC_PREFIXES = frozenset({
    "/api/v1/auth/sso/",
})


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if path in PUBLIC_PATHS:
            return await call_next(request)
        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Pass OPTIONS preflight through so CORSMiddleware can handle it
        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        token = auth_header.removeprefix("Bearer ")
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
                options={"require": ["exp", "sub"]},
            )
            request.state.user = payload
            request.state.user_id = payload.get("sub") or payload.get("user_id")
            request.state.tenant_id = payload.get("tenant_id")
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Token expired"})
        except jwt.InvalidTokenError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        return await call_next(request)
