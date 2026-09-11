import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from sqlalchemy import select

from ..config import settings
from ..models.schema import AuthSession, User, Workspace
from ..schemas.auth import AuthResponse, PublicUser
from ..utils.sanitize import sanitize_text

# AUTH-REV-01: shared revocation. Redis (when explicitly configured via
# REDIS_URL) is the fast path; the DB (auth_sessions.status +
# revoked_user_cutoffs) is the cross-worker truth. There is deliberately NO
# process-local denylist anymore: a revocation invisible to another worker
# is not a revocation.
_REVOKED_PREFIX = "jwt:revoked:"
_CUTOFF_PREFIX = "jwt:cutoff:"
_redis_client = None
_redis_checked = False


def _get_revocation_redis():
    """Sync Redis client for the revocation fast path, else None.

    Opt-in rule mirrors middleware/csrf.py: only an explicit REDIS_URL
    enables it (never the localhost default), so tests/local without Redis
    pay no connection timeouts. Cached after first probe.
    """
    global _redis_client, _redis_checked
    import os

    if _redis_checked:
        return _redis_client
    _redis_checked = True
    if not os.environ.get("REDIS_URL"):
        return None
    try:
        import redis as _redis

        client = _redis.Redis.from_url(
            os.environ["REDIS_URL"],
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
        _redis_client = client
        return client
    except Exception as e:
        import logging as _log

        _log.getLogger(__name__).warning(
            "revocation Redis unavailable, using DB truth: %s", e
        )
        return None


# Test/embedding hook: middleware-adjacent checks open sessions through this
# factory. Production default is the global engine factory; the test harness
# overrides it with the per-test session so checks stay hermetic.
_session_factory_override = None


def set_revocation_session_factory(fn) -> None:
    global _session_factory_override
    _session_factory_override = fn


def _revocation_session_factory():
    if _session_factory_override is not None:
        return _session_factory_override()
    from ..database import async_session_factory

    return async_session_factory()


class AuthService:
    async def signup(self, email: str, password: str, display_name: str | None = None, db=None):
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="Email already registered")

        display_name = sanitize_text(display_name)
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        # Ensure tenant exists for RLS (audit 2026-08-21 CRITICAL)
        tenant = None
        if db is not None:
            try:
                from ..models.schema import Tenant

                tenant_result = await db.execute(select(Tenant).where(Tenant.slug == "default"))
                tenant = tenant_result.scalar_one_or_none()
                if not tenant:
                    tenant = Tenant(name="Default", slug="default")
                    db.add(tenant)
                    await db.flush()
            except Exception:
                tenant = None
        user = User(
            email=email,
            password_hash=password_hash,
            display_name=display_name or email.split("@")[0],
            tenant_id=tenant.id if tenant else None,
        )
        db.add(user)
        await db.flush()

        # OP-RLS-01: establish RLS context for the remainder of the signup
        # transaction. Under a least-privilege runtime role, the workspace
        # INSERT below (WITH CHECK owner) and subsequent reads require GUCs;
        # pre-auth there is no middleware context, so the freshly minted
        # identity bootstraps its own (transaction-scoped SET LOCAL).
        # No-op on SQLite / on failure (fail-closed RLS then applies, and the
        # pre-existing permissive users/tenants policies keep signup working).
        try:
            from sqlalchemy import text as _text

            if getattr(user, "tenant_id", None):
                await db.execute(
                    _text("SELECT set_config('app.tenant_id', :v, true)"),
                    {"v": str(user.tenant_id)},
                )
            await db.execute(
                _text("SELECT set_config('app.user_id', :v, true)"),
                {"v": str(user.id)},
            )
        except Exception:
            pass

        workspace = Workspace(
            user_id=user.id,
            name=f"{display_name or email.split('@')[0]}'s Workspace",
        )
        db.add(workspace)
        await db.flush()
        await db.refresh(user)

        access_token, refresh_token = await self.issue_token(str(user.id), email, tenant_id=str(user.tenant_id) if user.tenant_id else None, db=db)

        # Durability before response: get_db commits in yield-teardown (after
        # the response is sent), so a fast follow-up request (e.g. immediate
        # workspace creation after signup) could otherwise observe the new
        # user row as missing and fail its FK check (staging gate 2026-09-07:
        # intermittent 2/10 FK violations). Committing here makes the
        # bootstrap rows (tenant/user/workspace/session) durable before the
        # 201 is sent; the later get_db commit is then a harmless no-op.
        await db.commit()

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def login(self, email: str, password: str, db=None):
        from fastapi import HTTPException

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if user.status != "ACTIVE":
            raise HTTPException(status_code=403, detail="Account is not active")

        access_token, refresh_token = await self.issue_token(str(user.id), email, tenant_id=str(user.tenant_id) if user.tenant_id else None, db=db)

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def issue_token(self, user_id: str, email: str, tenant_id: str | None = None, db=None):
        import secrets

        now = datetime.now(UTC)
        access_token, jti = self._create_jwt(user_id, email, tenant_id)
        refresh_token = secrets.token_urlsafe(64)

        session = AuthSession(
            user_id=uuid.UUID(user_id),
            token=access_token,
            refresh_token=refresh_token,
            jti=jti,
            expires_at=now + timedelta(seconds=settings.jwt_refresh_token_ttl),
        )
        db.add(session)
        await db.flush()

        return access_token, refresh_token

    async def refresh_token(self, refresh_token: str, db=None):
        from fastapi import HTTPException

        result = await db.execute(
            select(AuthSession).where(AuthSession.refresh_token == refresh_token)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        now = datetime.now(UTC)
        if session.status != "ACTIVE" or session.expires_at < now:
            raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

        user_result = await db.execute(select(User).where(User.id == session.user_id))
        user = user_result.scalar_one_or_none()
        if not user or user.status != "ACTIVE":
            raise HTTPException(status_code=401, detail="User not found or inactive")

        session.status = "ROTATED"
        db.add(session)

        access_token, new_refresh_token = await self.issue_token(
            str(user.id), user.email, tenant_id=str(user.tenant_id) if user.tenant_id else None, db=db,
        )

        return AuthResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def validate_user(self, user_id: str, db=None):
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if user and user.status == "ACTIVE":
            return user
        return None

    def revoke_token(self, jti: str | None = None) -> None:
        """Best-effort shared single-token revocation (sync, logout path).

        Writes the Redis fast-path entry when Redis is configured. The
        durable cross-worker revocation is the auth_sessions.status flip
        performed by the logout route's SQL in the same request; the async
        check below always consults shared state, never process memory.
        """
        if not jti:
            return
        try:
            client = _get_revocation_redis()
            if client is not None:
                client.setex(
                    f"{_REVOKED_PREFIX}{jti}", int(settings.jwt_token_ttl), "1"
                )
        except Exception as e:
            import logging as _log

            _log.getLogger(__name__).warning("revoke_token Redis write failed: %s", e)

    async def revoke_all_user_tokens(self, user_id: str, db=None) -> None:
        """Server-side revoke-all watermark (shared across workers).

        Any access token for this user with iat strictly below the cutoff is
        rejected. Persists to revoked_user_cutoffs (+ Redis mirror). Prunes
        watermarks older than the max access-token lifetime.
        """
        import time

        cutoff = int(time.time())
        client = None
        try:
            client = _get_revocation_redis()
            if client is not None:
                client.setex(
                    f"{_CUTOFF_PREFIX}{user_id}", int(settings.jwt_token_ttl), str(cutoff)
                )
        except Exception as e:
            import logging as _log

            _log.getLogger(__name__).warning("revoke_all Redis write failed: %s", e)
        if db is None:
            return
        try:
            from ..models.schema import RevokedUserCutoff

            row = await db.get(RevokedUserCutoff, uuid.UUID(str(user_id)))
            if row is None:
                db.add(RevokedUserCutoff(user_id=uuid.UUID(str(user_id)), cutoff_unix=cutoff))
            else:
                row.cutoff_unix = cutoff
            # Prune watermarks that can no longer match a live access token.
            try:
                from sqlalchemy import delete

                await db.execute(
                    delete(RevokedUserCutoff).where(
                        RevokedUserCutoff.cutoff_unix
                        < int(time.time()) - int(settings.jwt_token_ttl) - 60
                    )
                )
            except Exception:
                pass
            await db.flush()
        except Exception as e:
            import logging as _log

            _log.getLogger(__name__).warning("revoke_all DB write failed: %s", e)

    async def is_token_revoked_async(
        self,
        jti: str | None = None,
        user_id: str | None = None,
        iat: float | None = None,
        raw_token: str | None = None,
        db=None,
    ) -> tuple[bool, str]:
        """Shared revocation check. Order: Redis fast path -> DB truth.

        Returns (revoked, reason). Raises on DB outage (callers fail closed:
        a revocation state that cannot be read must deny, never admit).
        Redis outage degrades to DB (warn-logged); Redis absence skips to DB.
        """
        import logging as _log

        log = _log.getLogger(__name__)
        # 1. Redis fast path (explicit REDIS_URL only).
        try:
            client = _get_revocation_redis()
        except Exception:
            client = None
        if client is not None:
            try:
                if jti and client.exists(f"{_REVOKED_PREFIX}{jti}"):
                    return True, "denylist"
                if user_id:
                    stored = client.get(f"{_CUTOFF_PREFIX}{user_id}")
                    if stored is not None and iat is not None and float(iat) < float(stored):
                        return True, "cutoff"
            except Exception as e:
                log.warning("revocation Redis read failed, falling back to DB: %s", e)
        # 2. DB truth: session status (covers logout's status flip for ALL of
        # the user's sessions) + revoke-all watermarks.
        own_session = False
        session = db
        ctx = None
        if session is None:
            # Open a session through the (overridable) factory. Production:
            # global engine factory (cross-worker DB truth). Tests: the
            # per-test session via set_revocation_session_factory.
            own_session = True
            factory = _revocation_session_factory()
            ctx = factory()
            session = await ctx.__aenter__()
        try:
            from sqlalchemy import or_

            from ..models.schema import RevokedUserCutoff

            if jti or raw_token:
                conds = []
                if jti:
                    conds.append(AuthSession.jti == str(jti))
                if raw_token:
                    conds.append(AuthSession.token == raw_token)
                res = await session.execute(
                    select(AuthSession.status).where(or_(*conds)).limit(1)
                )
                status = res.scalar_one_or_none()
                if status is not None and status != "ACTIVE":
                    return True, f"session-{status.lower()}"
            if user_id and iat is not None:
                try:
                    row = await session.get(
                        RevokedUserCutoff, uuid.UUID(str(user_id))
                    )
                except Exception:
                    row = None
                if row is not None and float(iat) < float(row.cutoff_unix):
                    return True, "cutoff"
            return False, ""
        finally:
            if own_session:
                try:
                    await ctx.__aexit__(None, None, None)
                except Exception:
                    pass

    def is_token_revoked(self, jti: str | None = None, user_id: str | None = None, iat: float | None = None) -> bool:
        """Deprecated sync shim (no DB access): consults the shared Redis
        fast path only. Prefer is_token_revoked_async. Returns False when
        Redis is unconfigured (documented: sync contexts cannot reach DB)."""
        try:
            client = _get_revocation_redis()
        except Exception:
            return False
        if client is None:
            return False
        try:
            if jti and client.exists(f"{_REVOKED_PREFIX}{jti}"):
                return True
            if user_id:
                stored = client.get(f"{_CUTOFF_PREFIX}{user_id}")
                if stored is not None and iat is not None and float(iat) < float(stored):
                    return True
        except Exception:
            return False
        return False

    def _create_jwt(self, user_id: str, email: str, tenant_id: str | None = None):
        now = datetime.now(UTC)
        jti = str(uuid.uuid4())
        payload = {
            "jti": jti,
            "sub": user_id,
            "email": email,
            "iat": now,
            "exp": now + timedelta(seconds=settings.jwt_token_ttl),
        }
        if tenant_id:
            payload["tenant_id"] = tenant_id
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), jti


auth_service = AuthService()
