"""T-2/T-3 — HTTP route parity for explicit ``/skill:<slug>`` pins.

T-2: the buffered routes (``POST /agents/chat`` and the legacy
``POST /chat/workspaces/{id}/chat``) must strip the pin before any consumer
sees the message, and the pinned directive must still reach the compiled
prompt.

T-3: the streaming route must do the same before its early consumers —
``is_multi_agent_request``, ``route_intent_and_plan`` and
``detect_adversarial_prompt``. A pin that leaks into routing or the security
filter changes what those systems classify, even if the eventual prompt is
clean.

These tests drive the real routes through the shared test app, so they fail if
a router passes the raw message upstream or drops ``pinned_skill``.
"""
from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.models.schema import WorkspaceCapability
from api.services.llm_service import LLMService

pytestmark = pytest.mark.asyncio

SKILL_NAME = "buffered-pinned-skill"
DOC_MARKER = "BUFFERED-PIN-DOC-MARKER"
DOC = (
    f"# Buffered Pin Skill\n\n"
    f"{DOC_MARKER} — this document may only arrive through the pin.\n\n"
    "## Operating Rules\n"
    "1. Follow the operator's request exactly.\n"
)


def _capture_loop(monkeypatch) -> list[list[dict[str, Any]]]:
    """Capture the exact messages the loop compiles, at class level."""
    captured: list[list[dict[str, Any]]] = []

    async def mock_stream(self, messages, tools=None, **kwargs):
        captured.append([dict(m) for m in messages])
        yield {"type": "text_delta", "text": json.dumps({"summary": "ok", "proposals": []})}
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)
    return captured


def _use_test_db(monkeypatch, db_session: AsyncSession) -> None:
    """The loop's skill lookup opens its own short-lived session; point it at
    this test's session instead of the global factory above the per-test engine.
    """

    import api.database as database

    @asynccontextmanager
    async def _session(**kwargs: Any):
        yield db_session

    monkeypatch.setattr(database, "scoped_session", _session)


async def _workspace(client: AsyncClient, headers: dict) -> str:
    res = await client.post("/api/v1/workspaces", json={"name": "buffered-pin-ws"}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json().get("id") or res.json()["workspace_id"]


async def _seed_skill(db_session: AsyncSession, workspace_id: str) -> None:
    """A skill whose trigger can never match, so only the pin can inject it."""
    db_session.add(
        WorkspaceCapability(
            workspace_id=uuid.UUID(workspace_id),
            name=SKILL_NAME,
            category="skill",
            description="Buffered-path pin parity skill",
            version="1.0.0",
            enabled=True,
            config={
                "markdown_doc": DOC,
                "required_scope": "memory.read",
                "triggers": ["phrase never present anywhere"],
            },
        )
    )
    await db_session.commit()


def _contents(captured: list[list[dict[str, Any]]]) -> list[str]:
    return [str(m.get("content", "")) for messages in captured for m in messages]


async def _assert_pin_parity(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch,
    headers: dict,
    *,
    path: str,
    payload: dict,
) -> None:
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    captured = _capture_loop(monkeypatch)
    _use_test_db(monkeypatch, db_session)

    res = await client.post(path, json=payload, headers=headers)
    assert res.status_code == 200, res.text

    contents = _contents(captured)
    assert contents, "the agent loop never called the LLM"

    joined = "\n".join(contents)
    assert DOC_MARKER in joined, "pinned directive never reached the compiled prompt"
    assert '<untrusted-data source="workspace:skills">' in joined
    assert f"### {SKILL_NAME}" in joined

    assert "/skill:" not in joined, "the pin leaked into a prompt consumer"

    # The skill name legitimately appears in the injected directive header. The
    # leak this guards is the pin's *slug* surviving in the user text before the
    # skills layer, e.g. a strip that removes only ``/skill:``.
    before_skills = joined.split("## Workspace skills")[0]
    assert SKILL_NAME not in before_skills, "the raw pin slug survived stripping"
    assert "summarize my documents" in before_skills

    system = "\n".join(
        str(m.get("content", "")) for messages in captured for m in messages if m.get("role") == "system"
    )
    assert DOC_MARKER not in system, "workspace-authored text reached the trusted system block"


async def test_agents_chat_strips_pin_and_injects_directive(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict, monkeypatch
):
    workspace_id = await _workspace(client, auth_headers)
    await _seed_skill(db_session, workspace_id)
    await _assert_pin_parity(
        client,
        db_session,
        monkeypatch,
        auth_headers,
        path="/api/v1/agents/chat",
        payload={
            "workspaceId": workspace_id,
            "message": f"/skill:{SKILL_NAME} summarize my documents",
            "agentName": "resume",
        },
    )


async def test_legacy_chat_strips_pin_and_injects_directive(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict, monkeypatch
):
    workspace_id = await _workspace(client, auth_headers)
    await _seed_skill(db_session, workspace_id)
    await _assert_pin_parity(
        client,
        db_session,
        monkeypatch,
        auth_headers,
        path=f"/api/v1/chat/workspaces/{workspace_id}/chat",
        payload={
            "message": f"/skill:{SKILL_NAME} summarize my documents",
            "agent_name": "resume",
        },
    )


async def test_api_installed_skill_reaches_prompt_and_counts_usage(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict, monkeypatch
):
    """E1: a skill created through the API is injected and counted by a real run.

    The row is installed through ``POST /capabilities`` rather than seeded
    directly, so the test covers the real create path's config shape. The
    assertion reads ``usage_count`` from the database after the request, which
    is the same telemetry the Skills UI's "Most used" ordering consumes.

    Boundary: this uses the SQLite test database. PostgreSQL row-level-security
    behaviour for the same write is covered by ``pnpm verify:pg``, not here.
    """
    workspace_id = await _workspace(client, auth_headers)
    install_headers = {**auth_headers, "X-Workspace-Id": workspace_id}
    created = await client.post(
        "/api/v1/capabilities",
        json={
            "name": SKILL_NAME,
            "category": "skill",
            "description": "Installed through the API for E1",
            "version": "1.0.0",
            "config": {
                "markdown_doc": DOC,
                "required_scope": "memory.read",
                "triggers": ["phrase never present anywhere"],
            },
        },
        headers=install_headers,
    )
    assert created.status_code == 201, created.text
    capability_id = created.json()["id"]

    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    captured = _capture_loop(monkeypatch)
    _use_test_db(monkeypatch, db_session)

    res = await client.post(
        "/api/v1/agents/chat",
        json={
            "workspaceId": workspace_id,
            "message": f"/skill:{SKILL_NAME} summarize my documents",
            "agentName": "resume",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text

    joined = "\n".join(_contents(captured))
    assert DOC_MARKER in joined, "API-installed skill never reached the compiled prompt"
    assert f"### {SKILL_NAME}" in joined

    usage = await db_session.execute(
        select(WorkspaceCapability.usage_count, WorkspaceCapability.last_used_at).where(
            WorkspaceCapability.id == uuid.UUID(capability_id)
        )
    )
    usage_count, last_used_at = usage.one()
    assert usage_count == 1
    assert last_used_at is not None


async def test_stream_strips_pin_before_early_consumers(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """The stream's classifier, router and security filter see the residual.

    ``run_agent_loop_stream`` is replaced with a one-event stub: T-2 already
    proves injection on the real loop; this test isolates the early consumers
    that would otherwise classify the raw pin.
    """
    workspace_id = await _workspace(client, auth_headers)
    seen: dict[str, str] = {}

    from api.infrastructure import agent_eval
    from api.orchestrator import router as router_mod
    from api.orchestrator import supervisor
    from api.orchestrator import loop as loop_mod

    def fake_is_multi(message: str) -> bool:
        seen["is_multi"] = message
        return False

    async def fake_route(message: str, *args, **kwargs):
        seen["route"] = message
        return "resume", 0.99, None

    def fake_adversarial(message: str) -> list[dict]:
        seen["adversarial"] = message
        return []

    async def fake_stream(req):
        seen["loop_message"] = req.message
        seen["pinned_skill"] = req.pinned_skill or ""
        yield {"event": "done", "data": {"status": "completed", "result": "ok"}}

    monkeypatch.setattr(supervisor, "is_multi_agent_request", fake_is_multi)
    monkeypatch.setattr(router_mod, "route_intent_and_plan", fake_route)
    monkeypatch.setattr(agent_eval, "detect_adversarial_prompt", fake_adversarial)
    monkeypatch.setattr(loop_mod, "run_agent_loop_stream", fake_stream)

    res = await client.post(
        "/api/v1/agents/chat/stream",
        json={
            "workspaceId": workspace_id,
            "message": f"/skill:{SKILL_NAME} summarize my documents",
        },
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text

    for consumer in ("is_multi", "route", "adversarial"):
        assert consumer in seen, f"{consumer} was never called"
        assert "/skill:" not in seen[consumer], f"pin leaked into {consumer}"
        assert SKILL_NAME not in seen[consumer], f"pin slug leaked into {consumer}"
        assert "summarize my documents" in seen[consumer]

    assert seen["pinned_skill"] == SKILL_NAME
    assert f"/skill:{SKILL_NAME}" not in seen["loop_message"]
