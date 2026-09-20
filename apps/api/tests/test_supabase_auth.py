"""Tests for Supabase Auth integration in FastAPI backend."""
import uuid
import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.config import settings
from api.models.schema import User, Workspace

pytestmark = pytest.mark.asyncio


class TestSupabaseAuth:
    async def test_supabase_token_decoding_and_auto_provision(self, client: AsyncClient, db_session: AsyncSession, monkeypatch):
        """Verify that a Supabase-issued JWT automatically authenticates and provisions the user and workspace."""
        test_uid = str(uuid.uuid4())
        test_email = f"supabase_user_{uuid.uuid4().hex[:8]}@example.com"

        # Configure Supabase JWT secret
        supa_secret = "test-supabase-jwt-secret-for-testing-12345678"
        monkeypatch.setattr(settings, "supabase_jwt_secret", supa_secret)

        token = jwt.encode(
            {
                "sub": test_uid,
                "email": test_email,
                "role": "authenticated",
                "iss": "https://yygakxcttyaeunvkeybx.supabase.co/auth/v1",
                "exp": 9999999999,
                "iat": 1000000000,
                "user_metadata": {"full_name": "Supabase Test User"},
            },
            supa_secret,
            algorithm="HS256",
        )

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()

        assert data["user"]["email"] == test_email
        assert data["user"]["display_name"] == "Supabase Test User"
        assert len(data["workspaces"]) >= 1
        assert data["workspaces"][0]["name"] == "Default Workspace"

        # Verify user exists in session
        res = await db_session.execute(select(User).where(User.id == uuid.UUID(test_uid)))
        user_in_db = res.scalar_one_or_none()
        assert user_in_db is not None
        assert user_in_db.email == test_email
        assert user_in_db.auth_provider == "supabase"

    async def test_supabase_token_without_secret_fallback(self, client: AsyncClient, monkeypatch):
        """Verify that under Zero Trust, a Supabase token signed with an unknown secret is strictly rejected (HTTP 401)."""
        test_uid = str(uuid.uuid4())
        test_email = f"dev_user_{uuid.uuid4().hex[:8]}@example.com"

        monkeypatch.setattr(settings, "supabase_jwt_secret", "")
        monkeypatch.setattr(settings, "supabase_url", "")

        token = jwt.encode(
            {
                "sub": test_uid,
                "email": test_email,
                "iss": "https://yygakxcttyaeunvkeybx.supabase.co/auth/v1",
                "exp": 9999999999,
                "iat": 1000000000,
            },
            "random-secret-for-unverified-iss-test-32byteslong",
            algorithm="HS256",
        )

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        data = resp.json()
        assert data["detail"] == "Invalid token"
