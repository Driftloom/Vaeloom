import asyncio
import enum
import logging
import time
from typing import Any

logger = logging.getLogger("vaeloom-api.infrastructure.circuit_breaker")


class CircuitState(enum.Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
        name: str = "default",
        redis_client: Any | None = None,
    ):
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._half_open_max_calls = half_open_max_calls
        self._name = name
        self._redis_client = redis_client

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    def get_state(self) -> CircuitState:
        return self._state

    def reset(self) -> None:
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._half_open_calls = 0
        self._last_failure_time = 0.0
        logger.info("Circuit breaker '%s' manually reset to CLOSED", self._name)
        if self._redis_client:
            try:
                res = self._redis_client.delete(f"cb:{self._name}:state", f"cb:{self._name}:failures")
                if asyncio.iscoroutine(res):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(res)
                    except RuntimeError:
                        pass
            except Exception:
                pass

    async def call(self, coro, fallback: Any | None = None) -> Any:
        # Check distributed state if redis_client is configured
        if self._redis_client and self._state == CircuitState.CLOSED:
            try:
                r_state = self._redis_client.get(f"cb:{self._name}:state")
                if asyncio.iscoroutine(r_state):
                    r_state = await r_state
                if isinstance(r_state, bytes):
                    r_state = r_state.decode("utf-8")
                if r_state == CircuitState.OPEN.value:
                    self._state = CircuitState.OPEN
                    self._last_failure_time = time.monotonic()
            except Exception:
                pass

        async with self._lock:
            if self._state == CircuitState.OPEN:
                if time.monotonic() - self._last_failure_time >= self._recovery_timeout:
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    logger.info("Circuit breaker '%s' transitioning to HALF_OPEN", self._name)
                else:
                    logger.warning("Circuit breaker '%s' is OPEN, returning fallback", self._name)
                    if fallback is not None:
                        return fallback() if callable(fallback) else fallback
                    raise CircuitBreakerOpenError(f"Circuit breaker '{self._name}' is OPEN")

            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self._half_open_max_calls:
                    logger.warning("Circuit breaker '%s' HALF_OPEN at max calls, returning fallback", self._name)
                    if fallback is not None:
                        return fallback() if callable(fallback) else fallback
                    raise CircuitBreakerOpenError(f"Circuit breaker '{self._name}' is HALF_OPEN at capacity")
                self._half_open_calls += 1

        try:
            result = await coro
        except Exception:
            async with self._lock:
                self._failure_count += 1
                self._last_failure_time = time.monotonic()
                if self._failure_count >= self._failure_threshold:
                    self._state = CircuitState.OPEN
                    logger.error(
                        "Circuit breaker '%s' OPEN after %d failures",
                        self._name, self._failure_count,
                    )
                    if self._redis_client:
                        try:
                            res = self._redis_client.set(
                                f"cb:{self._name}:state",
                                CircuitState.OPEN.value,
                                ex=int(self._recovery_timeout),
                            )
                            if asyncio.iscoroutine(res):
                                await res
                        except Exception:
                            pass
                if self._state == CircuitState.HALF_OPEN:
                    self._state = CircuitState.OPEN
                    logger.warning(
                        "Circuit breaker '%s' HALF_OPEN call failed, back to OPEN",
                        self._name,
                    )
                    if self._redis_client:
                        try:
                            res = self._redis_client.set(
                                f"cb:{self._name}:state",
                                CircuitState.OPEN.value,
                                ex=int(self._recovery_timeout),
                            )
                            if asyncio.iscoroutine(res):
                                await res
                        except Exception:
                            pass
            if fallback is not None:
                return fallback() if callable(fallback) else fallback
            raise

        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                self._half_open_calls = 0
                logger.info("Circuit breaker '%s' recovered to CLOSED", self._name)
                if self._redis_client:
                    try:
                        res = self._redis_client.delete(f"cb:{self._name}:state", f"cb:{self._name}:failures")
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception:
                        pass
            else:
                self._failure_count = 0

        return result


class CircuitBreakerOpenError(Exception):
    pass
