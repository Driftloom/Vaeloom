import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..config import settings
from ..database import async_session_factory as _default_session_factory
from ..services.auth_service import auth_service

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
    "/api/v1/auth/saml/callback",
    "/api/v1/gmail/webhook",
    "/api/v1/consent/scopes",
})
PUBLIC_PREFIXES = frozenset({
    "/api/v1/auth/sso/",
    "/scim/",
    "/api/v1/profile/avatar/",
    "/api/v1/profile/public/",
})


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, session_factory=None):
        super().__init__(app)
        # Injectable for tests (mirrors IdempotencyMiddleware/TenantMiddleware):
        # production default is the global engine factory.
        self._session_factory = session_factory or _default_session_factory

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
            jti = payload.get("jti")
            user_id = payload.get("sub") or payload.get("user_id")
            iat = payload.get("iat")
            iat_val = float(iat) if isinstance(iat, (int, float)) else None

            # AUTH-REV-01: shared revocation (Redis fast path -> DB truth).
            # DB outage fails closed: an unreadable revocation state must
            # deny, never admit (authenticated endpoints need the DB anyway).
            # The check opens a short read-only session through the injected
            # factory (test-hermetic; production = global engine).
            try:
                async with self._session_factory() as _rev_session:
                    revoked, _reason = await auth_service.is_token_revoked_async(
                        jti=jti,
                        user_id=str(user_id) if user_id else None,
                        iat=iat_val,
                        raw_token=token,
                        db=_rev_session,
                    )
            except Exception as e:
                import logging as _log

                _log.getLogger(__name__).warning(
                    "revocation check unavailable, failing closed: %s", e
                )
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authorization unavailable — try again"},
                )
            if revoked:
                return JSONResponse(status_code=401, content={"detail": "Token has been revoked"})

            request.state.user = payload
            request.state.user_id = user_id
            request.state.tenant_id = payload.get("tenant_id")
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"detail": "Token expired"})
        except jwt.InvalidTokenError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        return await call_next(request)
