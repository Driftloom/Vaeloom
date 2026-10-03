"""A skill that actually shapes an agent run must move its own ``usage_count``.

``usage_count`` used to move only when an operator pressed *Test*, so the "Most
used" ordering in the Skills UI ranked test runs. These cover the seam that makes
real use count: :mod:`api.services.skill_injection` at the agent path.

Covers :mod:`api.services.skill_injection` and the agent-path writer in
:mod:`api.services.capability_usage_service` against a real SQLite session (the
``db_session`` fixture), plus the real ``_try_react_loop`` assembly point with the
LLM stream captured at class level.

Every count is asserted as an EXACT integer. A telemetry number that is "roughly
right" is the same dishonesty as the hard-coded ``usageCount`` this replaces.
"""
from __future__ import annotations

import json
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import Update, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.models.schema import Workspace, WorkspaceCapability
from api.orchestrator.base import BaseAgent
from api.orchestrator.card import AgentCard
from api.orchestrator.loop import _try_react_loop
from api.services import capability_usage_service as cus
from api.services import skill_injection as si
from api.services.llm_service import LLMService
from api.services.skill_injection import build_skill_directive

GRANTED = ["memory.read", "connector.gmail.write"]

# A run id, since no run identity reaches this seam from the loop today.
RUN = "run-alpha"
RUN_AGAIN = "run-beta"


def _doc(marker: str) -> str:
    return (
        f"# {marker} Skill\n\n"
        "## Mission\n"
        f"Apply the {marker} rules to this run.\n\n"
        "## Operating Rules\n"
        "1. Never fabricate evidence.\n"
        "2. Report what actually happened.\n"
    )


async def _workspace(db: AsyncSession, label: str = "usage") -> str:
    ws = Workspace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name=f"skill-usage-{label}-{uuid.uuid4().hex[:8]}"
    )
    db.add(ws)
    await db.commit()
    return str(ws.id)


async def _skill(
    db: AsyncSession,
    workspace_id: str,
    name: str,
    *,
    config: dict[str, Any] | None = None,
    enabled: bool = True,
    usage_count: int = 0,
) -> WorkspaceCapability:
    row = WorkspaceCapability(
        workspace_id=uuid.UUID(workspace_id),
        name=name,
        category="skill",
        description=f"{name} skill",
        version="1.0.0",
        enabled=enabled,
        config=config or {},
        usage_count=usage_count,
        last_used_at=None,
    )
    db.add(row)
    await db.commit()
    return row


@pytest.fixture(autouse=True)
def isolated_usage_state(monkeypatch):
    """Reset the two pieces of process-global telemetry state per test.

    The dedupe cache and the session-source override are module globals by
    necessity (the node has no session to receive and no state to hang a cache
    on), so without this every test would inherit its neighbours' suppressions.
    """
    monkeypatch.setattr(si, "_usage_dedupe", OrderedDict())
    monkeypatch.setattr(cus, "_USAGE_SESSION_FACTORY_OVERRIDE", None)
    monkeypatch.setenv(si.USAGE_TELEMETRY_ENV, "1")
    return monkeypatch


@pytest.fixture
def writes_to(monkeypatch, db_session: AsyncSession):
    """Point the agent-path writer at the test session.

    The production writer opens its own RLS-scoped session (so a telemetry write
    can never poison a user's transaction). The override is the same hook the
    executor's idempotency rows use, and it hands over a session the node must
    not close — the node only ever issues the UPDATE.
    """

    @asynccontextmanager
    async def _fake(workspace_id=None):
        yield db_session

    monkeypatch.setattr(cus, "_USAGE_SESSION_FACTORY_OVERRIDE", lambda wid: _fake(wid))
    return db_session


async def _usage(db: AsyncSession, workspace_id: str, name: str) -> tuple[int, Any]:
    row = (
        await db.execute(
            select(WorkspaceCapability).where(
                WorkspaceCapability.workspace_id == uuid.UUID(workspace_id),
                WorkspaceCapability.name == name,
                WorkspaceCapability.category == "skill",
            )
        )
    ).scalar_one()
    return int(row.usage_count or 0), row.last_used_at


def _run_kwargs(**over: Any) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "agent_name": "career",
        "allowed_scopes": GRANTED,
        "user_message": "summarize my documents",
    }
    kwargs.update(over)
    return kwargs


# ── 1. a real use is counted, exactly once ────────────────────────────────


@pytest.mark.asyncio
async def test_injected_skill_is_counted_once_and_stamped(
    db_session: AsyncSession, writes_to
):
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "counted-skill", config={
        "markdown_doc": _doc("Counted"), "required_scope": "memory.read",
    })
    assert await _usage(db_session, ws, "counted-skill") == (0, None)

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert directive.injected == ("counted-skill",)
    count, last_used_at = await _usage(db_session, ws, "counted-skill")
    assert count == 1
    assert last_used_at is not None


@pytest.mark.asyncio
async def test_counting_increments_and_never_overwrites(
    db_session: AsyncSession, writes_to
):
    """A row that already has a count must go up by one, not be reset to one —
    this is what makes the "Most used" ordering meaningful."""
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "prior-skill", config={
        "markdown_doc": _doc("Prior"), "required_scope": "memory.read",
    }, usage_count=7)

    await build_skill_directive(db_session, ws, usage_run_id=RUN, **_run_kwargs())

    assert (await _usage(db_session, ws, "prior-skill"))[0] == 8


@pytest.mark.asyncio
async def test_every_injected_skill_is_counted(db_session: AsyncSession, writes_to):
    ws = await _workspace(db_session)
    for name in ("alpha-skill", "bravo-skill", "charlie-skill"):
        await _skill(db_session, ws, name, config={
            "markdown_doc": _doc(name), "required_scope": "memory.read",
        })

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert len(directive.injected) == 3
    for name in directive.injected:
        assert (await _usage(db_session, ws, name))[0] == 1


@pytest.mark.asyncio
async def test_run_with_no_skills_injected_increments_nothing(
    db_session: AsyncSession, writes_to
):
    """Scope-gated: never injected, so never counted. Counting a skill that did
    not reach the prompt would rank the UI by misconfiguration."""
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "gated-skill", config={
        "markdown_doc": _doc("Gated"), "required_scope": "memory.write",
    })

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert directive.injected == ()
    assert directive.text == ""
    count, last_used_at = await _usage(db_session, ws, "gated-skill")
    assert count == 0
    assert last_used_at is None


@pytest.mark.asyncio
async def test_empty_workspace_increments_nothing(db_session: AsyncSession, writes_to):
    ws = await _workspace(db_session)

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert directive.injected == ()
    assert si._usage_dedupe == OrderedDict()


@pytest.mark.asyncio
async def test_a_skill_dropped_by_the_token_budget_is_not_counted(
    db_session: AsyncSession, writes_to
):
    """It did not reach the prompt, so it was not used."""
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "fat-skill", config={
        "markdown_doc": _doc("Fat") * 40, "required_scope": "memory.read",
    })

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, token_budget=10, **_run_kwargs()
    )

    assert directive.injected == ()
    assert [s.reason for s in directive.skipped] == ["token_budget_exceeded"]
    assert (await _usage(db_session, ws, "fat-skill"))[0] == 0


# ── 2. idempotency ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_same_run_replayed_does_not_double_count(
    db_session: AsyncSession, writes_to
):
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "replayed-skill", config={
        "markdown_doc": _doc("Replayed"), "required_scope": "memory.read",
    })

    for _ in range(3):
        directive = await build_skill_directive(
            db_session, ws, usage_run_id=RUN, **_run_kwargs()
        )
        assert directive.injected == ("replayed-skill",)

    assert (await _usage(db_session, ws, "replayed-skill"))[0] == 1


@pytest.mark.asyncio
async def test_a_different_run_counts_again(db_session: AsyncSession, writes_to):
    """Proves the dedupe key is per-run, not a permanent suppression: two real
    uses are two uses."""
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "twice-skill", config={
        "markdown_doc": _doc("Twice"), "required_scope": "memory.read",
    })

    await build_skill_directive(db_session, ws, usage_run_id=RUN, **_run_kwargs())
    await build_skill_directive(db_session, ws, usage_run_id=RUN_AGAIN, **_run_kwargs())

    assert (await _usage(db_session, ws, "twice-skill"))[0] == 2


@pytest.mark.asyncio
async def test_dedupe_is_scoped_to_the_workspace(db_session: AsyncSession, writes_to):
    """The key includes the workspace, so two workspaces using the same skill
    name each keep their own count."""
    a = await _workspace(db_session, "a")
    b = await _workspace(db_session, "b")
    await _skill(db_session, a, "shared-name", config={
        "markdown_doc": _doc("Shared"), "required_scope": "memory.read",
    })
    await _skill(db_session, b, "shared-name", config={
        "markdown_doc": _doc("Shared"), "required_scope": "memory.read",
    })

    await build_skill_directive(db_session, a, usage_run_id=RUN, **_run_kwargs())
    await build_skill_directive(db_session, b, usage_run_id=RUN, **_run_kwargs())

    assert (await _usage(db_session, a, "shared-name"))[0] == 1
    assert (await _usage(db_session, b, "shared-name"))[0] == 1


@pytest.mark.asyncio
async def test_dedupe_cache_is_bounded(db_session: AsyncSession, writes_to):
    """A long-lived worker must not accumulate markers without limit."""
    assert si.USAGE_DEDUPE_LIMIT == 512

    for idx in range(si.USAGE_DEDUPE_LIMIT + 25):
        assert si._claim_usage_slot("ws", "run", f"skill-{idx}") is True

    assert len(si._usage_dedupe) == si.USAGE_DEDUPE_LIMIT
    assert ("ws", "run", "skill-0") not in si._usage_dedupe
    assert ("ws", "run", "skill-24") not in si._usage_dedupe
    assert ("ws", "run", f"skill-{si.USAGE_DEDUPE_LIMIT + 24}") in si._usage_dedupe


@pytest.mark.asyncio
async def test_without_a_run_id_every_injection_counts_and_it_says_so(
    db_session: AsyncSession, writes_to, caplog
):
    """The honest current state, asserted rather than hidden.

    No run identifier reaches ``build_skill_directive`` today, so a run that
    assembles its prompt more than once (QA-rejected retry, or a resume from the
    checkpoint) counts the same skill more than once. This pins that behaviour
    and requires the WARNING, so the over-count is visible in production logs
    rather than discovered later in a "why is my usage 400" ticket.

    Passing ``usage_run_id`` is the fix; the one-line change lives at
    ``loop.py:1331``, owned by another agent.
    """
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "keyless-skill", config={
        "markdown_doc": _doc("Keyless"), "required_scope": "memory.read",
    })

    with caplog.at_level("WARNING", logger=si.__name__):
        for _ in range(2):
            await build_skill_directive(db_session, ws, **_run_kwargs())

    assert (await _usage(db_session, ws, "keyless-skill"))[0] == 2
    assert "without a run id" in caplog.text
    assert caplog.text.count("without a run id") == 2


@pytest.mark.asyncio
async def test_a_run_id_suppresses_the_warning(db_session: AsyncSession, writes_to, caplog):
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "keyed-skill", config={
        "markdown_doc": _doc("Keyed"), "required_scope": "memory.read",
    })

    with caplog.at_level("WARNING", logger=si.__name__):
        await build_skill_directive(db_session, ws, usage_run_id=RUN, **_run_kwargs())

    assert (await _usage(db_session, ws, "keyed-skill"))[0] == 1
    assert "without a run id" not in caplog.text


# ── 3. only what actually reached the prompt ──────────────────────────────


@pytest.mark.asyncio
async def test_disabled_skill_is_not_counted(db_session: AsyncSession, writes_to):
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "off-skill", config={
        "markdown_doc": _doc("Off"), "required_scope": "memory.read",
    }, enabled=False)

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert directive.injected == ()
    assert [s.reason for s in directive.skipped] == ["disabled"]
    count, last_used_at = await _usage(db_session, ws, "off-skill")
    assert count == 0
    assert last_used_at is None


@pytest.mark.asyncio
async def test_trigger_unmatched_skill_is_not_counted(db_session: AsyncSession, writes_to):
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "untriggered-skill", config={
        "markdown_doc": _doc("Untriggered"), "required_scope": "memory.read",
        "triggers": ["design the thing"],
    })

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert directive.injected == ()
    assert [s.reason for s in directive.skipped] == ["trigger_not_matched"]
    assert (await _usage(db_session, ws, "untriggered-skill"))[0] == 0


# ── 4. cross-tenant ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_other_workspace_skill_is_not_counted(db_session: AsyncSession, writes_to):
    """Negative control: B's row is invisible to A's run, so A's run cannot move
    B's counter — and B's own row is untouched too."""
    a = await _workspace(db_session, "mine")
    b = await _workspace(db_session, "theirs")
    await _skill(db_session, b, "their-skill", config={
        "markdown_doc": _doc("Theirs"), "required_scope": "memory.read",
    })
    await _skill(db_session, a, "my-skill", config={
        "markdown_doc": _doc("Mine"), "required_scope": "memory.read",
    })

    directive = await build_skill_directive(db_session, a, usage_run_id=RUN, **_run_kwargs())

    assert directive.injected == ("my-skill",)
    assert "Theirs" not in directive.text
    assert (await _usage(db_session, a, "my-skill"))[0] == 1
    assert (await _usage(db_session, b, "their-skill")) == (0, None)


@pytest.mark.asyncio
async def test_writer_refuses_a_capability_id_from_another_workspace(
    db_session: AsyncSession, writes_to
):
    """The workspace predicate is on the UPDATE itself, not just on the read that
    produced the id. A wrong/stale id cannot move another workspace's counter even
    if a caller supplies one."""
    a = await _workspace(db_session, "preda")
    b = await _workspace(db_session, "predb")
    theirs = await _skill(db_session, b, "their-skill", config={
        "markdown_doc": _doc("Theirs"), "required_scope": "memory.read",
    })

    counted = await cus.record_injected_usage(
        a, [(str(theirs.id), "their-skill")], category="skill"
    )

    assert counted == 0
    assert (await _usage(db_session, b, "their-skill")) == (0, None)


@pytest.mark.asyncio
async def test_writer_ignores_a_category_mismatch(db_session: AsyncSession, writes_to):
    """A capability id from a different category is not a skill and is not counted."""
    ws = await _workspace(db_session, "cat")
    agent_row = WorkspaceCapability(
        workspace_id=uuid.UUID(ws),
        name="career",
        category="agent",
        description="an agent, not a skill",
        version="1.0.0",
        enabled=True,
        config={},
        usage_count=4,
    )
    db_session.add(agent_row)
    await db_session.commit()

    counted = await cus.record_injected_usage(
        ws, [(str(agent_row.id), "career")], category="skill"
    )

    assert counted == 0
    assert int(agent_row.usage_count) == 4


# ── 5. a failed telemetry write must not fail the run ─────────────────────


@pytest.mark.asyncio
async def test_write_failure_does_not_fail_the_run(db_session: AsyncSession, monkeypatch, caplog):
    """A store that is entirely unavailable is the failure an operator will
    actually hit. The run must still get its complete, fenced directive."""

    def _boom(workspace_id=None):
        raise RuntimeError("capability table unreachable")

    monkeypatch.setattr(cus, "_USAGE_SESSION_FACTORY_OVERRIDE", _boom)
    ws = await _workspace(db_session, "deadstore")
    await _skill(db_session, ws, "resilient-skill", config={
        "markdown_doc": _doc("Resilient"), "required_scope": "memory.read",
    })

    with caplog.at_level("WARNING", logger=cus.__name__):
        directive = await build_skill_directive(
            db_session, ws, usage_run_id=RUN, **_run_kwargs()
        )

    assert directive.injected == ("resilient-skill",)
    assert "### resilient-skill" in directive.text
    assert directive.text.count("<untrusted-data") == 1
    assert directive.text.count("</untrusted-data>") == 1
    assert _doc("Resilient").strip() in directive.text
    assert "capability table unreachable" in caplog.text


@pytest.mark.asyncio
async def test_session_source_failure_does_not_fail_the_run(
    db_session: AsyncSession, writes_to, monkeypatch, caplog
):
    """Same guarantee one layer down: a session that opens but cannot execute
    the telemetry UPDATE.

    The skill read must keep working — only the UPDATE is poisoned — which is the
    point: the run's own query succeeded and the failure is confined to the write.
    """

    class _UpdatePoisoned:
        def __init__(self, inner: AsyncSession) -> None:
            self._inner = inner

        async def execute(self, statement: Any, *args: Any, **kwargs: Any) -> Any:
            if isinstance(statement, Update):
                raise RuntimeError("telemetry write rejected")
            return await self._inner.execute(statement, *args, **kwargs)

    monkeypatch.setattr(cus, "_USAGE_SESSION_FACTORY_OVERRIDE", lambda wid: _open(_UpdatePoisoned(db_session)))
    ws = await _workspace(db_session, "deadexec")
    await _skill(db_session, ws, "still-fine-skill", config={
        "markdown_doc": _doc("Fine"), "required_scope": "memory.read",
    })

    with caplog.at_level("WARNING", logger=cus.__name__):
        directive = await build_skill_directive(
            db_session, ws, usage_run_id=RUN, **_run_kwargs()
        )

    assert directive.injected == ("still-fine-skill",)
    assert "### still-fine-skill" in directive.text
    assert _doc("Fine").strip() in directive.text
    assert "telemetry write rejected" in caplog.text
    assert (await _usage(db_session, ws, "still-fine-skill"))[0] == 0


def _raising(message: str):
    async def _execute(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError(message)

    return _execute


@asynccontextmanager
async def _open(session: Any):
    yield session


@pytest.mark.asyncio
async def test_unusable_workspace_id_records_nothing(db_session: AsyncSession, writes_to, caplog):
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "nowhere-skill", config={
        "markdown_doc": _doc("Nowhere"), "required_scope": "memory.read",
    })

    with caplog.at_level("WARNING", logger=cus.__name__):
        counted = await cus.record_injected_usage(
            "ws_not_a_uuid", [(str(uuid.uuid4()), "nowhere-skill")], category="skill"
        )

    assert counted == 0
    assert "unusable workspace id" in caplog.text


@pytest.mark.asyncio
async def test_unusable_capability_id_records_nothing(
    db_session: AsyncSession, writes_to, caplog
):
    ws = await _workspace(db_session)

    with caplog.at_level("WARNING", logger=cus.__name__):
        counted = await cus.record_injected_usage(
            ws, [("not-a-uuid", "whatever")], category="skill"
        )

    assert counted == 0
    assert "unusable capability id" in caplog.text


@pytest.mark.asyncio
async def test_empty_entries_short_circuits(db_session: AsyncSession, writes_to):
    assert await cus.record_injected_usage(str(uuid.uuid4()), [], category="skill") == 0
    assert si._usage_dedupe == OrderedDict()


# ── 6. kill switch ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kill_switch_off_records_nothing(
    db_session: AsyncSession, writes_to, monkeypatch
):
    monkeypatch.setenv(si.USAGE_TELEMETRY_ENV, "0")
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "switched-off-skill", config={
        "markdown_doc": _doc("Off"), "required_scope": "memory.read",
    })

    directive = await build_skill_directive(
        db_session, ws, usage_run_id=RUN, **_run_kwargs()
    )

    assert directive.injected == ("switched-off-skill",)
    assert (await _usage(db_session, ws, "switched-off-skill"))[0] == 0
    assert (await _usage(db_session, ws, "switched-off-skill"))[1] is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1", True),
        ("true", True),
        ("yes", True),
        ("on", True),
        ("", True),
        ("0", False),
        ("false", False),
        ("no", False),
        ("off", False),
        ("nonsense", True),
    ],
)
def test_kill_switch_parsing(monkeypatch, raw: str, expected: bool):
    # A stand-in for the settings object rather than the real one: `Settings` is
    # a pydantic model and refuses attribute surgery for a field it does not have.
    monkeypatch.setattr(si, "settings", SimpleNamespace())
    monkeypatch.setenv(si.USAGE_TELEMETRY_ENV, raw)
    assert si.usage_telemetry_enabled() is expected


def test_kill_switch_defaults_on_without_configuration(monkeypatch):
    """A telemetry counter nobody writes is indistinguishable from a capability
    nobody uses. The default is therefore ON, and bounded (one UPDATE per
    injected skill, own transaction, killable here)."""
    monkeypatch.setattr(si, "settings", SimpleNamespace())
    monkeypatch.delenv(si.USAGE_TELEMETRY_ENV, raising=False)
    assert si.usage_telemetry_enabled() is True


def test_a_settings_attribute_wins_over_the_environment(monkeypatch):
    """One read point: if config.py ever gains the flag, the env var stops being
    consulted rather than silently competing with it."""
    monkeypatch.setattr(
        si, "settings", SimpleNamespace(skill_usage_telemetry_enabled=False)
    )
    monkeypatch.setenv(si.USAGE_TELEMETRY_ENV, "1")
    assert si.usage_telemetry_enabled() is False


def test_the_live_settings_object_has_no_flag_today(monkeypatch):
    """The precedence branch above is only reachable because config.py — which
    this change does not own — has no such field. Pins that premise so a future
    addition to config.py is noticed here rather than changing which lever wins.
    """
    monkeypatch.delenv(si.USAGE_TELEMETRY_ENV, raising=False)
    assert not hasattr(settings, si.USAGE_TELEMETRY_SETTING)
    assert si.usage_telemetry_enabled() is True


# ── 7. the real agent path (real _try_react_loop) ─────────────────────────


class _UsageAgent(BaseAgent):
    mission = "A simple agent for testing that real use moves usage_count"
    tools = []
    card = AgentCard(
        name="dummy",
        version="1.0.0",
        description="Dummy agent for skill usage assertions",
        tools=["search_documents", "draft_email"],
        output_schema={
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
        },
    )

    async def fallback(self) -> Any:
        return {"agent_name": "dummy", "action": "fallback", "result": {"summary": "fallback"}}


def _capture_loop(monkeypatch) -> list[list[dict[str, Any]]]:
    """Class-level patch of the tool stream — patching the llm_service singleton
    leaves a shadowing __dict__ entry that hijacks later class-level patches."""
    captured: list[list[dict[str, Any]]] = []

    async def mock_stream(self, messages, tools=None, **kwargs):
        captured.append([dict(m) for m in messages])
        yield {"type": "text_delta", "text": json.dumps({"summary": "ok"})}
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)
    return captured


async def _run_loop(db_session: AsyncSession, workspace_id: str, message: str) -> None:
    result = await _try_react_loop(
        agent=_UsageAgent(),
        message=message,
        workspace_id=workspace_id,
        agent_name="dummy",
        db=db_session,
        request_id=f"req-usage-{uuid.uuid4().hex[:8]}",
    )
    assert result is not None, result


@pytest.mark.asyncio
async def test_the_real_agent_path_counts_a_skill_it_injected(
    monkeypatch, db_session: AsyncSession, writes_to, caplog
):
    """End-to-end: an agent run that actually delivered a skill moves that
    skill's counter. This is the behaviour the Skills UI was faking."""
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    _capture_loop(monkeypatch)

    ws = await _workspace(db_session, "loop")
    await _skill(db_session, ws, "loop-used-skill", config={
        "markdown_doc": _doc("LoopUsed"), "required_scope": "memory.read",
    }, usage_count=11)

    with caplog.at_level("INFO", logger=si.__name__):
        await _run_loop(db_session, ws, "summarize my documents")

    assert (await _usage(db_session, ws, "loop-used-skill"))[0] == 12
    assert "SKILL_USAGE" in caplog.text
    assert "loop-used-skill" in caplog.text


@pytest.mark.asyncio
async def test_the_real_agent_path_leaves_a_gated_skill_uncounted(
    monkeypatch, db_session: AsyncSession, writes_to
):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    _capture_loop(monkeypatch)

    ws = await _workspace(db_session, "loopgated")
    await _skill(db_session, ws, "loop-gated-skill", config={
        "markdown_doc": _doc("LoopGated"), "required_scope": "memory.write",
    })

    await _run_loop(db_session, ws, "summarize my documents")

    assert (await _usage(db_session, ws, "loop-gated-skill")) == (0, None)


@pytest.mark.asyncio
async def test_the_real_agent_path_survives_a_dead_telemetry_store(
    monkeypatch, db_session: AsyncSession, caplog
):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    captured = _capture_loop(monkeypatch)

    def _boom(workspace_id=None):
        raise RuntimeError("capability table unreachable")

    monkeypatch.setattr(cus, "_USAGE_SESSION_FACTORY_OVERRIDE", _boom)

    ws = await _workspace(db_session, "loopdead")
    await _skill(db_session, ws, "loop-survivor-skill", config={
        "markdown_doc": _doc("LoopSurvivor"), "required_scope": "memory.read",
    })

    result = await _try_react_loop(
        agent=_UsageAgent(),
        message="summarize my documents",
        workspace_id=ws,
        agent_name="dummy",
        db=db_session,
        request_id=f"req-usage-{uuid.uuid4().hex[:8]}",
    )

    assert result is not None
    user = [m for m in captured[0] if m["role"] == "user"][0]["content"]
    assert "### loop-survivor-skill" in user
    assert "### loop-survivor-skill" not in [m for m in captured[0] if m["role"] == "system"][0]["content"]
    assert (await _usage(db_session, ws, "loop-survivor-skill"))[0] == 0


@pytest.mark.asyncio
async def test_agent_path_without_a_db_session_counts_nothing(
    monkeypatch, db_session: AsyncSession, writes_to
):
    """No session means no lookup at all, so there is no row to count."""
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    captured = _capture_loop(monkeypatch)

    ws = await _workspace(db_session, "loopnodb")
    await _skill(db_session, ws, "never-counted-skill", config={
        "markdown_doc": _doc("NeverCounted"), "required_scope": "memory.read",
    })

    result = await _try_react_loop(
        agent=_UsageAgent(),
        message="summarize my documents",
        workspace_id=ws,
        agent_name="dummy",
    )

    assert result is not None
    assert "## Workspace skills" not in [m for m in captured[0] if m["role"] == "system"][0]["content"]
    assert (await _usage(db_session, ws, "never-counted-skill"))[0] == 0