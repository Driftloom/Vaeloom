"""Tests for DatabaseStateStore and LoopState checkpointing."""
from __future__ import annotations

import uuid
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from api.models.schema import LoopCheckpoint
from api.orchestrator.state import LoopState, load_or_create_state, save_checkpoint
from api.orchestrator.state_store import (
    DatabaseStateStore,
    get_state_store,
    set_state_store,
)


@pytest.mark.asyncio
async def test_database_state_store_crud(db_session):
    # Create an async session factory using the test session's bind
    engine = db_session.bind
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    store = DatabaseStateStore(session_factory=session_factory)
    req_id = f"req_{uuid.uuid4()}"
    ws_id = str(uuid.uuid4())

    state_data = {
        "request_id": req_id,
        "workspace_id": ws_id,
        "phases": {
            "plan_0": {"agent": "resume", "strategy": "tailor"},
            "act_0": {"summary": "Generated tailored resume"},
        },
    }

    # Save
    await store.save(req_id, state_data, workspace_id=ws_id)

    # Load
    loaded = await store.load(req_id)
    assert loaded is not None
    assert loaded["request_id"] == req_id
    assert loaded["phases"]["plan_0"]["agent"] == "resume"
    assert loaded["phases"]["act_0"]["summary"] == "Generated tailored resume"

    # Update
    state_data["phases"]["reflect_0"] = {"is_satisfied": True}
    await store.save(req_id, state_data, workspace_id=ws_id)

    updated = await store.load(req_id)
    assert updated is not None
    assert updated["phases"]["reflect_0"]["is_satisfied"] is True

    # Delete
    await store.delete(req_id)
    deleted = await store.load(req_id)
    assert deleted is None


@pytest.mark.asyncio
async def test_loop_state_integration_with_database_store(db_session):
    engine = db_session.bind
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    store = DatabaseStateStore(session_factory=session_factory)

    # Override active state store
    set_state_store(store)
    try:
        req_id = f"req_loop_{uuid.uuid4()}"
        ws_id = str(uuid.uuid4())

        state = await load_or_create_state(req_id, workspace_id=ws_id)
        assert state.request_id == req_id
        assert state.workspace_id == ws_id

        state.add_phase("plan_0", {"intent": "job_search"})
        await save_checkpoint(state)

        # Reload from store
        reloaded = await load_or_create_state(req_id)
        assert reloaded.phases.get("plan_0", {}).get("intent") == "job_search"
        assert reloaded.workspace_id == ws_id
    finally:
        set_state_store(None)
