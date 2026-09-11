"""CAS-DEAD-01 battery: production checkpoint writes actually use CAS.

Store level (File/Memory/DB-SQLite backends): N concurrent same-version
writers -> exactly one winner, N-1 ConcurrentUpdateError, valid final chain.
save_checkpoint level: concurrent writers converge via reload+merge+retry;
cancel/terminal monotonicity holds under race (no clearing, no un-complete).
Redis backend: covered by test_redis_cas.py when a server is reachable.
"""
import asyncio
import uuid

import pytest

pytestmark = pytest.mark.asyncio


async def _stores(tmp_path):
    from api.database import Base
    import api.models.schema  # noqa: F401 (register LoopCheckpoint)
    from api.orchestrator.state_store import (
        DatabaseStateStore,
        FileStateStore,
        MemoryStateStore,
    )
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    db_file = str(tmp_path / f"cas-{uuid.uuid4().hex[:8]}.db")
    setup_eng = create_async_engine(f"sqlite+aiosqlite:///{db_file}", poolclass=NullPool)
    async with setup_eng.begin() as c:
        await c.run_sync(Base.metadata.create_all)
    await setup_eng.dispose()
    eng = create_async_engine(f"sqlite+aiosqlite:///{db_file}", poolclass=NullPool)
    mk = async_sessionmaker(eng, expire_on_commit=False)
    return {
        "file": FileStateStore(state_dir=tmp_path / "f"),
        "memory": MemoryStateStore(),
        "db": DatabaseStateStore(session_factory=mk),
    }, eng


async def _seed(store, rid, version=5):
    # plant version N via sequential saves from a blank dict
    d = {"request_id": rid, "state_version": 1, "phases": {}}
    for _ in range(version - 1):
        v = await store.save(rid, d, "ws", expected_version=int(d["state_version"]))
        d = dict(d)
        d["state_version"] = v
    return d


class TestStoreLevelCas:
    @pytest.mark.parametrize("backend", ["file", "memory", "db"])
    @pytest.mark.parametrize("n", [2, 4, 8])
    async def test_concurrent_same_version_single_winner(self, tmp_path, backend, n):
        import copy

        from api.orchestrator.state_store import ConcurrentUpdateError

        stores, eng = await _stores(tmp_path)
        store = stores[backend]
        rid = f"req-{uuid.uuid4().hex[:8]}"
        base = await _seed(store, rid, version=5)

        results: list = []

        async def writer(i):
            d = copy.deepcopy(base)
            d["phases"] = {f"w{i}": True}
            try:
                v = await store.save(rid, d, "ws", expected_version=5)
                results.append(("won", i, v))
            except ConcurrentUpdateError as e:
                results.append(("conflict", i, str(e)[:60]))

        await asyncio.gather(*[writer(i) for i in range(n)])
        winners = [r for r in results if r[0] == "won"]
        conflicts = [r for r in results if r[0] == "conflict"]
        assert len(winners) == 1, f"{backend} n={n}: {results}"
        assert len(conflicts) == n - 1, f"{backend} n={n}: {results}"
        assert winners[0][2] == 6
        final = await store.load(rid, "ws")
        assert final is not None and int(final["state_version"]) == 6
        await eng.dispose()

    @pytest.mark.parametrize("backend", ["file", "memory", "db"])
    async def test_stale_expected_always_conflicts(self, tmp_path, backend):
        from api.orchestrator.state_store import ConcurrentUpdateError

        stores, eng = await _stores(tmp_path)
        store = stores[backend]
        rid = f"req-{uuid.uuid4().hex[:8]}"
        await _seed(store, rid, version=4)
        with pytest.raises(ConcurrentUpdateError):
            await store.save(rid, {"request_id": rid, "state_version": 2}, "ws",
                             expected_version=2)
        await eng.dispose()


class TestCheckpointLevelCas:
    async def test_concurrent_saves_converge_monotonic(self, tmp_path, monkeypatch):
        from api.orchestrator import state as st_mod
        from api.orchestrator.state import LoopState, load_or_create_state, save_checkpoint
        from api.orchestrator.state_store import MemoryStateStore, set_state_store

        set_state_store(MemoryStateStore())
        try:
            rid = f"req-{uuid.uuid4().hex[:8]}"
            a = await load_or_create_state(rid, workspace_id="ws")
            a.workspace_id = "ws"
            a.tenant_id = "t"
            a.add_phase("p_a", {"by": "a"})
            await save_checkpoint(a)

            async def racer_b():
                b = await load_or_create_state(rid, workspace_id="ws")
                b.add_phase("p_b", {"by": "b"})
                return await save_checkpoint(b)

            async def racer_c():
                c = await load_or_create_state(rid, workspace_id="ws")
                c.add_phase("p_c", {"by": "c"})
                return await save_checkpoint(c)

            va, vb, vc = await asyncio.gather(
                save_checkpoint(a), racer_b(), racer_c())
            # all converge (no exception), versions strictly advance
            assert sorted([va, vb, vc]) == sorted(set([va, vb, vc]))
            assert max(va, vb, vc) >= 4
            final = await load_or_create_state(rid, workspace_id="ws")
            assert int(final.state_version) == max(va, vb, vc)
        finally:
            set_state_store(None)

    async def test_cancel_survives_race(self, tmp_path):
        from api.orchestrator.state import load_or_create_state, save_checkpoint
        from api.orchestrator.state_store import MemoryStateStore, set_state_store

        set_state_store(MemoryStateStore())
        try:
            rid = f"req-{uuid.uuid4().hex[:8]}"
            a = await load_or_create_state(rid, workspace_id="ws")
            a.workspace_id = "ws"
            a.add_phase("p0", {})
            await save_checkpoint(a)
            # canceller sets the flag...
            canceller = await load_or_create_state(rid, workspace_id="ws")
            canceller.cancel_requested = True
            await save_checkpoint(canceller)
            # ...stale writer must not clear it (merge-before-write).
            stale = await load_or_create_state(rid, workspace_id="ws")
            stale.cancel_requested = False  # stale copy predates the cancel
            stale.add_phase("p_stale", {})
            await save_checkpoint(stale)
            final = await load_or_create_state(rid, workspace_id="ws")
            assert final.cancel_requested is True
        finally:
            set_state_store(None)

    async def test_terminal_survives_race(self, tmp_path):
        from api.orchestrator.state import load_or_create_state, save_checkpoint
        from api.orchestrator.state_store import MemoryStateStore, set_state_store

        set_state_store(MemoryStateStore())
        try:
            rid = f"req-{uuid.uuid4().hex[:8]}"
            a = await load_or_create_state(rid, workspace_id="ws")
            a.workspace_id = "ws"
            a.add_phase("p0", {})
            await save_checkpoint(a)
            finisher = await load_or_create_state(rid, workspace_id="ws")
            finisher.terminate("success", "success")
            await save_checkpoint(finisher)
            # stale non-terminal writer must not un-complete the run
            stale = await load_or_create_state(rid, workspace_id="ws")
            stale.status = "running"
            stale.termination_reason = None
            await save_checkpoint(stale)
            final = await load_or_create_state(rid, workspace_id="ws")
            assert final.status == "success"
            assert final.termination_reason == "success"
        finally:
            set_state_store(None)
