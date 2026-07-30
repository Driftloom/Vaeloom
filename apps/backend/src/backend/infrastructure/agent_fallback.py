import asyncio
import logging
import random
import time
from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol, TypeVar

T = TypeVar("T")
logger = logging.getLogger("vaeloom-backend.infrastructure.agent_fallback")


class FallbackPolicy(Protocol[T]):
    async def execute(self, input: Any, context: dict[str, Any] | None = None) -> T:
        ...


@dataclass
class Result:
    success: bool
    data: Any = None
    error: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class PrimaryWithFallback:
    def __init__(self, policy: FallbackPolicy, fallback: FallbackPolicy):
        self._policy = policy
        self._fallback = fallback

    async def execute(self, input: Any, context: dict[str, Any] | None = None) -> Result:
        try:
            result = await self._policy.execute(input, context)
            return Result(success=True, data=result, metadata={"used_fallback": False})
        except Exception as exc:
            logger.warning("Primary policy failed, running fallback: %s", exc)
            try:
                result = await self._fallback.execute(input, context)
                return Result(
                    success=True,
                    data=result,
                    metadata={"used_fallback": True, "primary_error": str(exc)},
                )
            except Exception as fallback_exc:
                return Result(
                    success=False,
                    error=f"Primary: {exc}, Fallback: {fallback_exc}",
                    metadata={"used_fallback": True},
                )


class RetryWithBackoff:
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 30.0):
        self._max_retries = max_retries
        self._base_delay = base_delay
        self._max_delay = max_delay

    async def execute(self, input: Any, context: dict[str, Any] | None = None) -> Result:
        last_error: Optional[Exception] = None
        for attempt in range(self._max_retries + 1):
            try:
                policy = context.get("policy") if context else None
                if policy is not None:
                    result = await policy(input, context)
                else:
                    result = input
                return Result(
                    success=True,
                    data=result,
                    metadata={"attempts": attempt + 1, "retried": attempt > 0},
                )
            except Exception as exc:
                last_error = exc
                if attempt < self._max_retries:
                    delay = min(self._base_delay * (2 ** attempt), self._max_delay)
                    jitter = random.uniform(0, delay * 0.1)
                    total_delay = delay + jitter
                    logger.warning(
                        "Retry attempt %d/%d failed, retrying in %.2fs: %s",
                        attempt + 1, self._max_retries, total_delay, exc,
                    )
                    await asyncio.sleep(total_delay)

        return Result(
            success=False,
            error=str(last_error),
            metadata={"attempts": self._max_retries + 1, "retried": True},
        )


@dataclass
class CacheEntry:
    data: Any
    expires_at: float


class CachedFallback:
    def __init__(self, cache_ttl: float = 300.0):
        self._cache: dict[str, CacheEntry] = {}
        self._cache_ttl = cache_ttl

    async def execute(self, input: Any, context: dict[str, Any] | None = None) -> Result:
        cache_key = str(hash(str(input)))
        now = time.monotonic()

        entry = self._cache.get(cache_key)
        if entry and entry.expires_at > now:
            return Result(
                success=True,
                data=entry.data,
                metadata={"source": "cache", "cache_key": cache_key},
            )

        policy = context.get("policy") if context else None
        if policy is not None:
            try:
                result = await policy(input, context)
                self._cache[cache_key] = CacheEntry(data=result, expires_at=now + self._cache_ttl)
                return Result(
                    success=True,
                    data=result,
                    metadata={"source": "fresh", "cache_key": cache_key},
                )
            except Exception as exc:
                entry = self._cache.get(cache_key)
                if entry:
                    return Result(
                        success=True,
                        data=entry.data,
                        metadata={"source": "stale_cache", "cache_key": cache_key, "error": str(exc)},
                    )
                return Result(success=False, error=str(exc), metadata={"source": "error"})
        else:
            return Result(success=True, data=input, metadata={"source": "passthrough"})


class ModelDowngradeFallback:
    def __init__(self, primary_model: str = "claude-3-5-sonnet-20241022", fallback_model: str = "claude-3-haiku-20240307"):
        self._primary_model = primary_model
        self._fallback_model = fallback_model

    async def execute(self, input: Any, context: dict[str, Any] | None = None) -> Result:
        ctx = context or {}
        model_to_use = ctx.get("model", self._primary_model)
        policy = ctx.get("policy")

        if policy is not None:
            try:
                run_context = {**ctx, "model": model_to_use}
                result = await policy(input, run_context)
                return Result(
                    success=True,
                    data=result,
                    metadata={"model_used": model_to_use, "downgraded": model_to_use != self._primary_model},
                )
            except Exception as exc:
                if model_to_use == self._primary_model:
                    logger.warning("Primary model failed, downgrading to %s: %s", self._fallback_model, exc)
                    try:
                        run_context = {**ctx, "model": self._fallback_model}
                        result = await policy(input, run_context)
                        return Result(
                            success=True,
                            data=result,
                            metadata={"model_used": self._fallback_model, "downgraded": True},
                        )
                    except Exception as fallback_exc:
                        return Result(success=False, error=str(fallback_exc), metadata={"downgraded": True})
                return Result(success=False, error=str(exc), metadata={"downgraded": True})
        else:
            return Result(success=True, data=input, metadata={"model_used": model_to_use, "downgraded": False})
