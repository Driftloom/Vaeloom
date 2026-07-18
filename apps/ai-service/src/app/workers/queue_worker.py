"""
BullMQ-compatible queue worker for the AI service.

Reads jobs from the same Redis queues that BullMQ (Node.js) writes to,
processes event jobs and agent execution jobs, and feeds them into the
orchestrator for agent execution.
"""

import asyncio
import json
import logging
import os
import signal
import uuid
from typing import Any, Callable, Coroutine

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

    async def _process_job(self, job_id: str) -> None:
        """Fetch, process, and finalize a single job."""
        r = await self._get_redis()
        job_key = self._job_key(job_id)

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
                await r.sadd(self._failed_key, job_id)
                await r.hset(job_key, "failedReason", f"No handler for '{job_name}'")
                return

            result = await handler(data)

            await r.zadd(self._completed_key, {job_id: job_data.get("timestamp", 0)})
            await r.hset(job_key, "returnvalue", json.dumps(result))

            logger.info("Job %s completed successfully", job_id)

        except Exception:
            logger.exception("Job %s failed", job_id)
            await r.zadd(self._failed_key, {job_id: 0})
            await r.hset(job_key, "failedReason", "Worker processing error")

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
    from app.orchestrator.router import handle, UserRequest

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


async def run_worker():
    """Entry point — creates and starts the worker."""
    worker = BullMQWorker(queue_name="events")

    worker.register("event.publish", handle_event_publish)
    worker.register("subscription.create", handle_subscription_create)

    loop = asyncio.get_event_loop()

    stop_event = asyncio.Event()

    def _signal_handler():
        logger.info("Shutdown signal received")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass

    worker_task = asyncio.create_task(worker.start())

    await stop_event.wait()
    await worker.stop()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
