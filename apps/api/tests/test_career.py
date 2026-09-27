from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCareerAPI:
    async def _auth_header_and_ws(self, client: AsyncClient) -> tuple[dict, str]:
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": f"career_{uuid.uuid4().hex[:8]}@test.com", "password": "Test1234!"},
        )
        assert res.status_code in (200, 201), res.text
        data = res.json()
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": "Career Test WS"}, headers=headers)
        assert ws_res.status_code in (200, 201), ws_res.text
        ws_id = ws_res.json()["id"]

        return headers, ws_id

    async def test_career_strategy_unauthorized(self, client: AsyncClient):
        ws_id = str(uuid.uuid4())
        res = await client.get(f"/api/v1/career/strategy?workspace_id={ws_id}")
        assert res.status_code == 401

    async def test_career_strategy_missing_workspace(self, client: AsyncClient):
        headers, _ = await self._auth_header_and_ws(client)
        res = await client.get("/api/v1/career/strategy", headers=headers)
        assert res.status_code == 422

    async def test_career_strategy_success(self, client: AsyncClient):
        headers, ws_id = await self._auth_header_and_ws(client)
        res = await client.get(f"/api/v1/career/strategy?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "primaryTargetRole" in data
        assert "overallMatchPercentage" in data["primaryTargetRole"]
        assert "skillGaps" in data
        assert "milestones" in data
        assert "targetCompanies" in data
        assert isinstance(data["skillGaps"], list)
        assert len(data["skillGaps"]) > 0
        assert isinstance(data["milestones"], list)
        assert len(data["milestones"]) > 0
