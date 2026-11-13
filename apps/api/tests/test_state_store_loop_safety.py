"""Regression tests for FileStateStore lock scoping across event loops.

Root cause of the CI hangs fixed in run 43400920642: ``get_state_store()`` is a
process-wide singleton and ``FileStateStore`` cached a single ``asyncio.Lock``.
pytest-asyncio creates a fresh event loop per test and tears it down with
``shutdown_asyncgens()`` + ``loop.close()`` without cancelling pending tasks.
A detached checkpoint save (``_save_eval_phase``) abandoned mid-lock therefore
left the singleton lock acquired forever, and the next ``save_checkpoint`` in
that worker awaited a dead loop with no timer -- faulthandler saw only
``selectors.select`` and pytest-timeout killed the worker at 180 s.

These tests pin the fix: one lock per running loop, so a dead loop's abandoned
lock can never starve a live loop, while in-loop CAS serialization survives.
The cross-loop tests are synchronous on purpose: they drive each loop
explicitly, exactly like pytest-asyncio's per-test loop teardown.
"""
import asyncio

import pytest

import api.orchestrator.state_store as state_store_module
from api.orchestrator.state import LoopState, save_checkpoint
from api.orchestrator.state_store import (
    ConcurrentUpdateError,
    FileStateStore,
    get_state_store,
    set_state_store,
)


def _run_in_new_loop(coro_factory):
    """Run ``coro_factory()`` in a throwaway loop, then close it un-drained.

    Closing without ``shutdown_asyncgens``-style task cancellation is the
    pytest-asyncio teardown behaviour that exposed the bug.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro_factory())
    finally:
        loop.close()


def _poison_lock(store: FileStateStore) -> asyncio.Lock:
    """Acquire the store's loop lock in a loop that is then closed un-released.

    This is exactly the state a detached task leaves behind when the test's
    event loop is closed without cancelling it.
    """

    async def _acquire() -> asyncio.Lock:
        lock = store._get_lock()
        await lock.acquire()
        return lock

    abandoned = _run_in_new_loop(_acquire)
    assert abandoned.locked(), "test setup must leave the dead loop's lock held"
    return abandoned


def test_lock_from_a_closed_loop_does_not_block_a_live_loop(tmp_path):
    store = FileStateStore(state_dir=tmp_path)
    poisoned = _poison_lock(store)

    async def _save_on_live_loop() -> tuple[asyncio.Lock, int]:
        # A live loop must get its own lock object, not the abandoned one.
        live_lock = store._get_lock()
        version = await asyncio.wait_for(
            store.save("loop-rollover", {"state_version": 1}, expected_version=1),
            timeout=2,
        )
        return live_lock, version

    live_lock, version = _run_in_new_loop(_save_on_live_loop)

    assert live_lock is not poisoned
    assert not live_lock.locked()
    assert version == 2
    assert (tmp_path / "loop-rollover.json").exists()


def test_cas_survives_loop_rollover(tmp_path):
    """CAS is still enforced after a poisoned loop is abandoned."""
    store = FileStateStore(state_dir=tmp_path)

    async def _first_write() -> int:
        return await store.save("cas-rollover", {"state_version": 1}, expected_version=1)

    assert _run_in_new_loop(_first_write) == 2
    _poison_lock(store)

    async def _stale_then_current() -> None:
        # Stale writer: must raise, not wait on the dead loop's lock.
        with pytest.raises(ConcurrentUpdateError):
            await asyncio.wait_for(
                store.save("cas-rollover", {"state_version": 1}, expected_version=1),
                timeout=2,
            )
        # Current writer: succeeds on the live loop at the right version.
        assert (
            await asyncio.wait_for(
                store.save("cas-rollover", {"state_version": 2}, expected_version=2),
                timeout=2,
            )
            == 3
        )

    _run_in_new_loop(_stale_then_current)


async def test_concurrent_writers_in_one_loop_stay_serialized(tmp_path):
    """The per-loop lock still provides the read-check-write CAS interlock."""
    store = FileStateStore(state_dir=tmp_path)
    assert await store.save("cas-race", {"state_version": 1}, expected_version=1) == 2

    results = await asyncio.gather(
        store.save("cas-race", {"state_version": 2}, expected_version=2),
        store.save("cas-race", {"state_version": 2}, expected_version=2),
        return_exceptions=True,
    )

    versions = [r for r in results if isinstance(r, int)]
    conflicts = [r for r in results if isinstance(r, ConcurrentUpdateError)]
    assert versions == [3], f"exactly one writer may win, got {results!r}"
    assert len(conflicts) == 1, f"the loser must raise CAS conflict, got {results!r}"


def test_save_checkpoint_after_poisoned_singleton(tmp_path):
    """End-to-end: the production writer recovers from a dead loop's lock."""
    store = FileStateStore(state_dir=tmp_path)
    previous_store = state_store_module._default_store
    set_state_store(store)
    try:
        _poison_lock(store)
        assert get_state_store() is store

        async def _save_checkpoint_on_live_loop() -> tuple[int, dict | None]:
            state = LoopState("run-after-poison", workspace_id="ws-1")
            version = await asyncio.wait_for(save_checkpoint(state), timeout=3)
            return version, await store.load("run-after-poison")

        version, stored = _run_in_new_loop(_save_checkpoint_on_live_loop)

        assert version == 2
        assert stored is not None
        assert stored["state_version"] == 2
        assert stored["request_id"] == "run-after-poison"
    finally:
        set_state_store(previous_store)
