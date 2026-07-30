import asyncio
import time

import pytest

from backend.infrastructure.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState


class TestCircuitBreaker:
    def test_initial_state_is_closed(self):
        cb = CircuitBreaker()
        assert cb.get_state() == CircuitState.CLOSED

    def test_reset_restores_closed_state(self):
        cb = CircuitBreaker(failure_threshold=1)
        cb._failure_count = 10
        cb._state = CircuitState.OPEN
        cb.reset()
        assert cb.get_state() == CircuitState.CLOSED
        assert cb._failure_count == 0

    @pytest.mark.asyncio
    async def test_successful_call_stays_closed(self):
        cb = CircuitBreaker()

        async def success():
            return "ok"

        result = await cb.call(success())
        assert result == "ok"
        assert cb.get_state() == CircuitState.CLOSED
        assert cb._failure_count == 0

    @pytest.mark.asyncio
    async def test_failures_open_circuit(self):
        cb = CircuitBreaker(failure_threshold=3)

        async def fail():
            raise ValueError("boom")

        for _ in range(3):
            with pytest.raises(ValueError):
                await cb.call(fail())

        assert cb.get_state() == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_open_circuit_raises_error(self):
        cb = CircuitBreaker(failure_threshold=1)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())

        with pytest.raises(CircuitBreakerOpenError):
            await cb.call(fail())

    @pytest.mark.asyncio
    async def test_open_circuit_uses_fallback(self):
        cb = CircuitBreaker(failure_threshold=1)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())

        result = await cb.call(fail(), fallback="cached_result")
        assert result == "cached_result"

    @pytest.mark.asyncio
    async def test_open_circuit_uses_callable_fallback(self):
        cb = CircuitBreaker(failure_threshold=1)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())

        result = await cb.call(fail(), fallback=lambda: "computed_fallback")
        assert result == "computed_fallback"

    @pytest.mark.asyncio
    async def test_half_open_recovers_on_success(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())
        assert cb.get_state() == CircuitState.OPEN

        await asyncio.sleep(0.06)

        async def success():
            return "recovered"

        result = await cb.call(success())
        assert result == "recovered"
        assert cb.get_state() == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_half_open_failure_reopens(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())
        assert cb.get_state() == CircuitState.OPEN

        await asyncio.sleep(0.06)

        with pytest.raises(ValueError):
            await cb.call(fail())
        assert cb.get_state() == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_half_open_limits_concurrent_calls(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05, half_open_max_calls=2)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())

        await asyncio.sleep(0.06)

        start_event = asyncio.Event()

        async def waiter():
            await start_event.wait()
            await asyncio.sleep(0.2)
            return "ok"

        t1 = asyncio.create_task(cb.call(waiter()))
        t2 = asyncio.create_task(cb.call(waiter()))
        t3 = asyncio.create_task(cb.call(waiter(), fallback="rejected"))

        start_event.set()
        results = await asyncio.gather(t1, t2, t3, return_exceptions=True)
        assert results[0] == "ok"
        assert results[1] == "ok"
        assert results[2] == "rejected" or isinstance(results[2], CircuitBreakerOpenError)

    @pytest.mark.asyncio
    async def test_success_resets_failure_count(self):
        cb = CircuitBreaker(failure_threshold=3)

        async def fail():
            raise ValueError("boom")

        async def success():
            return "ok"

        for _ in range(2):
            with pytest.raises(ValueError):
                await cb.call(fail())
        assert cb._failure_count == 2

        await cb.call(success())
        assert cb._failure_count == 0
        assert cb.get_state() == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_concurrent_safe_calls(self):
        cb = CircuitBreaker(failure_threshold=5)

        async def fail():
            raise ValueError("boom")

        tasks = [cb.call(fail()) for _ in range(5)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        assert all(isinstance(r, ValueError) for r in results)
        assert cb.get_state() == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_named_circuit_breaker(self):
        cb = CircuitBreaker(name="test-agent", failure_threshold=2)
        assert cb._name == "test-agent"

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())
        assert cb._failure_count == 1

        with pytest.raises(ValueError):
            await cb.call(fail())
        assert cb.get_state() == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_recovery_timeout_not_elapsed_stays_open(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())
        assert cb.get_state() == CircuitState.OPEN

        with pytest.raises(CircuitBreakerOpenError):
            await cb.call(fail())

    @pytest.mark.asyncio
    async def test_fallback_callable_with_half_open_open_after_failure(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05, half_open_max_calls=1)

        async def fail():
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail())

        await asyncio.sleep(0.06)

        async def fail_again():
            raise RuntimeError("still broken")

        with pytest.raises(RuntimeError):
            await cb.call(fail_again())

        result = await cb.call(fail_again(), fallback="saved")
        assert result == "saved"
