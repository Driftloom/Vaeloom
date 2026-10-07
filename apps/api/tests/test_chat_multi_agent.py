import json
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestChatMultiAgent:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "multiagent@test.com", "password": "TestPassword123!"},
        )
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_get_model_catalog(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/agents/models", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "models" in data
        assert isinstance(data["models"], list)
        assert len(data["models"]) >= 5
        assert data["defaultModel"] == "gpt-4o-mini"

        first_model = data["models"][0]
        assert "id" in first_model
        assert "provider" in first_model
        assert "tier" in first_model
        assert "maxTokens" in first_model
        assert "costPer1kInput" in first_model
        assert "costPer1kOutput" in first_model
        assert "healthStatus" in first_model

    async def test_multi_agent_chat_stream(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_res = await client.post("/api/v1/workspaces", json={"name": "squad-ws"}, headers=headers)
        assert ws_res.status_code == 201, ws_res.text
        ws_id = ws_res.json().get("id") or ws_res.json().get("workspace_id")

        payload = {
            "workspaceId": str(ws_id),
            "message": "Analyze my technical experience and optimize ATS keywords",
            "agentNames": ["resume", "ats"],
            "model": "gpt-4o-mini",
            "temperature": 0.7,
        }

        res = await client.post(
            "/api/v1/agents/chat/stream",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 200, res.text
        assert "text/event-stream" in res.headers.get("content-type", "")

        events: list[str] = []
        body_text = res.text
        for line in body_text.splitlines():
            if line.startswith("event:"):
                events.append(line.replace("event:", "").strip())

        assert "supervisor_start" in events
        assert "done" in events
        # Verify either agent_start, agent_token, or supervisor_agent_done exists
        assert any(e in events for e in ("agent_start", "agent_token", "agent_done", "supervisor_agent_done"))

    async def test_pin_message_to_memory(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_res = await client.post("/api/v1/workspaces", json={"name": "pin-memory-ws"}, headers=headers)
        assert ws_res.status_code == 201, ws_res.text
        ws_id = ws_res.json().get("id") or ws_res.json().get("workspace_id")

        conv_res = await client.post(
            f"/api/v1/workspaces/{ws_id}/conversations",
            json={"title": "Strategy Session", "agent_name": "resume"},
            headers=headers,
        )
        assert conv_res.status_code == 201, conv_res.text
        conv_id = conv_res.json()["id"]

        msg_content = "Key achievement: Scaled distributed system throughput by 300% across Kubernetes clusters."
        msg_res = await client.post(
            f"/api/v1/workspaces/{ws_id}/conversations/{conv_id}/messages",
            json={
                "client_id": "test-msg-client-1",
                "role": "agent",
                "text": msg_content,
                "agent_name": "resume",
            },
            headers=headers,
        )
        assert msg_res.status_code in (200, 201), msg_res.text
        msg_id = msg_res.json()["id"]

        pin_res = await client.post(
            f"/api/v1/workspaces/{ws_id}/conversations/{conv_id}/messages/{msg_id}/pin-memory",
            headers=headers,
        )
        assert pin_res.status_code == 201, pin_res.text
        pin_data = pin_res.json()

        assert pin_data["type"] == "knowledge"
        assert pin_data["domain"] == "chat"
        assert msg_content in pin_data["content"]
        assert pin_data["metadata"]["pinned_from_chat"] is True
        assert pin_data["metadata"]["message_id"] == str(msg_id)

        # Verify retrieval via memory API
        mem_id = pin_data["id"]
        get_res = await client.get(f"/api/v1/memories/{mem_id}", headers=headers)
        assert get_res.status_code == 200, get_res.text
        assert get_res.json()["id"] == mem_id
