import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestConversations:
    async def _auth_and_workspace(self, client: AsyncClient) -> tuple[dict, str]:
        email = f"conv_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": "TestPassword123!",
            "name": "Conv Tester",
        })
        assert res.status_code == 201
        token = res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}
        ws_res = await client.post("/api/v1/workspaces", json={"name": "Conv Test Space"}, headers=auth_headers)
        assert ws_res.status_code == 201
        workspace_id = ws_res.json()["id"]
        headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}
        return headers, workspace_id

    async def _create(self, client: AsyncClient, headers: dict, title: str = "Resume Review") -> dict:
        res = await client.post(
            f"/api/v1/workspaces/{headers['X-Workspace-Id']}/conversations",
            json={"title": title, "agent_name": "resume"},
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()

    async def test_crud_round_trip(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"

        # Empty list envelope
        empty = await client.get(base, headers=headers)
        assert empty.status_code == 200
        assert empty.json() == {"conversations": [], "total": 0, "page": 1, "page_size": 20}

        # Create
        created = await self._create(client, headers)
        assert created["workspace_id"] == workspace_id
        assert created["title"] == "Resume Review"
        assert created["agent_name"] == "resume"
        assert created["message_count"] == 0
        conv_id = created["id"]

        # List contains it
        listed = await client.get(base, headers=headers)
        assert listed.status_code == 200
        body = listed.json()
        assert body["total"] == 1
        assert [c["id"] for c in body["conversations"]] == [conv_id]

        # Get with messages
        got = await client.get(f"{base}/{conv_id}", headers=headers)
        assert got.status_code == 200
        assert got.json()["messages"] == []
        assert got.json()["message_count"] == 0

        # Patch
        patched = await client.patch(
            f"{base}/{conv_id}", json={"title": "Renamed"}, headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["title"] == "Renamed"

        # Delete -> 204
        deleted = await client.delete(f"{base}/{conv_id}", headers=headers)
        assert deleted.status_code == 204
        assert deleted.content == b""

        # Gone
        assert (await client.get(f"{base}/{conv_id}", headers=headers)).status_code == 404

    async def test_cross_workspace_isolation_returns_404(self, client: AsyncClient):
        headers_a, ws_a = await self._auth_and_workspace(client)
        headers_b, ws_b = await self._auth_and_workspace(client)
        conv = await self._create(client, headers_a)

        # B's own workspace path with A's conversation id: 404, not 403/200.
        res = await client.get(
            f"/api/v1/workspaces/{ws_b}/conversations/{conv['id']}", headers=headers_b,
        )
        assert res.status_code == 404

        patch = await client.patch(
            f"/api/v1/workspaces/{ws_b}/conversations/{conv['id']}",
            json={"title": "hijacked"}, headers=headers_b,
        )
        assert patch.status_code == 404

        delete = await client.delete(
            f"/api/v1/workspaces/{ws_b}/conversations/{conv['id']}", headers=headers_b,
        )
        assert delete.status_code == 404

        # A still owns it and the title is untouched.
        still = await client.get(
            f"/api/v1/workspaces/{ws_a}/conversations/{conv['id']}", headers=headers_a,
        )
        assert still.status_code == 200
        assert still.json()["title"] == "Resume Review"

        # B's list does not leak A's row.
        list_b = await client.get(f"/api/v1/workspaces/{ws_b}/conversations", headers=headers_b)
        assert list_b.status_code == 200
        assert list_b.json()["conversations"] == []

    async def test_non_member_of_workspace_gets_404(self, client: AsyncClient):
        headers_owner, ws_owner = await self._auth_and_workspace(client)
        headers_outsider, _ws_outsider = await self._auth_and_workspace(client)
        conv = await self._create(client, headers_owner)

        # The outsider authenticates fine and targets the owner's workspace path.
        res = await client.get(
            f"/api/v1/workspaces/{ws_owner}/conversations/{conv['id']}", headers=headers_outsider,
        )
        assert res.status_code == 404

        listed = await client.get(
            f"/api/v1/workspaces/{ws_owner}/conversations", headers=headers_outsider,
        )
        assert listed.status_code == 404

    async def test_unauthenticated_is_401(self, client: AsyncClient):
        _, ws_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{ws_id}/conversations"
        assert (await client.get(base)).status_code == 401
        assert (await client.post(base, json={})).status_code == 401

    async def test_bad_uuid_is_400(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        res = await client.get(
            f"/api/v1/workspaces/{workspace_id}/conversations/not-a-uuid", headers=headers,
        )
        assert res.status_code == 400

    async def test_message_create_and_duplicate_client_id(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)

        payload = {
            "role": "user",
            "text": "My salary expectation is 180k for this role",
            "client_id": "c-1",
            "status": "complete",
        }
        first = await client.post(f"{base}/{conv['id']}/messages", json=payload, headers=headers)
        assert first.status_code == 201
        first_id = first.json()["id"]

        # Retry with identical client_id: no second row.
        retry = await client.post(f"{base}/{conv['id']}/messages", json=payload, headers=headers)
        assert retry.status_code == 200
        assert retry.json()["id"] == first_id

        got = await client.get(f"{base}/{conv['id']}", headers=headers)
        assert got.status_code == 200
        assert got.json()["message_count"] == 1
        assert len(got.json()["messages"]) == 1

    async def test_message_defaults_and_passthrough_fields(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)

        payload = {
            "role": "agent",
            "text": "Here is the tailored resume.",
            "client_id": "a-1",
            "agent_name": "resume",
            "confidence": 0.91,
            "citations": [{"source": "resume:1"}],
            "action_chips": ["download"],
            "latency_ms": 812,
            "highway": "system2",
            "s1_latency_ms": 12,
            "s2_latency_ms": 800,
            "reply_to": "c-1",
        }
        res = await client.post(f"{base}/{conv['id']}/messages", json=payload, headers=headers)
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "complete"
        assert body["tool_calls"] == []
        assert body["proposals"] == []
        assert body["questions"] == []
        assert body["attachments"] == []
        assert body["phases"] == []
        assert body["plan"] is None
        assert body["error"] is None
        assert body["workflow_id"] is None
        assert body["confidence"] == 0.91
        assert body["citations"] == [{"source": "resume:1"}]
        assert body["reply_to"] == "c-1"
        assert body["latency_ms"] == 812

    async def test_message_validation_rejects_out_of_range(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)

        bad_confidence = await client.post(
            f"{base}/{conv['id']}/messages",
            json={"role": "user", "text": "hi", "client_id": "x1", "confidence": 1.5},
            headers=headers,
        )
        assert bad_confidence.status_code == 422

        bad_role = await client.post(
            f"{base}/{conv['id']}/messages",
            json={"role": "system", "text": "hi", "client_id": "x2"},
            headers=headers,
        )
        assert bad_role.status_code == 422

        bad_status = await client.post(
            f"{base}/{conv['id']}/messages",
            json={"role": "user", "text": "hi", "client_id": "x3", "status": "pending"},
            headers=headers,
        )
        assert bad_status.status_code == 422

    async def test_error_and_text_payloads_round_trip(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)

        res = await client.post(
            f"{base}/{conv['id']}/messages",
            json={
                "role": "agent",
                "text": "The run failed without producing output.",
                "client_id": "e-1",
                "status": "error",
                "error": {"message": "upstream timeout", "code": "LLM_TIMEOUT"},
                "tool_calls": [{"name": "search_jobs", "ok": True}],
                "proposals": [{"title": "Tailor resume"}],
                "questions": ["Which role?"],
                "attachments": [{"name": "cv.pdf", "size": 1024}],
                "plan": {"plan_id": "p1"},
                "phases": [{"name": "act", "status": "done"}],
                "workflow_id": "wf-77",
            },
            headers=headers,
        )
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "error"
        assert body["error"] == {"message": "upstream timeout", "code": "LLM_TIMEOUT"}
        assert body["tool_calls"] == [{"name": "search_jobs", "ok": True}]
        assert body["proposals"] == [{"title": "Tailor resume"}]
        assert body["questions"] == ["Which role?"]
        assert body["attachments"] == [{"name": "cv.pdf", "size": 1024}]
        assert body["plan"] == {"plan_id": "p1"}
        assert body["phases"] == [{"name": "act", "status": "done"}]
        assert body["workflow_id"] == "wf-77"

        # The same payload must come back identically from the read path: the
        # column is named `error` but the ORM attribute is `error_`, so this is
        # where a missing alias would surface as a silently null field.
        got = await client.get(f"{base}/{conv['id']}", headers=headers)
        assert got.status_code == 200
        stored = got.json()["messages"][0]
        assert stored["error"] == {"message": "upstream timeout", "code": "LLM_TIMEOUT"}
        assert stored["tool_calls"] == [{"name": "search_jobs", "ok": True}]
        assert stored["plan"] == {"plan_id": "p1"}

    async def test_message_text_allows_empty_string(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)

        res = await client.post(
            f"{base}/{conv['id']}/messages",
            json={"role": "user", "text": "", "client_id": "empty-1"},
            headers=headers,
        )
        assert res.status_code == 201
        assert res.json()["text"] == ""

    async def test_message_on_unknown_conversation_is_404(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        res = await client.post(
            f"/api/v1/workspaces/{workspace_id}/conversations/{uuid.uuid4()}/messages",
            json={"role": "user", "text": "hi", "client_id": "z1"},
            headers=headers,
        )
        assert res.status_code == 404

    async def test_search_filters_title_case_insensitively(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        await self._create(client, headers, title="Resume Tailoring")
        await self._create(client, headers, title="Interview Prep")

        found = await client.get(f"{base}?search=tailoring", headers=headers)
        assert found.status_code == 200
        body = found.json()
        assert body["total"] == 1
        assert body["conversations"][0]["title"] == "Resume Tailoring"

        upper = await client.get(f"{base}?search=INTERVIEW", headers=headers)
        assert upper.status_code == 200
        assert upper.json()["total"] == 1
        assert upper.json()["conversations"][0]["title"] == "Interview Prep"

        none = await client.get(f"{base}?search=zzzz", headers=headers)
        assert none.status_code == 200
        assert none.json()["total"] == 0
        assert none.json()["conversations"] == []

    async def test_pagination_limit_offset(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        for i in range(3):
            await self._create(client, headers, title=f"Thread {i}")

        page1 = await client.get(f"{base}?limit=2&offset=0", headers=headers)
        assert page1.status_code == 200
        assert len(page1.json()["conversations"]) == 2
        assert page1.json()["page_size"] == 2
        assert page1.json()["page"] == 1
        assert page1.json()["total"] == 3

        page2 = await client.get(f"{base}?limit=2&offset=2", headers=headers)
        assert page2.status_code == 200
        assert len(page2.json()["conversations"]) == 1
        assert page2.json()["page"] == 2

        legacy = await client.get(f"{base}?page=2&page_size=1", headers=headers)
        assert legacy.status_code == 200
        assert legacy.json()["page"] == 2
        assert legacy.json()["page_size"] == 1
        assert legacy.json()["total"] == 3

        # limit wins over page/page_size per the pagination standard
        assert (await client.get(f"{base}?page=1&page_size=1&limit=3", headers=headers)).json()["page_size"] == 3

    async def test_delete_messages_keeps_conversation(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)

        for i in range(2):
            res = await client.post(
                f"{base}/{conv['id']}/messages",
                json={"role": "user", "text": f"m{i}", "client_id": f"c-{i}"},
                headers=headers,
            )
            assert res.status_code == 201

        cleared = await client.delete(f"{base}/{conv['id']}/messages", headers=headers)
        assert cleared.status_code == 204
        assert cleared.content == b""

        after = await client.get(f"{base}/{conv['id']}", headers=headers)
        assert after.status_code == 200
        assert after.json()["messages"] == []
        assert after.json()["message_count"] == 0

        # Conversation itself survives and is still listed.
        listed = await client.get(base, headers=headers)
        assert listed.json()["total"] == 1
        assert listed.json()["conversations"][0]["id"] == conv["id"]

        # client_id is reusable after the clear.
        again = await client.post(
            f"{base}/{conv['id']}/messages",
            json={"role": "user", "text": "after clear", "client_id": "c-0"},
            headers=headers,
        )
        assert again.status_code == 201

    async def test_delete_conversation_cascades_messages(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"
        conv = await self._create(client, headers)
        res = await client.post(
            f"{base}/{conv['id']}/messages",
            json={"role": "user", "text": "salary 180k", "client_id": "c-cascade"},
            headers=headers,
        )
        assert res.status_code == 201

        assert (await client.delete(f"{base}/{conv['id']}", headers=headers)).status_code == 204

        assert (await client.get(f"{base}/{conv['id']}", headers=headers)).status_code == 404
        # The message row must not survive its parent, or it becomes an orphan
        # holding resume PII that no endpoint can reach or delete.
        listed = await client.get(base, headers=headers)
        assert listed.json()["total"] == 0

        reuse = await client.post(
            f"/api/v1/workspaces/{workspace_id}/conversations",
            json={"title": "Recreated"},
            headers=headers,
        )
        assert reuse.status_code == 201
        assert reuse.json()["id"] != conv["id"]

    async def test_ordering(self, client: AsyncClient):
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"

        first = await self._create(client, headers, title="First")
        second = await self._create(client, headers, title="Second")

        # Conversations: newest-first.
        listed = await client.get(base, headers=headers)
        assert listed.status_code == 200
        assert [c["id"] for c in listed.json()["conversations"]] == [second["id"], first["id"]]

        # Messages: oldest-first.
        await client.post(
            f"{base}/{first['id']}/messages",
            json={"role": "user", "text": "one", "client_id": "m1"}, headers=headers,
        )
        await client.post(
            f"{base}/{first['id']}/messages",
            json={"role": "agent", "text": "two", "client_id": "m2", "reply_to": "m1"}, headers=headers,
        )
        got = await client.get(f"{base}/{first['id']}", headers=headers)
        assert got.status_code == 200
        assert [m["client_id"] for m in got.json()["messages"]] == ["m1", "m2"]
        assert got.json()["message_count"] == 2

    async def test_chat_message_synthesizes_cognitive_memory(self, client: AsyncClient):
        """Verify Level 1 (transcript row) and Level 2 (cognitive memory in Second Brain) are both stored."""
        headers, workspace_id = await self._auth_and_workspace(client)
        base = f"/api/v1/workspaces/{workspace_id}/conversations"

        conv = await self._create(client, headers, title="Career Chat")
        conv_id = conv["id"]

        # User sends a preference message with cues
        res = await client.post(
            f"{base}/{conv_id}/messages",
            json={
                "role": "user",
                "text": "Remember that I prefer remote Staff Distributed Systems Engineer roles with $220k base.",
                "client_id": "c-pref-1",
            },
            headers=headers,
        )
        assert res.status_code == 201

        # Level 1 verified: message row exists in conversation
        got_conv = await client.get(f"{base}/{conv_id}", headers=headers)
        assert got_conv.status_code == 200
        assert got_conv.json()["message_count"] == 1
        assert got_conv.json()["messages"][0]["client_id"] == "c-pref-1"

        # Level 2 verified: cognitive memory exists in Second Brain memories
        mem_res = await client.get(f"/api/v1/workspaces/{workspace_id}/memories", headers=headers)
        assert mem_res.status_code == 200
        mem_data = mem_res.json()
        memories = mem_data if isinstance(mem_data, list) else mem_data.get("memories", [])
        assert len(memories) >= 1
        chat_mems = [m for m in memories if m.get("source_type") == "chat"]
        assert len(chat_mems) >= 1
        assert chat_mems[0]["type"] == "preference"
        assert "Distributed Systems" in chat_mems[0]["content"]

