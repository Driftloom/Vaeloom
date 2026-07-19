from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

import jwt

from ..config import settings

PUBLIC_PATHS = frozenset({
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/signup",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
})


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            request.state.user = None
            request.state.tenant_id = None
            request.state.user_id = None
            return await call_next(request)

        token = auth_header.removeprefix("Bearer ")
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            request.state.user = payload
            request.state.user_id = payload.get("sub") or payload.get("user_id")
            request.state.tenant_id = payload.get("tenant_id")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

        return await call_next(request)
