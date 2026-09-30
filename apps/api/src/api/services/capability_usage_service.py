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
"""

from __future__ import annotations

import logging
import uuid as uuid_mod
from datetime import UTC, datetime

from sqlalchemy import select
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