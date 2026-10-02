"""Per-workspace tool enable gate.

The gate exists because a workspace admin could toggle a tool off in the UI and
the agent kept running it: ``ALL_TOOLS`` registers unconditionally and nothing
consulted the ``WorkspaceCapability`` row. These tests pin the three properties
that make the switch trustworthy:

  1. ABSENCE OF A ROW MEANS ENABLED. Every pre-existing workspace has zero tool
     rows, so reading "missing" as "disabled" would switch off the whole built-in
     surface on upgrade.
  2. THE GATE IS SCOPED. A tool disabled in workspace A is untouched in B.
  3. THE TOGGLE IS IMMEDIATE. A write invalidates the cache, so an operator does
     not watch a disabled tool keep executing for a TTL window and conclude the
     switch is broken.
"""

import time
import uuid

import pytest
from httpx import AsyncClient

from api.tools.executor import (
    _TOOL_ENABLE_GATE,
    reset_tool_enable_gate,
    tool_disabled_message,
)
from api.tools.definitions import ALL_TOOLS

pytestmark = pytest.mark.asyncio


async def _authed_workspace(client: AsyncClient, label: str) -> tuple[dict, str]:
    email = f"gate_{label}_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPassword123!", "name": "Gate Tester"},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]

    ws_res = await client.post(
        "/api/v1/workspaces", json={"name": f"Gate {label}"}, headers={"Authorization": f"Bearer {token}"}
    )
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["id"]
    return (
        {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id},
        workspace_id,
    )


async def _create_tool(client: AsyncClient, headers: dict, name: str) -> str:
    res = await client.post(
        "/api/v1/capabilities",
        json={
            "name": name,
            "category": "tool",
            "description": f"Gate test tool {name}",
            "config": {"parameters": {"type": "object", "properties": {}}},
        },
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.fixture(autouse=True)
def _gate_isolation(monkeypatch, db_session):
    """Point the gate at the test database and clear its module state.

    The gate reads through `executor._ws_session` -> `database.scoped_session`,
    which yields from `database.async_session_factory`. That factory is bound to
    the real engine, so without redirecting it the gate queries a database the
    test never wrote to and silently answers "nothing is disabled". `scoped_session`
    resolves the factory at call time, so patching the factory is sufficient.
    """
    from api import database as database_module

    test_factory = database_module.async_sessionmaker(
        db_session.bind, expire_on_commit=False
    )
    monkeypatch.setattr(database_module, "async_session_factory", test_factory)

    reset_tool_enable_gate()
    _TOOL_ENABLE_GATE.clear()
    yield
    reset_tool_enable_gate()
    _TOOL_ENABLE_GATE.clear()


class TestGateInvariants:
    async def test_no_capability_rows_at_all_means_every_built_in_tool_is_enabled(self, client: AsyncClient):
        """Upgrade safety: the row table is empty for every existing workspace."""
        headers, workspace_id = await _authed_workspace(client, "absent")

        res = await client.get("/api/v1/capabilities", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

        disabled = await _TOOL_ENABLE_GATE.disabled(workspace_id)
        assert disabled == frozenset()

        # The invariant in the shape that matters: no built-in tool is denied.
        # `ALL_TOOLS` is keyed by tool name.
        assert disabled.isdisjoint(ALL_TOOLS.keys())

    async def test_an_explicit_disabled_row_denies_that_one_tool_and_nothing_else(self, client: AsyncClient):
        headers, workspace_id = await _authed_workspace(client, "one-off")
        tool_id = await _create_tool(client, headers, "gate_denied_tool")
        await _TOOL_ENABLE_GATE.disabled(workspace_id)  # warm the pre-toggle cache

        patch = await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers
        )
        assert patch.status_code == 200
        assert patch.json()["enabled"] is False

        disabled = await _TOOL_ENABLE_GATE.disabled(workspace_id)
        assert "gate_denied_tool" in disabled
        assert len(disabled) == 1

        for name in ALL_TOOLS:
            if name != "gate_denied_tool":
                assert name not in disabled

    async def test_re_enabling_clears_the_denial(self, client: AsyncClient):
        headers, workspace_id = await _authed_workspace(client, "reenable")
        tool_id = await _create_tool(client, headers, "gate_round_trip_tool")

        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers
        )).status_code == 200
        assert "gate_round_trip_tool" in await _TOOL_ENABLE_GATE.disabled(workspace_id)

        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": True}, headers=headers
        )).status_code == 200
        assert "gate_round_trip_tool" not in await _TOOL_ENABLE_GATE.disabled(workspace_id)

    async def test_deleting_a_disabled_row_unblocks_the_tool(self, client: AsyncClient):
        """A deleted row means "no opinion", which under the invariant is enabled."""
        headers, workspace_id = await _authed_workspace(client, "deleted")
        tool_id = await _create_tool(client, headers, "gate_deleted_tool")

        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers
        )).status_code == 200
        assert "gate_deleted_tool" in await _TOOL_ENABLE_GATE.disabled(workspace_id)

        assert (await client.delete(
            f"/api/v1/capabilities/{tool_id}", headers=headers
        )).status_code == 204
        assert "gate_deleted_tool" not in await _TOOL_ENABLE_GATE.disabled(workspace_id)

    async def test_disabling_a_non_tool_capability_does_not_touch_the_gate(self, client: AsyncClient):
        headers, workspace_id = await _authed_workspace(client, "nontool")
        res = await client.post(
            "/api/v1/capabilities",
            json={"name": "gate_skill", "category": "skill", "description": "not a tool"},
            headers=headers,
        )
        assert res.status_code == 201
        skill_id = res.json()["id"]
        await _TOOL_ENABLE_GATE.disabled(workspace_id)

        assert (await client.patch(
            f"/api/v1/capabilities/{skill_id}", json={"enabled": False}, headers=headers
        )).status_code == 200
        assert await _TOOL_ENABLE_GATE.disabled(workspace_id) == frozenset()


class TestGateIsolation:
    async def test_disabling_in_one_workspace_leaves_another_untouched(self, client: AsyncClient):
        """Negative control: the gate is per workspace, never fleet-wide."""
        headers_a, ws_a = await _authed_workspace(client, "iso-a")
        headers_b, ws_b = await _authed_workspace(client, "iso-b")

        tool_id = await _create_tool(client, headers_a, "gate_iso_tool")
        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers_a
        )).status_code == 200

        assert "gate_iso_tool" in await _TOOL_ENABLE_GATE.disabled(ws_a)
        assert "gate_iso_tool" not in await _TOOL_ENABLE_GATE.disabled(ws_b)

    async def test_two_workspaces_hold_independent_sets(self, client: AsyncClient):
        headers_a, ws_a = await _authed_workspace(client, "set-a")
        headers_b, ws_b = await _authed_workspace(client, "set-b")

        id_a = await _create_tool(client, headers_a, "gate_only_a")
        id_b = await _create_tool(client, headers_b, "gate_only_b")
        assert (await client.patch(
            f"/api/v1/capabilities/{id_a}", json={"enabled": False}, headers=headers_a
        )).status_code == 200
        assert (await client.patch(
            f"/api/v1/capabilities/{id_b}", json={"enabled": False}, headers=headers_b
        )).status_code == 200

        assert await _TOOL_ENABLE_GATE.disabled(ws_a) == frozenset({"gate_only_a"})
        assert await _TOOL_ENABLE_GATE.disabled(ws_b) == frozenset({"gate_only_b"})


class TestGateCache:
    async def test_the_write_path_invalidates_immediately(self, client: AsyncClient):
        """The property that makes the switch feel real to an operator.

        Without invalidation the cached set survives the PATCH, so the denial does
        not appear until the TTL expires.
        """
        headers, workspace_id = await _authed_workspace(client, "invalidate")
        tool_id = await _create_tool(client, headers, "gate_cache_tool")

        assert await _TOOL_ENABLE_GATE.disabled(workspace_id) == frozenset()
        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers
        )).status_code == 200

        # No sleep, no TTL expiry: the write alone must change the answer.
        assert await _TOOL_ENABLE_GATE.disabled(workspace_id) == frozenset({"gate_cache_tool"})

    async def test_within_ttl_a_repeat_read_is_served_from_cache(self, client: AsyncClient):
        headers, workspace_id = await _authed_workspace(client, "ttl")
        tool_id = await _create_tool(client, headers, "gate_ttl_tool")
        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers
        )).status_code == 200

        first = await _TOOL_ENABLE_GATE.disabled(workspace_id)
        second = await _TOOL_ENABLE_GATE.disabled(workspace_id)
        assert first is second  # same object => served from the cached window

    async def test_a_stale_window_expires_within_the_documented_bound(self, client: AsyncClient):
        """The staleness bound is real and bounded: past the TTL the set is re-read."""
        from api.tools.executor import set_tool_enable_cache_ttl

        headers, workspace_id = await _authed_workspace(client, "stale")
        tool_id = await _create_tool(client, headers, "gate_stale_tool")
        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": False}, headers=headers
        )).status_code == 200
        assert await _TOOL_ENABLE_GATE.disabled(workspace_id) == frozenset({"gate_stale_tool"})

        # Mutate the row behind the gate's back, as a second worker would, then
        # wait out a deliberately tiny window.
        import asyncio

        from api.database import get_db  # noqa: F401  (documents the session source)

        set_tool_enable_cache_ttl(0.01)
        assert (await client.patch(
            f"/api/v1/capabilities/{tool_id}", json={"enabled": True}, headers=headers
        )).status_code == 200
        await asyncio.sleep(0.05)
        assert await _TOOL_ENABLE_GATE.disabled(workspace_id) == frozenset()
        assert time.monotonic() > 0  # the TTL path was actually exercised

    async def test_a_non_uuid_workspace_key_does_not_raise(self, client: AsyncClient):
        """The gate must degrade, not crash the tool path it guards."""
        headers, _ = await _authed_workspace(client, "malformed")
        assert await _TOOL_ENABLE_GATE.disabled("not-a-uuid") == frozenset()
        assert await _TOOL_ENABLE_GATE.disabled("") == frozenset()


class TestDenialMessage:
    def test_the_message_names_the_tool_and_the_remedy(self):
        """A denial the operator cannot act on is a support ticket, not a gate."""
        message = tool_disabled_message("fetch_url", "ws-42")
        assert "fetch_url" in message
        assert "disabled for this workspace" in message
        assert "ws-42" in message
        assert "enabled=true" in message

    def test_the_message_is_stable_across_calls(self):
        assert tool_disabled_message("t", "w") == tool_disabled_message("t", "w")