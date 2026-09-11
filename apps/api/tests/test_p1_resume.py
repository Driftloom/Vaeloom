"""LOOP-RESUME-01 battery: every runtime path enforces identical resume trust.

Matrix: legacy buffered loop, stream loop, supervisor resume, and the shared
validate_resume_identity gate (unit). Graph/Temporal/ReAct inherit the same
semantics (Temporal delegates to run_graph_direct; ReAct runs inside
loop/graph) — graph-side rejection is covered by the runner's own suites.
"""
import uuid

import pytest

pytestmark = pytest.mark.asyncio


@pytest.fixture()
def _mem():
    from api.orchestrator.state_store import MemoryStateStore, set_state_store

    set_state_store(MemoryStateStore())
    try:
        yield
    finally:
        set_state_store(None)


def _stub_agent(name="stub"):
    return type(name, (), {})()


class TestResumeGateUnit:
    def test_match_passes(self):
        from api.orchestrator.state import LoopState, validate_resume_identity

        st = LoopState("r", workspace_id="wsA", tenant_id="tA")
        st.agent_id = "ag"
        out = validate_resume_identity(st, tenant_id="tA", workspace_id="wsA", agent_id="ag")
        assert out.workspace_id == "wsA"

    def test_workspace_mismatch_refuses(self):
        from api.orchestrator.state import (
            ForeignCheckpointError,
            LoopState,
            validate_resume_identity,
        )

        st = LoopState("r", workspace_id="wsA", tenant_id="tA")
        with pytest.raises(ForeignCheckpointError):
            validate_resume_identity(st, tenant_id="tA", workspace_id="wsB")

    def test_tenant_mismatch_refuses(self):
        from api.orchestrator.state import (
            ForeignCheckpointError,
            LoopState,
            validate_resume_identity,
        )

        st = LoopState("r", workspace_id="wsA", tenant_id="tA")
        with pytest.raises(ForeignCheckpointError):
            validate_resume_identity(st, tenant_id="tB", workspace_id="wsA")

    def test_agent_mismatch_refuses(self):
        from api.orchestrator.state import (
            ForeignCheckpointError,
            LoopState,
            validate_resume_identity,
        )

        st = LoopState("r", workspace_id="wsA")
        st.agent_id = "ag-a"
        with pytest.raises(ForeignCheckpointError):
            validate_resume_identity(st, workspace_id="wsA", agent_id="ag-b")

    def test_legacy_blank_pins_once(self):
        from api.orchestrator.state import LoopState, validate_resume_identity

        st = LoopState("r")  # pre-identity checkpoint
        out = validate_resume_identity(st, tenant_id="tA", workspace_id="wsA")
        assert out.workspace_id == "wsA" and out.tenant_id == "tA"

    def test_empty_both_is_fresh(self):
        from api.orchestrator.state import LoopState, validate_resume_identity

        st = LoopState("r")
        out = validate_resume_identity(st)
        assert out.workspace_id is None


class TestBufferedLoopRefusal:
    async def test_foreign_checkpoint_refused_untouched(self, _mem):
        from api.orchestrator.loop import AgentRequest, run_agent_loop
        from api.orchestrator.state import load_or_create_state, save_checkpoint

        rid = f"req-{uuid.uuid4().hex[:8]}"
        st = await load_or_create_state(rid, workspace_id="wsA")
        st.workspace_id = "wsA"
        st.tenant_id = "tA"
        st.agent_id = "ag"
        st.add_phase("plan_0", {"ok": True})
        await save_checkpoint(st)

        req = AgentRequest(_stub_agent(), rid, "do things", "wsB", "ag",
                           tenant_id="tB", user_id="u2")
        resp = await run_agent_loop(req)
        assert resp.status == "failed", resp.status
        assert resp.termination_reason == "policy_stop", resp.termination_reason

        # stored state untouched: still wsA, no new phases, no laundering
        st2 = await load_or_create_state(rid, workspace_id="wsA")
        assert st2.workspace_id == "wsA"
        assert st2.tenant_id == "tA"
        assert set(st2.phases) == {"plan_0"}, dict(st2.phases).keys()


class TestStreamLoopRefusal:
    async def test_foreign_stream_resume_refused(self, _mem):
        from api.orchestrator.loop import AgentRequest, run_agent_loop_stream
        from api.orchestrator.state import load_or_create_state, save_checkpoint

        rid = f"req-{uuid.uuid4().hex[:8]}"
        st = await load_or_create_state(rid, workspace_id="wsA")
        st.workspace_id = "wsA"
        st.tenant_id = "tA"
        st.agent_id = "ag"
        await save_checkpoint(st)

        req = AgentRequest(_stub_agent(), rid, "do things", "wsB", "ag",
                           tenant_id="tB", user_id="u2")
        events = [e async for e in run_agent_loop_stream(req)]
        assert events, "stream emitted nothing"
        assert events[0]["event"] == "error"
        assert "Resume refused" in str(events[0]["data"])
        assert events[-1]["event"] == "done"


class TestSupervisorRefusal:
    async def test_supervisor_foreign_resume_refused(self, _mem):
        from api.orchestrator.state import load_or_create_state, save_checkpoint
        from api.orchestrator.supervisor import resume_supervisor

        rid = f"req-{uuid.uuid4().hex[:8]}"
        st = await load_or_create_state(rid, workspace_id="wsA")
        st.workspace_id = "wsA"
        st.add_phase("supervisor_pause_0", {"layer_idx": 0})
        await save_checkpoint(st)

        res = await resume_supervisor(rid, "wsB", {"decision": "approved"})
        assert res.get("status") == "refused", res
