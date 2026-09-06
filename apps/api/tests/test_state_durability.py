"""Integration tests for LoopState durability across StateStore backends."""
import asyncio
import pytest

from api.orchestrator.state import LoopState, load_or_create_state, save_checkpoint
from api.orchestrator.state_store import (
    CompositeStateStore,
    FileStateStore,
    MemoryStateStore,
    set_state_store,
)


@pytest.mark.asyncio
async def test_memory_state_store_durability():
    store = MemoryStateStore()
    set_state_store(store)
    try:
        state = LoopState("req-mem-1")
        state.add_phase("plan_0", {"steps": ["a", "b"]})
        state.add_phase("act_0", {"tool": "search"})
        await save_checkpoint(state)

        # Reload simulating new process turn
        loaded = await load_or_create_state("req-mem-1")
        assert loaded.request_id == "req-mem-1"
        assert "plan_0" in loaded.phases
        assert loaded.phases["plan_0"]["steps"] == ["a", "b"]
        assert loaded.phases["act_0"]["tool"] == "search"
    finally:
        set_state_store(None)


@pytest.mark.asyncio
async def test_composite_state_store_fallback(tmp_path):
    primary_mem = MemoryStateStore()
    fallback_file = FileStateStore(state_dir=tmp_path)
    composite = CompositeStateStore(primary=primary_mem, fallback=fallback_file)

    set_state_store(composite)
    try:
        state = LoopState("req-comp-1")
        state.add_phase("observe", {"result": "success"})
        await save_checkpoint(state)

        # Verify fallback file got written
        file_checkpoint = await fallback_file.load("req-comp-1")
        assert file_checkpoint is not None
        assert file_checkpoint["phases"]["observe"]["result"] == "success"

        # Wipe primary to simulate memory crash / process restart
        await primary_mem.delete("req-comp-1")

        # Load should recover from fallback
        recovered = await load_or_create_state("req-comp-1")
        assert recovered.request_id == "req-comp-1"
        assert recovered.phases["observe"]["result"] == "success"
    finally:
        set_state_store(None)
