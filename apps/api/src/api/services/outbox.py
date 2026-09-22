"""Transactional outbox — slice 1 (ADR-045).

Problem: publishers today commit a DB row and then enqueue to Redis in two
separate steps. A crash between them leaves either a ghost job (Redis without
DB truth) or a lost job (DB without Redis delivery).

Slice 1 provides the ledger + writer + atomic claim + stub relay. It does NOT
rewire any existing publisher (Loop 2) and does NOT publish to a real broker:
``publish_due_events`` with ``publisher=None`` marks claimed rows ``published``
so the full claim → deliver → mark cycle is exercised end to end.

Same-transaction usage (the whole point)::

    from api.services.outbox import record_outbox_event

    async def create_application(db, ...):
        app = Application(...)
        db.add(app)
        # Same session, BEFORE commit — rolls back atomically with `app`.
        record_outbox_event(
            db,
            event_type="application.status_changed",
            payload={"application_id": str(app.id), "status": app.status},
            workspace_id=app.workspace_id,
            tenant_id=tenant_id,
        )
        await db.commit()  # single commit covers domain row + outbox row

A background relay (Loop 2) will call ``publish_due_events(db, publisher=...)``
on a timer; until then the relay is default-off via
``settings.outbox_relay_enabled``.

Delivery semantics: at-least-once. A crash between broker publish and the
``published`` mark causes redelivery, so consumers MUST be idempotent
(key on ``outbox_events.id``).
"""

import inspect
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Awaitable, Callable

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.schema import OutboxEvent

logger = logging.getLogger(__name__)

#: Terminal / transient outbox row states.
OUTBOX_STATUS_PENDING = "pending"
OUTBOX_STATUS_CLAIMED = "claimed"
OUTBOX_STATUS_PUBLISHED = "published"
OUTBOX_STATUS_FAILED = "failed"

OUTBOX_STATUSES = frozenset({
    OUTBOX_STATUS_PENDING,
    OUTBOX_STATUS_CLAIMED,
    OUTBOX_STATUS_PUBLISHED,
    OUTBOX_STATUS_FAILED,
})

#: Cap stored error text so a pathological traceback can't bloat the row.
_MAX_ERROR_CHARS = 2000


def _coerce_uuid(value: uuid.UUID | str | None) -> uuid.UUID | None:
    if value is None or isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def record_outbox_event(
    db: AsyncSession,
    *,
    event_type: str,
    payload: dict,
    tenant_id: uuid.UUID | str | None = None,
    workspace_id: uuid.UUID | str | None = None,
    next_attempt_at: datetime | None = None,
) -> OutboxEvent:
    """Stage one outbox row in the caller's transaction. No commit, no flush of
    other state — call ``await db.flush()`` / ``await db.commit()`` yourself.

    MUST be called on the same session/transaction as the domain write it
    mirrors; committing separately reintroduces the dual-write window this
    table exists to close. The row is synchronous (no awaiting needed) so it
    can be dropped into any service method without restructuring.
    """
    if not event_type or not isinstance(event_type, str):
        raise ValueError("event_type must be a non-empty string")
    if payload is None or not isinstance(payload, dict):
        raise ValueError("payload must be a dict")

    event = OutboxEvent(
        id=uuid.uuid4(),  # client-generated so callers can use event.id pre-flush
        tenant_id=_coerce_uuid(tenant_id),
        workspace_id=_coerce_uuid(workspace_id),
        event_type=event_type,
        payload=payload,
        status=OUTBOX_STATUS_PENDING,
        attempts=0,
        next_attempt_at=next_attempt_at,
    )
    db.add(event)
    return event


async def claim_outbox_event(
    db: AsyncSession,
    *,
    max_attempts: int = 5,
) -> OutboxEvent | None:
    """Atomically claim one due ``pending`` row. Exactly one claimant wins.

    Mechanism (portable PG + SQLite): pick the oldest due candidate, then a
    guarded ``UPDATE ... WHERE id AND status='pending'``. The statement-level
    write is the atomic gate — a concurrent claimant's UPDATE affects 0 rows
    and moves on. (PG could use ``SELECT ... FOR UPDATE SKIP LOCKED``; the
    guarded UPDATE keeps one code path for both dialects in slice 1.)

    Flushes the claim; the caller owns the commit (the relay commits per
    batch, see ``publish_due_events``). Returns ``None`` when nothing is due.
    """
    now = datetime.now(UTC)
    due = or_(OutboxEvent.next_attempt_at.is_(None), OutboxEvent.next_attempt_at <= now)
    stmt = (
        select(OutboxEvent.id)
        .where(
            OutboxEvent.status == OUTBOX_STATUS_PENDING,
            OutboxEvent.attempts < max_attempts,
            due,
        )
        .order_by(OutboxEvent.created_at.asc())
        .limit(10)
    )
    candidate_ids = list((await db.execute(stmt)).scalars().all())

    for candidate_id in candidate_ids:
        result = await db.execute(
            update(OutboxEvent)
            .where(
                OutboxEvent.id == candidate_id,
                OutboxEvent.status == OUTBOX_STATUS_PENDING,
            )
            .values(status=OUTBOX_STATUS_CLAIMED, attempts=OutboxEvent.attempts + 1, updated_at=now)
        )
        if result.rowcount == 1:
            await db.flush()
            claimed = await db.get(OutboxEvent, candidate_id)
            logger.debug("Outbox claimed event %s", candidate_id)
            return claimed
    return None


async def publish_due_events(
    db: AsyncSession,
    *,
    publisher: Callable[[OutboxEvent], Any | Awaitable[Any]] | None = None,
    batch_size: int = 10,
    max_attempts: int = 5,
    retry_delay_seconds: int = 60,
    enabled: bool | None = None,
) -> dict:
    """Relay stub: claim due rows and deliver them. Commits once per call.

    - ``enabled=None`` (default) reads ``settings.outbox_relay_enabled``
      (default OFF). Disabled → no-op ``{"status": "disabled", ...}``.
    - ``publisher=None`` (slice-1 stub) marks claimed rows ``published``
      WITHOUT touching a broker — exercises the claim → mark cycle only.
      Loop 2 passes a real BullMQ/Redis publisher here.
    - Publisher exceptions → row back to ``pending`` with
      ``next_attempt_at = now + retry_delay_seconds``; once
      ``attempts >= max_attempts`` → ``failed`` (dead-letter triage, Loop 2).

    Returns ``{"status", "published", "retried", "failed"}`` counters.
    """
    if enabled is None:
        enabled = bool(getattr(settings, "outbox_relay_enabled", False))
    if not enabled:
        return {"status": "disabled", "published": 0, "retried": 0, "failed": 0}

    now = datetime.now(UTC)
    published = retried = failed = 0

    for _ in range(max(1, batch_size)):
        event = await claim_outbox_event(db, max_attempts=max_attempts)
        if event is None:
            break
        try:
            if publisher is not None:
                outcome = publisher(event)
                if inspect.isawaitable(outcome):
                    await outcome
            event.status = OUTBOX_STATUS_PUBLISHED
            event.updated_at = now
            published += 1
        except Exception as exc:  # noqa: BLE001 — relay must never crash the loop
            event.last_error = str(exc)[:_MAX_ERROR_CHARS]
            event.updated_at = now
            if event.attempts >= max_attempts:
                event.status = OUTBOX_STATUS_FAILED
                failed += 1
                logger.warning("Outbox event %s exhausted retries (%s)", event.id, exc)
            else:
                event.status = OUTBOX_STATUS_PENDING
                event.next_attempt_at = now + timedelta(seconds=retry_delay_seconds)
                retried += 1
        await db.flush()

    await db.commit()
    return {"status": "ok", "published": published, "retried": retried, "failed": failed}


async def outbox_depth(db: AsyncSession) -> dict:
    """Operator metric: row counts per status (for dashboards / Loop 2 alerts)."""
    stmt = select(OutboxEvent.status, func.count()).group_by(OutboxEvent.status)
    rows = (await db.execute(stmt)).all()
    counts = {status: 0 for status in OUTBOX_STATUSES}
    for status, count in rows:
        counts[status] = count
    return counts


async def requeue_failed_events(
    db: AsyncSession,
    event_ids: list,
) -> int:
    """Dead-letter triage (Loop 2): move ``failed`` rows back to ``pending``.

    Attempts reset to 0 (operator explicitly triaged — the row gets a fresh
    budget) and ``next_attempt_at`` cleared so the next relay pass picks it
    up. Commits. Returns the number of rows requeued.
    """
    if not event_ids:
        return 0
    now = datetime.now(UTC)
    result = await db.execute(
        update(OutboxEvent)
        .where(
            OutboxEvent.id.in_(list(event_ids)),
            OutboxEvent.status == OUTBOX_STATUS_FAILED,
        )
        .values(
            status=OUTBOX_STATUS_PENDING,
            attempts=0,
            next_attempt_at=None,
            last_error=None,
            updated_at=now,
        )
    )
    await db.commit()
    return int(result.rowcount or 0)
