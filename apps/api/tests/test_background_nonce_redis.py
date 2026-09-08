"""Background envelope nonce replay: memory semantics + live Redis cross-worker proof.

Hermetic tests force the process-local backend (no Redis). Live tests use a
real Redis broker when reachable and SKIP otherwise — never mocked, never
fakeredis-as-live. See docs/audits/muse-final-production-gate.md.
"""
import os

import pytest

from api.infrastructure.background_envelope import (
    averify_background_envelope,
    create_background_envelope,
    nonce_backend_status,
    reset_nonce_cache,
    verify_background_envelope,
)

pytestmark = pytest.mark.asyncio


def _live_redis_url() -> str | None:
    """Return a reachable live Redis URL, or None (caller must skip)."""
    candidates: list[str] = []
    for env_key in ("REDIS_URL", "REDIS__URL"):
        val = os.environ.get(env_key)
        if val:
            candidates.append(val)
    candidates.append("redis://localhost:6379/0")  # dev broker (no auth)
    # Isolated staging default from .env.staging.example (disposable staging only).
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


def _env(ttl=60):
    return create_background_envelope("t1", "w1", "u1", "agent-1", "sync_job", ttl_seconds=ttl)


@pytest.fixture(autouse=True)
def _clean():
    reset_nonce_cache()
    yield
    reset_nonce_cache()


class TestMemorySemantics:
    async def test_first_true_replay_false(self, monkeypatch):
        import api.infrastructure.background_envelope as mod

        monkeypatch.setattr(mod, "_get_default_nonce_redis", lambda: None)
        env = _env()
        ok, _, _ = verify_background_envelope(dict(env))
        assert ok is True
        ok2, reason2, _ = verify_background_envelope(dict(env))
        assert ok2 is False and "replay" in reason2

    async def test_check_replay_false_allows_reverify(self, monkeypatch):
        import api.infrastructure.background_envelope as mod

        monkeypatch.setattr(mod, "_get_default_nonce_redis", lambda: None)
        env = _env()
        assert verify_background_envelope(dict(env))[0] is True
        assert verify_background_envelope(dict(env), check_replay=False)[0] is True

    async def test_tampered_rejected(self, monkeypatch):
        import api.infrastructure.background_envelope as mod

        monkeypatch.setattr(mod, "_get_default_nonce_redis", lambda: None)
        env = _env()
        bad = dict(env)
        bad["workspace_id"] = "attacker-ws"
        ok, reason, _ = verify_background_envelope(bad)
        assert ok is False and "signature" in reason

    async def test_expired_rejected(self, monkeypatch):
        import api.infrastructure.background_envelope as mod

        monkeypatch.setattr(mod, "_get_default_nonce_redis", lambda: None)
        env = _env(ttl=-10)
        ok, reason, _ = verify_background_envelope(dict(env))
        assert ok is False and "expired" in reason

    async def test_missing_field_rejected(self, monkeypatch):
        import api.infrastructure.background_envelope as mod

        monkeypatch.setattr(mod, "_get_default_nonce_redis", lambda: None)
        env = _env()
        bad = dict(env)
        del bad["nonce"]
        ok, reason, _ = verify_background_envelope(bad)
        assert ok is False and "nonce" in reason

    async def test_backend_status_memory_when_no_redis(self, monkeypatch):
        import api.infrastructure.background_envelope as mod

        monkeypatch.setattr(mod, "_get_default_nonce_redis", lambda: None)
        assert nonce_backend_status() == "memory"


class TestLiveRedis:
    async def test_cross_worker_replay_rejected(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        import redis as _redis

        worker_a = _redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        worker_b = _redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        try:
            env = _env(ttl=120)
            ok_a, _, _ = verify_background_envelope(dict(env), redis_client=worker_a)
            assert ok_a is True
            ok_b, reason_b, _ = verify_background_envelope(dict(env), redis_client=worker_b)
            assert ok_b is False and "replay" in reason_b
        finally:
            worker_a.close()
            worker_b.close()

    async def test_concurrent_20_exactly_one_winner(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        import concurrent.futures as _fut

        import redis as _redis

        env = _env(ttl=120)

        def _attempt(_i: int) -> bool:
            client = _redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
            try:
                ok, _, _ = verify_background_envelope(dict(env), redis_client=client)
                return ok
            finally:
                try:
                    client.close()
                except Exception:
                    pass

        with _fut.ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(_attempt, range(20)))
        assert results.count(True) == 1
        assert results.count(False) == 19

    async def test_async_variant_cross_worker(self):
        url = _live_redis_url()
        if url is None:
            pytest.skip("no live Redis reachable")
        import redis.asyncio as _aioredis

        client_a = _aioredis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        client_b = _aioredis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        try:
            env = _env(ttl=120)
            ok_a, _, _ = await averify_background_envelope(dict(env), redis_client=client_a)
            assert ok_a is True
            ok_b, reason_b, _ = await averify_background_envelope(dict(env), redis_client=client_b)
            assert ok_b is False and "replay" in reason_b
        finally:
            try:
                await client_a.aclose()
                await client_b.aclose()
            except Exception:
                pass

    async def test_backend_status_redis_when_reachable(self, monkeypatch):
        if _live_redis_url() is None:
            pytest.skip("no live Redis reachable")
        # Do not force the URL; discovery must find a broker on its own.
        assert nonce_backend_status() == "redis"
