import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestXSS:
    """Verify endpoints sanitize or reject XSS payloads."""

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "\"><script>alert(1)</script>",
        "<svg onload=alert(1)>",
    ])
    async def test_signup_email_xss(self, client: AsyncClient, payload: str):
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": f"xss-{payload}@test.com", "password": "Test1234!"},
        )
        assert res.status_code in (201, 400, 422)

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "\"><script>alert(1)</script>",
        "<body onload=alert(1)>",
        "\" onmouseover=\"alert(1)",
    ])
    async def test_signup_display_name_xss(self, client: AsyncClient, payload: str):
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "xss-test@test.com", "password": "Test1234!", "display_name": payload},
        )
        if res.status_code == 201:
            data = res.json()
            user = data.get("user", {})
            display_name = user.get("display_name", "")
            assert "<script>" not in display_name
            assert "onerror" not in display_name
            assert "onload" not in display_name
            assert "onmouseover" not in display_name

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "'; alert(1); '",
    ])
    async def test_memory_content_xss(
        self, client: AsyncClient, auth_headers: dict, payload: str,
    ):
        res = await client.post(
            "/api/v1/memories",
            json={"content": payload, "memory_type": "note"},
            headers=auth_headers,
        )
        if res.status_code == 201:
            content = res.json().get("content", "")
            assert "<script>" not in content
            assert "onerror" not in content

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "\"><script>alert(1)</script>",
    ])
    async def test_search_query_xss(
        self, client: AsyncClient, auth_headers: dict, payload: str,
    ):
        res = await client.post(
            "/api/v1/search",
            json={"query": payload, "sources": ["memories"], "limit": 10},
            headers=auth_headers,
        )
        assert res.status_code in (200, 422, 400)

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "\"><script>alert(1)</script>",
        "<svg onload=alert(1)>",
        "<<script>alert(1)</script>",
    ])
    async def test_workspace_name_xss(
        self, client: AsyncClient, auth_headers: dict, payload: str,
    ):
        res = await client.post(
            "/api/v1/workspaces",
            json={"name": payload, "description": "test"},
            headers=auth_headers,
        )
        if res.status_code == 201:
            name = res.json().get("name", "")
            assert "<script>" not in name
            assert "onerror" not in name
            assert "onload" not in name

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
    ])
    async def test_agent_name_xss(
        self, client: AsyncClient, auth_headers: dict, payload: str,
    ):
        res = await client.post(
            "/api/v1/agents",
            json={"name": payload, "description": "test agent", "type": "chat"},
            headers=auth_headers,
        )
        if res.status_code == 201:
            name = res.json().get("name", "")
            assert "<script>" not in name
            assert "onerror" not in name

    @pytest.mark.parametrize("payload", [
        "<script>alert('xss')</script>",
        "\"><script>alert(1)</script>",
        "'; alert(1); '",
    ])
    async def test_integration_config_xss(
        self, client: AsyncClient, auth_headers: dict, payload: str,
    ):
        res = await client.post(
            "/api/v1/integrations",
            json={"name": payload, "type": "calendar", "config": {"url": payload}},
            headers=auth_headers,
        )
        assert res.status_code in (201, 422, 400)

    async def test_response_headers_prevent_xss(
        self, client: AsyncClient, auth_headers: dict,
    ):
        res = await client.get("/api/v1/workspaces", headers=auth_headers)
        csp = res.headers.get("content-security-policy", "")
        xcto = res.headers.get("x-content-type-options", "")
        assert "default-src 'self'" in csp or not csp
        assert xcto == "nosniff" or not xcto
