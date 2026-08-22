"""
BullMQ-compatible queue worker for the AI service.

Reads jobs from the same Redis queues that BullMQ (Node.js) writes to,
processes event jobs and agent execution jobs, and feeds them into the
orchestrator for agent execution.

Durable scheduling (ADR-033): this worker also consumes the `schedules`
queue where the background daemon enqueues claimed cron slots:
  - schedule.agent_run — execute an AgentSchedule slot
  - schedule.job_run   — execute a raw scheduled_jobs HTTP/event job
  - daemon.watcher     — daily proactive scans (gmail / calendar / job_finder)
Failed jobs retry with exponential backoff (maxAttempts from the job hash).
Run standalone: python -m api.workers.queue_worker
"""

import asyncio
import contextlib
import json
import logging
import os
import signal
import time
import uuid
from collections.abc import Callable, Coroutine
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)

_JOB_PREFIX = "bull:"


class BullMQWorker:
    """Minimal BullMQ-compatible worker that reads jobs from Redis."""

    def __init__(
        self,
        queue_name: str,
        redis_url: str | None = None,
        concurrency: int = 5,
        poll_interval: float = 1.0,
    ):
        self.queue_name = queue_name
        self.redis_url = redis_url or os.getenv("REDIS__URL", "redis://localhost:6379/0")
        self.concurrency = concurrency
        self.poll_interval = poll_interval
        self._redis: redis.Redis | None = None
        self._running = False
        self._semaphore: asyncio.Semaphore | None = None
        self._handlers: dict[str, Callable[..., Coroutine]] = {}
        self._active_tasks: set[asyncio.Task] = set()

    @property
    def _wait_key(self) -> str:
        return f"{_JOB_PREFIX}{self.queue_name}:wait"

    @property
    def _active_key(self) -> str:
        return f"{_JOB_PREFIX}{self.queue_name}:active"

    @property
    def _completed_key(self) -> str:
        return f"{_JOB_PREFIX}{self.queue_name}:completed"

    @property
    def _failed_key(self) -> str:
        return f"{_JOB_PREFIX}{self.queue_name}:failed"

    @property
    def _delayed_key(self) -> str:
        return f"{_JOB_PREFIX}{self.queue_name}:delayed"

    def _job_key(self, job_id: str) -> str:
        return f"{_JOB_PREFIX}{self.queue_name}:{job_id}"

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    def register(self, job_type: str, handler: Callable[..., Coroutine]) -> None:
        """Register a handler for a specific job type (e.g. 'event.publish')."""
        self._handlers[job_type] = handler

    async def start(self) -> None:
        """Start the worker loop."""
        r = await self._get_redis()
        self._running = True
        self._semaphore = asyncio.Semaphore(self.concurrency)
        logger.info(
            "BullMQ worker started for queue '%s' (concurrency=%d)",
            self.queue_name,
            self.concurrency,
        )

        while self._running:
            try:
                await self._promote_delayed(r)
                result = await r.blpop(self._wait_key, timeout=self.poll_interval)
                if result is None:
                    continue

                _key, job_id = result

                async with self._semaphore:
                    task = asyncio.create_task(self._process_job(job_id))
                    self._active_tasks.add(task)
                    task.add_done_callback(self._active_tasks.discard)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in worker loop")

        await self._drain()

    async def _promote_delayed(self, r: redis.Redis) -> None:
        """Move due retry jobs from the delayed zset back onto the wait list.

        zrem is the atomic gate — concurrent workers can't double-promote.
        """
        try:
            now_ms = int(time.time() * 1000)
            due = await r.zrangebyscore(self._delayed_key, "-inf", now_ms, start=0, num=20)
            for job_id in due:
                removed = await r.zrem(self._delayed_key, job_id)
                if removed:
                    await r.lpush(self._wait_key, job_id)
                    logger.info("Retry promoted to wait queue: %s", job_id)
        except Exception:
            logger.debug("Delayed promotion poll failed", exc_info=True)

    async def _process_job(self, job_id: str) -> None:
        """Fetch, process, and finalize a single job (with retry/backoff)."""
        r = await self._get_redis()
        job_key = self._job_key(job_id)
        job_data: dict[str, Any] = {}

        try:
            raw = await r.hgetall(job_key)
            if not raw:
                logger.warning("Job %s not found in Redis", job_id)
                return

            job_data = {
                k: json.loads(v) if isinstance(v, str) and v.startswith(("{", "[")) else v
                for k, v in raw.items()
            }
            job_name = job_data.get("name", "")
            data = job_data.get("data", {})

            logger.info("Processing job %s (%s)", job_id, job_name)

            handler = self._handlers.get(job_name)
            if handler is None:
                logger.warning("No handler registered for job type '%s'", job_name)
                await r.hset(job_key, "failedReason", f"No handler for '{job_name}'")
                await r.zadd(self._failed_key, {job_id: 0})
                return

            result = await handler(data)

            await r.zadd(self._completed_key, {job_id: float(job_data.get("timestamp", 0) or 0)})
            await r.hset(job_key, mapping={"returnvalue": json.dumps(result)})

            logger.info("Job %s completed successfully", job_id)

        except Exception:
            logger.exception("Job %s failed", job_id)
            # Retry with exponential backoff until maxAttempts, then dead-letter
            try:
                attempts = int(job_data.get("attempts", 0) or 0)
            except Exception:
                attempts = 0
            try:
                max_attempts = int(job_data.get("maxAttempts", 3) or 3)
            except Exception:
                max_attempts = 3
            attempts += 1
            if attempts < max_attempts:
                backoff_ms = min(300_000, (2 ** attempts) * 5_000)
                await r.hset(job_key, mapping={"attempts": str(attempts)})
                await r.zadd(self._delayed_key, {job_id: int(time.time() * 1000) + backoff_ms})
                logger.warning(
                    "Job %s attempt %d/%d failed — retrying in %dms",
                    job_id, attempts, max_attempts, backoff_ms,
                )
            else:
                await r.hset(job_key, mapping={
                    "attempts": str(attempts),
                    "failedReason": f"Failed after {attempts} attempts",
                })
                await r.zadd(self._failed_key, {job_id: attempts})
                logger.error("Job %s dead-lettered after %d attempts", job_id, attempts)

    async def _drain(self) -> None:
        """Wait for active tasks to finish on shutdown."""
        if self._active_tasks:
            logger.info("Draining %d active tasks...", len(self._active_tasks))
            await asyncio.gather(*self._active_tasks, return_exceptions=True)

    async def stop(self) -> None:
        """Gracefully stop the worker."""
        self._running = False
        if self._redis:
            await self._redis.close()
            self._redis = None
        logger.info("BullMQ worker stopped")


# ── Wiring ─────────────────────────────────────────────────────────────────────


async def handle_event_publish(data: dict[str, Any]) -> dict[str, Any]:
    """Handle 'event.publish' jobs from the API events queue."""
    from api.orchestrator.router import UserRequest, handle

    event_type = data.get("type", "unknown")
    payload = data.get("payload", {})

    logger.info("Event publish: type=%s tenant=%s", event_type, data.get("tenantId"))

    if event_type == "agent.execute":
        request = UserRequest(
            request_id=str(uuid.uuid4()),
            message=payload.get("message", ""),
            workspace_id=payload.get("workspaceId", "default"),
        )
        result = await handle(request)
        return {"status": "processed", "agent_result": result}

    return {"status": "acknowledged", "event_type": event_type}


async def handle_subscription_create(data: dict[str, Any]) -> dict[str, Any]:
    """Handle 'subscription.create' jobs."""
    logger.info("Subscription create: type=%s handler=%s", data.get("eventType"), data.get("handlerId"))
    return {"status": "registered", "event_type": data.get("eventType")}


# ── Durable scheduling handlers (ADR-033) ─────────────────────────────────────


async def handle_schedule_agent_run(data: dict[str, Any]) -> dict[str, Any]:
    """Execute a claimed AgentSchedule slot enqueued by the background daemon.

    Raises on failure so BullMQWorker retries with backoff.
    """
    from api.infrastructure.background_daemon import execute_agent_schedule_job

    schedule_id = data.get("schedule_id", "")
    agent_id = data.get("agent_id", "")
    if not schedule_id or not agent_id:
        return {"status": "skipped", "reason": "missing schedule_id/agent_id"}

    result = await execute_agent_schedule_job(schedule_id, agent_id, data.get("input") or {})
    if result.get("status") == "failed":
        raise RuntimeError(result.get("error") or f"agent schedule {schedule_id} execution failed")
    logger.info(
        "schedule.agent_run %s done (catchup=%s)", schedule_id, bool(data.get("catchup"))
    )
    return result


async def handle_schedule_job_run(data: dict[str, Any]) -> dict[str, Any]:
    """Execute a claimed scheduled_jobs row (HTTP/event) enqueued by the daemon."""
    from datetime import UTC, datetime

    from api.database import async_session_factory
    from api.infrastructure.background_daemon import (
        _record_job_execution,
        execute_scheduled_job_row,
    )

    job_id = str(data.get("id", ""))
    result = await execute_scheduled_job_row(data)
    try:
        async with async_session_factory() as db:
            await _record_job_execution(db, job_id, result["status"], result["error"], datetime.now(UTC))
            await db.commit()
    except Exception:
        logger.debug("job_executions record failed for %s (non-fatal)", job_id, exc_info=True)
    if result.get("status") == "failed":
        raise RuntimeError(result.get("error") or f"scheduled job {job_id} failed")
    return result


async def handle_daemon_watcher(data: dict[str, Any]) -> dict[str, Any]:
    """Run a daily proactive watcher scan by name (gmail / calendar / job_finder)."""
    from api.infrastructure.background_daemon import WATCHER_REGISTRY

    name = data.get("watcher", "")
    scan = WATCHER_REGISTRY.get(name)
    if scan is None:
        return {"status": "skipped", "reason": f"unknown watcher '{name}'"}
    count = await scan()
    return {"status": "ok", "watcher": name, "workspaces": count}


async def run_worker():
    """Entry point — creates and starts the worker."""
    worker = BullMQWorker(queue_name="events")

    worker.register("event.publish", handle_event_publish)
    worker.register("subscription.create", handle_subscription_create)

    # Durable schedules queue (daemon enqueues claimed cron slots here)
    schedules_worker = BullMQWorker(queue_name="schedules")
    schedules_worker.register("schedule.agent_run", handle_schedule_agent_run)
    schedules_worker.register("schedule.job_run", handle_schedule_job_run)
    schedules_worker.register("daemon.watcher", handle_daemon_watcher)

    loop = asyncio.get_event_loop()

    stop_event = asyncio.Event()

    def _signal_handler():
        logger.info("Shutdown signal received")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, _signal_handler)

    worker_task = asyncio.create_task(worker.start())
    schedules_task = asyncio.create_task(schedules_worker.start())

    await stop_event.wait()
    await worker.stop()
    await schedules_worker.stop()
    worker_task.cancel()
    schedules_task.cancel()
    for t in (worker_task, schedules_task):
        with contextlib.suppress(asyncio.CancelledError):
            await t


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
