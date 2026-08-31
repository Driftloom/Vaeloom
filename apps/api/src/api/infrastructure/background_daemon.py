"""
Background Daemon — proactive cron + watcher workers.

Runs as an asyncio background task started from FastAPI lifespan.
Replaces the prior "CRUD-only" scheduler_service/trigger_job mock.

Features:
- AgentSchedule cron poller (agent_schedules table, evaluated every 60s)
- Daily 06:00 UTC Gmail Watcher (GmailAgent inbox scan)
- Daily 08:00 UTC Calendar Conflict Monitor (SchedulerAgent)
- Nightly 02:00 UTC Job Finder (JobSearchAgent)
- Raw scheduled_jobs poller (scheduled_jobs table, for scheduler service)

Durability (ADR-033): when Redis is available the daemon is an ENQUEUER, not an
executor — due schedules are atomically claimed (SETNX dedup key per slot) and
pushed to a BullMQ-compatible `schedules` queue for the dedicated queue worker
(api.workers.queue_worker). This makes execution multi-instance safe and
survives API restarts. When Redis is unavailable (local dev / tests) it falls
back to inline execution exactly like the pre-ADR behavior.

All jobs are tenant-isolated and approval-gated where needed.
Failures are logged but do not crash the daemon loop.
"""
import asyncio
import contextlib
import logging
import os
import time
import uuid as uuid_mod
from datetime import UTC, datetime, timedelta
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)

# ── Durable queue constants ─────────────────────────────────────────

SCHEDULES_QUEUE = "schedules"
CLAIM_TTL_SECONDS = 120          # dedup claim per slot; expires so a crashed enqueuer self-heals
REDIS_CACHE_SECONDS = 30.0       # how long a failed Redis probe stays cached
MAX_CATCHUP_MINUTES = 24 * 60    # bounded missed-run catch-up window on startup

# ── Prod strictness: fail-closed when Redis unavailable in non-local ──────
def _durable_required() -> bool:
    """True in staging/prod (non-local) — inline degraded would risk double-run without dedup."""
    try:
        return getattr(settings, "service_environment", "local") != "local"
    except Exception:
        return False


def _degraded_inline_allowed() -> bool:
    return not _durable_required()


# ── Redis helpers (best-effort; None → inline degraded mode) ────────

_redis_cached: Any = False       # client | False (failed) | client object
_redis_cache_ts: float = 0.0


def get_daemon_redis() -> Any | None:
    """Return a cached Redis client or None when Redis is unavailable.

    Failure results are cached briefly so a down Redis doesn't add latency
    to every 60s tick.
    """
    global _redis_cached, _redis_cache_ts
    now_ts = time.monotonic()
    if _redis_cached is not None and (now_ts - _redis_cache_ts) < REDIS_CACHE_SECONDS:
        return _redis_cached if _redis_cached is not False else None
    url = os.environ.get("REDIS__URL") or getattr(settings, "redis__url", "") or ""
    client = None
    if url:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
        except Exception as e:
            logger.debug(f"DAEMON Redis client init failed ({e}) — inline mode")
            client = None
    _redis_cached = client if client is not None else False
    _redis_cache_ts = now_ts
    return client


async def claim_slot(r: Any, dedup_key: str) -> bool:
    """Atomically claim a schedule slot across instances. True → we own this run."""
    try:
        created = await r.set(f"vaeloom:daemon:claim:{dedup_key}", "1", nx=True, ex=CLAIM_TTL_SECONDS)
        return bool(created)
    except Exception as e:
        logger.debug(f"DAEMON claim failed for {dedup_key} ({e}) — treating as unclaimed")
        return False


async def enqueue_daemon_job(r: Any, name: str, data: dict[str, Any], max_attempts: int = 3) -> bool:
    """Push a BullMQ-compatible job onto the durable schedules queue."""
    job_id = uuid_mod.uuid4().hex
    base = f"bull:{SCHEDULES_QUEUE}"
    try:
        await r.hset(f"{base}:{job_id}", mapping={
            "name": name,
            "data": __import__("json").dumps(data),
            "timestamp": str(int(time.time() * 1000)),
            "attempts": "0",
            "maxAttempts": str(max_attempts),
        })
        await r.expire(f"{base}:{job_id}", 86400)
        await r.lpush(f"{base}:wait", job_id)
        logger.info(f"DAEMON enqueued {name} job {job_id} (queue={SCHEDULES_QUEUE})")
        return True
    except Exception as e:
        logger.warning(f"DAEMON enqueue failed for {name} ({e})")
        return False

# ── Cron matching ───────────────────────────────────────────────────

def _is_cron_due(cron: str, now: datetime) -> bool:
    """Return True if cron expression is due at `now` (minute precision).

    Tries croniter first; falls back to simple 5-field matching for common cases.
    """
    cron = cron.strip()
    # Quick path: every-minute / common presets
    if cron == "* * * * *":
        return True
    if cron == "0 * * * *":
        return now.minute == 0
    if cron == "0 0 * * *":
        return now.hour == 0 and now.minute == 0
    if cron == "0 6 * * *":
        return now.hour == 6 and now.minute == 0
    if cron == "0 8 * * *":
        return now.hour == 8 and now.minute == 0
    if cron == "0 2 * * *":
        return now.hour == 2 and now.minute == 0
    # Try croniter if installed
    try:
        from croniter import croniter
        # croniter gives next run *after* base; check if previous run was within last 60s
        base = now.replace(second=0, microsecond=0)
        itr = croniter(cron, base - __import__("datetime").timedelta(minutes=1, seconds=1))
        nxt = itr.get_next(datetime)
        # Due if next occurrence equals current minute
        return abs((nxt - base).total_seconds()) < 60
    except ImportError:
        # croniter not available — log once and use fallback
        logger.debug("croniter not installed, using fallback cron matcher for '%s'", cron)
        return _simple_cron_match(cron, now)
    except Exception as e:
        logger.warning(f"Cron parse failed for '{cron}': {e}")
        return False


def _simple_cron_match(cron: str, now: datetime) -> bool:
    """Very small 5-field matcher for standard cron."""
    try:
        parts = cron.split()
        if len(parts) != 5:
            return False
        minute, hour, dom, month, dow = parts

        def _field_matches(field: str, value: int) -> bool:
            if field == "*":
                return True
            if field.startswith("*/"):
                step = int(field[2:])
                return value % step == 0
            # Comma-separated lists
            for token in field.split(","):
                if "-" in token:
                    lo, hi = token.split("-", 1)
                    if int(lo) <= value <= int(hi):
                        return True
                elif token.isdigit() and int(token) == value:
                    return True
            return False

        return (
            _field_matches(minute, now.minute)
            and _field_matches(hour, now.hour)
            and _field_matches(dom, now.day)
            and _field_matches(month, now.month)
            # dow: 0=Sunday, but Python Monday=0 — approximate
            and _field_matches(dow, (now.weekday() + 1) % 7)
        )
    except Exception:
        return False


# ── Extracted executors (shared by daemon inline mode + queue worker) ──


async def execute_agent_schedule_job(schedule_id: str, agent_id: str, input_data: dict[str, Any] | None) -> dict[str, Any]:
    """Execute one agent schedule. Runs in the queue worker (durable mode) or
    inline (degraded mode). Marks last_run_at on success or failure attempt."""
    from uuid import UUID

    from api.database import async_session_factory
    from api.models.schema import AgentSchedule
    from api.schemas.agent import AgentExecute
    from api.services.agent_service import agent_service

    async with async_session_factory() as db:
        dto = AgentExecute(input=input_data or {}, stream=False)
        try:
            result = await agent_service.execute_agent(db, UUID(agent_id), dto, tenant_id=None, user_id=None)
            status = "success"
            error = None
        except Exception as e:
            result = None
            status = "failed"
            error = str(e)[:500]
            logger.warning(f"DAEMON agent_schedule {schedule_id} execution failed: {e}")
        # Record the run regardless — retry logic lives in the worker, not slot claims
        try:
            sched = await db.get(AgentSchedule, UUID(schedule_id))
            if sched:
                sched.last_run_at = datetime.now(UTC)
            await db.commit()
        except Exception:
            with contextlib.suppress(Exception):
                await db.rollback()
        summary = ""
        if isinstance(result, dict):
            summary = str(result.get("final_result") or result.get("result", {}).get("summary", ""))[:500] if isinstance(result.get("result"), dict) else str(result.get("final_result", ""))[:500]
        return {"status": status, "error": error, "summary": summary}


async def execute_scheduled_job_row(job: dict[str, Any]) -> dict[str, Any]:
    """Execute one raw scheduled_jobs row (HTTP/event). Returns {status, error}."""
    job_type = job.get("type", "")
    url = job.get("url")
    event_name = job.get("event")
    payload = job.get("payload") or {}
    method = job.get("method")
    headers = job.get("headers")
    exec_status = "success"
    exec_error = None
    try:
        if job_type == "http" and url:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                req_method = (method or "POST").upper()
                hdrs = headers if isinstance(headers, dict) else {}
                resp = await client.request(req_method, url, json=payload, headers=hdrs)
                exec_status = "success" if resp.status_code < 400 else "failed"
                if resp.status_code >= 400:
                    exec_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
        elif job_type == "event" and event_name:
            from api.services.event_service import event_service
            await event_service.publish(event_type=event_name, payload=payload, tenant_id=job.get("tenant_id"))
        else:
            # Unknown type — just mark as triggered (backwards compat)
            exec_status = "success"
    except Exception as exec_e:
        exec_status = "failed"
        exec_error = str(exec_e)[:500]
        logger.warning(f"DAEMON scheduled_job {job.get('id')} execution failed: {exec_e}")
    return {"status": exec_status, "error": exec_error}


# ── AgentSchedule poller ────────────────────────────────────────────

async def _run_due_agent_schedules(now: datetime) -> int:
    """Check agent_schedules and trigger any due jobs.

    Durable mode (Redis): atomically claim the slot then enqueue for the worker.
    Degraded mode (no Redis): execute inline (single-instance behavior).
    Returns count triggered.
    """
    # Temporal shadow guard (§18): when Temporal schedules are enabled, daemon skips
    # agent_schedules polling to avoid double-fire. Guard is fail-open (returns 0, logs).
    try:
        from ..temporal.client import is_temporal_enabled

        if is_temporal_enabled():
            logger.debug("DAEMON _run_due_agent_schedules skipped — temporal schedules enabled")
            return 0
    except Exception:
        pass
    triggered = 0
    r = get_daemon_redis()
    try:
        from sqlalchemy import select

        from api.database import async_session_factory
        from api.models.schema import AgentSchedule

        async with async_session_factory() as db:
            result = await db.execute(select(AgentSchedule).where(AgentSchedule.enabled == True))  # noqa: E712
            schedules = result.scalars().all()
            for sched in schedules:
                try:
                    if not _is_cron_due(sched.cron, now):
                        continue
                    logger.info(f"DAEMON: agent_schedule due {sched.id} cron='{sched.cron}' agent={sched.agent_id}")
                    dedup_key = f"agent_sched:{sched.id}:{now.strftime('%Y%m%d%H%M')}"
                    data = {
                        "schedule_id": str(sched.id),
                        "agent_id": str(sched.agent_id),
                        "input": sched.input or {},
                    }
                    ran = False
                    if r is not None:
                        if await claim_slot(r, dedup_key):
                            if await enqueue_daemon_job(r, "schedule.agent_run", data):
                                ran = True
                            else:
                                # Enqueue failed after claim — release so a later tick can retry
                                with contextlib.suppress(Exception):
                                    await r.delete(f"vaeloom:daemon:claim:{dedup_key}")
                    else:
                        if _degraded_inline_allowed():
                            # Degraded inline mode (local/dev/tests) — execute directly
                            await execute_agent_schedule_job(str(sched.id), str(sched.agent_id), sched.input or {})
                            ran = True
                        else:
                            logger.error(
                                f"DAEMON durable required but Redis unavailable — skipping agent_schedule {sched.id} (prod fail-closed). "
                                "Deploy queue-worker with REDIS__URL or set service_environment=local for degraded mode."
                            )
                            continue
                    if ran:
                        # Track last_run_at immediately at enqueue time too (worker re-stamps post-run)
                        try:
                            sched.last_run_at = now
                            await db.commit()
                        except Exception:
                            with contextlib.suppress(Exception):
                                await db.rollback()
                        triggered += 1
                except Exception as e:
                    logger.warning(f"DAEMON agent_schedule {sched.id} trigger failed: {e}")
                    with contextlib.suppress(Exception):
                        await db.rollback()
            return triggered
    except Exception as e:
        logger.warning(f"DAEMON agent_schedules poll failed: {e}")
        return 0


async def _record_job_execution(db: Any, job_id: str, exec_status: str, exec_error: str | None, now: datetime) -> None:
    """Record a job_executions row — full schema with minimal fallback for SQLite/test."""
    try:
        import uuid as _uuid

        from sqlalchemy import text
        await db.execute(
            text("INSERT INTO job_executions (id, job_id, status, started_at, finished_at, status_code, error, created_at) VALUES (:id, :job_id, :status, :started, :finished, :code, :err, :now)"),  # nosec B608
            {
                "id": str(_uuid.uuid4()),
                "job_id": str(job_id),
                "status": exec_status,
                "started": now,
                "finished": datetime.now(UTC),
                "code": 200 if exec_status == "success" else 500,
                "err": exec_error,
                "now": now,
            },
        )
    except Exception as e_full:
        # Fallback for SQLite/test where job_executions has minimal cols (id, job_id, status, created_at)
        try:
            import uuid as _uuid2

            from sqlalchemy import text
            await db.execute(
                text("INSERT INTO job_executions (id, job_id, status, created_at) VALUES (:id, :job_id, :status, :now)"),  # nosec B608
                {
                    "id": str(_uuid2.uuid4()),
                    "job_id": str(job_id),
                    "status": exec_status,
                    "now": now,
                },
            )
        except Exception as e_min:
            logger.debug(f"job_executions insert failed (both schemas): full={e_full} minimal={e_min}")


async def _run_due_scheduled_jobs(now: datetime) -> int:
    """Raw scheduled_jobs table poller — claim + enqueue (durable) or execute inline."""
    try:
        from ..temporal.client import is_temporal_enabled

        if is_temporal_enabled():
            logger.debug("DAEMON _run_due_scheduled_jobs skipped — temporal schedules enabled")
            return 0
    except Exception:
        pass
    r = get_daemon_redis()
    triggered = 0
    try:
        from sqlalchemy import text

        from api.database import async_session_factory

        async with async_session_factory() as db:
            result = await db.execute(text("SELECT id, cron, payload, tenant_id, type, method, url, event, headers FROM scheduled_jobs WHERE status = 'active'"))  # nosec B608
            rows = result.fetchall()
            for row in rows:
                job_id, cron, payload, tenant_id, job_type, method, url, event_name, headers = row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]
                try:
                    if not cron or not _is_cron_due(str(cron), now):
                        continue
                    logger.info(f"DAEMON: scheduled_job due {job_id} type={job_type} cron='{cron}' tenant={tenant_id}")
                    job_data = {
                        "id": str(job_id), "type": job_type, "method": method,
                        "url": url, "event": event_name, "payload": payload or {},
                        "headers": headers if isinstance(headers, dict) else {},
                        "tenant_id": tenant_id,
                    }
                    dedup_key = f"sched_job:{job_id}:{now.strftime('%Y%m%d%H%M')}"
                    ran = False
                    if r is not None:
                        if await claim_slot(r, dedup_key):
                            if await enqueue_daemon_job(r, "schedule.job_run", job_data):
                                ran = True
                            else:
                                with contextlib.suppress(Exception):
                                    await r.delete(f"vaeloom:daemon:claim:{dedup_key}")
                    else:
                        if _degraded_inline_allowed():
                            exec_res = await execute_scheduled_job_row(job_data)
                            await _record_job_execution(db, str(job_id), exec_res["status"], exec_res["error"], now)
                            ran = True
                        else:
                            logger.error(
                                f"DAEMON durable required but Redis unavailable — skipping scheduled_job {job_id} (prod fail-closed)"
                            )
                            continue

                    if ran:
                        await db.execute(
                            text("UPDATE scheduled_jobs SET last_run_at = :now, updated_at = :now WHERE id = :id"),  # nosec B608
                            {"now": now, "id": job_id},
                        )
                        await db.commit()
                        triggered += 1
                except Exception as e:
                    logger.warning(f"DAEMON scheduled_job {job_id} trigger failed: {e}")
                    with contextlib.suppress(Exception):
                        await db.rollback()
            return triggered
    except Exception as e:
        logger.debug(f"DAEMON scheduled_jobs poll skipped (table maybe missing): {e}")
        return 0


# ── Proactive watchers (daily) ──────────────────────────────────────
#
# Each watcher = pure scan body (no time gate, reusable by the queue worker)
# + a gated dispatcher that routes through the durable queue when Redis is
# available and falls back to inline execution otherwise.


async def gmail_watcher_scan() -> int:
    """Scan Gmail inboxes for all active workspaces. No time gate — worker-safe."""
    try:
        from sqlalchemy import select

        from api.agents.gmail_agent.handler import GmailAgent
        from api.database import async_session_factory
        from api.models.schema import Workspace

        async with async_session_factory() as db:
            # Tenant-scoped: select workspaces with tenant_id, only those with Gmail connector or recent activity
            rows = await db.execute(select(Workspace.id, Workspace.tenant_id).where(Workspace.tenant_id.is_not(None)).limit(20))
            workspaces = rows.all()
            if not workspaces:
                # Fallback: try without tenant filter for local dev where tenant may be null
                fallback = await db.execute(select(Workspace.id, Workspace.tenant_id).limit(20))
                workspaces = fallback.all()
            count = 0
            for ws_id, tenant_id in workspaces:
                try:
                    agent = GmailAgent(workspace_id=str(ws_id))
                    # Real fetch — GmailClient will return None if not configured, then we classify real emails
                    emails = None
                    try:
                        emails = await agent.fetch_emails(query="newer_than:1d", max_results=20)
                    except Exception as fe:
                        logger.debug(f"DAEMON Gmail fetch ws={ws_id} failed, using fallback: {fe}")
                    if emails:
                        await agent.classify_emails(emails=emails)
                    else:
                        # No real emails or not configured — still run classification with empty to surface no-op
                        await agent.classify_emails(emails=[])
                    count += 1
                except Exception as e:
                    logger.warning(f"DAEMON Gmail watcher ws={ws_id} tenant={tenant_id} failed: {e}")
            if count:
                logger.info(f"DAEMON Gmail watcher ran for {count} workspaces (tenant-scoped)")
            return count
    except Exception as e:
        logger.warning(f"DAEMON Gmail watcher failed: {e}")
        return 0


async def calendar_monitor_scan() -> int:
    """Check calendar conflicts for active workspaces. No time gate — worker-safe."""
    try:
        from sqlalchemy import select

        from api.agents.scheduler_agent.handler import SchedulerAgent
        from api.database import async_session_factory
        from api.models.schema import Workspace

        async with async_session_factory() as db:
            rows = await db.execute(select(Workspace.id, Workspace.tenant_id).where(Workspace.tenant_id.is_not(None)).limit(20))
            workspaces = rows.all()
            if not workspaces:
                fallback = await db.execute(select(Workspace.id, Workspace.tenant_id).limit(20))
                workspaces = fallback.all()
            count = 0
            for ws_id, tenant_id in workspaces:
                try:
                    agent = SchedulerAgent(workspace_id=str(ws_id))
                    # Real fetch — CalendarClient will return None if not configured
                    events = None
                    try:
                        events = await agent.fetch_events(days_ahead=1)
                    except Exception as fe:
                        logger.debug(f"DAEMON calendar fetch ws={ws_id} failed: {fe}")
                    await agent.check_conflicts(events=events or [])
                    count += 1
                except Exception as e:
                    logger.warning(f"DAEMON calendar monitor ws={ws_id} tenant={tenant_id} failed: {e}")
            if count:
                logger.info(f"DAEMON calendar monitor ran for {count} workspaces (tenant-scoped)")
            return count
    except Exception as e:
        logger.warning(f"DAEMON calendar monitor failed: {e}")
        return 0


async def job_finder_scan() -> int:
    """Run JobSearch for active workspaces. No time gate — worker-safe."""
    try:
        from sqlalchemy import select

        from api.agents.job_search_agent.handler import JobSearchAgent
        from api.database import async_session_factory
        from api.models.schema import Workspace

        async with async_session_factory() as db:
            rows = await db.execute(select(Workspace.id, Workspace.tenant_id).where(Workspace.tenant_id.is_not(None)).limit(20))
            workspaces = rows.all()
            if not workspaces:
                fallback = await db.execute(select(Workspace.id, Workspace.tenant_id).limit(20))
                workspaces = fallback.all()
            count = 0
            for ws_id, tenant_id in workspaces:
                try:
                    agent = JobSearchAgent(workspace_id=str(ws_id))
                    # Use tenant-scoped search; keywords could be derived from workspace memory in future
                    await agent.search(keywords=["software", "engineer"], user_skills=[], rejected_job_ids=[])
                    count += 1
                except Exception as e:
                    logger.warning(f"DAEMON job finder ws={ws_id} tenant={tenant_id} failed: {e}")
            if count:
                logger.info(f"DAEMON nightly job finder ran for {count} workspaces (tenant-scoped)")
            return count
    except Exception as e:
        logger.warning(f"DAEMON job finder failed: {e}")
        return 0


# Registry used by the queue worker to execute daemon.watcher jobs by name.
WATCHER_REGISTRY = {
    "gmail": gmail_watcher_scan,
    "calendar": calendar_monitor_scan,
    "job_finder": job_finder_scan,
}


async def reflection_scan_wrapper() -> int:
    """03:00 UTC reflection watcher — nightly memory consolidation (P1, best-effort)."""
    try:
        from .reflection_scheduler import reflection_scan

        return await reflection_scan()
    except Exception as e:
        logger.debug(f"reflection wrapper failed: {e}")
        return 0


WATCHER_REGISTRY["reflection"] = reflection_scan_wrapper


async def _dispatch_daily_watcher(name: str, hour_utc: int, now: datetime) -> int:
    """Gate a daily watcher to its UTC hour, route via durable queue when possible."""
    if not (now.hour == hour_utc and now.minute == 0):
        return 0
    r = get_daemon_redis()
    if r is not None:
        dedup_key = f"watcher:{name}:{now.strftime('%Y%m%d')}"
        if await claim_slot(r, dedup_key):
            if await enqueue_daemon_job(r, "daemon.watcher", {"watcher": name}):
                return 1
            # Enqueue failed after claim → release claim, fall through to inline
            with contextlib.suppress(Exception):
                await r.delete(f"vaeloom:daemon:claim:{dedup_key}")
    if _degraded_inline_allowed():
        scan = WATCHER_REGISTRY.get(name)
        return await scan() if scan else 0
    logger.error(
        f"DAEMON durable required but Redis unavailable — skipping watcher '{name}' (prod fail-closed)"
    )
    return 0


async def _run_gmail_watcher(now: datetime) -> int:
    """06:00 UTC daily: scan Gmail inboxes for deadlines (tenant-scoped, real fetch)."""
    return await _dispatch_daily_watcher("gmail", 6, now)


async def _run_calendar_monitor(now: datetime) -> int:
    """08:00 UTC daily: check calendar conflicts for active workspaces (tenant-scoped, real fetch)."""
    return await _dispatch_daily_watcher("calendar", 8, now)


async def _run_job_finder(now: datetime) -> int:
    """02:00 UTC nightly: run JobSearch for active workspaces (tenant-scoped)."""
    return await _dispatch_daily_watcher("job_finder", 2, now)


async def _run_reflection(now: datetime) -> int:
    """03:00 UTC nightly: memory consolidation + preference learning (P1)."""
    return await _dispatch_daily_watcher("reflection", 3, now)


# ── Missed-run catch-up ─────────────────────────────────────────────

async def catch_up_missed_runs(now: datetime) -> int:
    """On startup, trigger each enabled schedule's most recent missed due slot once.

    Bounded: scans back at most MAX_CATCHUP_MINUTES and fires at most ONE catch-up
    slot per schedule. Uses the same Redis claim keys as normal ticks so concurrent
    instances can't double-fire; falls back to inline execution without Redis.
    """
    try:
        from ..temporal.client import is_temporal_enabled

        if is_temporal_enabled():
            logger.debug("DAEMON catch_up_missed_runs skipped — temporal schedules enabled")
            return 0
    except Exception:
        pass
    triggered = 0
    r = get_daemon_redis()
    try:
        from sqlalchemy import select

        from api.database import async_session_factory
        from api.models.schema import AgentSchedule

        async with async_session_factory() as db:
            result = await db.execute(select(AgentSchedule).where(AgentSchedule.enabled == True))  # noqa: E712
            schedules = result.scalars().all()
            for sched in schedules:
                try:
                    last = sched.last_run_at
                    # SQLite/legacy rows may come back tz-naive — normalize to UTC
                    if last is not None and last.tzinfo is None:
                        last = last.replace(tzinfo=UTC)
                    # Walk back minute-by-minute from the most recent full minute
                    found_slot: datetime | None = None
                    for back in range(1, MAX_CATCHUP_MINUTES + 1):
                        slot = (now - timedelta(minutes=back)).replace(second=0, microsecond=0)
                        if last and slot <= last:
                            break
                        if _is_cron_due(sched.cron, slot):
                            found_slot = slot
                            break  # most recent missed slot only
                    if not found_slot:
                        continue
                    logger.info(
                        f"DAEMON catch-up: schedule {sched.id} missed slot {found_slot.isoformat()} "
                        f"(last_run_at={last.isoformat() if last else 'never'})"
                    )
                    dedup_key = f"agent_sched:{sched.id}:{found_slot.strftime('%Y%m%d%H%M')}:catchup"
                    data = {
                        "schedule_id": str(sched.id),
                        "agent_id": str(sched.agent_id),
                        "input": sched.input or {},
                        "catchup": True,
                        "slot": found_slot.isoformat(),
                    }
                    ran = False
                    if r is not None:
                        if await claim_slot(r, dedup_key):
                            if await enqueue_daemon_job(r, "schedule.agent_run", data):
                                ran = True
                    else:
                        if _degraded_inline_allowed():
                            await execute_agent_schedule_job(str(sched.id), str(sched.agent_id), sched.input or {})
                            ran = True
                        else:
                            logger.error(f"DAEMON catch-up: Redis unavailable in non-local — skipping catch-up for schedule {sched.id} (prod fail-closed)")
                            continue
                    if ran:
                        try:
                            sched.last_run_at = now
                            await db.commit()
                        except Exception:
                            with contextlib.suppress(Exception):
                                await db.rollback()
                        triggered += 1
                except Exception as e:
                    logger.warning(f"DAEMON catch-up for schedule {sched.id} failed: {e}")
                    with contextlib.suppress(Exception):
                        await db.rollback()
        if triggered:
            logger.info(f"DAEMON catch-up triggered {triggered} missed schedule run(s)")
        return triggered
    except Exception as e:
        logger.warning(f"DAEMON catch-up poll failed: {e}")
        return 0


# ── Main daemon loop ────────────────────────────────────────────────

async def _daemon_tick(now: datetime) -> None:
    """One polling iteration — run all due jobs for this minute."""
    try:
        # Use gather to run pollers concurrently, but await all
        results = await asyncio.gather(
            _run_due_agent_schedules(now),
            _run_due_scheduled_jobs(now),
            _run_gmail_watcher(now),
            _run_calendar_monitor(now),
            _run_job_finder(now),
            _run_reflection(now),
            return_exceptions=True,
        )
        # Log exceptions if any poller raised
        for r in results:
            if isinstance(r, Exception):
                logger.warning(f"DAEMON tick sub-task exception: {r}")
    except Exception as e:
        logger.warning(f"DAEMON tick failed: {e}")


async def background_daemon_loop() -> None:
    """Infinite loop — sleeps 60s between ticks, aligned to minute boundary."""
    logger.info("DAEMON background loop started (60s poll, daily watchers at 02/06/08 UTC)")
    # Small startup delay so DB migrations can finish
    await asyncio.sleep(5)
    # Bounded missed-run catch-up (ADR-033) — one-shot, most recent missed slot per schedule
    try:
        await catch_up_missed_runs(datetime.now(UTC))
    except Exception as e:
        logger.warning(f"DAEMON startup catch-up failed (non-fatal): {e}")
    while True:
        try:
            now = datetime.now(UTC)
            # Align to next minute boundary for cron precision
            await _daemon_tick(now)
            # Sleep until next minute + small jitter
            # Compute seconds until next minute
            next_min = (now.replace(second=0, microsecond=0) + __import__("datetime").timedelta(minutes=1))
            sleep_s = max(1, (next_min - now).total_seconds())
            # Cap at 60s even if clock skew
            sleep_s = min(sleep_s, 60)
            await asyncio.sleep(sleep_s)
        except asyncio.CancelledError:
            logger.info("DAEMON background loop cancelled — shutting down")
            raise
        except Exception as e:
            logger.warning(f"DAEMON loop error (will retry in 60s): {e}")
            await asyncio.sleep(60)


_daemon_task: asyncio.Task | None = None


def start_background_daemon() -> asyncio.Task | None:
    """Start the daemon if not already running. Returns the task."""
    global _daemon_task
    if _daemon_task and not _daemon_task.done():
        return _daemon_task
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.warning("DAEMON not started — no running event loop")
        return None
    _daemon_task = loop.create_task(background_daemon_loop(), name="vaeloom-daemon")
    # Log unhandled exceptions
    def _log_done(t: asyncio.Task):
        try:
            exc = t.exception()
            if exc:
                logger.error(f"DAEMON task crashed: {exc}")
        except asyncio.CancelledError:
            pass
    _daemon_task.add_done_callback(_log_done)
    logger.info("DAEMON background task scheduled")
    return _daemon_task


def stop_background_daemon() -> None:
    """Cancel the daemon task if running."""
    global _daemon_task
    if _daemon_task and not _daemon_task.done():
        _daemon_task.cancel()
        logger.info("DAEMON cancellation requested")
    _daemon_task = None
