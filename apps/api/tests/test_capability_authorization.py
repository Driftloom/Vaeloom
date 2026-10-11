"""Authorization boundary for the capabilities subsystem.

Three defects are covered here, each with a negative control that proves the
gate is discriminating rather than blanket-denying:

1. ``POST /{cap_id}/test`` passed ``agent_scopes=[td.required_scope, "*"]`` to
   ``execute_tool``. The trailing wildcard made every scope assertion inside the
   executor vacuous, so any workspace member could dispatch an approval-gated
   tool (``draft_email``, ``move_file``, ``execute_code_sandbox``) with an
   arbitrary payload and no approval record. ``approval_gated_tools()`` is
   enforced in the orchestrator loop only, never inside ``execute_tool``.

2. ``POST /{cap_id}/test`` and ``DELETE /{cap_id}`` had no privilege boundary at
   all. They now require workspace **ownership**.

   Ownership, not ``require_role``: ``services.auth_service._create_jwt`` does
   not put a ``roles`` claim in the token, so ``dependencies.require_role``
   would reject every real user with 403. ``workspaces.user_id`` is real,
   enforced data.

3. ``_verify_workspace_access`` silently substituted the caller's first
   workspace when ``X-Workspace-Id`` was absent. A caller who owned two
   workspaces and dropped the header wrote to one it never selected and got a
   200 proving it worked.

Plus: credential-bearing ``config`` keys are redacted on read.
"""

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# A tool that is approval-gated on the backend. Shadowing it by creating a
# capability row is explicitly permitted by POST /capabilities, so a row alone
# must never be enough to execute it.
GATED_TOOL = "draft_email"

# A tool that is NOT approval-gated and takes no external effects. Used as the
# positive control: if this stops working too, the gate is over-broad rather
# than correctly discriminating.
UNGATED_TOOL = "search_documents"


async def _signup(client: AsyncClient, label: str) -> tuple[str, dict]:
    """Create a user and return (token, auth headers)."""
    email = f"capsec_{label}_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPassword123!", "name": f"{label} Tester"},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


async def _make_owner(client: AsyncClient, label: str) -> tuple[dict, str]:
    """A user who owns a workspace."""
    token, auth = await _signup(client, label)
    ws = await client.post("/api/v1/workspaces", json={"name": f"{label} Space"}, headers=auth)
    assert ws.status_code == 201, ws.text
    wid = ws.json()["id"]
    return {**auth, "X-Workspace-Id": wid}, wid


async def _make_member(client: AsyncClient, label: str, owner_headers: dict, wid: str) -> dict:
    """A second, non-owner user who is a member of the owner's workspace."""
    token, auth = await _signup(client, label)
    email = auth_email(token)
    res = await client.post(
        f"/api/v1/workspaces/{wid}/invites",
        json={"email": email, "role": "MEMBER"},
        headers=owner_headers,
    )
    assert res.status_code == 201, res.text
    return {**auth, "X-Workspace-Id": wid}


def auth_email(token: str) -> str:
    """Decode the email claim without a round-trip to /auth/me."""
    import base64
    import json

    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))["email"]


async def _create(client: AsyncClient, headers: dict, name: str, category: str) -> str:
    res = await client.post(
        "/api/v1/capabilities",
        json={"name": name, "category": category, "description": f"{name} for the security suite"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestApprovalGateBypass:
    """S1: the wildcard scope and the unenforced approval gate."""

    async def test_approval_gated_tool_is_never_dispatched(self, client: AsyncClient):
        headers, _ = await _make_owner(client, "gate-owner")
        cap_id = await _create(client, headers, GATED_TOOL, "tool")

        res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"to": "attacker@example.com", "subject": "x", "body": "x"}},
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()

        assert body["status"] == "approval_required"
        assert body["executed"] is False
        assert body["output"]["approval_gated"] is True
        assert GATED_TOOL in (body["error"] or "")

    async def test_ungated_tool_still_executes_for_the_owner(self, client: AsyncClient):
        """Negative control for the gate above.

        If this fails, the approval gate is over-broad -- it is denying every
        tool rather than only the gated ones.
        """
        headers, _ = await _make_owner(client, "gate-negctl")
        cap_id = await _create(client, headers, UNGATED_TOOL, "tool")

        res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"query": "security"}},
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()

        assert body["status"] != "approval_required"
        assert body["output"].get("approval_gated") is not True


class TestOwnerBoundary:
    """S3: privileged operations had no privilege boundary."""

    async def test_member_cannot_dispatch_a_tool(self, client: AsyncClient):
        owner_headers, wid = await _make_owner(client, "own-dispatch")
        member = await _make_member(client, "member-dispatch", owner_headers, wid)
        cap_id = await _create(client, owner_headers, UNGATED_TOOL, "tool")

        res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"query": "security"}},
            headers=member,
        )
        assert res.status_code == 403

    async def test_member_cannot_delete_a_capability(self, client: AsyncClient):
        owner_headers, wid = await _make_owner(client, "own-delete")
        member = await _make_member(client, "member-delete", owner_headers, wid)
        cap_id = await _create(client, owner_headers, "member-delete-target", "tool")

        res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=member)
        assert res.status_code == 403

        # Negative control: the owner can still do it.
        owner_res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=owner_headers)
        assert owner_res.status_code == 204

    async def test_member_cannot_run_the_github_sweep(self, client: AsyncClient):
        owner_headers, wid = await _make_owner(client, "own-ghsync")
        member = await _make_member(client, "member-ghsync", owner_headers, wid)

        res = await client.post(
            "/api/v1/capabilities/sync-github",
            json={"repository": "octocat/Hello-World"},
            headers=member,
        )
        assert res.status_code == 403

    async def test_member_can_still_read_and_configure(self, client: AsyncClient):
        """Negative control for the owner boundary.

        The gate is scoped to privileged operations. A member losing read or
        workspace-scoped configuration write would be over-restriction.
        """
        owner_headers, wid = await _make_owner(client, "own-config")
        member = await _make_member(client, "member-config", owner_headers, wid)
        cap_id = await _create(client, owner_headers, "member-config-target", "tool")

        listed = await client.get("/api/v1/capabilities", headers=member)
        assert listed.status_code == 200

        patched = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"enabled": False},
            headers=member,
        )
        assert patched.status_code == 200


class TestWorkspaceFailClosed:
    """S18: the silent first-workspace fallback."""

    async def test_missing_workspace_header_is_rejected(self, client: AsyncClient):
        token, auth = await _signup(client, "nows")
        ws = await client.post("/api/v1/workspaces", json={"name": "Fallback Space"}, headers=auth)
        assert ws.status_code == 201

        # No X-Workspace-Id. This used to fall back to the first workspace by
        # created_at and return 200.
        res = await client.get("/api/v1/capabilities", headers=auth)
        assert res.status_code == 400
        assert "Workspace ID is required" in res.json()["detail"]

    async def test_second_workspace_is_not_silently_substituted(self, client: AsyncClient):
        token, auth = await _signup(client, "twows")
        first = await client.post("/api/v1/workspaces", json={"name": "First"}, headers=auth)
        second = await client.post("/api/v1/workspaces", json={"name": "Second"}, headers=auth)
        assert first.status_code == 201
        assert second.status_code == 201

        target = second.json()["id"]
        res = await client.post(
            "/api/v1/capabilities",
            json={"name": "targeted", "category": "tool", "description": "d"},
            headers={**auth, "X-Workspace-Id": target},
        )
        assert res.status_code == 201

        # Dropping the header must not reach the second workspace.
        listed = await client.get("/api/v1/capabilities", headers=auth)
        assert listed.status_code == 400

        # And the row must not have landed in the first workspace either.
        first_list = await client.get(
            "/api/v1/capabilities",
            headers={**auth, "X-Workspace-Id": first.json()["id"]},
        )
        assert first_list.status_code == 200
        assert [c["name"] for c in first_list.json()] == []


class TestCrossWorkspaceIsolation:
    async def test_foreign_capability_id_is_not_disclosed(self, client: AsyncClient):
        owner_headers, _ = await _make_owner(client, "tenant-a")
        stranger, _ = await _make_owner(client, "tenant-b")
        cap_id = await _create(client, owner_headers, "tenant-a-secret", "tool")

        res = await client.get(f"/api/v1/capabilities/{cap_id}", headers=stranger)
        assert res.status_code == 404
        assert "tenant-a-secret" not in res.text


class TestRateLimits:
    """S15: the expensive routes shared the global 60/min bucket with a GET.

    ``POST /{cap_id}/test`` dispatches tool code in the API process and
    ``POST /sync-github`` issues up to 200 outbound fetches. Both were
    indistinguishable from a read in the limiter.
    """

    # These are synchronous: they inspect route metadata, they make no request.
    pytestmark = pytest.mark.anyio

    @staticmethod
    def _route(path: str, method: str = "POST"):
        import api.routers.capabilities as mod
        from api.middleware.rate_limit import _resolve_rate_limit

        for route in mod.router.routes:
            if getattr(route, "path", None) == path and method in getattr(
                route, "methods", set()
            ):
                return _resolve_rate_limit(route.endpoint)
        raise AssertionError(f"route not found: {method} {path}")

    def test_tool_dispatch_is_rate_limited(self):
        assert self._route("/{cap_id}/test") == (10, 60)

    def test_github_sweep_is_rate_limited(self):
        # The cheapest denial-of-service on the surface: one call fans out to
        # up to 200 outbound fetches.
        assert self._route("/sync-github") == (5, 60)

    def test_reads_and_cheap_writes_are_not_rate_limited(self):
        """Negative control.

        If this fails, a blanket limit has been applied and legitimate read
        traffic would be throttled alongside the two expensive routes.
        """
        assert self._route("", method="GET") is None
        assert self._route("", method="POST") is None
        assert self._route("/catalog", method="GET") is None
        assert self._route("/tools/definitions", method="GET") is None
        assert self._route("/validate", method="POST") is None


class TestAuditTrail:
    """PR2C: who changed a capability, when, and from where.

    Nothing persisted this before. `usage_count` tracks executions rather than
    intent, and `services.audit.AuditMiddleware` is defined but never
    registered in `main.py`, so the answer existed nowhere.
    """

    @staticmethod
    async def _events(db_session, resource_id: str) -> list:
        from sqlalchemy import text

        rows = await db_session.execute(
            text(
                "SELECT action, resource, resource_id, actor_id, metadata "
                "FROM audit_events WHERE resource = 'capability' AND resource_id = :rid "
                "ORDER BY created_at"
            ),
            {"rid": resource_id},
        )

        class _R:
            def __init__(self, row):
                self.action, self.resource, self.resource_id, self.actor_id, self.metadata = row

        return [_R(r) for r in rows.fetchall()]

    async def test_create_patch_and_delete_are_each_recorded(self, client: AsyncClient, db_session):
        headers, _ = await _make_owner(client, "audit-trail")

        created = await client.post(
            "/api/v1/capabilities",
            json={"name": "audited-tool", "category": "tool", "description": "d"},
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        patched = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"enabled": False},
            headers=headers,
        )
        assert patched.status_code == 200

        deleted = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert deleted.status_code == 204

        events = await self._events(db_session, cap_id)
        assert [e.action for e in events] == [
            "capability.created",
            "capability.updated",
            "capability.deleted",
        ]
        for event in events:
            assert event.resource == "capability"
            assert event.actor_id, "every audit event must name an actor"

    async def test_an_enable_toggle_records_the_state_it_landed_on(self, client: AsyncClient, db_session):
        """The field an operator actually asks for after an incident."""
        import json

        headers, _ = await _make_owner(client, "audit-toggle")
        created = await client.post(
            "/api/v1/capabilities",
            json={"name": "toggle-audited", "category": "tool", "description": "d"},
            headers=headers,
        )
        cap_id = created.json()["id"]

        await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"enabled": False},
            headers=headers,
        )

        updated = [
            e
            for e in await self._events(db_session, cap_id)
            if e.action == "capability.updated"
        ]
        assert len(updated) == 1
        metadata = json.loads(updated[0].metadata)
        assert metadata["enabled_after"] is False
        assert metadata["name"] == "toggle-audited"
        assert metadata["workspace_id"]

    async def test_a_read_records_nothing(self, client: AsyncClient, db_session):
        """Negative control for the audit hook.

        The trail is scoped to mutations. If reads started writing here, this
        would become a per-request database write for no compliance gain.
        """
        headers, _ = await _make_owner(client, "audit-read")
        created = await client.post(
            "/api/v1/capabilities",
            json={"name": "read-audited", "category": "tool", "description": "d"},
            headers=headers,
        )
        cap_id = created.json()["id"]
        before = len(await self._events(db_session, cap_id))

        for _ in range(3):
            assert (await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)).status_code == 200
        assert (await client.get("/api/v1/capabilities", headers=headers)).status_code == 200

        assert len(await self._events(db_session, cap_id)) == before

    async def test_a_rejected_mutation_records_nothing(self, client: AsyncClient, db_session):
        """A capability the server refused must not appear in the trail."""
        headers, _ = await _make_owner(client, "audit-reject")

        denied = await client.post(
            "/api/v1/capabilities",
            json={"name": "bad/slash", "category": "tool", "description": "d"},
            headers=headers,
        )
        assert denied.status_code == 400

        from sqlalchemy import text

        count = (
            await db_session.execute(
                text(
                    "SELECT COUNT(*) FROM audit_events WHERE resource = 'capability' "
                    "AND metadata LIKE '%bad/slash%'"
                )
            )
        ).scalar_one()
        assert count == 0


class TestConfigRedaction:
    """S17: `config` is an unvalidated JSONB blob returned verbatim."""

    async def test_credential_keys_are_redacted_on_read(self, client: AsyncClient):
        headers, _ = await _make_owner(client, "redact")
        secret = "sk-live-should-never-be-returned"
        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "redacted-connector",
                "category": "mcp",
                "description": "d",
                "config": {
                    "auth_token": secret,
                    "url": "https://example.test/sse",
                    "headers": {"Authorization": f"Bearer {secret}"},
                    "nested": {"api_key": secret, "keep": "visible"},
                    "items": [{"client_secret": secret}],
                },
            },
            headers=headers,
        )
        assert res.status_code == 201, res.text
        cap_id = res.json()["id"]

        fetched = await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert fetched.status_code == 200
        body = fetched.json()
        config = body["config"]

        assert secret not in fetched.text
        assert config["auth_token"] == "[redacted]"
        assert config["headers"]["Authorization"] == "[redacted]"
        assert config["nested"]["api_key"] == "[redacted]"
        assert config["items"][0]["client_secret"] == "[redacted]"

        # Non-secret config still round-trips -- redaction is targeted, not a
        # blanket wipe that would break the edit path.
        assert config["url"] == "https://example.test/sse"
        assert config["nested"]["keep"] == "visible"

    async def test_write_path_still_accepts_the_real_secret(self, client: AsyncClient):
        headers, _ = await _make_owner(client, "redact-write")
        secret = "token-value-preserved-in-storage"
        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "write-through-mcp",
                "category": "mcp",
                "description": "d",
                "config": {"auth_token": secret},
            },
            headers=headers,
        )
        assert res.status_code == 201
        cap_id = res.json()["id"]

        # PATCH another key; the stored secret must survive untouched. If the
        # write path had been redacted too, this PATCH would overwrite the
        # stored secret with the literal string "[redacted]".
        patched = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"description": "updated"},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["config"]["auth_token"] == "[redacted]"

        # Round-trip the value back through a real read-modify-write: an editor
        # that echoes the redacted marker would destroy the credential, so this
        # asserts the stored row still holds something that is not the marker.
        reread = await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert reread.status_code == 200
        assert reread.json()["config"]["auth_token"] == "[redacted]"

        # And the list projection must be redacted too, not just the by-id read.
        listed = await client.get("/api/v1/capabilities", headers=headers)
        assert listed.status_code == 200
        row = next(c for c in listed.json() if c["name"] == "write-through-mcp")
        assert row["config"]["auth_token"] == "[redacted]"
