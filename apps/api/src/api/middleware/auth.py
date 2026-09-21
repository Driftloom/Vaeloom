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
    "/csrf-token",
    "/api/v1/auth/signup",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/mfa/verify",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/saml/callback",
    "/api/v1/auth/saml/metadata",
    "/api/v1/auth/saml/login",
    "/api/v1/gmail/webhook",
    "/api/v1/consent/scopes",
})
PUBLIC_PREFIXES = frozenset({
    "/api/v1/auth/sso/",
})

# External webhook senders (GitHub/Stripe-style) authenticate with per-connector
# HMAC signatures, not user JWTs. The inbound-webhook route performs full HMAC
# verification itself, so the middleware lets signature-bearing requests through
# and still 401s unsigned anonymous calls. Unsigned calls WITH a user JWT keep
# working as operator-initiated deliveries.
_WEBHOOK_HMAC_HEADERS = ("x-hub-signature-256", "x-webhook-signature")


def _carries_webhook_signature(request: Request) -> bool:
    return any(request.headers.get(header) for header in _WEBHOOK_HMAC_HEADERS)


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

        if (
            path.startswith("/api/v1/connectors/")
            and path.endswith("/inbound-webhook")
            and _carries_webhook_signature(request)
        ):
            return await call_next(request)

        # Pass OPTIONS preflight through so CORSMiddleware can handle it
        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        token = auth_header.removeprefix("Bearer ")
        try:
            payload = None
            try:
                payload = jwt.decode(
                    token,
                    settings.jwt_secret,
                    algorithms=[settings.jwt_algorithm],
                    options={"require": ["exp", "sub"]},
                )
            except jwt.ExpiredSignatureError:
                raise
            except Exception:
                supa_secret = getattr(settings, "supabase_jwt_secret", "")
                supa_url = getattr(settings, "supabase_url", "")
                verified = False

                # 1. Try HMAC secret if configured
                if supa_secret:
                    try:
                        payload = jwt.decode(
                            token,
                            supa_secret,
                            algorithms=["HS256"],
                            options={"verify_aud": False, "require": ["exp", "sub"]},
                        )
                        verified = True
                    except jwt.ExpiredSignatureError:
                        raise
                    except Exception:
                        pass

                # 2. Try Supabase JWKS (for ES256/RS256 asymmetric keys)
                if not verified and supa_url:
                    try:
                        from jwt import PyJWKClient
                        jwks_url = f"{supa_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
                        jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
                        signing_key = jwks_client.get_signing_key_from_jwt(token)
                        payload = jwt.decode(
                            token,
                            signing_key.key,
                            algorithms=["ES256", "RS256", "HS256"],
                            options={"verify_aud": False, "require": ["exp", "sub"]},
                        )
                        verified = True
                    except jwt.ExpiredSignatureError:
                        raise
                    except Exception:
                        pass

                # 3. Try Supabase Auth API verification fallback
                if not verified and supa_url:
                    try:
                        import time
                        import httpx
                        supa_key = getattr(settings, "supabase_anon_key", "")
                        headers = {"Authorization": f"Bearer {token}"}
                        if supa_key:
                            headers["apikey"] = supa_key
                        async with httpx.AsyncClient(timeout=2.0) as client:
                            resp = await client.get(
                                f"{supa_url.rstrip('/')}/auth/v1/user", headers=headers
                            )
                            if resp.status_code == 200:
                                user_data = resp.json()
                                now_ts = int(time.time())
                                payload = {
                                    "sub": user_data.get("id"),
                                    "email": user_data.get("email"),
                                    "user_metadata": user_data.get("user_metadata", {}) or {},
                                    "iat": now_ts,
                                    "exp": now_ts + 3600,
                                }
                                verified = True
                    except Exception:
                        pass

                if not verified:
                    raise jwt.InvalidTokenError("Token verification failed: untrusted or invalid signature")

            jti = payload.get("jti")
            user_id = payload.get("sub") or payload.get("user_id")
            email = payload.get("email")

            # Check if this user exists in the database
            # If a user exists with matching email (e.g. Supabase OAuth for existing user),
            # synchronize the user_id so all RLS and workspaces match seamlessly.
            db_user_id = user_id
            try:
                from sqlalchemy import select
                from ..models.schema import User as _User
                async with self._session_factory() as _s:
                    u = None
                    if user_id:
                        import uuid as _uuid
                        try:
                            res = await _s.execute(select(_User.id).where(_User.id == _uuid.UUID(str(user_id))))
                            u = res.scalar_one_or_none()
                        except Exception:
                            pass
                    if not u and email:
                        # ZERO-TRUST: Prevent Account Takeover via Unverified Email.
                        # Only link to an existing account by email if the token explicitly asserts email_verified is True.
                        user_meta = payload.get("user_metadata") or {}
                        app_meta = payload.get("app_metadata") or {}
                        is_verified = (
                            payload.get("email_verified") is True
                            or user_meta.get("email_verified") is True
                            or app_meta.get("email_verified") is True
                        )
                        if is_verified:
                            res = await _s.execute(select(_User.id).where(_User.email == email))
                            u = res.scalar_one_or_none()
                    if u:
                        db_user_id = str(u)
            except Exception:
                pass

            user_id = db_user_id
            payload["sub"] = str(user_id)

            iat = payload.get("iat")
            iat_val = float(iat) if isinstance(iat, (int, float)) else None

            # Only verify revocation if jti is present (native tokens)
            if jti:
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
