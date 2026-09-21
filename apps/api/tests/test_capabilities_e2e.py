import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCapabilitiesE2E:
    async def _setup_auth_and_workspace(self, client: AsyncClient) -> tuple[dict, str]:
        email = f"cap_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": "TestPassword123!",
            "name": "Cap Tester",
        })
        assert res.status_code == 201
        data = res.json()
        token = data["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # Create workspace
        ws_res = await client.post("/api/v1/workspaces", json={
            "name": "Capabilities Test Space",
        }, headers=auth_headers)
        assert ws_res.status_code == 201
        workspace_id = ws_res.json()["id"]

        headers = {
            "Authorization": f"Bearer {token}",
            "X-Workspace-Id": workspace_id,
        }
        return headers, workspace_id

    async def test_capabilities_crud_and_testing(self, client: AsyncClient):
        headers, workspace_id = await self._setup_auth_and_workspace(client)

        # 1. Initial list should be empty
        list_res = await client.get("/api/v1/capabilities", headers=headers)
        assert list_res.status_code == 200
        assert isinstance(list_res.json(), list)

        # 2. Create custom skill
        skill_payload = {
            "name": "forensic-code-auditor",
            "category": "skill",
            "description": "Performs deep forensic audits on source diffs",
            "version": "1.0.0",
            "config": {
                "tags": ["Security", "Audit"],
                "autonomy": "autonomous",
            },
        }
        create_res = await client.post("/api/v1/capabilities", json=skill_payload, headers=headers)
        assert create_res.status_code == 201
        skill_data = create_res.json()
        assert skill_data["name"] == "forensic-code-auditor"
        assert skill_data["category"] == "skill"
        assert skill_data["enabled"] is True
        skill_id = skill_data["id"]

        # 3. Create custom tool (dynamic tool registration)
        tool_payload = {
            "name": "custom_echo_tool",
            "category": "tool",
            "description": "Echoes back input payload",
            "config": {
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {"type": "string"},
                    },
                },
            },
        }
        create_tool_res = await client.post("/api/v1/capabilities", json=tool_payload, headers=headers)
        assert create_tool_res.status_code == 201
        tool_id = create_tool_res.json()["id"]

        # 4. Duplicate prevention (409 Conflict)
        dup_res = await client.post("/api/v1/capabilities", json=skill_payload, headers=headers)
        assert dup_res.status_code == 409

        # 5. Invalid category validation (400 Bad Request)
        bad_cat_payload = {
            "name": "bad-cat",
            "category": "invalid_category",
            "description": "invalid",
        }
        bad_res = await client.post("/api/v1/capabilities", json=bad_cat_payload, headers=headers)
        assert bad_res.status_code == 400

        # 6. Get single capability
        get_res = await client.get(f"/api/v1/capabilities/{skill_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["id"] == skill_id

        # 7. Update / toggle enabled state
        toggle_res = await client.patch(
            f"/api/v1/capabilities/{skill_id}",
            json={"enabled": False},
            headers=headers,
        )
        assert toggle_res.status_code == 200
        assert toggle_res.json()["enabled"] is False

        # 8. Test capability endpoint (real diagnostic execution)
        test_res = await client.post(
            f"/api/v1/capabilities/{tool_id}/test",
            json={"input": {"message": "hello world"}},
            headers=headers,
        )
        assert test_res.status_code == 200
        test_data = test_res.json()
        assert test_data["status"] == "success"
        assert "latency_ms" in test_data
        assert test_data["latency_ms"] >= 0.0

        # 9. Filter capabilities by category
        filter_res = await client.get("/api/v1/capabilities?category=skill", headers=headers)
        assert filter_res.status_code == 200
        skills = filter_res.json()
        assert len(skills) >= 1
        assert all(s["category"] == "skill" for s in skills)

        # 10. Delete capability
        del_res = await client.delete(f"/api/v1/capabilities/{skill_id}", headers=headers)
        assert del_res.status_code == 204

        # Verify it's gone
        get_after_del = await client.get(f"/api/v1/capabilities/{skill_id}", headers=headers)
        assert get_after_del.status_code == 404
