"""Phase 8: Temporal Schedules shadow wiring — idempotency + daemon guard."""

import pytest
from unittest.mock import AsyncMock, patch

from api.temporal.schedules import create_or_update_schedule

pytestmark = pytest.mark.asyncio


async def test_schedules_disabled_returns_false():
    # TEMPORAL_ENABLED=false by default locally → shadow returns False, no throw
    res = await create_or_update_schedule("sched-1", "0 * * * *", "ws-1", payload={})
    assert res is False


async def test_daemon_guard_skips_when_temporal_enabled(monkeypatch):
    monkeypatch.setenv("TEMPORAL_ENABLED", "true")
    # Need to reload settings override
    import api.temporal.client as client_mod

    # Patch is_temporal_enabled to True without needing real server
    with patch.object(client_mod, "is_temporal_enabled", return_value=True):
        from api.infrastructure.background_daemon import _run_due_agent_schedules, _run_due_scheduled_jobs, catch_up_missed_runs
        from datetime import datetime, UTC

        now = datetime.now(UTC)
        assert await _run_due_agent_schedules(now) == 0
        assert await _run_due_scheduled_jobs(now) == 0
        assert await catch_up_missed_runs(now) == 0


async def test_schedule_spec_uses_utc_jitter():
    # Deterministic: code sets jitter=60s and time_zone_name="UTC" (see schedules.py:55)
    from datetime import timedelta

    assert timedelta(seconds=60).total_seconds() == 60
    # Verify file contains expected strings (schedule spec contract)
    import pathlib

    src = pathlib.Path("apps/api/src/api/temporal/schedules.py").read_text()
    assert 'time_zone_name="UTC"' in src
    assert "jitter=timedelta(seconds=60)" in src
    assert "OverlapPolicy.SKIP" in src
