"""Slice-1 transactional outbox tests (ADR-045).

Covers: writer persists in-txn (and vanishes on rollback), atomic claim
(two claimants → one winner), stub relay marks published, failure →
retry-with-backoff → failed, and the default-off relay flag.
"""
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace as SimpleNamespace_for_adapter

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from api.config import settings
from api.models.schema import OutboxEvent
from api.services.outbox import (
    claim_outbox_event,
    publish_due_events,
    record_outbox_event,
    requeue_failed_events,
)

pytestmark = pytest.mark.asyncio


def _record(db, **kwargs):
    params = {
        "event_type": "application.status_changed",
        "payload": {"application_id": "app-1", "status": "SUBMITTED"},
        "tenant_id": uuid.uuid4(),
        "workspace_id": uuid.uuid4(),
    }
    params.update(kwargs)
    return record_outbox_event(db, **params)


async def _count(db, status=None):
    stmt = select(func.count()).select_from(OutboxEvent)
    if status is not None:
        stmt = stmt.where(OutboxEvent.status == status)
    return (await db.execute(stmt)).scalar_one()


class TestRecordOutboxEvent:
    async def test_writer_persists_in_txn(self, db_session):
        event = _record(db_session)
        # Writer stages only — service never commits; id is client-generated
        # so it is usable before flush/commit.
        assert event.id is not None
        assert event.status == "pending"
        assert event.attempts == 0

        await db_session.commit()

        row = (await db_session.execute(
            select(OutboxEvent).where(OutboxEvent.id == event.id)
        )).scalar_one()
        assert row.event_type == "application.status_changed"
        assert row.payload == {"application_id": "app-1", "status": "SUBMITTED"}
        assert row.status == "pending"
        assert row.created_at is not None

    async def test_writer_rolls_back_with_txn(self, db_session):
        _record(db_session)
        await db_session.commit()
        assert await _count(db_session) == 1

        _record(db_session, event_type="should.vanish")
        await db_session.rollback()

        assert await _count(db_session) == 1

    async def test_writer_rejects_bad_input(self, db_session):
        with pytest.raises(ValueError):
            record_outbox_event(db_session, event_type="", payload={})
        with pytest.raises(ValueError):
            record_outbox_event(db_session, event_type="x.y", payload=None)


class TestClaimOutboxEvent:
    async def test_two_claimants_one_winner(self, db_session):
        event = _record(db_session)
        await db_session.commit()

        winner = await claim_outbox_event(db_session)
        assert winner is not None
        assert winner.id == event.id
        assert winner.status == "claimed"
        assert winner.attempts == 1
        await db_session.commit()

        # Second claimant on a SEPARATE session (separate connection, same
        # file — simulates a second relay worker) gets nothing: the guarded
        # UPDATE ... WHERE status='pending' is the atomic gate.
        factory = async_sessionmaker(db_session.bind, expire_on_commit=False)
        async with factory() as session_b:
            loser = await claim_outbox_event(session_b)
            assert loser is None
            await session_b.rollback()

        # And the first session can't claim it twice either.
        assert await claim_outbox_event(db_session) is None

    async def test_claim_skips_not_due_and_exhausted(self, db_session):
        from datetime import timedelta

        _record(db_session, next_attempt_at=datetime.now(UTC) + timedelta(hours=1))
        future_event = _record(db_session, event_type="other.event")
        future_event.attempts = 5  # at max_attempts default → not claimable
        await db_session.commit()

        assert await claim_outbox_event(db_session) is None

    async def test_claim_empty_table_returns_none(self, db_session):
        assert await claim_outbox_event(db_session) is None


class TestPublishDueEvents:
    async def test_relay_marks_published_with_stub(self, db_session):
        _record(db_session)
        _record(db_session, event_type="document.created")
        await db_session.commit()

        seen = []

        def _stub_publisher(event):
            seen.append(event.id)

        result = await publish_due_events(db_session, publisher=_stub_publisher, enabled=True)

        assert result == {"status": "ok", "published": 2, "retried": 0, "failed": 0}
        assert len(seen) == 2
        assert await _count(db_session, "published") == 2
        assert await _count(db_session, "pending") == 0

    async def test_relay_supports_async_publisher(self, db_session):
        _record(db_session)
        await db_session.commit()

        async def _async_publisher(event):
            return {"broker": "ack", "id": str(event.id)}

        result = await publish_due_events(db_session, publisher=_async_publisher, enabled=True)
        assert result["published"] == 1
        assert await _count(db_session, "published") == 1

    async def test_relay_failure_retries_with_backoff(self, db_session):
        event = _record(db_session)
        await db_session.commit()
        before = datetime.now(UTC)

        def _boom(_event):
            raise RuntimeError("broker down")

        result = await publish_due_events(
            db_session, publisher=_boom, enabled=True,
            max_attempts=3, retry_delay_seconds=60,
        )

        assert result == {"status": "ok", "published": 0, "retried": 1, "failed": 0}
        row = await db_session.get(OutboxEvent, event.id)
        assert row.status == "pending"  # re-queued, not stuck in claimed
        assert row.attempts == 1
        assert row.next_attempt_at is not None and row.next_attempt_at > before
        assert "broker down" in (row.last_error or "")

    async def test_relay_failure_exhausts_to_failed(self, db_session):
        event = _record(db_session)
        await db_session.commit()

        def _boom(_event):
            raise RuntimeError("broker down forever")

        result = await publish_due_events(
            db_session, publisher=_boom, enabled=True, max_attempts=1,
        )

        assert result == {"status": "ok", "published": 0, "retried": 0, "failed": 1}
        row = await db_session.get(OutboxEvent, event.id)
        assert row.status == "failed"
        assert "broker down forever" in (row.last_error or "")

    async def test_relay_default_off_noops(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "outbox_relay_enabled", False)
        _record(db_session)
        await db_session.commit()

        result = await publish_due_events(db_session)

        assert result["status"] == "disabled"
        assert await _count(db_session, "pending") == 1


class TestRequeueFailedEvents:
    async def _fail_one(self, db_session):
        event = _record(db_session)
        await db_session.commit()

        def _boom(_event):
            raise RuntimeError("poison")

        await publish_due_events(db_session, publisher=_boom, enabled=True, max_attempts=1)
        assert await _count(db_session, "failed") == 1
        return event

    async def test_requeue_moves_failed_to_pending(self, db_session):
        event = await self._fail_one(db_session)
        n = await requeue_failed_events(db_session, [event.id])
        assert n == 1
        row = await db_session.get(OutboxEvent, event.id)
        assert row.status == "pending"
        assert row.attempts == 0
        assert row.next_attempt_at is None
        assert row.last_error is None

    async def test_requeue_ignores_non_failed(self, db_session):
        event = _record(db_session)
        await db_session.commit()
        n = await requeue_failed_events(db_session, [event.id])
        assert n == 0
        assert (await db_session.get(OutboxEvent, event.id)).status == "pending"

    async def test_requeue_empty_is_noop(self, db_session):
        assert await requeue_failed_events(db_session, []) == 0

    async def test_requeued_row_is_claimable_again(self, db_session):
        event = await self._fail_one(db_session)
        await requeue_failed_events(db_session, [event.id])
        claimed = await claim_outbox_event(db_session)
        assert claimed is not None and claimed.id == event.id


class TestPublishEventFromOutbox:
    async def test_adapter_delivers_parsed_fields(self, monkeypatch):
        import api.services.event_service as ev_mod

        seen = {}

        async def _fake_dispatch(event_id, event_type, workspace_id, payload, correlation_id=None):
            seen.update(event_id=event_id, event_type=event_type,
                        workspace_id=workspace_id, payload=payload)

        monkeypatch.setattr(ev_mod, "dispatch_event_workflow", _fake_dispatch)
        row = SimpleNamespace_for_adapter(
            payload={"event_id": "e-1", "event_type": "document.created",
                     "workspace_id": "w-1", "payload": {"k": "v"}},
        )
        await ev_mod.publish_event_from_outbox(row)
        assert seen == {"event_id": "e-1", "event_type": "document.created",
                        "workspace_id": "w-1", "payload": {"k": "v"}}

    async def test_adapter_noop_on_bad_payload(self):
        import api.services.event_service as ev_mod

        await ev_mod.publish_event_from_outbox(SimpleNamespace_for_adapter(payload=None))
        await ev_mod.publish_event_from_outbox(SimpleNamespace_for_adapter(payload="nope"))

    async def test_relay_end_to_end_with_real_publisher(self, db_session, monkeypatch):
        import api.services.event_service as ev_mod

        delivered = []

        async def _fake_dispatch(event_id, event_type, workspace_id, payload, correlation_id=None):
            delivered.append(event_id)

        monkeypatch.setattr(ev_mod, "dispatch_event_workflow", _fake_dispatch)
        event = _record(db_session, event_type="event.document.created",
                        payload={"event_id": "e-9", "event_type": "document.created",
                                 "workspace_id": None, "payload": {}})
        await db_session.commit()
        result = await publish_due_events(
            db_session, publisher=ev_mod.publish_event_from_outbox, enabled=True)
        assert result["published"] == 1
        assert delivered == ["e-9"]
        assert await _count(db_session, "published") == 1


class TestEventPublishMirrorsOutbox:
    async def test_publish_writes_outbox_same_txn(self, db_session):
        from types import SimpleNamespace

        import api.services.event_service as ev_mod
        dto = SimpleNamespace(type="note.created", source="test", category="note",
                              correlation_id=None, payload={}, priority="normal")
        event = await ev_mod.event_service.publish(dto, user_id=None, db=db_session)
        assert event.id is not None
        rows = (await db_session.execute(
            select(OutboxEvent).where(OutboxEvent.event_type == "event.note.created")
        )).scalars().all()
        assert len(rows) == 1
        assert rows[0].payload["event_id"] == str(event.id)
