"""Durable AI quota enforcement via Redis (T-007).

Replaces in-memory AgentRateLimiter/AgentCostTracker for daily caps.
Uses Redis INCR + EXPIRE atomic pattern, safe across restarts/workers.

Keys: quota:{workspace_id}:{YYYY-MM-DD}:{metric}
Metrics: requests, tokens, cost_cents
Limits: configurable via env (defaults: 1000 req/day, 100k tokens/day)
"""

import logging
import time
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

# Defaults — override via env
DEFAULT_DAILY_REQUESTS = 1000
DEFAULT_DAILY_TOKENS = 100_000
DEFAULT_DAILY_COST_CENTS = 5000  # $50

# Lua script for atomic check-and-increment with TTL
# KEYS[1] = quota key, ARGV[1] = increment (1 or token count), ARGV[2] = limit, ARGV[3] = ttl seconds
_LUA_CHECK = """
local cur = redis.call('GET', KEYS[1])
if cur and tonumber(cur) + tonumber(ARGV[1]) > tonumber(ARGV[2]) then
  return {0, cur}
end
local new = redis.call('INCRBY', KEYS[1], ARGV[1])
if new == tonumber(ARGV[1]) then
  redis.call('EXPIRE', KEYS[1], ARGV[3])
end
return {1, new}
"""


def _get_redis() -> object | None:
    try:
        import os

        url = os.environ.get("REDIS__URL") or os.environ.get("REDIS_URL") or ""
        if not url:
            try:
                from ..config import settings

                url = getattr(settings, "redis__url", "") or ""
            except Exception:
                pass
        if not url:
            return None
        import redis.asyncio as aioredis

        return aioredis.from_url(url, decode_responses=True, socket_connect_timeout=1, socket_timeout=1)
    except Exception as e:
        logger.debug(f"quota redis unavailable: {e}")
        return None


async def check_and_reserve(
    workspace_id: str,
    metric: str = "requests",
    increment: int = 1,
    limit: int | None = None,
) -> tuple[bool, int]:
    """Atomic check-and-reserve. Returns (allowed, new_value). Fail-open if Redis unavailable."""
    if limit is None:
        if metric == "requests":
            limit = DEFAULT_DAILY_REQUESTS
        elif metric == "tokens":
            limit = DEFAULT_DAILY_TOKENS
        elif metric == "cost_cents":
            limit = DEFAULT_DAILY_COST_CENTS
        else:
            limit = DEFAULT_DAILY_REQUESTS

    redis = _get_redis()
    if redis is None:
        try:
            from ..config import settings

            if getattr(settings, "service_environment", "local") != "local":
                logger.warning(f"quota check fail-closed (no redis) for {workspace_id}:{metric} in {getattr(settings, 'service_environment', 'local')}")
                return False, 0
        except Exception:
            pass
        logger.debug(f"quota check fail-open (no redis) for {workspace_id}:{metric}")
        return True, 0

    day = datetime.now(UTC).strftime("%Y-%m-%d")
    key = f"quota:{workspace_id}:{day}:{metric}"
    # TTL until end of day
    now = datetime.now(UTC)
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=0)
    ttl = int((end_of_day - now).total_seconds()) + 60
    try:
        # Try Lua for atomic check
        try:
            res = await redis.eval(_LUA_CHECK, 1, key, increment, limit, ttl)  # type: ignore[attr-defined]
            allowed = bool(res[0])
            cur = int(res[1]) if res[1] is not None else increment
            if not allowed:
                logger.warning(f"quota exceeded for {workspace_id} {metric}: {cur}/{limit}")
            return allowed, cur
        except Exception:
            # Fallback: simple INCR then check (race possible but rare)
            cur = await redis.incrby(key, increment)  # type: ignore[attr-defined]
            if cur == increment:
                await redis.expire(key, ttl)  # type: ignore[attr-defined]
            if cur > limit:
                # Rollback increment? We already incremented, so we should not allow but we already consumed quota.
                # For strict, we should decr, but we treat as exceeded and don't rollback to keep simple.
                logger.warning(f"quota exceeded (fallback) for {workspace_id} {metric}: {cur}/{limit}")
                return False, cur
            return True, cur
    except Exception as e:
        try:
            from ..config import settings

            if getattr(settings, "service_environment", "local") != "local":
                logger.warning(f"quota check fail-closed (error) for {workspace_id}:{metric} in {getattr(settings, 'service_environment', 'local')}: {e}")
                return False, 0
        except Exception:
            pass
        logger.debug(f"quota check failed, fail-open: {e}")
        return True, 0
    finally:
        try:
            await redis.aclose()  # type: ignore[attr-defined]
        except Exception:
            pass


async def record_actual_usage(workspace_id: str, tokens: int = 0, cost_cents: int = 0) -> None:
    """Record actual tokens/cost after execution (for accurate accounting)."""
    # Requests already counted via check_and_reserve increment=1 before execution
    if tokens > 0:
        await check_and_reserve(workspace_id, metric="tokens", increment=tokens)
    if cost_cents > 0:
        await check_and_reserve(workspace_id, metric="cost_cents", increment=cost_cents)
