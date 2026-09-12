"""IDEM-RACE-01 adversarial battery: atomic claim under concurrency.

Claim layer, threads x{n} with separate connections on one file DB:
exactly one winner and one effect; losers observe (duplicate/in_progress).
Also: stale-lease steal, failed-reclaim, retry-after-completion, and
execute_tool-level duplicate suppression with a metered effect.
"""
import asyncio
import threading
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture()
async def claim_db(tmp_path, monkeypatch):
    """File DB + factory override so the claim layer stays hermetic."""
    import sys

    sys.path.insert(0, "apps/api/src")
    from api.database import Base
    import api.models.schema  # noqa: F401
    from api.tools import executor as ex

    db_file = str(tmp_path / f"claim-{uuid.uuid4().hex[:8]}.db")

    eng = create_async_engine(f"sqlite+aiosqlite:///{db_file}", poolclass=NullPool)
    async with eng.begin() as c:
        await c.run_sync(Base.metadata.create_all)
    await eng.dispose()
    eng = create_async_engine(f"sqlite+aiosqlite:///{db_file}", poolclass=NullPool)
    mk = async_sessionmaker(eng, expire_on_commit=False)

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def factory(_ws):
        async with mk() as s:
            try:
                yield s
            finally:
                try:
                    await s.commit()
                except Exception:
                    await s.rollback()

    monkeypatch.setattr(ex, "_IDEM_SESSION_FACTORY_OVERRIDE", lambda _ws: factory(_ws))
    try:
        yield db_file
    finally:
        await eng.dispose()


def _thread_claim(ws, key, out, idx, delay=0.05):
    # NOTE: kept for single-threaded debugging only. Concurrency proof uses
    # separate PROCESSES (spawn): aiosqlite connections must not be shared
    # across threads on this platform, and processes are the stronger,
    # worker-faithful proof anyway.
    async def go():
        from api.tools.executor import _claim_tool_effect, _complete_tool_effect

        outcome, payload = await _claim_tool_effect(ws, key, "t", "a", "r")
        if outcome == "won":
            await asyncio.sleep(delay)
            out.append(idx)
            await _complete_tool_effect(ws, key, payload, True, {"status": "success"})
        else:
            out.append((outcome, payload if not isinstance(payload, dict) else "stored"))

    asyncio.run(go())


def _proc_claim(db_file, ws, key, idx, delay, q):
    import sys

    sys.path.insert(0, "apps/api/src")
    import asyncio as _aio

    async def go():
        from contextlib import asynccontextmanager

        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
        from sqlalchemy.pool import NullPool

        from api.tools import executor as ex

        eng = create_async_engine(f"sqlite+aiosqlite:///{db_file}", poolclass=NullPool)

        @asynccontextmanager
        async def factory(_ws):
            mk = async_sessionmaker(eng, expire_on_commit=False)
            async with mk() as s:
                yield s
                try:
                    await s.commit()
                except Exception:
                    await s.rollback()

        ex._IDEM_SESSION_FACTORY_OVERRIDE = lambda _ws: factory(_ws)
        try:
            outcome, payload = await ex._claim_tool_effect(ws, key, "t", "a", "r")
            if outcome == "won":
                await _aio.sleep(delay)
                q.put(("effect", idx))
                await ex._complete_tool_effect(
                    ws, key, payload, True, {"status": "success"})
                q.put(("won", idx))
            else:
                q.put((outcome, idx))
        finally:
            await eng.dispose()

    _aio.run(go())


class TestAtomicClaimRace:
    @pytest.mark.parametrize("n", [2, 4, 8, 16, 32])
    async def test_concurrent_claim_single_winner(self, claim_db, n):
        import multiprocessing as _mp
        import time as _time

        ctx = _mp.get_context("spawn")
        q = ctx.Queue()
        procs = [ctx.Process(target=_proc_claim, args=(claim_db, "ws", "k", i, 0.2, q))
                 for i in range(n)]
        for p in procs:
            p.start()
            _time.sleep(0.01)  # stagger spawn storms (thundering-herd relief only;
            # atomicity must and does hold regardless of arrival timing)
        for p in procs:
            p.join(180)
        assert all(p.exitcode == 0 for p in procs), [p.exitcode for p in procs]
        out = []
        while not q.empty():
            out.append(q.get())
        effects = [x for x in out if x[0] == "effect"]
        won = [x for x in out if x[0] == "won"]
        losers = [x for x in out if x[0] not in ("effect", "won")]
        assert len(effects) == 1, f"n={n}: effects={effects}"
        assert len(won) == 1, f"n={n}: won={won}"
        assert len(losers) == n - 1, f"n={n}: losers={losers}"
        assert all(o in ("duplicate", "in_progress") for o, _ in losers), losers

    async def test_retry_after_completion_returns_stored(self, claim_db):
        from api.tools.executor import _claim_tool_effect, _complete_tool_effect

        o1, p1 = await _claim_tool_effect("ws", "k2", "t", "a", "r")
        assert o1 == "won", (o1, p1)
        await _complete_tool_effect("ws", "k2", p1, True, {"status": "success", "v": 7})
        o2, p2 = await _claim_tool_effect("ws", "k2", "t", "a", "r")
        assert o2 == "duplicate", (o2, p2)
        assert p2.get("v") == 7

    async def test_stale_lease_stealable(self, claim_db):
        from datetime import UTC, datetime, timedelta

        from sqlalchemy import select

        from api.database import Base  # noqa: F401
        from api.models.schema import ToolIdempotency
        from api.tools.executor import _claim_tool_effect

        # plant an expired claim directly
        from api.tools import executor as ex

        factory = ex._idem_session_cm("ws")
        async with factory as s:
            s.add(ToolIdempotency(
                workspace_id="ws", idem_key="k3", tool_name="t", agent_id="a",
                status="claimed", result_json={}, claim_token="dead",
                lease_expires_at=datetime.now(UTC) - timedelta(seconds=1)))
            await s.commit()
        o, p = await _claim_tool_effect("ws", "k3", "t", "a", "r")
        assert o == "won", (o, p)

    async def test_failed_claim_reclaimable(self, claim_db):
        from api.tools.executor import (
            _claim_tool_effect,
            _complete_tool_effect,
        )

        o1, p1 = await _claim_tool_effect("ws", "k4", "t", "a", "r")
        assert o1 == "won"
        await _complete_tool_effect("ws", "k4", p1, False, None)
        o2, p2 = await _claim_tool_effect("ws", "k4", "t", "a", "r")
        assert o2 == "won", (o2, p2)
        await _complete_tool_effect("ws", "k4", p2, True, {"status": "success"})

    async def test_execute_tool_duplicate_suppressed(self, claim_db, monkeypatch):
        """End-to-end through execute_tool with a metered irreversible effect."""
        from api.tools import executor as ex
        from api.tools.definitions import ToolDefinition

        calls: list = []

        async def _fake_handler(params, workspace_id):
            calls.append(params)
            return {"status": "success", "tool": "t_meter", "result": {"n": len(calls)}}

        td = ToolDefinition(name="t_meter", description="metered",
                            input_schema={"type": "object"}, output_schema={},
                            required_scope="memory.write", category="memory_write")
        monkeypatch.setitem(ex.TOOL_DISPATCH, "t_meter", _fake_handler)

        async def _allow(*a, **k):
            return True

        monkeypatch.setattr(ex, "check_permission", _allow)
        params = {"x": 1, "_request_id": "r-meter"}

        async def one():
            return await ex.execute_tool(td, dict(params), agent_id="a",
                                         agent_scopes=["memory.write"], workspace_id="ws")

        r1, r2 = await asyncio.gather(one(), one())
        assert len(calls) == 1, f"duplicate effect executed: {len(calls)}"
        assert r1.get("status") == "success" and r2.get("status") == "success"
