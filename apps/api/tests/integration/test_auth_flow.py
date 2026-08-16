import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAuthFlow:
    """Full auth flow: signup → login → JWT → refresh → protected route."""

    EMAIL = "flow@test.com"
    PASSWORD = "FlowTest1234!"

    async def test_signup_creates_user_and_returns_token(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "Bearer"
        assert data["user"]["email"] == self.EMAIL

    async def test_duplicate_signup_returns_409(self, client: AsyncClient):
        await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        assert res.status_code == 409

    async def test_login_returns_valid_jwt(self, client: AsyncClient):
        await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["user"]["email"] == self.EMAIL

    async def test_login_with_wrong_password_returns_401(self, client: AsyncClient):
        await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": self.EMAIL, "password": "wrong-password"},
        )
        assert res.status_code == 401

    async def test_jwt_accesses_protected_route(self, client: AsyncClient):
        await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        token = login_res.json()["access_token"]

        res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["user"]["email"] == self.EMAIL

    async def test_protected_route_without_token_returns_401(
        self, client: AsyncClient
    ):
        res = await client.get("/api/v1/auth/me")
        assert res.status_code == 401

    async def test_protected_route_with_invalid_token_returns_401(
        self, client: AsyncClient
    ):
        res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        assert res.status_code == 401

    async def test_refresh_token_issues_new_tokens(self, client: AsyncClient):
        signup_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        refresh_token = signup_res.json()["refresh_token"]

        res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == self.EMAIL

    async def test_refresh_with_invalid_token_returns_401(
        self, client: AsyncClient
    ):
        res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "totally-invalid-token"},
        )
        assert res.status_code == 401

    async def test_full_flow(
        self, client: AsyncClient
    ):
        """Signup → login → use token → refresh → use new token."""
        signup_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": self.EMAIL, "password": self.PASSWORD},
        )
        assert signup_res.status_code == 201
        token = signup_res.json()["access_token"]
        refresh = signup_res.json()["refresh_token"]

        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200

        refresh_res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert refresh_res.status_code == 200
        new_token = refresh_res.json()["access_token"]

        me_res2 = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_token}"},
        )
        assert me_res2.status_code == 200
        assert me_res2.json()["user"]["email"] == self.EMAIL
