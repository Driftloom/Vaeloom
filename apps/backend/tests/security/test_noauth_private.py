import pytest
from httpx import AsyncClient

PUBLIC_PATHS = frozenset({
    "/health",
    "/health/ready",
    "/health/startup",
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/refresh",
})

PRIVATE_ENDPOINTS = [
    ("GET", "/api/v1/workspaces"),
    ("POST", "/api/v1/workspaces"),
    ("GET", "/api/v1/memories"),
    ("POST", "/api/v1/memories"),
    ("GET", "/api/v1/agents"),
    ("POST", "/api/v1/agents"),
    ("GET", "/api/v1/events"),
    ("POST", "/api/v1/events"),
    ("POST", "/api/v1/search"),
    ("GET", "/api/v1/integrations"),
    ("POST", "/api/v1/integrations"),
    ("GET", "/api/v1/billing"),
    ("GET", "/api/v1/documents"),
    ("GET", "/api/v1/notifications"),
    ("GET", "/api/v1/connectors"),
    ("GET", "/api/v1/scheduler"),
    ("GET", "/api/v1/analytics"),
    ("GET", "/api/v1/audit"),
    ("GET", "/api/v1/iam"),
    ("GET", "/api/v1/plugins"),
    ("GET", "/api/v1/chat"),
    ("GET", "/api/v1/knowledge-graph"),
    ("GET", "/api/v1/recommendations"),
    ("GET", "/api/v1/auth/me"),
]


@pytest.mark.asyncio
class TestNoAuthPrivate:
    """Verify all private endpoints require authentication."""

    @pytest.mark.parametrize("method,path", PRIVATE_ENDPOINTS)
    async def test_private_endpoint_requires_auth(
        self, client: AsyncClient, method: str, path: str,
    ):
        res = await client.request(method, path)
        assert res.status_code == 401, f"{method} {path} should return 401, got {res.status_code}"

    @pytest.mark.parametrize("method,path", PRIVATE_ENDPOINTS)
    async def test_private_endpoint_rejects_bad_token(
        self, client: AsyncClient, method: str, path: str,
    ):
        headers = {"Authorization": "Bearer invalid-token-12345"}
        res = await client.request(method, path, headers=headers)
        assert res.status_code == 401, f"{method} {path} should return 401 for bad token"

    @pytest.mark.parametrize("method,path", PRIVATE_ENDPOINTS)
    async def test_private_endpoint_rejects_empty_bearer(
        self, client: AsyncClient, method: str, path: str,
    ):
        headers = {"Authorization": "Bearer "}
        res = await client.request(method, path, headers=headers)
        assert res.status_code == 401, f"{method} {path} should return 401 for empty bearer"

    @pytest.mark.parametrize("method,path", PRIVATE_ENDPOINTS)
    async def test_private_endpoint_rejects_wrong_scheme(
        self, client: AsyncClient, method: str, path: str,
    ):
        headers = {"Authorization": "Basic dGVzdDp0ZXN0"}
        res = await client.request(method, path, headers=headers)
        assert res.status_code == 401, f"{method} {path} should return 401 for Basic auth"

    async def test_private_endpoint_accepts_valid_token(
        self, client: AsyncClient,
    ):
        signup_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "auth-test@vaeloom.test", "password": "AuthTest1234!"},
        )
        assert signup_res.status_code == 201
        token = signup_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/workspaces", headers=headers)
        assert res.status_code == 200

    @pytest.mark.parametrize("path", list(PUBLIC_PATHS))
    async def test_public_paths_are_accessible(
        self, client: AsyncClient, path: str,
    ):
        res = await client.get(path)
        assert res.status_code != 401, f"Public path {path} should not require auth"

    async def test_expired_token_is_rejected(
        self, client: AsyncClient,
    ):
        import jwt
        expired_token = jwt.encode(
            {"sub": "test-user", "exp": 0},
            "test-secret",
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {expired_token}"}
        res = await client.get("/api/v1/workspaces", headers=headers)
        assert res.status_code == 401

    async def test_malformed_token_is_rejected(
        self, client: AsyncClient,
    ):
        headers = {"Authorization": "Bearer definitely.not.a.valid.jwt"}
        res = await client.get("/api/v1/workspaces", headers=headers)
        assert res.status_code == 401
