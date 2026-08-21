import asyncio
import functools
import logging
import os
import time
from collections import defaultdict
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("vaeloom-api.infrastructure.agent_limits")


class TokenBucket:
    def __init__(self, rate: float, capacity: int):
        self._rate = rate
        self._capacity = capacity
        self._tokens = float(capacity)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
            self._last_refill = now
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return True
            return False

    async def release(self) -> None:
        async with self._lock:
            self._tokens = min(self._capacity, self._tokens + 1.0)


class ConcurrencySlot:
    def __init__(self, max_concurrency: int):
        self._max = max_concurrency
        self._current = 0
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self._lock:
            if self._current >= self._max:
                return False
            self._current += 1
            return True

    def release(self) -> None:
        self._current -= 1


class AgentRateLimiter:
    def __init__(
        self,
        rpm: int | None = None,
        concurrency: int | None = None,
    ):
        self._rpm = rpm or int(os.getenv("AGENT_RPM", "30"))
        self._concurrency = concurrency or int(os.getenv("AGENT_CONCURRENCY", "5"))
        self._buckets: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(rate=self._rpm / 60.0, capacity=self._rpm),
        )
        self._slots: dict[str, ConcurrencySlot] = defaultdict(
            lambda: ConcurrencySlot(self._concurrency),
        )

    async def acquire(self, agent_name: str) -> bool:
        bucket = self._buckets[agent_name]
        granted = await bucket.acquire()
        if not granted:
            logger.warning("Rate limit exceeded for agent '%s'", agent_name)
            return False
        slot = self._slots[agent_name]
        acquired = await slot.acquire()
        if not acquired:
            await bucket.release()
            return False
        return True

    async def release(self, agent_name: str) -> None:
        slot = self._slots.get(agent_name)
        if slot:
            slot.release()

    def get_available_tokens(self, agent_name: str) -> float:
        bucket = self._buckets.get(agent_name)
        if bucket is None:
            return float(self._rpm)
        now = time.monotonic()
        elapsed = now - bucket._last_refill
        return min(self._rpm, bucket._tokens + elapsed * (self._rpm / 60.0))


def rate_limit_agent(
    name: str | None = None,
    rpm: int | None = None,
    concurrency: int | None = None,
) -> Callable:
    _limiter = AgentRateLimiter(rpm=rpm, concurrency=concurrency)

    def decorator(func: Callable) -> Callable:
        agent_name = name or func.__name__

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            acquired = await _limiter.acquire(agent_name)
            if not acquired:
                raise AgentRateLimitError(f"Rate limit exceeded for agent '{agent_name}'")
            try:
                return await func(*args, **kwargs)
            finally:
                await _limiter.release(agent_name)

        return wrapper

    return decorator


class AgentRateLimitError(Exception):
    pass
