import hashlib
import os
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from sqlalchemy import select, update, delete, func

from ..config import settings
from ..models.schema import AuthSession, EmailVerificationToken, OnboardingState, User, Workspace
from ..schemas.auth import AuthResponse, PublicUser, SessionItemResponse, MfaSetupResponse
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


def set_revocation_redis(client) -> None:
    global _redis_client, _redis_checked
    _redis_client = client
    _redis_checked = True



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
    async def signup(
        self,
        email: str,
        password: str,
        display_name: str | None = None,
        ip_address: str | None = None,
        db=None,
    ):
        if not email or "@" not in email:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid email format")
        email = email.strip().lower()
        if not password or len(password) < 8:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

        # Set transaction-scoped pre-auth lookup GUCs for RLS on PostgreSQL
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_email', :email, true)"), {"email": email})
                await db.execute(text("SELECT set_config('app.lookup_slug', 'default', true)"))
            except Exception:
                pass

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
            email_verified=False,
            failed_login_attempts=0,
            locked_until=None,
            consent_version="2026-v1",
            consent_granted_at=datetime.now(UTC),
        )

        # Set user RLS context for subsequent inserts (workspaces, tokens, states)
        if db is not None:
            try:
                from ..middleware.tenant import set_rls_session_vars
                await set_rls_session_vars(
                    db,
                    tenant_id=str(tenant.id) if tenant else None,
                    user_id=str(user.id),
                )
            except Exception:
                pass

        db.add(user)
        await db.flush()

        # Audit consent in consent_records
        try:
            from .consent import consent_manager, ConsentScope
            await consent_manager.record_consent(
                user_id=str(user.id),
                scope=ConsentScope.terms_and_privacy,
                db=db,
                tenant_id=str(user.tenant_id) if user.tenant_id else None,
                ip_address=ip_address,
            )
        except Exception:
            pass

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

        # Generate email verification token
        raw_verification_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_verification_token.encode()).hexdigest()
        verification_token = EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        db.add(verification_token)

        # Initialize onboarding state for new user
        onboarding_state = OnboardingState(
            user_id=user.id,
            tenant_id=user.tenant_id,
            workspace_id=workspace.id,
            current_step="PROFILE",
            completed_steps=[],
            is_completed=False,
            step_data={},
        )
        db.add(onboarding_state)

        await db.refresh(user)

        access_token, refresh_token = await self.issue_token(
            str(user.id),
            email,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            db=db,
        )

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

    async def login(
        self,
        email: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
        db=None,
    ):
        from fastapi import HTTPException

        email = email.strip().lower()

        # Set transaction-scoped lookup_email GUC for pre-auth RLS query on PostgreSQL
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_email', :email, true)"), {"email": email})
            except Exception:
                pass

        result = await db.execute(select(User).where(func.lower(User.email) == email))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Bind identity GUCs for the rest of this transaction (session INSERT,
        # cutoff read, audit writes). Without these, RLS WITH CHECK denies the
        # session row and cutoff reads go blind on PostgreSQL.
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(user.id)})
                if user.tenant_id:
                    await db.execute(text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(user.tenant_id)})
            except Exception:
                pass

        now = datetime.now(UTC)
        # Check lockout: 10 consecutive failed attempts -> locked for 15 minutes
        if user.locked_until and isinstance(user.locked_until, datetime):
            locked_until = user.locked_until
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=UTC)
            if now < locked_until:
                raise HTTPException(
                    status_code=423,
                    detail="Account is locked due to too many failed login attempts. Please try again in 15 minutes.",
                )
            else:
                user.locked_until = None
                user.failed_login_attempts = 0

        uid_val = user.id if isinstance(user.id, uuid.UUID) else uuid.UUID(str(user.id))

        if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
            # Atomic update to avoid concurrency race condition (GAP-AUTH-02)
            stmt = (
                update(User)
                .where(User.id == uid_val)
                .values(failed_login_attempts=User.failed_login_attempts + 1)
                .returning(User.failed_login_attempts)
            )
            res = await db.execute(stmt)
            updated_attempts = res.scalar() or 1
            if updated_attempts >= 10:
                await db.execute(
                    update(User)
                    .where(User.id == uid_val)
                    .values(locked_until=now + timedelta(minutes=15))
                )
            await db.commit()
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if user.status != "ACTIVE":
            raise HTTPException(status_code=403, detail="Account is not active")

        # Establish authenticated RLS session context for this user and tenant
        if db is not None:
            try:
                from ..middleware.tenant import set_rls_session_vars
                await set_rls_session_vars(
                    db,
                    tenant_id=str(user.tenant_id) if getattr(user, "tenant_id", None) else None,
                    user_id=str(user.id),
                )
            except Exception:
                pass

        # Reset failed login attempts on successful login
        await db.execute(
            update(User)
            .where(User.id == uid_val)
            .values(failed_login_attempts=0, locked_until=None)
        )
        user.failed_login_attempts = 0
        user.locked_until = None
        await db.flush()

        # Zero-Trust Multi-Factor Authentication Challenge
        mfa_required = False
        if getattr(user, "mfa_enabled", False):
            mfa_required = True
        elif user.tenant_id:
            from ..models.schema import Tenant
            t_res = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
            tenant = t_res.scalar_one_or_none()
            if tenant and isinstance(tenant.settings, dict):
                mfa_required = tenant.settings.get("policies", {}).get("mfa_required", False)

        if mfa_required:
            from .totp_service import totp_service
            challenge_token = totp_service.create_mfa_challenge_token(str(user.id))
            await db.commit()
            return AuthResponse(
                access_token="",
                refresh_token="",
                mfa_required=True,
                mfa_token=challenge_token,
                user=PublicUser.model_validate(user),
            )

        access_token, refresh_token = await self.issue_token(
            str(user.id),
            email,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            user_agent=user_agent,
            ip_address=ip_address,
            db=db,
        )

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=PublicUser.model_validate(user),
        )

    @staticmethod
    async def evaluate_mfa_requirement(db, user) -> bool:
        """Whether this user must clear a TOTP challenge before receiving tokens.

        True when the user has enrolled, or when their tenant policy demands MFA.
        """
        if getattr(user, "mfa_enabled", False):
            return True
        if not getattr(user, "tenant_id", None):
            return False
        from ..models.schema import Tenant
        t_res = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        tenant = t_res.scalar_one_or_none()
        if tenant and isinstance(tenant.settings, dict):
            return bool(tenant.settings.get("policies", {}).get("mfa_required", False))
        return False

    async def issue_login_response(
        self,
        db,
        user,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResponse:
        """Single entry point for issuing tokens after ANY successful authentication.

        Every login path — password, SSO/OIDC and SAML — must go through here.
        Calling `issue_token` directly bypasses the multi-factor challenge, so a
        user enrolled in TOTP could sign in with a federated token and never be
        asked for a code. That is exactly what the SSO and SAML handlers did.
        """
        if await self.evaluate_mfa_requirement(db, user):
            from .totp_service import totp_service
            challenge_token = totp_service.create_mfa_challenge_token(str(user.id))
            if db is not None:
                await db.commit()
            return AuthResponse(
                access_token="",
                refresh_token="",
                mfa_required=True,
                mfa_token=challenge_token,
                user=PublicUser.model_validate(user),
            )

        access_token, refresh_token = await self.issue_token(
            str(user.id),
            user.email,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            user_agent=user_agent,
            ip_address=ip_address,
            db=db,
        )
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def setup_mfa(self, user_id: str, db=None) -> MfaSetupResponse:
        from fastapi import HTTPException
        from .totp_service import totp_service
        result = await db.execute(select(User).where(User.id == uuid.UUID(str(user_id))))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        secret = totp_service.generate_secret()
        otpauth_url = totp_service.get_totp_uri(secret, user.email)
        plaintext_codes, hashed_codes = totp_service.generate_recovery_codes()

        user.mfa_secret = secret
        user.mfa_recovery_codes = {"codes": hashed_codes}
        await db.commit()

        return MfaSetupResponse(
            secret=secret,
            otpauth_url=otpauth_url,
            recovery_codes=plaintext_codes,
        )

    async def verify_mfa_and_enable(self, user_id: str, code: str, db=None) -> dict:
        from fastapi import HTTPException
        from .totp_service import totp_service
        result = await db.execute(select(User).where(User.id == uuid.UUID(str(user_id))))
        user = result.scalar_one_or_none()
        if not user or not user.mfa_secret:
            raise HTTPException(status_code=400, detail="MFA setup has not been initiated")

        if not totp_service.verify_code(user.mfa_secret, code):
            raise HTTPException(status_code=400, detail="Invalid TOTP verification code")

        user.mfa_enabled = True
        await db.commit()
        return {"status": "success", "message": "MFA enabled successfully", "mfa_enabled": True}

    async def verify_mfa_login(
        self,
        mfa_token: str,
        code: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
        db=None,
    ) -> AuthResponse:
        from fastapi import HTTPException
        from .totp_service import totp_service
        user_id = totp_service.verify_mfa_challenge_token(mfa_token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired MFA challenge token")

        result = await db.execute(select(User).where(User.id == uuid.UUID(str(user_id))))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        is_valid = False
        if user.mfa_secret and totp_service.verify_code(user.mfa_secret, code):
            is_valid = True
        elif user.mfa_recovery_codes and isinstance(user.mfa_recovery_codes, dict):
            hashed_codes = user.mfa_recovery_codes.get("codes", [])
            valid_recovery, remaining = totp_service.verify_recovery_code(code, hashed_codes)
            if valid_recovery:
                is_valid = True
                user.mfa_recovery_codes = {"codes": remaining}
                await db.flush()

        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid MFA code or recovery code")

        # Login confirmed - issue full session tokens
        access_token, refresh_token = await self.issue_token(
            str(user.id),
            user.email,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            user_agent=user_agent,
            ip_address=ip_address,
            db=db,
        )

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def issue_token(
        self,
        user_id: str,
        email: str,
        tenant_id: str | None = None,
        family_id: uuid.UUID | None = None,
        user_agent: str | None = None,
        ip_address: str | None = None,
        db=None,
    ):
        now = datetime.now(UTC)
        access_token, jti = self._create_jwt(user_id, email, tenant_id)
        refresh_token = secrets.token_urlsafe(64)
        token_family = family_id or uuid.uuid4()

        # Set user_id RLS context for session insert on PostgreSQL
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(user_id)})
            except Exception:
                pass

        session = AuthSession(
            user_id=uuid.UUID(user_id),
            token=access_token,
            refresh_token=refresh_token,
            jti=jti,
            family_id=token_family,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=now + timedelta(seconds=settings.jwt_refresh_token_ttl),
        )
        db.add(session)
        await db.flush()

        return access_token, refresh_token

    async def refresh_token(
        self,
        refresh_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
        db=None,
    ):
        from fastapi import HTTPException

        # Set lookup_token RLS context for pre-auth refresh on PostgreSQL
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_token', :tok, true)"), {"tok": refresh_token})
            except Exception:
                pass

        result = await db.execute(
            select(AuthSession).where(AuthSession.refresh_token == refresh_token)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # REFRESH TOKEN ROTATION & THEFT DETECTION (GAP-AUTH-05):
        #
        # Rotation must be a single atomic state transition. The previous
        # implementation read the row, checked `status != "ACTIVE"` in Python and
        # then assigned `status = "ROTATED"`. Under READ COMMITTED two concurrent
        # refreshes with the same token both read ACTIVE and both proceeded, so one
        # stolen token could be exchanged twice before the theft was detected.
        #
        # A conditional UPDATE ... WHERE status = 'ACTIVE' with a rowcount check
        # makes exactly one caller the winner; every other caller observes
        # rowcount 0 and is treated as token reuse.
        rotate = (
            update(AuthSession)
            .where(AuthSession.id == session.id, AuthSession.status == "ACTIVE")
            .values(status="ROTATED")
            .execution_options(synchronize_session=False)
        )
        rotate_result = await db.execute(rotate)
        if rotate_result.rowcount != 1:
            # Lost the race, or the session was already revoked/rotated. Either
            # way this is a replay of a spent token, so revoke the whole family.
            if session.family_id:
                await db.execute(
                    update(AuthSession)
                    .where(AuthSession.family_id == session.family_id)
                    .values(status="REVOKED")
                )
            await db.commit()
            raise HTTPException(
                status_code=401,
                detail="Suspicious activity detected: refresh token reused. All related sessions have been revoked.",
            )
        session.status = "ROTATED"

        now = datetime.now(UTC)
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)

        if expires_at < now:
            await db.execute(
                update(AuthSession).where(AuthSession.id == session.id).values(status="REVOKED")
            )
            await db.commit()
            raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

        # Zero-Trust Cutoff Check (GAP-AUTH-03):
        # Check if user had a password reset or revoke-all event after this session was created
        from ..models.schema import RevokedUserCutoff
        cutoff_row = await db.get(RevokedUserCutoff, session.user_id)
        session_created = session.created_at
        if session_created.tzinfo is None:
            session_created = session_created.replace(tzinfo=UTC)
        if cutoff_row and session_created.timestamp() < cutoff_row.cutoff_unix:
            await db.execute(
                update(AuthSession).where(AuthSession.id == session.id).values(status="REVOKED")
            )
            await db.commit()
            raise HTTPException(
                status_code=401,
                detail="Session invalidated due to password reset or security event. Please log in again.",
            )

        user_result = await db.execute(select(User).where(User.id == session.user_id))
        user = user_result.scalar_one_or_none()
        if not user or user.status != "ACTIVE":
            raise HTTPException(status_code=401, detail="User not found or inactive")

        access_token, new_refresh_token = await self.issue_token(
            str(user.id),
            user.email,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            family_id=session.family_id,
            user_agent=user_agent or session.user_agent,
            ip_address=ip_address or session.ip_address,
            db=db,
        )

        return AuthResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def verify_email(self, token: str, db=None) -> bool:
        from fastapi import HTTPException

        if not token:
            raise HTTPException(status_code=400, detail="Verification token is required")

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        now = datetime.now(UTC)

        # Pre-auth RLS context (PostgreSQL): token-hash scope unlocks exactly
        # this row under the lookup policy; user scope follows once resolved.
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_token_hash', :th, true)"), {"th": token_hash})
            except Exception:
                pass

        result = await db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_hash
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or expired verification token")
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(record.user_id)})
            except Exception:
                pass

        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)

        if expires_at < now:
            await db.delete(record)
            await db.commit()
            raise HTTPException(status_code=400, detail="Verification token has expired")

        user_result = await db.execute(select(User).where(User.id == record.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.email_verified = True
        await db.delete(record)
        await db.commit()
        return True

    async def resend_verification(self, email: str, db=None) -> bool:
        if not email or "@" not in email:
            return False
        email = email.strip().lower()

        # Pre-auth RLS context (PostgreSQL): user lookup + token-hash scope.
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_email', :email, true)"), {"email": email})
            except Exception:
                pass

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or user.email_verified:
            # Constant return to prevent user enumeration
            return True

        # Invalidate existing tokens
        await db.execute(
            delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
        )

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_token_hash', :th, true)"), {"th": token_hash})
                await db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(user.id)})
            except Exception:
                pass
        new_token = EmailVerificationToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        db.add(new_token)
        await db.commit()
        return True

    async def list_user_sessions(self, user_id: str, current_jti: str | None = None, db=None) -> list[SessionItemResponse]:
        now = datetime.now(UTC)
        result = await db.execute(
            select(AuthSession)
            .where(
                AuthSession.user_id == uuid.UUID(user_id),
                AuthSession.status == "ACTIVE",
            )
            .order_by(AuthSession.created_at.desc())
        )
        sessions = result.scalars().all()
        active_sessions = []
        for s in sessions:
            exp = s.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=UTC)
            if exp >= now:
                active_sessions.append(
                    SessionItemResponse(
                        id=s.id,
                        user_agent=s.user_agent,
                        ip_address=s.ip_address,
                        created_at=s.created_at,
                        expires_at=s.expires_at,
                        is_current=(s.jti == current_jti) if current_jti and s.jti else False,
                        status=s.status,
                    )
                )
        return active_sessions

    async def revoke_user_session(self, user_id: str, session_id: str, db=None) -> bool:
        result = await db.execute(
            select(AuthSession).where(
                AuthSession.id == uuid.UUID(session_id),
                AuthSession.user_id == uuid.UUID(user_id),
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            return False

        session.status = "REVOKED"
        if session.jti:
            self.revoke_token(jti=session.jti)
        await db.commit()
        return True

    async def revoke_other_sessions(self, user_id: str, current_jti: str | None = None, db=None) -> int:
        result = await db.execute(
            select(AuthSession).where(
                AuthSession.user_id == uuid.UUID(user_id),
                AuthSession.status == "ACTIVE",
            )
        )
        sessions = result.scalars().all()
        revoked_count = 0
        for s in sessions:
            if current_jti and s.jti == current_jti:
                continue
            s.status = "REVOKED"
            if s.jti:
                self.revoke_token(jti=s.jti)
            revoked_count += 1
        await db.commit()
        return revoked_count

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
                client.set(
                    f"{_REVOKED_PREFIX}{jti}", "1", ex=int(settings.jwt_token_ttl)
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
                client.set(
                    f"{_CUTOFF_PREFIX}{user_id}", str(cutoff), ex=int(settings.jwt_token_ttl)
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

    _password_resets: dict[str, tuple[str, datetime]] = {}

    async def request_password_reset(self, email: str, db=None) -> bool:
        """Issue a password reset token for the given email (constant time behavior to prevent user enumeration)."""
        import hashlib
        import logging
        import secrets

        logger = logging.getLogger(__name__)
        if not email or "@" not in email:
            return False
        email = email.strip().lower()

        if db is not None:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if not user:
                return True

            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            expires_at = datetime.now(UTC) + timedelta(minutes=15)

            AuthService._password_resets[token_hash] = (str(user.id), expires_at)
            redis = _get_revocation_redis()
            if redis is not None:
                try:
                    redis.set(f"pwd_reset:{token_hash}", str(user.id), ex=900)
                except Exception as e:
                    logger.warning("Failed to store reset token in Redis: %s", e)

            # SECURITY: never log the raw reset token. Anyone with read access to
            # application logs could otherwise complete any password reset. Log
            # only the user id and the token's expiry.
            logger.info("Password reset issued for user %s, expires at %s", user.id, expires_at)

            # Dispatch transactional password reset email
            try:
                from api.services.email_service import email_service
                frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
                reset_url = f"{frontend_url}/reset-password?token={raw_token}"
                await email_service.send_password_reset_email(
                    to_email=user.email,
                    reset_url=reset_url,
                    expires_minutes=15,
                )
            except Exception as mail_exc:
                logger.warning("Failed to dispatch password reset email: %s", mail_exc)

        return True

    async def reset_password_with_token(self, token: str, new_password: str, db=None) -> bool:
        """Verify password reset token and update user password."""
        import hashlib
        from fastapi import HTTPException

        if not token or not new_password or len(new_password) < 8:
            raise HTTPException(status_code=400, detail="Invalid token or password must be at least 8 characters")

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        user_id = None

        # Single-use invariant: a reset token must be consumed exactly once,
        # across BOTH storage paths. The token is written to Redis *and* to the
        # in-process dict, so whichever path answers first must also invalidate
        # the other. Previously only the Redis key was deleted, which meant a
        # token could be redeemed a second time via the in-process dict.
        in_memory = AuthService._password_resets.pop(token_hash, None)

        redis = _get_revocation_redis()
        if redis is not None:
            try:
                # GETDEL (Redis >= 6.2) is atomic; the pipelled GET+DEL fallback
                # is not, so a burst of concurrent resets can still race.
                getdel = getattr(redis, "getdel", None)
                if callable(getdel):
                    user_id = getdel(f"pwd_reset:{token_hash}")
                else:
                    pipe = redis.pipeline()
                    pipe.get(f"pwd_reset:{token_hash}")
                    pipe.delete(f"pwd_reset:{token_hash}")
                    results = pipe.execute()
                    user_id = results[0]
            except Exception:
                pass

        if not user_id and in_memory is not None:
            uid, exp = in_memory
            if datetime.now(UTC) <= exp:
                user_id = uid

        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

        if db is not None:
            result = await db.execute(select(User).where(User.id == uuid.UUID(str(user_id))))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            user.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
            # A completed reset is proof of account control, so it also clears
            # the failure counter and any active lockout. Without this, a user
            # locked out by repeated failed logins has no self-service recovery:
            # reset succeeds but the next login still returns 423.
            user.failed_login_attempts = 0
            user.locked_until = None
            # Explicitly revoke all active auth_sessions in DB (GAP-AUTH-03)
            await db.execute(
                update(AuthSession)
                .where(AuthSession.user_id == user.id, AuthSession.status == "ACTIVE")
                .values(status="REVOKED")
            )
            await db.commit()
            await self.revoke_all_user_tokens(user_id=str(user.id), db=db)
        return True

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
