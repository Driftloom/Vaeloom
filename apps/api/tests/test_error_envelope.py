"""RFC 7807 superset envelope (Loop 3).

Problem fields (type/title/status/instance) are ADDED to the existing
{success, error:{code,message,details}} shape — nothing removed, so current
clients keep parsing. 422 keeps FastAPI's detail[] verbatim.
"""
import pytest
from httpx import AsyncClient

from api.middleware.exception_handler import problem_envelope

pytestmark = pytest.mark.asyncio


class TestProblemEnvelope:
    def test_additive_fields(self):
        body = problem_envelope(403, "Forbidden", None, None)
        assert body["success"] is False
        assert body["error"] == {"code": 403, "message": "Forbidden", "details": None}
        assert body["type"] == "https://api.vaeloom.app/errors/forbidden"
        assert body["title"] == "Forbidden"
        assert body["status"] == 403

    def test_unknown_status_falls_back(self):
        body = problem_envelope(418, "teapot", None, None)
        assert body["type"] == "https://api.vaeloom.app/errors/error"
        assert body["status"] == 418
        assert "instance" not in body


class TestLiveErrorShapes:
    async def test_401_has_problem_fields(self, client: AsyncClient):
        res = await client.get("/api/v1/memories")
        assert res.status_code == 401
        body = res.json()
        assert body["error"]["code"] == 401
        assert body["type"] == "https://api.vaeloom.app/errors/unauthorized"
        assert body["title"] == "Unauthorized"
        assert body["status"] == 401
        assert body["instance"] == "/api/v1/memories"

    async def test_404_has_problem_fields(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "envelope@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        res = await client.get("/api/v1/no-such-route-xyz",
                               headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 404
        body = res.json()
        assert body["type"] == "https://api.vaeloom.app/errors/not-found"
        assert body["status"] == 404

    async def test_422_keeps_detail_array(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={"email": "not-an-email"})
        assert res.status_code == 422
        body = res.json()
        assert body["type"] == "https://api.vaeloom.app/errors/validation-error"
        assert isinstance(body["detail"], list) and len(body["detail"]) > 0
        # legacy shape intact
        assert body["success"] is False
