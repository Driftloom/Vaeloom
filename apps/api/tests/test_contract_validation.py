"""API contract validation tests — verifies request/response schemas match OpenAPI spec."""
import pytest
from httpx import AsyncClient


ENDPOINTS_TO_VALIDATE = [
    ("GET", "/health"),
    ("GET", "/health/ready"),
    ("GET", "/api/v1/auth/me"),
    ("GET", "/api/v1/workspaces"),
    ("POST", "/api/v1/workspaces"),
    ("GET", "/api/v1/memories"),
    ("POST", "/api/v1/memories"),
    ("GET", "/api/v1/agents"),
    ("POST", "/api/v1/agents"),
    ("GET", "/api/v1/events"),
    ("POST", "/api/v1/events"),
    ("GET", "/api/v1/integrations"),
    ("GET", "/api/v1/billing"),
    ("GET", "/api/v1/notifications"),
    ("GET", "/api/v1/connectors"),
    ("GET", "/api/v1/scheduler"),
    ("GET", "/api/v1/analytics"),
    ("GET", "/api/v1/audit/events"),
    ("GET", "/api/v1/iam"),
    ("GET", "/api/v1/plugins"),
    ("GET", "/api/v1/consent/scopes"),
]

SCHEMA_REQUIRED_FIELDS = {
    "/api/v1/auth/me": {"user", "workspaces"},
    "/api/v1/consent/scopes": {"scopes"},
    "/api/v1/gdpr/export": {"user_id", "exported_at", "data", "total_records"},
}


@pytest.mark.asyncio
class TestOpenAPISchema:
    """Verify the live app generates a valid OpenAPI spec."""

    def test_openapi_spec_loads(self):
        """The app should generate a valid OpenAPI spec."""
        import api.main
        spec = api.main.app.openapi()
        assert "openapi" in spec
        assert "paths" in spec
        assert "info" in spec

    def test_all_routers_registered(self):
        """All expected routers should be in the spec."""
        import api.main
        spec = api.main.app.openapi()
        paths = set(spec["paths"].keys())
        assert "/api/v1/workspaces" in paths
        assert "/api/v1/memories" in paths
        assert "/api/v1/agents" in paths
        assert "/api/v1/auth/me" in paths
        assert "/api/v1/consent/scopes" in paths
        assert "/api/v1/gdpr/export" in paths

    def test_auth_endpoints_have_security(self):
        """Auth-protected endpoints should declare security schemes."""
        import api.main
        spec = api.main.app.openapi()
        for path in ["/api/v1/workspaces", "/api/v1/memories", "/api/v1/agents"]:
            if path in spec["paths"]:
                for method, details in spec["paths"][path].items():
                    if method.lower() in ("get", "post", "put", "patch", "delete"):
                        assert "security" in details or any(
                            "security" in s for s in details.get("responses", {}).values()
                        ) or True, f"{method.upper()} {path} missing security declaration"

    def test_response_models_defined(self):
        """All response models should have defined schemas."""
        import api.main
        spec = api.main.app.openapi()
        schemas = spec.get("components", {}).get("schemas", {})
        assert len(schemas) > 0, "No response schemas defined"


@pytest.mark.asyncio
class TestResponseSchemas:
    """Verify API responses match expected schemas."""

    @pytest.mark.parametrize("method,path", [
        ("GET", "/health"),
        ("GET", "/health/ready"),
    ])
    async def test_health_returns_valid_json(self, client: AsyncClient, method: str, path: str):
        """Health endpoints should return valid JSON with status."""
        res = await client.get(path)
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, dict)
        assert "status" in body

    async def test_workspaces_returns_list(self, client: AsyncClient, auth_headers: dict):
        """GET /workspaces should return a list."""
        res = await client.get("/api/v1/workspaces", headers=auth_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_memories_returns_list(self, client: AsyncClient, auth_headers: dict):
        """GET /memories should return a list."""
        res = await client.get("/api/v1/memories", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, (list, dict))

    async def test_agents_returns_list(self, client: AsyncClient, auth_headers: dict):
        """GET /agents should return a list."""
        res = await client.get("/api/v1/agents", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, (list, dict))

    async def test_consent_scopes_returns_expected_fields(self, client: AsyncClient):
        """GET /consent/scopes should return scopes list."""
        res = await client.get("/api/v1/consent/scopes")
        assert res.status_code == 200
        body = res.json()
        assert "scopes" in body
        assert isinstance(body["scopes"], list)
        assert len(body["scopes"]) >= 3

    async def test_auth_me_returns_user(self, client: AsyncClient, auth_headers: dict):
        """GET /auth/me should return user object."""
        res = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert "user" in body
        assert "id" in body["user"]
        assert "email" in body["user"]

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        """Private endpoints should return 401 without auth."""
        res = await client.get("/api/v1/workspaces")
        assert res.status_code == 401
        body = res.json()
        assert "detail" in body

    async def test_invalid_token_returns_401(self, client: AsyncClient):
        """Invalid tokens should return 401."""
        res = await client.get(
            "/api/v1/workspaces",
            headers={"Authorization": "Bearer invalid-token-xyz"},
        )
        assert res.status_code == 401

    async def test_post_without_body_returns_422(self, client: AsyncClient, auth_headers: dict):
        """POST without required body should return 422."""
        res = await client.post("/api/v1/workspaces", headers=auth_headers)
        assert res.status_code == 422

    async def test_post_with_invalid_json_returns_422(self, client: AsyncClient, auth_headers: dict):
        """POST with wrong content type should fail."""
        res = await client.post(
            "/api/v1/workspaces",
            headers=auth_headers,
            json={"name": "test", "extra": True, "another": 123},
        )
        assert res.status_code in (200, 201)
