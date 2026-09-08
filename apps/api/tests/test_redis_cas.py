"""RedisStateStore CAS matrix against a LIVE Redis broker.

Skips (never passes vacuously) when no live Redis is reachable. Covers:
match / mismatch / concurrent writers / stale writer / malformed stored
state / missing state / retry-after-conflict. Terminal/cancellation
preservation rides on the store-level guarantee (stale writers cannot
overwrite), proven at merge level by test_state_durability hermetic tests.
"""
import os
import uuid

import pytest

from api.orchestrator.state_store import ConcurrentUpdateError, RedisStateStore

pytestmark = pytest.mark.asyncio


def _live_redis_url() -> str | None:
    candidates: list[str] = []
    for env_key in ("REDIS_URL", "REDIS__URL"):
        val = os.environ.get(env_key)
        if val:
            candidates.append(val)
    candidates.append("redis://localhost:6379/0")
    staging_pw = os.environ.get("STAGING_REDIS_PASSWORD", "change-me-staging-redis-32chars-min")
    candidates.append(f"redis://:{staging_pw}@localhost:6380/0")
    import redis as _redis

    for url in candidates:
        try:
            client = _redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
            client.ping()
            client.close()
            return url
        except Exception:
            continue
    return None


def _new_store(url: str) -> RedisStateStore:
    import redis.asyncio as _aioredis

    client = _aioredis.from_url(url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
    return RedisStateStore(redis_client=client, ttl_seconds=120)


def _rid() -> str:
    return f"cas-test-{uuid.uuid4().hex[:12]}"


async def _close(store: RedisStateStore) -> None:
    try:
        await store.delete(_rid())  # no-op safeguard; real cleanup below
    except Exception:
        pass
    try:
        await store.redis.aclose()
    except Exception:
        pass


class TestRedisCasLive:
    async def test_save_without_expected_bumps(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        store = _new_store(url)
        rid = _rid()
        try:
            v1 = await store.save(rid, {"state_version": 1, "phase": "a"})
            assert v1 == 2
            loaded = await store.load(rid)
            assert loaded is not None and loaded["state_version"] == 2
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_expected_match_writes(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        store = _new_store(url)
        rid = _rid()
        try:
            v1 = await store.save(rid, {"state_version": 1})
            assert v1 == 2
            v2 = await store.save(rid, {"state_version": 2, "phase": "b"}, expected_version=2)
            assert v2 == 3
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_expected_mismatch_raises_and_preserves(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        store = _new_store(url)
        rid = _rid()
        try:
            await store.save(rid, {"state_version": 1, "marker": "winner"})
            with pytest.raises(ConcurrentUpdateError):
                await store.save(rid, {"state_version": 1, "marker": "stale"}, expected_version=1)
            loaded = await store.load(rid)
            assert loaded is not None and loaded.get("marker") == "winner"
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_two_concurrent_writers_one_winner(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        import asyncio as _asyncio

        store = _new_store(url)
        rid = _rid()
        try:
            await store.save(rid, {"state_version": 1})
            results: list[str] = []

            async def _writer(tag: str):
                try:
                    await store.save(rid, {"state_version": 2, "tag": tag}, expected_version=2)
                    results.append(f"{tag}-won")
                except ConcurrentUpdateError:
                    results.append(f"{tag}-lost")

            await _asyncio.gather(*(_writer(f"w{i}") for i in range(8)))
            assert len([r for r in results if r.endswith("-won")]) == 1
            assert len([r for r in results if r.endswith("-lost")]) == 7
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_retry_after_conflict_succeeds(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        store = _new_store(url)
        rid = _rid()
        try:
            await store.save(rid, {"state_version": 1})
            await store.save(rid, {"state_version": 2, "v": "fresh"}, expected_version=2)
            with pytest.raises(ConcurrentUpdateError):
                await store.save(rid, {"state_version": 2, "v": "stale"}, expected_version=2)
            v = await store.save(rid, {"state_version": 3, "v": "retry"}, expected_version=3)
            assert v == 4
            assert (await store.load(rid))["v"] == "retry"
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_malformed_stored_state_refuses_overwrite(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        store = _new_store(url)
        rid = _rid()
        try:
            await store.redis.set(store._key(rid), "not-json{{{", ex=120)
            with pytest.raises(ConcurrentUpdateError):
                await store.save(rid, {"state_version": 9}, expected_version=9)
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_missing_state_with_expected_writes(self):
        """Parity with Memory/File/DB backends: missing key + expected writes."""
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        store = _new_store(url)
        rid = _rid()
        try:
            v = await store.save(rid, {"state_version": 4}, expected_version=4)
            assert v == 5
        finally:
            await store.delete(rid)
            await _close(store)

    async def test_sync_client_also_enforces_cas(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        import redis as _redis

        sync_client = _redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
        store = RedisStateStore(redis_client=sync_client, ttl_seconds=120)
        rid = _rid()
        try:
            v1 = await store.save(rid, {"state_version": 1})
            assert v1 == 2
            with pytest.raises(ConcurrentUpdateError):
                await store.save(rid, {"state_version": 1}, expected_version=1)
        finally:
            try:
                await store.delete(rid)
            except Exception:
                pass
            try:
                sync_client.close()
            except Exception:
                pass
