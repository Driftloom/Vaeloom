import asyncio

import pytest

from backend.infrastructure.agent_fallback import (
    CacheEntry,
    CachedFallback,
    FallbackPolicy,
    ModelDowngradeFallback,
    PrimaryWithFallback,
    Result,
    RetryWithBackoff,
)


class AlwaysSucceed:
    async def execute(self, input, context=None):
        return "success"


class AlwaysFail:
    async def execute(self, input, context=None):
        raise RuntimeError("always fails")


class AsyncPolicy:
    def __init__(self, fail_count=0):
        self.calls = 0
        self.fail_count = fail_count

    async def execute(self, input, context=None):
        self.calls += 1
        if self.calls <= self.fail_count:
            raise RuntimeError(f"fail {self.calls}")
        return f"result-{self.calls}"


class TestPrimaryWithFallback:
    @pytest.mark.asyncio
    async def test_primary_succeeds(self):
        policy = PrimaryWithFallback(AlwaysSucceed(), AlwaysFail())
        result = await policy.execute("test")
        assert result.success is True
        assert result.data == "success"
        assert result.metadata["used_fallback"] is False

    @pytest.mark.asyncio
    async def test_fallback_on_primary_failure(self):
        policy = PrimaryWithFallback(AlwaysFail(), AlwaysSucceed())
        result = await policy.execute("test")
        assert result.success is True
        assert result.data == "success"
        assert result.metadata["used_fallback"] is True

    @pytest.mark.asyncio
    async def test_both_fail(self):
        policy = PrimaryWithFallback(AlwaysFail(), AlwaysFail())
        result = await policy.execute("test")
        assert result.success is False
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_fallback_receives_input(self):
        class CaptureInput:
            def __init__(self):
                self.received = None

            async def execute(self, input, context=None):
                self.received = input
                return input

        fallback = CaptureInput()
        policy = PrimaryWithFallback(AlwaysFail(), fallback)
        result = await policy.execute("hello")
        assert result.success is True
        assert fallback.received == "hello"

    @pytest.mark.asyncio
    async def test_fallback_receives_context(self):
        class CaptureContext:
            def __init__(self):
                self.received = None

            async def execute(self, input, context=None):
                self.received = context
                return input

        fallback = CaptureContext()
        policy = PrimaryWithFallback(AlwaysFail(), fallback)
        ctx = {"key": "value"}
        await policy.execute("test", context=ctx)
        assert fallback.received == ctx


class TestRetryWithBackoff:
    @pytest.mark.asyncio
    async def test_succeeds_without_retry(self):
        retry = RetryWithBackoff(max_retries=3)

        async def policy(input, context=None):
            return "ok"

        result = await retry.execute("test", context={"policy": policy})
        assert result.success is True
        assert result.data == "ok"
        assert result.metadata["attempts"] == 1
        assert result.metadata["retried"] is False

    @pytest.mark.asyncio
    async def test_retries_on_failure_then_succeeds(self):
        retry = RetryWithBackoff(max_retries=3, base_delay=0.01)
        state = {"count": 0}

        async def policy(input, context=None):
            state["count"] += 1
            if state["count"] < 3:
                raise RuntimeError(f"try {state['count']}")
            return "ok"

        result = await retry.execute("test", context={"policy": policy})
        assert result.success is True
        assert result.data == "ok"
        assert state["count"] == 3
        assert result.metadata["retried"] is True

    @pytest.mark.asyncio
    async def test_exhausts_retries(self):
        retry = RetryWithBackoff(max_retries=2, base_delay=0.01)

        async def policy(input, context=None):
            raise RuntimeError("persistent failure")

        result = await retry.execute("test", context={"policy": policy})
        assert result.success is False
        assert result.metadata["attempts"] == 3

    @pytest.mark.asyncio
    async def test_without_policy_in_context(self):
        retry = RetryWithBackoff(max_retries=1, base_delay=0.01)
        result = await retry.execute("direct_input")
        assert result.success is True
        assert result.data == "direct_input"

    @pytest.mark.asyncio
    async def test_backoff_delay_increases(self):
        retry = RetryWithBackoff(max_retries=3, base_delay=0.1, max_delay=1.0)
        state = {"count": 0}

        async def policy(input, context=None):
            state["count"] += 1
            raise RuntimeError("fail")

        start = asyncio.get_event_loop().time()
        await retry.execute("test", context={"policy": policy})
        elapsed = asyncio.get_event_loop().time() - start
        assert elapsed >= 0.1


class TestCachedFallback:
    @pytest.mark.asyncio
    async def test_returns_cached_on_failure(self):
        cache = CachedFallback(cache_ttl=-1)

        async def policy(input, context=None):
            return "fresh"

        result = await cache.execute("test", context={"policy": policy})
        assert result.success is True
        assert result.metadata["source"] == "fresh"

        cache._cache[str(hash("test"))] = CacheEntry(
            data="stale_data",
            expires_at=0,
        )

        async def failing_policy(input, context=None):
            raise RuntimeError("fail")

        result = await cache.execute("test", context={"policy": failing_policy})
        assert result.success is True
        assert result.data == "stale_data"
        assert result.metadata["source"] == "stale_cache"

    @pytest.mark.asyncio
    async def test_stale_cache_ignored(self):
        cache = CachedFallback(cache_ttl=0)

        async def policy(input, context=None):
            return "fresh"

        result = await cache.execute("test", context={"policy": policy})
        assert result.metadata["source"] == "fresh"

    @pytest.mark.asyncio
    async def test_no_policy_passthrough(self):
        cache = CachedFallback(cache_ttl=300)
        result = await cache.execute("test")
        assert result.success is True
        assert result.data == "test"
        assert result.metadata["source"] == "passthrough"

    @pytest.mark.asyncio
    async def test_cache_key_based_on_input(self):
        cache = CachedFallback(cache_ttl=300)

        async def policy(input, context=None):
            return f"result-{input}"

        r1 = await cache.execute("a", context={"policy": policy})
        assert r1.data == "result-a"

        r2 = await cache.execute("a", context={"policy": policy})
        assert r2.metadata["source"] == "cache"
        assert r2.data == "result-a"

        r3 = await cache.execute("b", context={"policy": policy})
        assert r3.data == "result-b"
        assert r3.metadata["source"] == "fresh"


class TestModelDowngradeFallback:
    @pytest.mark.asyncio
    async def test_primary_model_succeeds(self):
        downgrade = ModelDowngradeFallback()

        async def policy(input, context=None):
            assert context["model"] == "claude-3-5-sonnet-20241022"
            return "ok"

        result = await downgrade.execute("test", context={"policy": policy})
        assert result.success is True
        assert result.data == "ok"
        assert result.metadata["downgraded"] is False

    @pytest.mark.asyncio
    async def test_downgrades_on_failure(self):
        downgrade = ModelDowngradeFallback()

        call_log = []

        async def policy(input, context=None):
            call_log.append(context["model"])
            if context["model"] == "claude-3-5-sonnet-20241022":
                raise RuntimeError("primary failed")
            return f"ok-with-{context['model']}"

        result = await downgrade.execute("test", context={"policy": policy})
        assert result.success is True
        assert result.data == "ok-with-claude-3-haiku-20240307"
        assert call_log == ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"]
        assert result.metadata["downgraded"] is True

    @pytest.mark.asyncio
    async def test_both_models_fail(self):
        downgrade = ModelDowngradeFallback()

        async def policy(input, context=None):
            raise RuntimeError(f"{context['model']} failed")

        result = await downgrade.execute("test", context={"policy": policy})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_custom_model_names(self):
        downgrade = ModelDowngradeFallback(
            primary_model="gpt-4", fallback_model="gpt-3.5-turbo",
        )

        async def policy(input, context=None):
            assert context["model"] == "gpt-4"
            return "ok"

        result = await downgrade.execute("test", context={"policy": policy})
        assert result.success is True
        assert result.metadata["model_used"] == "gpt-4"

    @pytest.mark.asyncio
    async def test_uses_context_model_override(self):
        downgrade = ModelDowngradeFallback()

        async def policy(input, context=None):
            return f"used-{context['model']}"

        result = await downgrade.execute("test", context={"policy": policy, "model": "custom-model"})
        assert result.data == "used-custom-model"
        assert result.metadata["model_used"] == "custom-model"

    @pytest.mark.asyncio
    async def test_no_policy_passthrough(self):
        downgrade = ModelDowngradeFallback()
        result = await downgrade.execute("test")
        assert result.success is True
        assert result.data == "test"
