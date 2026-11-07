"""A real tool execution must move its own ``usage_count`` row.

``usage_count`` was fiction in the frontend and only moved on operator *Test*
runs (the request-path diagnostic) or on skill injection (the agent path).
These cover the third seam: :func:`api.tools.executor.execute_tool` — every
real execution of a workspace tool through a ``category='tool'`` capability
row, recorded by the ONE request-path writer in
:mod:`api.services.capability_usage_service`.

Covers the request-path writers (``record_usage`` / ``record_usage_by_name``)
against a real SQLite session (the ``db_session`` fixture) and the executor
hook against the real ``execute_tool`` with the service's own session factory
pointed at the test session.

Every count is asserted as an EXACT integer. A telemetry number that is
"roughly right" is the same dishonesty as the hard-coded ``usageCount`` this
replaces.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Workspace, WorkspaceCapability
from api.services import capability_usage_service as capability_usage
from api.tools import executor as tool_executor
from api.tools.definitions import ToolDefinition
from api.tools.executor import execute_tool


def _aware(dt: datetime) -> datetime:
    """SQLite drops tzinfo on round-trip; treat naive as UTC."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


async def _workspace(db: AsyncSession, label: str = "usage") -> str:
    ws = Workspace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name=f"tool-usage-{label}-{uuid.uuid4().hex[:8]}"
    )
    db.add(ws)
    await db.commit()
    return str(ws.id)


async def _tool_row(
    db: AsyncSession,
    workspace_id: str,
    name: str,
    *,
    enabled: bool = True,
    usage_count: int = 0,
) -> WorkspaceCapability:
    row = WorkspaceCapability(
        workspace_id=uuid.UUID(workspace_id),
        name=name,
        category="tool",
        description=f"{name} tool",
        version="1.0.0",
        enabled=enabled,
        config={},
        usage_count=usage_count,
        last_used_at=None,
    )
    db.add(row)
    await db.commit()
    return row


async def _row_of(
    db: AsyncSession, workspace_id: str, name: str
) -> WorkspaceCapability | None:
    return (
        await db.execute(
            select(WorkspaceCapability).where(
                WorkspaceCapability.workspace_id == uuid.UUID(workspace_id),
                WorkspaceCapability.name == name,
                WorkspaceCapability.category == "tool",
            )
        )
    ).scalar_one_or_none()


async def _usage(db: AsyncSession, workspace_id: str, name: str) -> tuple[int, Any]:
    row = await _row_of(db, workspace_id, name)
    assert row is not None
    return int(row.usage_count or 0), row.last_used_at


@pytest.fixture(autouse=True)
def isolated_telemetry_state():
    """Reset the process-global telemetry state per test.

    The session-source overrides are module globals (the hook has no session
    to hang state on), so without this every test would inherit its
    neighbours' overrides. Direct assignment, not monkeypatch: a leaked value
    from earlier in the session must not be restored by a monkeypatch undo.
    """
    capability_usage._USAGE_SESSION_FACTORY_OVERRIDE = None
    tool_executor._IDEM_SESSION_FACTORY_OVERRIDE = None
    yield
    capability_usage._USAGE_SESSION_FACTORY_OVERRIDE = None
    tool_executor._IDEM_SESSION_FACTORY_OVERRIDE = None


@pytest.fixture
def writes_to(monkeypatch, db_session: AsyncSession):
    """Point BOTH writers at the test session.

    The production writers open their own RLS-scoped session (so a telemetry
    write can never poison a user's transaction). The overrides are the same
    hooks the executor's idempotency rows use.
    """

    @asynccontextmanager
    async def _fake(workspace_id=None):
        yield db_session

    monkeypatch.setattr(
        capability_usage, "_USAGE_SESSION_FACTORY_OVERRIDE", lambda wid: _fake(wid)
    )
    monkeypatch.setattr(
        tool_executor, "_IDEM_SESSION_FACTORY_OVERRIDE", lambda wid: _fake(wid)
    )
    return db_session


@pytest.fixture
def gate_allows_all(monkeypatch):
    """The enable gate reads the disabled set in its own session; the tests
    here only exercise rows that are not disabled, so stub the read empty."""

    async def _no_disabled(workspace_id: str):
        return frozenset()

    monkeypatch.setattr(tool_executor, "_query_disabled_tools", _no_disabled)


# ── 1. record_usage: flush-only increment + stamp ─────────────────────────


@pytest.mark.asyncio
async def test_record_usage_increments_by_one_and_stamps(
    db_session: AsyncSession, monkeypatch
):
    """Existing row, category 'tool', usage_count 2 → 3, last_used_at set, and
    the writer itself commits NOTHING — flush-only, the caller owns the
    transaction."""
    ws = await _workspace(db_session)
    row = await _tool_row(db_session, ws, "counted-tool", usage_count=2)
    assert await _usage(db_session, ws, "counted-tool") == (2, None)

    commits: list[str] = []
    real_commit = db_session.commit

    async def counting_commit():
        commits.append("commit")
        return await real_commit()

    monkeypatch.setattr(db_session, "commit", counting_commit)

    returned = await capability_usage.record_usage(db_session, row)
    assert returned is row
    assert commits == [], "record_usage is flush-only; it must not commit"

    # Caller's transaction boundary.
    await counting_commit()

    db_session.expire_all()
    count, last_used_at = await _usage(db_session, ws, "counted-tool")
    assert count == 3
    assert last_used_at is not None
    assert abs((datetime.now(UTC) - _aware(last_used_at)).total_seconds()) < 60


@pytest.mark.asyncio
async def test_record_usage_by_name_unknown_name_is_a_silent_no_op(
    db_session: AsyncSession, caplog
):
    """A tool the workspace has no capability row for records nothing — no
    invented counter, no exception."""
    ws = await _workspace(db_session)

    with caplog.at_level("DEBUG"):
        returned = await capability_usage.record_usage_by_name(
            db_session,
            workspace_id=ws,
            name="ghost-tool",
            category="tool",
        )

    assert returned is None
    rows = (
        await db_session.execute(
            select(WorkspaceCapability).where(WorkspaceCapability.name == "ghost-tool")
        )
    ).scalars().all()
    assert rows == []


# ── 2. fail-open: a telemetry failure never propagates ────────────────────


@pytest.mark.asyncio
async def test_record_usage_is_fail_open_when_flush_raises(
    db_session: AsyncSession, monkeypatch, caplog
):
    """Flush raising must log a warning and return normally: losing a telemetry
    count is strictly better than failing the business operation."""
    ws = await _workspace(db_session)
    row = await _tool_row(db_session, ws, "fail-open-tool", usage_count=2)

    real_flush = db_session.flush

    async def raising_flush(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(db_session, "flush", raising_flush)
    try:
        with caplog.at_level("WARNING", logger=capability_usage.__name__):
            returned = await capability_usage.record_usage(db_session, row)
    finally:
        monkeypatch.setattr(db_session, "flush", real_flush)

    assert returned is row
    assert "Failed to record capability usage" in caplog.text
    assert "disk on fire" in caplog.text

    # The rollback left the row exactly as it was.
    db_session.expire_all()
    assert (await _usage(db_session, ws, "fail-open-tool"))[0] == 2


# ── 3. the executor hook: one bump per execution, replays record nothing ──


@pytest.mark.asyncio
async def test_executor_hook_bumps_exactly_once_and_lru_replay_records_nothing(
    db_session: AsyncSession, writes_to, gate_allows_all, monkeypatch, caplog
):
    """The negative path is the IDEMPOTENCY LRU replay (chosen over the
    permission-denial alternative, which is covered in
    test_tools_executor.py): first execution bumps +1 and stamps; the second
    identical call short-circuits on the LRU before the hook and records
    nothing."""
    monkeypatch.setattr(tool_executor, "_audit_log", lambda *a, **k: None)

    async def mock_handler(params, ws_id):
        return {"status": "success", "tool": "replay_tool", "result": "ok"}

    monkeypatch.setitem(tool_executor.TOOL_DISPATCH, "replay_tool", mock_handler)

    ws = await _workspace(db_session)
    await _tool_row(db_session, ws, "replay_tool", usage_count=1)

    tool = ToolDefinition(
        name="replay_tool", description="", input_schema={}, output_schema={},
        required_scope="memory.read", category="connector_write",
    )

    async def mock_check(*a):
        return True

    monkeypatch.setattr(tool_executor, "check_permission", mock_check)

    first = await execute_tool(tool, {"q": "v"}, "agent-1", ["memory.read"], ws)
    assert first["status"] == "success"

    count, last_used_at = await _usage(db_session, ws, "replay_tool")
    assert count == 2, "a real execution bumps by exactly 1"
    assert last_used_at is not None

    # Identical call → memory LRU replay, short-circuits before the hook.
    second = await execute_tool(tool, {"q": "v"}, "agent-1", ["memory.read"], ws)
    assert second["status"] == "success"
    assert second is first or second == first

    count, _ = await _usage(db_session, ws, "replay_tool")
    assert count == 2, "a cache-hit replay records nothing"
