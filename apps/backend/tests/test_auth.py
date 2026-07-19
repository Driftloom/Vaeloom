import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAuth:
    async def test_signup(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "test@test.com",
            "password": "Test1234!",
        })
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
        assert data["user"]["email"] == "test@test.com"

    async def test_login(self, client: AsyncClient):
        await client.post("/api/v1/auth/signup", json={
            "email": "test@test.com",
            "password": "Test1234!",
        })
        res = await client.post("/api/v1/auth/login", json={
            "email": "test@test.com",
            "password": "Test1234!",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data

    async def test_login_wrong_password(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrong",
        })
        assert res.status_code == 401

    async def test_me_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/auth/me")
        assert res.status_code == 401

    async def test_me_with_token(self, client: AsyncClient):
        signup_res = await client.post("/api/v1/auth/signup", json={
            "email": "test@test.com",
            "password": "Test1234!",
        })
        token = signup_res.json()["access_token"]
        res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["user"]["email"] == "test@test.com"
