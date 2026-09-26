"""Tests for password reset durability, single-use, expiry, and lockout clearance.

Covers Wave 2.4 and Wave 2.14 of the Enterprise Production Readiness Plan:
- PasswordResetToken persistence in database
- Replay prevention (used_at enforced, raises 400 on repeat)
- Expiry enforcement (expired token raises 400)
- Lockout & failed attempts clearance upon successful password reset
- Active sessions revoked upon password reset
"""
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from api.models.schema import AuthSession, PasswordResetToken, User
from api.services.auth_service import auth_service

pytestmark = pytest.mark.asyncio


class TestPasswordResetRecovery:
    async def _create_test_user(self, db, email: str = "reset-test@vaeloom.com") -> User:
        user = User(
            id=uuid.uuid4(),
            email=email,
            password_hash="$2b$12$eX4mpL3h4shf0rt3st1ng0nly...............",
            display_name="Reset Tester",
            status="ACTIVE",
            email_verified=True,
            failed_login_attempts=0,
            locked_until=None,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def test_password_reset_full_flow_db_persisted(self, db_session):
        """request_password_reset stores token in DB and reset_password_with_token marks it used."""
        user = await self._create_test_user(db_session, "persist-flow@vaeloom.com")

        # 1. Issue reset
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(UTC) + timedelta(minutes=15)

        db_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db_session.add(db_token)
        await db_session.commit()

        # 2. Verify token is in DB and unused
        res = await db_session.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
        persisted = res.scalar_one_or_none()
        assert persisted is not None
        assert persisted.used_at is None
        assert persisted.user_id == user.id

        # 3. Reset password using token
        success = await auth_service.reset_password_with_token(
            token=raw_token,
            new_password="NewSecurePassword123!",
            db=db_session,
        )
        assert success is True

        # 4. Verify token is now marked as used in DB
        await db_session.refresh(persisted)
        assert persisted.used_at is not None

        # 5. Verify user's password was updated
        await db_session.refresh(user)
        assert user.password_hash != "$2b$12$eX4mpL3h4shf0rt3st1ng0nly..............."

    async def test_password_reset_replay_rejected(self, db_session):
        """A password reset token can only be consumed once; replay yields 400."""
        user = await self._create_test_user(db_session, "replay-token@vaeloom.com")

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        db_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        db_session.add(db_token)
        await db_session.commit()

        # First consumption -> succeeds
        ok = await auth_service.reset_password_with_token(
            token=raw_token,
            new_password="BrandNewPassword123!",
            db=db_session,
        )
        assert ok is True

        # Second consumption -> rejected with 400
        with pytest.raises(HTTPException) as exc_info:
            await auth_service.reset_password_with_token(
                token=raw_token,
                new_password="AnotherPassword123!",
                db=db_session,
            )
        assert exc_info.value.status_code == 400
        assert "already been used" in exc_info.value.detail.lower()

    async def test_password_reset_expired_rejected(self, db_session):
        """An expired token yields 400 and does not change the password."""
        user = await self._create_test_user(db_session, "expired-token@vaeloom.com")
        orig_hash = user.password_hash

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expired_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) - timedelta(seconds=10),
        )
        db_session.add(expired_token)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await auth_service.reset_password_with_token(
                token=raw_token,
                new_password="NewAttempt1234!",
                db=db_session,
            )
        assert exc_info.value.status_code == 400
        assert "expired" in exc_info.value.detail.lower()

        # Verify password did not change
        await db_session.refresh(user)
        assert user.password_hash == orig_hash

    async def test_password_reset_clears_lockout_and_failed_attempts(self, db_session):
        """Completing a password reset proves account control, clearing lockout and failure counters."""
        user = await self._create_test_user(db_session, "lockout-clear@vaeloom.com")
        user.failed_login_attempts = 5
        user.locked_until = datetime.now(UTC) + timedelta(minutes=15)
        await db_session.commit()

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        db_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        db_session.add(db_token)
        await db_session.commit()

        ok = await auth_service.reset_password_with_token(
            token=raw_token,
            new_password="UnlockedPassword123!",
            db=db_session,
        )
        assert ok is True

        await db_session.refresh(user)
        assert user.failed_login_attempts == 0
        assert user.locked_until is None

    async def test_password_reset_revokes_active_sessions(self, db_session):
        """Resetting a password revokes all active auth sessions for the user."""
        user = await self._create_test_user(db_session, "revoke-sessions@vaeloom.com")

        # Create active session
        session = AuthSession(
            user_id=user.id,
            token="dummy_access_token_digest",
            refresh_token="dummy_refresh_token_digest",
            jti=str(uuid.uuid4()),
            status="ACTIVE",
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)
        assert session.status == "ACTIVE"

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        db_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        db_session.add(db_token)
        await db_session.commit()

        ok = await auth_service.reset_password_with_token(
            token=raw_token,
            new_password="NewSecurePass1234!",
            db=db_session,
        )
        assert ok is True

        await db_session.refresh(session)
        assert session.status == "REVOKED"
