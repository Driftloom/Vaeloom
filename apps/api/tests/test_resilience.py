"""Resilience tests — verifies circuit breaker, rate limiting, and fallback behavior."""
import asyncio
import time

import pytest

from api.infrastructure.agent_fallback import (
    CacheEntry,
    CachedFallback,
    FallbackPolicy,
    ModelDowngradeFallback,
    PrimaryWithFallback,
    Result,
    RetryWithBackoff,
)
from api.infrastructure.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState
from api.middleware.rate_limit import MemoryBackend


class TestCircuitBreaker:
    """Verify circuit breaker transitions: closed → open → half-open → closed."""

    async def test_circuit_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=10.0)

        async def failing_coro():
            raise RuntimeError("fail")

        for _ in range(3):
            try:
                await cb.call(failing_coro())
            except RuntimeError:
                pass

        assert cb.get_state() == CircuitState.OPEN

    async def test_circuit_rejects_when_open(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=60.0)

        async def failing_coro():
            raise RuntimeError("fail")

        for _ in range(2):
            try:
                await cb.call(failing_coro())
            except RuntimeError:
                pass

        with pytest.raises(CircuitBreakerOpenError):
            await cb.call(failing_coro())

    async def test_circuit_half_open_after_timeout(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        async def failing_coro():
            raise RuntimeError("fail")

        for _ in range(2):
            try:
                await cb.call(failing_coro())
            except RuntimeError:
                pass

        assert cb.get_state() == CircuitState.OPEN
        await asyncio.sleep(0.15)

        async def success_coro():
            return "recovered"

        result = await cb.call(success_coro())
        assert result == "recovered"

    async def test_circuit_resets_on_success(self):
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        async def failing_coro():
            raise RuntimeError("fail")

        for _ in range(2):
            try:
                await cb.call(failing_coro())
            except RuntimeError:
                pass

        await asyncio.sleep(0.15)

        async def success_coro():
            return "ok"

        await cb.call(success_coro())
        assert cb.get_state() == CircuitState.CLOSED

    async def test_circuit_manual_reset(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)

        async def failing_coro():
            raise RuntimeError("fail")

        try:
            await cb.call(failing_coro())
        except RuntimeError:
            pass

        assert cb.get_state() == CircuitState.OPEN
        cb.reset()
        assert cb.get_state() == CircuitState.CLOSED

    async def test_circuit_returns_fallback_when_open(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)

        async def failing_coro():
            raise RuntimeError("fail")

        try:
            await cb.call(failing_coro())
        except RuntimeError:
            pass

        result = await cb.call(failing_coro(), fallback=lambda: "fallback-value")
        assert result == "fallback-value"


class MockPolicy:
    """Mock policy that implements the FallbackPolicy protocol."""
    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    async def execute(self, input, context=None):
        if self._error:
            raise self._error
        return self._result


class TestFallbackPolicies:
    """Verify fallback chain behavior."""

    async def test_primary_success_no_fallback(self):
        policy = MockPolicy(result="primary-result")
        fallback = MockPolicy(result="fallback-result")

        chain = PrimaryWithFallback(policy=policy, fallback=fallback)
        result = await chain.execute("input")
        assert result.success is True
        assert result.data == "primary-result"
        assert result.metadata["used_fallback"] is False

    async def test_fallback_on_primary_failure(self):
        policy = MockPolicy(error=RuntimeError("primary failed"))
        fallback = MockPolicy(result="fallback-result")

        chain = PrimaryWithFallback(policy=policy, fallback=fallback)
        result = await chain.execute("input")
        assert result.success is True
        assert result.data == "fallback-result"
        assert result.metadata["used_fallback"] is True

    async def test_all_failures_returns_error(self):
        policy = MockPolicy(error=RuntimeError("primary failed"))
        fallback = MockPolicy(error=RuntimeError("fallback failed"))

        chain = PrimaryWithFallback(policy=policy, fallback=fallback)
        result = await chain.execute("input")
        assert result.success is False
        assert result.error is not None

    async def test_retry_succeeds_after_transient_failure(self):
        call_count = 0

        async def flaky_policy(input, context=None):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise RuntimeError(f"fail {call_count}")
            return "success"

        policy = RetryWithBackoff(max_retries=3, base_delay=0.01)
        result = await policy.execute("input", context={"policy": flaky_policy})
        assert result.success is True
        assert result.data == "success"
        assert result.metadata["attempts"] == 3


class TestCachedFallback:
    """Verify cache-based fallback behavior."""

    async def test_cache_returns_stale_on_failure(self):
        cache = CachedFallback(cache_ttl=60.0)

        # Cache key is hash(str(input)) — set entry as EXPIRED so it falls through to stale path
        cache_key = str(hash(str("test-input")))
        cache._cache[cache_key] = CacheEntry(data="cached_data", expires_at=time.monotonic() - 1)

        async def failing_policy(input, context=None):
            raise RuntimeError("fail")

        result = await cache.execute("test-input", context={"policy": failing_policy})
        assert result.success is True
        assert result.data == "cached_data"
        assert result.metadata["source"] == "stale_cache"

    async def test_cache_returns_fresh_on_success(self):
        cache = CachedFallback(cache_ttl=60.0)

        async def success_policy(input, context=None):
            return "fresh_data"

        result = await cache.execute("key", context={"policy": success_policy})
        assert result.success is True
        assert result.data == "fresh_data"
        assert result.metadata["source"] == "fresh"


class TestRateLimitMemoryBackend:
    """Verify the MemoryBackend sliding window rate limiter."""

    async def test_allows_within_limit(self):
        backend = MemoryBackend()
        allowed, _ = await backend.check_and_record("client1", max_requests=5, window_seconds=60)
        assert allowed is True

    async def test_blocks_after_limit(self):
        backend = MemoryBackend()
        for _ in range(5):
            await backend.check_and_record("client2", max_requests=5, window_seconds=60)
        allowed, retry_after = await backend.check_and_record("client2", max_requests=5, window_seconds=60)
        assert allowed is False
        assert retry_after > 0

    async def test_different_clients_independent(self):
        backend = MemoryBackend()
        for _ in range(5):
            await backend.check_and_record("clientA", max_requests=3, window_seconds=60)
        allowed_a, _ = await backend.check_and_record("clientA", max_requests=3, window_seconds=60)
        assert allowed_a is False

        allowed_b, _ = await backend.check_and_record("clientB", max_requests=3, window_seconds=60)
        assert allowed_b is True

    async def test_window_expires(self):
        backend = MemoryBackend()
        for _ in range(3):
            await backend.check_and_record("client3", max_requests=3, window_seconds=0)
        await asyncio.sleep(0.01)
        allowed, _ = await backend.check_and_record("client3", max_requests=3, window_seconds=0)
        assert allowed is True
