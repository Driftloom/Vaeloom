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

    async def test_refresh_token_bad_token(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid-token",
        })
        assert res.status_code == 401

    async def test_me_not_authenticated(self, db_session):
        from api.database import get_db
        from api.dependencies import get_current_user
        from api.routers import auth
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(auth.router, prefix="/api/v1/auth")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def no_user():
            return None
        app.dependency_overrides[get_current_user] = no_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/auth/me")
            assert res.status_code == 401
            assert "Not authenticated" in res.json()["detail"]

    async def test_me_invalid_token_missing_sub(self, db_session):
        from api.database import get_db
        from api.dependencies import get_current_user
        from api.routers import auth
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(auth.router, prefix="/api/v1/auth")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def user_no_sub():
            return {"email": "test@test.com"}
        app.dependency_overrides[get_current_user] = user_no_sub

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/auth/me")
            assert res.status_code == 401
            assert "Invalid token" in res.json()["detail"]

    async def test_me_user_not_found(self, db_session):
        from api.database import get_db
        from api.dependencies import get_current_user
        from api.routers import auth
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(auth.router, prefix="/api/v1/auth")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def user_not_found():
            return {"sub": "00000000-0000-0000-0000-000000000000"}
        app.dependency_overrides[get_current_user] = user_not_found

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/auth/me")
            assert res.status_code == 401
            assert "User not found or inactive" in res.json()["detail"]

    async def test_signup_weak_password_rejected(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "strong@test.com",
            "password": "123",
        })
        assert res.status_code in (400, 422)

    async def test_signup_invalid_email_rejected(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "invalid-email",
            "password": "ValidPassword123!",
        })
        assert res.status_code in (400, 422)

    async def test_forgot_and_reset_password_flow(self, client: AsyncClient):
        # 1. Sign up user
        signup_res = await client.post("/api/v1/auth/signup", json={
            "email": "recovery@vaeloom.test",
            "password": "OldPassword123!",
        })
        assert signup_res.status_code == 201

        # 2. Request reset
        forgot_res = await client.post("/api/v1/auth/forgot-password", json={
            "email": "recovery@vaeloom.test",
        })
        assert forgot_res.status_code == 200

        # Retrieve the generated token from in-memory dictionary for testing
        from api.services.auth_service import AuthService
        assert len(AuthService._password_resets) > 0
        token_hash = list(AuthService._password_resets.keys())[0]

        # In order to test reset endpoint, we can test with the raw token if known,
        # or directly invoke reset_password_with_token
        # Let's test with a known token by setting it in _password_resets:
        import hashlib
        raw_test_token = "secure-test-token-12345"
        test_hash = hashlib.sha256(raw_test_token.encode()).hexdigest()
        from datetime import datetime, UTC, timedelta
        user_id = signup_res.json()["user"]["id"]
        AuthService._password_resets[test_hash] = (user_id, datetime.now(UTC) + timedelta(minutes=15))

        # 3. Reset password using valid token
        reset_res = await client.post("/api/v1/auth/reset-password", json={
            "token": raw_test_token,
            "new_password": "NewPassword1234!",
        })
        assert reset_res.status_code == 200

        # 4. Login with new password
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "recovery@vaeloom.test",
            "password": "NewPassword1234!",
        })
        assert login_res.status_code == 200
        assert "access_token" in login_res.json()

        # 5. Verify old password fails
        old_login = await client.post("/api/v1/auth/login", json={
            "email": "recovery@vaeloom.test",
            "password": "OldPassword123!",
        })
        assert old_login.status_code == 401



class TestRefreshRotation:
    """Refresh-token rotation must be a single atomic transition.

    The previous implementation read the session, checked ``status != ACTIVE``
    in Python, then assigned ``status = "ROTATED"``. Under READ COMMITTED two
    concurrent refreshes with the same token both read ACTIVE and both succeeded,
    so a stolen token could be exchanged twice before theft detection fired.
    """

    async def _signup_and_get_refresh(self, client: AsyncClient, email: str) -> str:
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "Refresh1234!"},
        )
        assert res.status_code == 201, res.text
        return res.json()["refresh_token"]

    async def test_concurrent_refresh_has_exactly_one_winner(self, client: AsyncClient):
        import asyncio

        token = await self._signup_and_get_refresh(client, "rotate-once@test.com")

        # Fire the same refresh token concurrently.
        results = await asyncio.gather(
            *[
                client.post(
                    "/api/v1/auth/refresh", json={"refresh_token": token}
                )
                for _ in range(5)
            ],
            return_exceptions=True,
        )

        statuses = [r.status_code for r in results if not isinstance(r, Exception)]
        successes = [s for s in statuses if s == 200]
        failures = [s for s in statuses if s == 401]

        assert len(successes) == 1, f"expected exactly 1 winner, got {statuses}"
        assert len(failures) == len(statuses) - 1, f"expected the rest to be 401, got {statuses}"

    async def test_replayed_refresh_token_is_rejected(self, client: AsyncClient):
        """A spent token must be refused and must revoke the family."""
        token = await self._signup_and_get_refresh(client, "rotate-replay@test.com")

        first = await client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        assert first.status_code == 200

        second = await client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        assert second.status_code == 401
        # Responses use the RFC 7807 superset envelope; the human-readable text
        # lives at error.message (see middleware/exception_handler.problem_envelope).
        body = second.json()
        assert body["status"] == 401
        assert "revoked" in str(body["error"]["message"]).lower()

