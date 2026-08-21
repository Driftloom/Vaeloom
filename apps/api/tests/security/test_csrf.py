"""CSRF protection tests — verifies double-submit cookie pattern."""
import pytest
from httpx import AsyncClient


MUTATED_ENDPOINTS = [
    ("POST", "/api/v1/workspaces"),
    ("POST", "/api/v1/memories"),
    ("POST", "/api/v1/agents"),
    ("POST", "/api/v1/events"),
    ("POST", "/api/v1/search"),
]

SAFE_ENDPOINTS = ["/health", "/health/ready", "/api/v1/auth/login", "/api/v1/auth/signup"]


@pytest.mark.asyncio
class TestCSRFProtection:
    """Verify CSRF middleware blocks unauthenticated mutations."""

    @pytest.mark.parametrize("method,path", MUTATED_ENDPOINTS)
    async def test_mutation_without_csrf_token_blocked(
        self, csrf_client: AsyncClient, csrf_auth_headers: dict, method: str, path: str,
    ):
        """POST/PUT/PATCH/DELETE without CSRF headers should return 403."""
        res = await csrf_client.request(method, path, headers=csrf_auth_headers)
        assert res.status_code == 403, f"{method} {path} without CSRF should be 403"

    @pytest.mark.parametrize("path", SAFE_ENDPOINTS)
    async def test_safe_endpoint_skips_csrf(self, csrf_client: AsyncClient, path: str):
        """GET and auth endpoints should not require CSRF."""
        res = await csrf_client.get(path)
        assert res.status_code != 403 or res.status_code == 200

    async def test_csrf_token_endpoint_returns_token(self, csrf_client: AsyncClient):
        """GET /csrf-token should return a token and set a cookie."""
        res = await csrf_client.get("/csrf-token")
        assert res.status_code == 200
        body = res.json()
        assert "csrf_token" in body
        assert len(body["csrf_token"]) > 10
        assert "csrf_token" in res.cookies

    async def test_mutation_with_valid_csrf_token_allowed(
        self, csrf_client: AsyncClient, csrf_auth_headers: dict,
    ):
        """POST with matching CSRF header + cookie should pass CSRF check."""
        token_res = await csrf_client.get("/csrf-token")
        token = token_res.json()["csrf_token"]
        cookie = token_res.cookies.get("csrf_token", "")

        headers = {**csrf_auth_headers, "X-CSRF-Token": token}
        cookies = {"csrf_token": cookie}

        res = await csrf_client.post(
            "/api/v1/workspaces",
            headers=headers,
            cookies=cookies,
            json={"name": "CSRF Test Workspace"},
        )
        assert res.status_code != 403, f"Valid CSRF should not return 403, got {res.status_code}"

    async def test_mutation_with_mismatched_csrf_token_blocked(
        self, csrf_client: AsyncClient, csrf_auth_headers: dict,
    ):
        """POST with wrong X-CSRF-Token value should return 403."""
        token_res = await csrf_client.get("/csrf-token")
        cookie = token_res.cookies.get("csrf_token", "")

        headers = {**csrf_auth_headers, "X-CSRF-Token": "totally-wrong-token"}
        cookies = {"csrf_token": cookie}

        res = await csrf_client.post(
            "/api/v1/workspaces",
            headers=headers,
            cookies=cookies,
            json={"name": "Should Fail"},
        )
        assert res.status_code == 403

    async def test_mutation_with_header_only_no_cookie_blocked(
        self, csrf_client: AsyncClient, csrf_auth_headers: dict,
    ):
        """POST with X-CSRF-Token header but no cookie should return 403."""
        token_res = await csrf_client.get("/csrf-token")
        token = token_res.json()["csrf_token"]

        headers = {**csrf_auth_headers, "X-CSRF-Token": token}
        csrf_client.cookies.clear()

        res = await csrf_client.post(
            "/api/v1/workspaces",
            headers=headers,
            json={"name": "Should Fail"},
        )
        assert res.status_code == 403

    async def test_mutation_with_cookie_only_no_header_blocked(
        self, csrf_client: AsyncClient, csrf_auth_headers: dict,
    ):
        """POST with cookie but no X-CSRF-Token header should return 403."""
        token_res = await csrf_client.get("/csrf-token")
        cookie = token_res.cookies.get("csrf_token", "")

        cookies = {"csrf_token": cookie}

        res = await csrf_client.post(
            "/api/v1/workspaces",
            headers=csrf_auth_headers,
            cookies=cookies,
            json={"name": "Should Fail"},
        )
        assert res.status_code == 403

    async def test_csrf_token_expiry(self):
        """Tokens should expire after TTL."""
        from api.middleware.csrf import CSRFTokenStore
        store = CSRFTokenStore()
        store._ttl = 0.0
        token = store.generate()
        import time
        time.sleep(0.01)
        assert store.validate(token) is False
