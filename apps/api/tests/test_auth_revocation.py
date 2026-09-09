import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAuthRevocation:
    async def test_token_revocation_lifecycle(self, client: AsyncClient):
        email = f"revoke_{uuid.uuid4().hex[:8]}@test.com"
        password = "SecurePassword123!"

        # 1. Sign up
        res_signup = await client.post("/api/v1/auth/signup", json={"email": email, "password": password})
        assert res_signup.status_code == 201, res_signup.text
        token1 = res_signup.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}

        # 2. Token works for /me
        res_me1 = await client.get("/api/v1/auth/me", headers=headers1)
        assert res_me1.status_code == 200
        assert res_me1.json()["user"]["email"] == email

        # 3. Log out
        res_logout = await client.post("/api/v1/auth/logout", headers=headers1)
        assert res_logout.status_code == 204

        # 4. Token MUST now be rejected as revoked
        res_me_revoked = await client.get("/api/v1/auth/me", headers=headers1)
        assert res_me_revoked.status_code == 401
        assert "revoked" in res_me_revoked.text.lower()

        # 5. Log in again to obtain a fresh token
        res_login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert res_login.status_code == 200
        token2 = res_login.json()["access_token"]
        assert token2 != token1
        headers2 = {"Authorization": f"Bearer {token2}"}

        # 6. Fresh token works
        res_me2 = await client.get("/api/v1/auth/me", headers=headers2)
        assert res_me2.status_code == 200
        assert res_me2.json()["user"]["email"] == email
