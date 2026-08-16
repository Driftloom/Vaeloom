import asyncio
import os

import pytest

from api.infrastructure.agent_limits import (
    AgentRateLimitError,
    AgentRateLimiter,
    TokenBucket,
    rate_limit_agent,
)


class TestTokenBucket:
    @pytest.mark.asyncio
    async def test_acquire_returns_true_when_tokens_available(self):
        bucket = TokenBucket(rate=100, capacity=100)
        assert await bucket.acquire() is True

    @pytest.mark.asyncio
    async def test_acquire_returns_false_when_empty(self):
        bucket = TokenBucket(rate=0, capacity=0)
        assert await bucket.acquire() is False

    @pytest.mark.asyncio
    async def test_release_adds_token(self):
        bucket = TokenBucket(rate=0, capacity=5)
        for _ in range(5):
            await bucket.acquire()
        assert await bucket.acquire() is False
        await bucket.release()
        assert await bucket.acquire() is True

    @pytest.mark.asyncio
    async def test_tokens_refill_over_time(self):
        bucket = TokenBucket(rate=100, capacity=100)
        for _ in range(100):
            await bucket.acquire()
        assert await bucket.acquire() is False
        await asyncio.sleep(0.02)
        assert await bucket.acquire() is True


class TestAgentRateLimiter:
    @pytest.mark.asyncio
    async def test_acquire_and_release(self):
        limiter = AgentRateLimiter(rpm=1000, concurrency=10)
        assert await limiter.acquire("agent-a") is True
        await limiter.release("agent-a")

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self):
        limiter = AgentRateLimiter(rpm=1, concurrency=10)
        assert await limiter.acquire("test-agent") is True
        assert await limiter.acquire("test-agent") is False

    @pytest.mark.asyncio
    async def test_get_available_tokens(self):
        limiter = AgentRateLimiter(rpm=100, concurrency=10)
        tokens = limiter.get_available_tokens("agent-x")
        assert tokens == 100.0

    @pytest.mark.asyncio
    async def test_concurrency_limit(self):
        limiter = AgentRateLimiter(rpm=1000, concurrency=2)

        acquired = []

        async def acquire_and_hold():
            ok = await limiter.acquire("concurrent-agent")
            if ok:
                acquired.append(True)
                await asyncio.sleep(0.3)
                await limiter.release("concurrent-agent")
            return ok

        t1 = asyncio.create_task(acquire_and_hold())
        t2 = asyncio.create_task(acquire_and_hold())
        t3 = asyncio.create_task(acquire_and_hold())

        results = await asyncio.gather(t1, t2, t3, return_exceptions=True)
        success_count = sum(1 for r in results if r is True)
        assert success_count == 2
        assert any(r is False for r in results)

    @pytest.mark.asyncio
    async def test_per_agent_isolation(self):
        limiter = AgentRateLimiter(rpm=1, concurrency=10)
        assert await limiter.acquire("agent-a") is True
        assert await limiter.acquire("agent-a") is False
        assert await limiter.acquire("agent-b") is True
        assert await limiter.acquire("agent-b") is False

    @pytest.mark.asyncio
    async def test_release_restores_concurrency(self):
        limiter = AgentRateLimiter(rpm=1000, concurrency=2)
        assert await limiter.acquire("agent") is True
        assert await limiter.acquire("agent") is True
        assert await limiter.acquire("agent") is False
        await limiter.release("agent")
        assert await limiter.acquire("agent") is True


class TestRateLimitDecorator:
    @pytest.mark.asyncio
    async def test_decorator_passes_through(self):
        calls = []

        @rate_limit_agent(name="test-fn", rpm=1000, concurrency=10)
        async def my_agent(data: str) -> str:
            calls.append(data)
            return f"processed-{data}"

        result = await my_agent("hello")
        assert result == "processed-hello"
        assert calls == ["hello"]

    @pytest.mark.asyncio
    async def test_decorator_rate_limits(self):
        @rate_limit_agent(name="limited-fn", rpm=1, concurrency=10)
        async def my_agent(data: str) -> str:
            return f"ok-{data}"

        result = await my_agent("first")
        assert result == "ok-first"

        with pytest.raises(AgentRateLimitError):
            await my_agent("second")

    @pytest.mark.asyncio
    async def test_decorator_uses_function_name(self):
        @rate_limit_agent(rpm=1000, concurrency=10)
        async def auto_named_agent():
            return "ok"

        result = await auto_named_agent()
        assert result == "ok"

    @pytest.mark.asyncio
    async def test_decorator_releases_on_exception(self):
        @rate_limit_agent(name="error-agent", rpm=1, concurrency=10)
        async def error_agent():
            raise ValueError("oops")

        with pytest.raises(ValueError):
            await error_agent()

        @rate_limit_agent(name="error-agent", rpm=1000, concurrency=10)
        async def retry_agent():
            return "works"

        result = await retry_agent()
        assert result == "works"
