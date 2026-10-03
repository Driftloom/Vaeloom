"""Per-workspace capability usage telemetry.

Why this exists
---------------
``usageCount`` used to be a hard-coded number in the frontend's
``capabilities-data.ts``. It was never measured, so it was fiction. Usage is
per workspace — the same skill is used 0 times in one workspace and 400 times in
another — so it lives in ``workspace_capabilities`` (migration 0062) rather than
in the catalog.

Telemetry policy
----------------
Only real invocations increment the counter. A validation-only call still counts
as *use of the skill document* because it loads and parses that document, but a
call that never reached a capability row records nothing.

Two writers, two transaction owners
-----------------------------------
``record_usage`` / ``record_usage_by_name`` are the **request-path** writer: the
caller passes its own session and owns the commit.

:func:`record_injected_usage` is the **agent-path** writer, and it deliberately
does not. The ReAct and graph paths are handed no session they own, and putting
a telemetry UPDATE inside a user's transaction gives telemetry a way to fail
that user: a failed flush leaves the session in ``PendingRollbackError`` and the
*next unrelated query* raises, long after the telemetry call returned. The
agent path therefore writes in its own session and its own transaction, so the
worst case is a lost count — never a failed request. Same rationale, same
``scoped_session`` call as the executor's idempotency rows
(``tools.executor._idem_session_cm``).
"""

from __future__ import annotations

import logging
import uuid as uuid_mod
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import WorkspaceCapability

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(UTC)


async def find_capability(
    session: AsyncSession,
    *,
    workspace_id: str,
    name: str,
    category: str,
) -> WorkspaceCapability | None:
    """Resolve a capability row by name inside one workspace.

    ``workspace_id`` arrives as a string from the request context; it is coerced
    to a ``uuid.UUID`` because the column is a typed UUID and a raw dashed string
    would not match on SQLite.
    """
    try:
        wid = uuid_mod.UUID(str(workspace_id))
    except (ValueError, TypeError):
        return None

    res = await session.execute(
        select(WorkspaceCapability).where(
            WorkspaceCapability.workspace_id == wid,
            WorkspaceCapability.name == name,
            WorkspaceCapability.category == category,
        )
    )
    return res.scalar_one_or_none()


async def record_usage(
    session: AsyncSession,
    capability: WorkspaceCapability,
    *,
    now: datetime | None = None,
) -> WorkspaceCapability:
    """Increment ``usage_count`` and stamp ``last_used_at``.

    Flushes but does not commit; the caller owns the transaction boundary. A
    telemetry write must never be the reason a business operation rolls back,
    so a failure here is logged and swallowed rather than propagated.
    """
    try:
        capability.usage_count = int(capability.usage_count or 0) + 1
        capability.last_used_at = now or utcnow()
        await session.flush()
    except Exception as exc:  # pragma: no cover - rollback path
        logger.warning("Failed to record capability usage for %s: %s", capability.name, exc)
        await session.rollback()
    return capability


async def record_usage_by_name(
    session: AsyncSession,
    *,
    workspace_id: str,
    name: str,
    category: str,
    now: datetime | None = None,
) -> WorkspaceCapability | None:
    """Look up a row then record usage. Returns None when no row exists.

    A capability the workspace has not installed has no per-workspace counter to
    increment; the caller reports that honestly instead of inventing a number.
    """
    row = await find_capability(session, workspace_id=workspace_id, name=name, category=category)
    if row is None:
        return None
    return await record_usage(session, row, now=now)


# ── agent-path writer ─────────────────────────────────────────────────────
# Test hook: override the session source so a test's own engine receives the
# write. Same shape and same reason as tools.executor.set_idem_session_factory —
# the default is the production path and is never a test double.
_USAGE_SESSION_FACTORY_OVERRIDE: Any = None


def set_usage_session_factory(fn) -> None:
    global _USAGE_SESSION_FACTORY_OVERRIDE
    _USAGE_SESSION_FACTORY_OVERRIDE = fn


def _usage_session_cm(workspace_id: str):
    """RLS-scoped session for usage writes, falling back to the raw factory when
    scoping itself is unavailable (SQLite, tests) — identical ladder to
    ``tools.executor._idem_session_cm``."""
    if _USAGE_SESSION_FACTORY_OVERRIDE is not None:
        return _USAGE_SESSION_FACTORY_OVERRIDE(workspace_id)
    try:
        from ..database import scoped_session

        return scoped_session(workspace_id=workspace_id, require=False)
    except Exception:
        from ..database import async_session_factory

        return async_session_factory()


def _as_uuid(value: Any) -> Any:
    try:
        return uuid_mod.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


async def record_injected_usage(
    workspace_id: str,
    entries: Sequence[tuple[str, str]],
    *,
    category: str,
    now: datetime | None = None,
) -> int:
    """Count skills an agent run actually injected. Returns rows incremented.

    ``entries`` are ``(capability_id, name)`` pairs taken from the rows the run
    actually injected, which is what makes the tenant boundary provable rather
    than asserted: the UPDATE is predicated on the primary key **and** the
    workspace **and** the category, so a stale or wrong id cannot move a counter
    in another workspace even if it is somehow supplied. ``rowcount`` is the
    truth reported back — a name that no longer resolves counts nothing.

    The increment is ``usage_count = usage_count + 1`` (not an assignment) so a
    concurrent writer's count is not clobbered, and ``coalesce`` keeps a legacy
    NULL from turning the row non-nullable-violating.

    Never raises. Returns 0 when the store is unavailable, because losing a
    telemetry count is strictly better than failing an agent turn.
    """
    if not entries:
        return 0

    wid = _as_uuid(workspace_id)
    if wid is None:
        # A non-UUID workspace id cannot be predicated on, so there is no way to
        # prove tenant scope here. Record nothing rather than guess.
        logger.warning("Injected-skill usage not recorded: unusable workspace id %r", workspace_id)
        return 0

    stamp = now or utcnow()
    incremented = 0
    try:
        async with _usage_session_cm(str(wid)) as session:
            for capability_id, name in entries:
                cid = _as_uuid(capability_id)
                if cid is None:
                    logger.warning(
                        "Injected-skill usage not recorded for %s: unusable capability id %r",
                        name,
                        capability_id,
                    )
                    continue
                res = await session.execute(
                    update(WorkspaceCapability)
                    .where(
                        WorkspaceCapability.id == cid,
                        WorkspaceCapability.workspace_id == wid,
                        WorkspaceCapability.category == category,
                    )
                    .values(
                        usage_count=func.coalesce(WorkspaceCapability.usage_count, 0) + 1,
                        last_used_at=stamp,
                    )
                )
                if res.rowcount:
                    incremented += 1
                else:
                    logger.warning(
                        "Injected-skill usage matched no row for %s (id=%s) in workspace %s",
                        name,
                        cid,
                        wid,
                    )
            await session.commit()
        return incremented
    except Exception as exc:
        logger.warning("Injected-skill usage telemetry failed (run unaffected): %s", exc)
        return 0
