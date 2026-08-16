import json
import time
from typing import Any


class CacheService:
    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}
        self._redis = None

    async def _ensure_redis(self):
        if self._redis is None:
            try:
                import redis.asyncio as aioredis

                from ..config import settings

                self._redis = aioredis.from_url(
                    settings.redis__url,
                    socket_connect_timeout=2,
                    decode_responses=True,
                )
                await self._redis.ping()
            except Exception:
                self._redis = False

    async def get(self, key: str) -> Any:
        await self._ensure_redis()
        if self._redis:
            val = await self._redis.get(key)
            return json.loads(val) if val else None
        if key in self._store:
            value, expires = self._store[key]
            if expires == 0 or time.time() < expires:
                return value
            del self._store[key]
        return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        await self._ensure_redis()
        if self._redis:
            await self._redis.setex(key, ttl, json.dumps(value))
        else:
            self._store[key] = (value, time.time() + ttl if ttl else 0)

    async def delete(self, key: str) -> None:
        await self._ensure_redis()
        if self._redis:
            await self._redis.delete(key)
        else:
            self._store.pop(key, None)

    async def invalidate(self, pattern: str) -> None:
        await self._ensure_redis()
        if self._redis:
            keys = await self._redis.keys(pattern)
            if keys:
                await self._redis.delete(*keys)
        else:
            import fnmatch

            self._store = {
                k: v
                for k, v in self._store.items()
                if not fnmatch.fnmatch(k, pattern)
            }


cache_service = CacheService()
