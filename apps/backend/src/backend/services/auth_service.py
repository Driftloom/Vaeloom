import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import select

from ..config import settings
from ..models.schema import AuthSession, User, Workspace
from ..schemas.auth import AuthResponse, PublicUser


class AuthService:
    async def signup(self, email: str, password: str, display_name: str | None = None, db=None):
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="Email already registered")

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = User(
            email=email,
            password_hash=password_hash,
            display_name=display_name or email.split("@")[0],
        )
        db.add(user)
        await db.flush()

        workspace = Workspace(
            user_id=user.id,
            name=f"{display_name or email.split('@')[0]}'s Workspace",
        )
        db.add(workspace)
        await db.flush()
        await db.refresh(user)

        access_token, refresh_token = await self.issue_token(str(user.id), email, db=db)

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

        access_token, refresh_token = await self.issue_token(str(user.id), email, db=db)

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=PublicUser.model_validate(user),
        )

    async def issue_token(self, user_id: str, email: str, tenant_id: str | None = None, db=None):
        import secrets

        now = datetime.now(timezone.utc)
        access_token = self._create_jwt(user_id, email, tenant_id)
        refresh_token = secrets.token_urlsafe(64)

        session = AuthSession(
            user_id=uuid.UUID(user_id),
            token=access_token,
            refresh_token=refresh_token,
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

        now = datetime.now(timezone.utc)
        if session.status != "ACTIVE" or session.expires_at < now:
            raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

        user_result = await db.execute(select(User).where(User.id == session.user_id))
        user = user_result.scalar_one_or_none()
        if not user or user.status != "ACTIVE":
            raise HTTPException(status_code=401, detail="User not found or inactive")

        session.status = "ROTATED"
        db.add(session)

        access_token, new_refresh_token = await self.issue_token(
            str(user.id), user.email, db=db,
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

    def _create_jwt(self, user_id: str, email: str, tenant_id: str | None = None):
        now = datetime.now(timezone.utc)
        payload = {
            "jti": str(uuid.uuid4()),
            "sub": user_id,
            "email": email,
            "iat": now,
            "exp": now + timedelta(seconds=settings.jwt_token_ttl),
        }
        if tenant_id:
            payload["tenant_id"] = tenant_id
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


auth_service = AuthService()
