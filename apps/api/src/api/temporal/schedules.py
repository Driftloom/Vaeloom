"""Temporal Schedules bridge (ADR-038 Phase 8).

Wraps sdk schedule APIs with workspace-scoped lifecycle:
create / update / pause / resume / delete.

Each agent_schedules / scheduled_jobs row maps to a Temporal Schedule
spec cron + UTC with BUFFER_ONE / SKIP to guarantee idempotency per §7.
Degraded path: when Temporal disabled, caller keeps background_daemon
behavior (no throw — fail-open, existing queue remains).
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _enabled() -> bool:
    try:
        from ..config import settings
        return bool(getattr(settings, "temporal_enabled", False))
    except Exception:
        return False


async def create_or_update_schedule(
    schedule_id: str,
    cron: str,
    workspace_id: str | None,
    payload: dict[str, Any] | None = None,
    task_queue: str | None = None,
) -> bool:
    # T-008: payload size and secret validation
    if payload is not None:
        try:
            from .validation import validate_no_secrets, validate_payload_size
            validate_no_secrets(payload)
            validate_payload_size(payload, label="schedule payload")
        except ValueError as ve:
            import logging
            logging.getLogger(__name__).warning(f"schedule payload rejected for {schedule_id}: {ve}")
            return False
    if not _enabled():
        return False
    try:
        from ..temporal.client import get_temporal_client
        from datetime import timedelta
        try:
            from temporalio.client import Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleState, SchedulePolicy  # type: ignore
            from temporalio.common import RetryPolicy  # type: ignore
        except Exception as e:
            logger.debug(f"schedules: SDK import failed ({e})")
            return False
        client = await get_temporal_client()
        if client is None:
            return False
        from ..temporal.queues import queue_name as _qn

        q = task_queue or _qn("schedules")
        # Minimal cron -> spec translation (croniter already in repo)
        # Temporal ScheduleSpec.cron_expressions takes list of 5-field crons.
        # Timezone explicitly UTC per §19 (never assume server TZ), jitter ±60s per §22
        spec = ScheduleSpec(cron_expressions=[cron], time_zone_name="UTC", jitter=timedelta(seconds=60))
        action = ScheduleActionStartWorkflow(
            "DurableAgentRunWorkflow",
            {"schedule_id": schedule_id, "workspace_id": workspace_id, "payload": payload or {}},
            id=f"sched-{workspace_id or 'global'}-{schedule_id}",
            task_queue=q,
            retry_policy=RetryPolicy(maximum_attempts=3),
            execution_timeout=timedelta(minutes=30),
        )
        sched = Schedule(
            action=action,
            spec=spec,
            state=ScheduleState(note=f"vaeloom schedule {schedule_id}"),
            policy=SchedulePolicy(overlap=SchedulePolicy.OverlapPolicy.SKIP, catchup_window=timedelta(hours=24)),
        )
        # create or update (upsert semantics)
        try:
            await client.create_schedule(f"sched:{workspace_id or 'global'}:{schedule_id}", sched)
            logger.info(f"Temporal schedule created {schedule_id} cron='{cron}'")
        except Exception as ce:
            msg = str(ce)
            if "AlreadyExists" in msg or "already exists" in msg.lower():
                handle = client.get_schedule_handle(f"sched:{workspace_id or 'global'}:{schedule_id}")
                await handle.update(lambda prev: sched)  # type: ignore[arg-type]
                logger.info(f"Temporal schedule updated {schedule_id}")
            else:
                raise
        return True
    except Exception as e:
        logger.warning(f"create_or_update_schedule failed for {schedule_id}: {e}")
        return False


async def delete_schedule(schedule_id: str, workspace_id: str | None) -> bool:
    if not _enabled():
        return False
    try:
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            return False
        handle = client.get_schedule_handle(f"sched:{workspace_id or 'global'}:{schedule_id}")
        await handle.delete()
        return True
    except Exception as e:
        msg = str(e)
        if "NotFound" in msg or "not found" in msg.lower():
            return True
        logger.warning(f"delete_schedule failed for {schedule_id}: {e}")
        return False


async def pause_schedule(schedule_id: str, workspace_id: str | None) -> bool:
    if not _enabled():
        return False
    try:
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            return False
        handle = client.get_schedule_handle(f"sched:{workspace_id or 'global'}:{schedule_id}")
        await handle.pause(note="paused via API")
        return True
    except Exception as e:
        logger.warning(f"pause_schedule failed for {schedule_id}: {e}")
        return False


async def resume_schedule(schedule_id: str, workspace_id: str | None) -> bool:
    if not _enabled():
        return False
    try:
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            return False
        handle = client.get_schedule_handle(f"sched:{workspace_id or 'global'}:{schedule_id}")
        await handle.unpause(note="resumed via API")
        return True
    except Exception as e:
        logger.warning(f"resume_schedule failed for {schedule_id}: {e}")
        return False
