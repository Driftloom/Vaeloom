import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestSQLInjection:
    """Verify endpoints reject common SQL injection patterns."""

    PRIVATE_ENDPOINTS = [
        ("GET", "/api/v1/workspaces"),
        ("GET", "/api/v1/memories"),
        ("GET", "/api/v1/agents"),
        ("GET", "/api/v1/notifications"),
        ("GET", "/api/v1/analytics"),
    ]

    @pytest.mark.parametrize("payload", [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users; --",
        "' OR 1=1 --",
        "1' ORDER BY 1--",
    ])
    async def test_login_email_injection(self, client: AsyncClient, payload: str):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": payload, "password": "test123"},
        )
        assert res.status_code in (401, 422, 400)

    @pytest.mark.parametrize("payload", [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users; --",
        "' OR 1=1 --",
        "1' AND 1=1",
    ])
    async def test_login_password_injection(self, client: AsyncClient, payload: str):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@test.com", "password": payload},
        )
        assert res.status_code in (401, 422, 400)

    @pytest.mark.parametrize("method,path", PRIVATE_ENDPOINTS)
    @pytest.mark.parametrize("sqli_field", [
        "limit",
        "offset",
        "page",
    ])
    async def test_query_param_injection(
        self, client: AsyncClient, auth_headers: dict, method: str, path: str, sqli_field: str,
    ):
        params = {sqli_field: "' OR 1=1 --"}
        res = await client.request(method, path, params=params, headers=auth_headers)
        assert res.status_code in (200, 422, 400)

    @pytest.mark.parametrize("sqli_field", [
        "query",
        "sources",
    ])
    async def test_search_body_injection(
        self, client: AsyncClient, auth_headers: dict, sqli_field: str,
    ):
        body = {"query": "test", "sources": ["memories"], "limit": 10}
        body[sqli_field] = "' UNION SELECT pg_sleep(5)--"
        res = await client.post("/api/v1/search", json=body, headers=auth_headers)
        assert res.status_code in (200, 422, 400)

    async def test_memory_create_injection(
        self, client: AsyncClient, auth_headers: dict,
    ):
        payloads = [
            {"content": "'; DROP TABLE memories; --", "memory_type": "note"},
            {"content": "safe content", "memory_type": "'; DROP TABLE memories; --"},
            {"content": "<script>alert(1)</script>", "memory_type": "<script>alert(1)</script>"},
            {"content": "' OR '1'='1", "memory_type": "' OR '1'='1"},
        ]
        for body in payloads:
            res = await client.post("/api/v1/memories", json=body, headers=auth_headers)
            assert res.status_code in (201, 422, 400)

    async def test_signup_injection(self, client: AsyncClient):
        payloads = [
            {"email": "' OR 1=1--", "password": "test1234"},
            {"email": "test@test.com", "password": "' OR 1=1--"},
            {"email": "'; DROP TABLE users; --@test.com", "password": "test1234"},
        ]
        for body in payloads:
            res = await client.post("/api/v1/auth/signup", json=body)
            assert res.status_code in (201, 400, 422)

    async def test_sso_injection(self, client: AsyncClient):
        payloads = [
            {"token": "' OR 1=1--"},
            {"token": "'; DROP TABLE users; --"},
            {"token": "' UNION SELECT * FROM users; --"},
        ]
        for body in payloads:
            res = await client.post("/api/v1/auth/sso/google", json=body)
            assert res.status_code in (400, 401, 422)
