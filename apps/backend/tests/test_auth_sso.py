import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _error_msg(res) -> str:
    body = res.json()
    if "detail" in body:
        return body["detail"]
    return body.get("error", {}).get("message", str(body))


class TestSSOTokenLogin:
    async def test_post_sso_unsupported_provider(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/sso/unsupported", json={"token": "abc"})
        assert res.status_code == 400, f"Got {res.status_code}: {res.text}"
        assert "Unsupported" in _error_msg(res)

    async def test_post_sso_no_provider_config(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/sso/unknown", json={"token": "abc"})
        assert res.status_code == 400, f"Got {res.status_code}: {res.text}"
        assert "Unsupported" in _error_msg(res)

    async def test_post_sso_invalid_token(self, client: AsyncClient):
        from backend.config import settings
        settings.sso_providers["google"] = {
            "issuer": "https://accounts.google.com",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }
        res = await client.post("/api/v1/auth/sso/google", json={"token": "invalid-token"})
        assert res.status_code == 401, f"Got {res.status_code}: {res.text}"
        assert "Invalid SSO token" in _error_msg(res)

    async def test_post_sso_success(self, db_session, monkeypatch):
        from backend.config import settings
        from backend.database import get_db
        from backend.routers import auth as auth_router
        from backend.services.sso import SSOProvider, SSOConfig
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        settings.sso_providers["google"] = {
            "issuer": "https://accounts.google.com",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }

        class FakeGoogleProvider(SSOProvider):
            def __init__(self, config: SSOConfig):
                self.config = config
            async def validate_token(self, token: str) -> dict | None:
                return {"sub": "google-123", "email": "sso@test.com", "name": "SSO User"}
            async def get_auth_url(self, redirect_uri: str, state: str) -> str:
                return "https://accounts.google.com/o/oauth2/v2/auth"
            async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
                return "id_token"

        monkeypatch.setattr(auth_router, "get_sso_provider", lambda p, c: FakeGoogleProvider(c))

        app = FastAPI()
        app.include_router(auth_router.router, prefix="/api/v1/auth")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/auth/sso/google", json={"token": "fake-token"})
            assert res.status_code == 200, f"Got {res.status_code}: {res.text}"
            data = res.json()
            assert "access_token" in data
            assert data["user"]["email"] == "sso@test.com"
            assert data["user"]["auth_provider"] == "google"

    async def test_post_sso_creates_new_user(self, db_session, monkeypatch):
        from backend.config import settings
        from backend.database import get_db
        from backend.routers import auth as auth_router
        from backend.services.sso import SSOProvider, SSOConfig
        from sqlalchemy import select
        from backend.models.schema import User
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        settings.sso_providers["microsoft"] = {
            "issuer": "common",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }

        class FakeMSProvider(SSOProvider):
            def __init__(self, config: SSOConfig):
                self.config = config
            async def validate_token(self, token: str) -> dict | None:
                return {"sub": "ms-456", "email": "new-sso@test.com", "name": "New SSO User"}
            async def get_auth_url(self, redirect_uri: str, state: str) -> str:
                return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
            async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
                return "id_token"

        monkeypatch.setattr(auth_router, "get_sso_provider", lambda p, c: FakeMSProvider(c))

        app = FastAPI()
        app.include_router(auth_router.router, prefix="/api/v1/auth")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/auth/sso/microsoft", json={"token": "fake-token"})
            assert res.status_code == 200, f"Got {res.status_code}: {res.text}"
            data = res.json()
            assert data["user"]["email"] == "new-sso@test.com"

        result = await db_session.execute(select(User).where(User.email == "new-sso@test.com"))
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.auth_provider == "microsoft"

    async def test_post_sso_inactive_user(self, db_session, monkeypatch):
        from backend.config import settings
        from backend.database import get_db
        from backend.routers import auth as auth_router
        from backend.services.sso import SSOProvider, SSOConfig
        from backend.models.schema import User
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        settings.sso_providers["google"] = {
            "issuer": "https://accounts.google.com",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }

        inactive_user = User(
            email="inactive@test.com",
            display_name="Inactive",
            auth_provider="google",
            status="INACTIVE",
        )
        db_session.add(inactive_user)
        await db_session.flush()
        await db_session.refresh(inactive_user)

        class FakeProvider(SSOProvider):
            def __init__(self, config: SSOConfig):
                self.config = config
            async def validate_token(self, token: str) -> dict | None:
                return {"sub": "inactive-789", "email": "inactive@test.com", "name": "Inactive User"}
            async def get_auth_url(self, redirect_uri: str, state: str) -> str:
                return "https://accounts.google.com/o/oauth2/v2/auth"
            async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
                return "id_token"

        monkeypatch.setattr(auth_router, "get_sso_provider", lambda p, c: FakeProvider(c))

        app = FastAPI()
        app.include_router(auth_router.router, prefix="/api/v1/auth")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/auth/sso/google", json={"token": "fake-token"})
            assert res.status_code == 403, f"Got {res.status_code}: {res.text}"
            assert "not active" in _error_msg(res).lower()
