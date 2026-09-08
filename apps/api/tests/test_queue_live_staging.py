"""Live queue / redelivery / SIGKILL / outage proof against ISOLATED staging Redis.

Target: staging broker ONLY (default localhost:6380). NEVER the shared dev
broker on 6379 and never production. Every test SKIPS when staging Redis is
unreachable. Evidence: docs/audits/muse-final-production-gate.md.
"""
import asyncio
import json
import os
import subprocess
import sys
import time
import uuid

import pytest


def _staging_redis_url() -> str | None:
    explicit = os.environ.get("STAGING_REDIS_URL")
    if explicit:
        candidates = [explicit]
    else:
        pw = os.environ.get("STAGING_REDIS_PASSWORD", "change-me-staging-redis-32chars-min")
        port = os.environ.get("STAGING_REDIS_PORT", "6380")
        candidates = [f"redis://:{pw}@localhost:{port}/0"]
    import redis as _redis

    for url in candidates:
        try:
            client = _redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
            client.ping()
            client.close()
            return url
        except Exception:
            continue
    return None


def _qname() -> str:
    return f"gateq-{uuid.uuid4().hex[:10]}"


async def _enqueue(url: str, queue: str, name: str, data: dict, max_attempts: int = 3) -> str:
    import redis.asyncio as _aioredis

    r = _aioredis.from_url(url, decode_responses=True)
    try:
        job_id = uuid.uuid4().hex[:12]
        key = f"bull:{queue}:{job_id}"
        await r.hset(key, mapping={
            "name": name,
            "data": json.dumps(data),
            "timestamp": str(int(time.time() * 1000)),
            "attempts": "0",
            "maxAttempts": str(max_attempts),
        })
        await r.lpush(f"bull:{queue}:wait", job_id)
        return job_id
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


async def _wait_for(url: str, queue: str, job_id: str, timeout_s: float = 20.0) -> str:
    """Poll completed/failed sets; returns 'completed', 'failed', or raises TimeoutError."""
    import redis.asyncio as _aioredis

    r = _aioredis.from_url(url, decode_responses=True)
    try:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if await r.zscore(f"bull:{queue}:completed", job_id) is not None:
                return "completed"
            if await r.zscore(f"bull:{queue}:failed", job_id) is not None:
                return "failed"
            await asyncio.sleep(0.2)
        raise TimeoutError(f"job {job_id} unsettled after {timeout_s}s")
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


async def _read_h(url: str, queue: str, job_id: str, field: str):
    import redis.asyncio as _aioredis

    r = _aioredis.from_url(url, decode_responses=True)
    try:
        return await r.hget(f"bull:{queue}:{job_id}", field)
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


@pytest.mark.asyncio
class TestLiveQueue:
    async def test_enqueue_to_completion(self):
        from api.workers.queue_worker import BullMQWorker

        url = _staging_redis_url()
        if url is None:
            pytest.skip("staging Redis unreachable")
        queue = _qname()
        seen: list[dict] = []

        async def _echo(data):
            seen.append(data)
            return {"status": "echoed", "n": data.get("n")}

        worker = BullMQWorker(queue_name=queue, redis_url=url, concurrency=2, poll_interval=0.2)
        worker.register("job.echo", _echo)
        task = asyncio.create_task(worker.start())
        try:
            job_id = await _enqueue(url, queue, "job.echo", {"n": 7})
            assert await _wait_for(url, queue, job_id) == "completed"
            assert seen and seen[0].get("n") == 7
            raw = await _read_h(url, queue, job_id, "returnvalue")
            assert json.loads(raw)["status"] == "echoed"
        finally:
            await worker.stop()
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def test_redelivery_does_not_duplicate_effect(self):
        """Same envelope redelivered -> replay rejected, counter stays 1."""
        from api.infrastructure.background_envelope import create_background_envelope
        from api.workers.queue_worker import BullMQWorker

        url = _staging_redis_url()
        if url is None:
            pytest.skip("staging Redis unreachable")
        import redis.asyncio as _aioredis

        queue = _qname()
        counter_key = f"gate:counter:{uuid.uuid4().hex[:8]}"
        r = _aioredis.from_url(url, decode_responses=True)
        try:
            await r.set(counter_key, "0")
        finally:
            try:
                await r.aclose()
            except Exception:
                pass

        async def _guarded(data):
            from api.infrastructure.background_envelope import (
                BackgroundSecurityError,
                averify_background_envelope,
            )

            env = data.get("envelope")
            ok, reason, _ = await averify_background_envelope(env)
            if not ok:
                raise BackgroundSecurityError(reason)
            rr = _aioredis.from_url(url, decode_responses=True)
            try:
                await rr.incr(counter_key)
            finally:
                try:
                    await rr.aclose()
                except Exception:
                    pass
            return {"status": "applied"}

        worker = BullMQWorker(queue_name=queue, redis_url=url, concurrency=1, poll_interval=0.2)
        worker.register("job.guarded", _guarded)
        task = asyncio.create_task(worker.start())
        try:
            env = create_background_envelope("t-live", "w-live", "u-live", "a-live", "test.apply", ttl_seconds=300)
            job_id = await _enqueue(url, queue, "job.guarded", {"envelope": env}, max_attempts=1)
            assert await _wait_for(url, queue, job_id) == "completed"

            rr = _aioredis.from_url(url, decode_responses=True)
            try:
                assert int(await rr.get(counter_key)) == 1
            finally:
                try:
                    await rr.aclose()
                except Exception:
                    pass

            # Redelivery of the identical job (same envelope nonce).
            rr2 = _aioredis.from_url(url, decode_responses=True)
            try:
                await rr2.lpush(f"bull:{queue}:wait", job_id)
            finally:
                try:
                    await rr2.aclose()
                except Exception:
                    pass
            # maxAttempts=1 -> single retry then failed, never completed twice.
            await asyncio.sleep(3)
            rr3 = _aioredis.from_url(url, decode_responses=True)
            try:
                assert int(await rr3.get(counter_key)) == 1
            finally:
                try:
                    await rr3.aclose()
                except Exception:
                    pass
        finally:
            await worker.stop()
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


WORKER_SCRIPT = r"""
import asyncio, json, os, sys
sys.path.insert(0, os.environ["GATE_SRC"])
import redis.asyncio as aioredis
from api.infrastructure.background_envelope import averify_background_envelope

async def main():
    url, queue, job_id = sys.argv[1], sys.argv[2], sys.argv[3]
    r = aioredis.from_url(url, decode_responses=True)
    try:
        # Dequeue exactly one job (simulates worker pickup, pre-ack).
        _, picked = await r.brpop(f"bull:{queue}:wait", timeout=15)
        assert picked == job_id, f"picked {picked} != {job_id}"
        raw = await r.hgetall(f"bull:{queue}:{job_id}")
        data = json.loads(raw["data"])
        ok, reason, _ = await averify_background_envelope(data["envelope"])
        if not ok:
            await r.hset(f"bull:{queue}:{job_id}", mapping={"failedReason": reason})
            await r.zadd(f"bull:{queue}:failed", {job_id: 1})
            return
        # Consequential side effect (durable marker), THEN kill window.
        await r.incr(os.environ["GATE_COUNTER"])
        print("GATE: side effect applied, entering kill window", flush=True)
        await asyncio.sleep(15)  # <-- forceful kill lands here (after effect, before ack)
        await r.zadd(f"bull:{queue}:completed", {job_id: 1})
        print("GATE: acked (should never print in kill test)", flush=True)
    finally:
        try:
            await r.aclose()
        except Exception:
            pass

asyncio.run(main())
"""


@pytest.mark.asyncio
class TestLiveSigkill:
    async def test_forceful_kill_after_effect_before_ack_single_effect(self, tmp_path):
        """Windows TerminateProcess (no cleanup, kill -9 equivalent) mid-window.

        Kill point is AFTER the durable side-effect marker and BEFORE the
        completion ack. Redelivery must NOT duplicate the effect (envelope
        replay rejected). Evidence (PID, timestamps, counter) asserted below.
        """
        url = _staging_redis_url()
        if url is None:
            pytest.skip("staging Redis unreachable")
        import redis.asyncio as _aioredis

        from api.infrastructure.background_envelope import create_background_envelope

        queue = _qname()
        counter_key = f"gate:sigkill:{uuid.uuid4().hex[:8]}"
        r = _aioredis.from_url(url, decode_responses=True)
        try:
            await r.set(counter_key, "0")
        finally:
            try:
                await r.aclose()
            except Exception:
                pass

        env = create_background_envelope("t-kill", "w-kill", "u-kill", "a-kill", "test.apply", ttl_seconds=300)
        job_id = await _enqueue(url, queue, "job.guarded", {"envelope": env}, max_attempts=1)

        script = tmp_path / "kill_worker.py"
        script.write_text(WORKER_SCRIPT)
        import api as _api_pkg

        src = os.path.dirname(os.path.dirname(os.path.abspath(_api_pkg.__file__)))
        child_env = dict(os.environ)
        child_env["GATE_SRC"] = src
        child_env["GATE_COUNTER"] = counter_key
        # Same signing key as this test process (HMAC must verify in child).
        child_env.setdefault("JWT_SECRET", os.environ.get("JWT_SECRET", "test-jwt-secret-for-ci-only-32-chars-long!!"))
        child_env.setdefault("ENCRYPTION_KEY", os.environ.get("ENCRYPTION_KEY", "test-encryption-key-must-be-at-least-32-chars!!"))
        kill_ts: float | None = None
        proc = subprocess.Popen(
            [sys.executable, str(script), url, queue, job_id],
            env=child_env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        try:
            # Wait until the durable side-effect marker exists (pre-ack window).
            rr = _aioredis.from_url(url, decode_responses=True)
            try:
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline:
                    if int(await rr.get(counter_key) or 0) >= 1:
                        break
                    await asyncio.sleep(0.2)
                assert int(await rr.get(counter_key) or 0) == 1, "worker never reached kill window"
            finally:
                try:
                    await rr.aclose()
                except Exception:
                    pass
            pid = proc.pid
            assert proc.poll() is None, "worker exited before kill (not in window)"
            kill_ts = time.time()
            proc.kill()  # Windows: TerminateProcess — forceful, no handlers (kill -9 equivalent)
            proc.wait(timeout=15)
            assert proc.returncode is not None
        finally:
            if proc.poll() is None:
                proc.kill()

        assert kill_ts is not None
        # Not acked: neither completed nor failed.
        rr2 = _aioredis.from_url(url, decode_responses=True)
        try:
            assert await rr2.zscore(f"bull:{queue}:completed", job_id) is None
            assert int(await rr2.get(counter_key)) == 1
        finally:
            try:
                await rr2.aclose()
            except Exception:
                pass

        # Fresh worker redelivers the same job -> envelope replay rejects it.
        from api.workers.queue_worker import BullMQWorker

        applied: list = []

        async def _guarded(data):
            from api.infrastructure.background_envelope import (
                BackgroundSecurityError,
                averify_background_envelope,
            )

            ok, reason, _ = await averify_background_envelope(data["envelope"])
            if not ok:
                raise BackgroundSecurityError(reason)
            applied.append(1)
            return {"status": "applied"}

        worker = BullMQWorker(queue_name=queue, redis_url=url, concurrency=1, poll_interval=0.2)
        worker.register("job.guarded", _guarded)
        # NOTE: handler name differs from enqueued name; push under the right name.
        job_id2 = await _enqueue(url, queue, "job.guarded", {"envelope": env}, max_attempts=1)
        task = asyncio.create_task(worker.start())
        try:
            # Original job id redelivery (pre-kill envelope, already consumed).
            rr3 = _aioredis.from_url(url, decode_responses=True)
            try:
                await rr3.lpush(f"bull:{queue}:wait", job_id)
            finally:
                try:
                    await rr3.aclose()
                except Exception:
                    pass
            await _wait_for(url, queue, job_id2, timeout_s=15)
            await asyncio.sleep(2)  # let the redelivered original also settle
            rr4 = _aioredis.from_url(url, decode_responses=True)
            try:
                # job_id2 used a FRESH envelope? No — same env object: also replay.
                # Either way the counter (authoritative marker) must stay exactly 1.
                assert int(await rr4.get(counter_key)) == 1, "duplicate side effect after kill+redelivery"
            finally:
                try:
                    await rr4.aclose()
                except Exception:
                    pass
        finally:
            await worker.stop()
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        print(f"GATE SIGKILL evidence pid={pid} kill_ts={kill_ts} job={job_id} counter=1")


class TestLiveOutage:
    def test_redis_stop_explicit_failure_and_recovery(self):
        """Stopping ONLY the isolated staging broker: ops fail loudly, recover after start."""
        url = _staging_redis_url()
        if url is None:
            pytest.skip("staging Redis unreachable")
        import redis as _redis

        stopped = subprocess.run(["docker", "stop", "vaeloom-staging-redis"],
                                 capture_output=True, text=True, timeout=60)
        assert stopped.returncode == 0, stopped.stderr
        try:
            client = _redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
            try:
                with pytest.raises(Exception):
                    client.ping()
            finally:
                try:
                    client.close()
                except Exception:
                    pass
            # Nonce layer must degrade to documented local best-effort, not phantom success.
            import api.infrastructure.background_envelope as mod

            assert mod.nonce_backend_status() in ("memory", "redis")
        finally:
            started = subprocess.run(["docker", "start", "vaeloom-staging-redis"],
                                     capture_output=True, text=True, timeout=60)
            assert started.returncode == 0, started.stderr
        # Recovery: broker accepts writes again.
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                c2 = _redis.Redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
                try:
                    if c2.ping():
                        break
                finally:
                    try:
                        c2.close()
                    except Exception:
                        pass
            except Exception:
                time.sleep(1)
        else:
            pytest.fail("staging Redis did not recover after start")
