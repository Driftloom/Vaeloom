import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestSSO:
    async def test_sso_unsupported_provider(self, client: AsyncClient):
        res = await client.get("/api/v1/auth/sso/unsupported", params={"redirect_uri": "http://localhost:3000/callback"})
        body = res.json()
        assert res.status_code == 400, f"Expected 400 got {res.status_code}: {body}"
        assert "Unsupported" in body.get("detail", str(body))

    async def test_sso_google_login(self, client: AsyncClient):
        from api.config import settings
        settings.sso_providers["google"] = {
            "issuer": "https://accounts.google.com",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }
        res = await client.get("/api/v1/auth/sso/google", params={"redirect_uri": "http://localhost:3000/callback"})
        assert res.status_code == 200
        data = res.json()
        assert "auth_url" in data
        assert "state" in data
        assert "accounts.google.com" in data["auth_url"]

    async def test_sso_microsoft_login(self, client: AsyncClient):
        from api.config import settings
        settings.sso_providers["microsoft"] = {
            "issuer": "common",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }
        res = await client.get("/api/v1/auth/sso/microsoft", params={"redirect_uri": "http://localhost:3000/callback"})
        assert res.status_code == 200
        data = res.json()
        assert "auth_url" in data
        assert "login.microsoftonline.com" in data["auth_url"]

    async def test_sso_callback_state_mismatch(self, db_session):
        from api.config import settings
        from api.database import get_db
        from api.routers import auth
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        settings.sso_providers["google"] = {
            "issuer": "https://accounts.google.com",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }

        app = FastAPI()
        app.include_router(auth.router, prefix="/api/v1/auth")
        app.state._sso_state = "expected-state"

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get(
                "/api/v1/auth/sso/google/callback",
                params={"code": "authcode", "state": "wrong-state"},
            )
            assert res.status_code == 400, f"Got {res.status_code}: {res.text}"
            assert "Invalid or expired SSO state" in res.json()["detail"]

    async def test_sso_callback_bad_code(self, db_session):
        from unittest.mock import AsyncMock, patch
        from api.config import settings
        from api.database import get_db
        from api.routers import auth
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        settings.sso_providers["google"] = {
            "issuer": "https://accounts.google.com",
            "client_id": "test-client-id",
            "client_secret": "test-client-secret",
        }

        app = FastAPI()
        app.include_router(auth.router, prefix="/api/v1/auth")
        auth._sso_states["test-state"] = "google"

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        mock_resp = AsyncMock()
        mock_resp.status_code = 400
        mock_resp.text = "invalid_grant"

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            with patch("api.services.sso.httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
                res = await ac.get(
                    "/api/v1/auth/sso/google/callback",
                    params={"code": "authcode", "state": "test-state"},
                )
            assert res.status_code == 401, f"Got {res.status_code}: {res.text}"
            assert "Failed to exchange" in res.json()["detail"]

    async def test_sso_provider_config_parsing(self):
        from api.config import Settings
        s = Settings(sso_providers='{"google":{"issuer":"https://accounts.google.com","client_id":"id","client_secret":"secret"}}')
        assert s.sso_providers["google"]["client_id"] == "id"

    async def test_sso_provider_config_empty(self):
        from api.config import Settings
        s = Settings()
        assert s.sso_providers == {}

    async def test_google_sso_provider(self):
        from api.services.sso import GoogleSSOProvider, SSOConfig
        config = SSOConfig(issuer="https://accounts.google.com", client_id="id", client_secret="secret")
        provider = GoogleSSOProvider(config)
        url = await provider.get_auth_url("http://localhost:3000/callback", "test-state")
        assert "accounts.google.com" in url
        assert "client_id=id" in url
        assert "state=test-state" in url

    async def test_microsoft_sso_provider(self):
        from api.services.sso import MicrosoftSSOProvider, SSOConfig
        config = SSOConfig(issuer="common", client_id="id", client_secret="secret")
        provider = MicrosoftSSOProvider(config)
        url = await provider.get_auth_url("http://localhost:3000/callback", "test-state")
        assert "login.microsoftonline.com" in url
        assert "client_id=id" in url
        assert "state=test-state" in url

    async def test_google_validate_token_bad_jwt(self):
        from api.services.sso import GoogleSSOProvider, SSOConfig
        config = SSOConfig(issuer="https://accounts.google.com", client_id="id", client_secret="secret")
        provider = GoogleSSOProvider(config)
        result = await provider.validate_token("invalid-token")
        assert result is None

    async def test_saml_provider(self):
        from api.services.sso import SSOConfig, get_sso_provider
        config = SSOConfig(issuer="saml-issuer", client_id="id", client_secret="secret")
        with pytest.raises(ValueError, match="Unsupported SSO provider.*saml"):
            get_sso_provider("saml", config)

    async def test_get_sso_provider_unsupported(self):
        from api.services.sso import SSOConfig, get_sso_provider
        config = SSOConfig(issuer="x", client_id="x", client_secret="x")
        with pytest.raises(ValueError, match="Unsupported SSO provider"):
            get_sso_provider("unknown", config)

    async def test_sso_callback_no_provider_config(self, client: AsyncClient):
        from api.routers import auth
        auth._sso_states["test-state-unknown"] = "unknown"
        res = await client.get(
            "/api/v1/auth/sso/unknown/callback",
            params={"code": "authcode", "state": "test-state-unknown"},
        )
        body = res.json()
        assert res.status_code == 400, f"Got {res.status_code}: {res.text}"
        assert "Unsupported" in body.get("detail", str(body))

    async def test_sso_microsoft_exchange_code_bad(self):
        from unittest.mock import AsyncMock, patch
        from api.services.sso import MicrosoftSSOProvider, SSOConfig
        config = SSOConfig(issuer="common", client_id="id", client_secret="secret")
        provider = MicrosoftSSOProvider(config)
        mock_resp = AsyncMock()
        mock_resp.status_code = 400
        mock_resp.text = "invalid_grant"
        with patch("api.services.sso.httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
            result = await provider.exchange_code("bad-code", "http://redirect")
        assert result is None
