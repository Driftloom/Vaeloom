import json
import logging
from unittest.mock import MagicMock
import pytest

pytestmark = pytest.mark.asyncio


class MockAgent:
    async def execute(self, *args, **kwargs):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "done", "details": {}, "proposals": [], "questions": []}}

    async def search(self, *args, **kwargs):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "found", "details": {}, "proposals": [], "questions": []}}

    async def score(self, *args, **kwargs):
        return {"action": "suggest", "confidence": 0.8, "result": {"summary": "scored", "details": {}, "proposals": [], "questions": []}}

    async def prepare(self, *args, **kwargs):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "prepared", "details": {}, "proposals": [], "questions": []}}

    async def classify_emails(self, *args, **kwargs):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "classified", "details": {}, "proposals": [], "questions": []}}

    async def process(self, *args, **kwargs):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "processed", "details": {}, "proposals": [], "questions": []}}

    async def check_conflicts(self, *args, **kwargs):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "checked", "details": {}, "proposals": [], "questions": []}}

    async def fallback(self):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "fallback done", "details": {}, "proposals": [], "questions": []}}


class MockAgentWithFallback:
    async def fallback(self):
        return {"action": "execute", "confidence": 1.0, "result": {"summary": "fallback", "details": {}, "proposals": [], "questions": []}}


def _make_agent(name):
    cls = type(name, (MockAgent,), {})
    return cls()


class TestBaseAgent:
    def test_fallback_raises_not_implemented(self):
        from api.orchestrator.base import BaseAgent
        agent = BaseAgent()
        with pytest.raises(NotImplementedError, match="must implement a fallback"):
            import asyncio
            asyncio.run(agent.fallback())


class TestAgentRequest:
    def test_construction_with_explicit_name(self):
        from api.orchestrator.loop import AgentRequest
        agent = _make_agent("CustomAgent")
        req = AgentRequest(agent, "r1", "hello", "ws1", "explicit_name")
        assert req.id == "r1"
        assert req.message == "hello"
        assert req.workspace_id == "ws1"
        assert req.agent_name == "explicit_name"

    def test_derive_agent_name_strips_suffixes(self):
        from api.orchestrator.loop import AgentRequest
        for class_name, expected in [
            ("GmailAgent", "gmail"),
            ("GmailAgentHandler", "gmail"),
            ("OrganizationAgent", "organization"),
            ("MemoryAgentHandler", "memory"),
            ("PlainHandler", "plain"),
        ]:
            agent = _make_agent(class_name)
            req = AgentRequest(agent, "r1", "msg", "ws1")
            assert req.agent_name == expected, f"{class_name} -> {req.agent_name}"

    def test_derive_agent_name_no_suffix(self):
        from api.orchestrator.loop import AgentRequest
        agent = _make_agent("SomethingElse")
        req = AgentRequest(agent, "r1", "msg", "ws1")
        assert req.agent_name == "somethingelse"


class TestAgentResponse:
    def test_construction(self):
        from api.orchestrator.loop import AgentResponse
        r = AgentResponse("ok", {"key": "val"})
        assert r.status == "ok"
        assert r.final_result == {"key": "val"}


class TestReflectResult:
    def test_construction(self):
        from api.orchestrator.loop import ReflectResult
        r = ReflectResult(True, "all good")
        assert r.is_satisfied is True
        assert r.reason == "all good"


class TestPlanPhase:
    async def test_returns_plan_dict(self):
        from api.orchestrator.loop import plan_phase, AgentRequest
        from api.orchestrator.state import LoopState
        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "r1", "analyze data", "ws1")
        state = LoopState("r1")
        plan = await plan_phase(req, state)
        assert plan["agent_type"] == "test"
        assert plan["message"] == "analyze data"
        assert plan["workspace_id"] == "ws1"


class TestActPhase:
    @pytest.mark.parametrize("agent_type, method_name, expected_action", [
        ("OrganizationAgent", "execute", "execute"),
        ("ResumeAgent", "execute", "execute"),
        ("ATSAgent", "score", "suggest"),
        ("JobSearchAgent", "search", "execute"),
        ("ApplicationAgent", "prepare", "execute"),
        ("GmailAgent", "classify_emails", "execute"),
        ("GmailAgentHandler", "classify_emails", "execute"),
        ("DriveAgent", "process", "execute"),
        ("DriveAgentHandler", "process", "execute"),
        ("SchedulerAgent", "check_conflicts", "execute"),
        ("MemoryAgent", "execute", "execute"),
        ("MemoryAgentHandler", "execute", "execute"),
        ("UnknownAgent", "fallback", "execute"),
    ])
    async def test_dispatch_paths(self, agent_type, method_name, expected_action):
        from api.orchestrator.loop import act_phase, AgentRequest
        agent = _make_agent(agent_type)
        req = AgentRequest(agent, "r1", "test message", "ws1")
        plan = {"agent_type": agent_type, "message": "test message", "workspace_id": "ws1"}
        result = await act_phase(plan, req)
        assert result["action"] == expected_action, f"{agent_type}: expected {expected_action}, got {result.get('action')}"

    async def test_error_returns_error_dict(self):
        from api.orchestrator.loop import act_phase, AgentRequest
        class FailingAgent:
            pass

        agent = FailingAgent()
        req = AgentRequest(agent, "r1", "test", "ws1")
        plan = {"agent_type": "FailingAgent", "message": "test", "workspace_id": "ws1"}
        result = await act_phase(plan, req)
        assert result["action"] == "error"
        assert result["confidence"] == 0.0
        assert "Execution error" in result["result"]["summary"]

    async def test_resume_agent_execute_with_profile(self):
        from api.orchestrator.loop import act_phase, AgentRequest
        agent = _make_agent("ResumeAgent")
        req = AgentRequest(agent, "r1", "Python", "ws1")
        plan = {"agent_type": "ResumeAgent", "message": "Python", "workspace_id": "ws1"}
        result = await act_phase(plan, req)
        assert result["action"] == "execute"


class TestObservePhase:
    async def test_returns_observe_dict(self):
        from api.orchestrator.loop import observe_phase
        act_result = {"action": "execute", "confidence": 0.9, "result": {"summary": "task done", "details": {}}}
        obs = await observe_phase(act_result)
        assert obs["observation"] == "task done"
        assert obs["action"] == "execute"
        assert obs["confidence"] == 0.9
        assert obs["payload"] == act_result

    async def test_missing_fields_default(self):
        from api.orchestrator.loop import observe_phase
        obs = await observe_phase({})
        assert obs["observation"] == ""
        assert obs["action"] is None
        assert obs["confidence"] == 0.0
        assert obs["payload"] == {}


class TestReflectPhase:
    @pytest.mark.parametrize("action, confidence, iteration, expected_satisfied, expected_reason_substr", [
        ("execute", 0.0, 0, True, "Executed successfully"),
        ("suggest", 0.7, 0, True, "Good suggestion"),
        ("suggest", 0.8, 0, True, "Good suggestion"),
        ("suggest", 0.69, 0, False, "Max iterations"),
        ("suggest", 0.5, 2, True, "Max iterations"),
        ("error", 0.0, 0, False, "retrying"),
        ("error", 0.0, 1, False, "retrying"),
        ("error", 0.0, 2, True, "escalating"),
        ("ask_clarification", 0.0, 0, False, "Need more info"),
        ("ask_clarification", 0.0, 1, False, "Need more info"),
        ("ask_clarification", 0.0, 2, True, "escalating"),
        ("unknown_action", 0.0, 0, False, "Max iterations"),
        ("unknown_action", 0.0, 2, True, "Max iterations"),
    ])
    async def test_reflect_paths(self, action, confidence, iteration, expected_satisfied, expected_reason_substr):
        from api.orchestrator.loop import reflect_phase, AgentRequest
        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "r1", "msg", "ws1")
        observe_result = {"action": action, "confidence": confidence}
        result = await reflect_phase(req, observe_result, iteration)
        assert result.is_satisfied is expected_satisfied
        assert expected_reason_substr in result.reason, f"reason was: {result.reason}"


class TestImprovePhase:
    async def test_returns_latest_observe_summary(self):
        from api.orchestrator.loop import improve_phase, AgentRequest
        from api.orchestrator.state import LoopState
        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "r1", "msg", "ws1")
        state = LoopState("r1")
        state.add_phase("observe_2", {"payload": {"result": {"summary": "final"}}})
        resp = await improve_phase(state, req)
        assert resp.status == "success"
        assert resp.final_result == "final"

    async def test_falls_back_to_deepest_available(self):
        from api.orchestrator.loop import improve_phase, AgentRequest
        from api.orchestrator.state import LoopState
        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "r1", "msg", "ws1")
        state = LoopState("r1")
        state.add_phase("observe_1", {"payload": {"result": {"summary": "mid"}}})
        resp = await improve_phase(state, req)
        assert resp.final_result == "mid"

    async def test_no_observations_returns_default(self):
        from api.orchestrator.loop import improve_phase, AgentRequest
        from api.orchestrator.state import LoopState
        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "r1", "msg", "ws1")
        state = LoopState("r1")
        resp = await improve_phase(state, req)
        assert resp.status == "success"
        assert resp.final_result == "Task completed"


class TestEscalate:
    async def test_returns_escalated(self):
        from api.orchestrator.loop import escalate_to_user
        from api.orchestrator.state import LoopState
        state = LoopState("r1")
        resp = await escalate_to_user(state)
        assert resp.status == "escalated"
        assert resp.final_result == "max retries exceeded"


class TestRunAgentLoop:
    async def test_satisfied_on_first_iteration(self, tmp_path, monkeypatch):
        from api.orchestrator.loop import run_agent_loop, AgentRequest
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "loop-r1", "do something", "ws1")
        resp = await run_agent_loop(req)
        assert resp.status == "success"
    async def test_max_iterations_returns_success(self, tmp_path, monkeypatch):
        from api.orchestrator.loop import run_agent_loop, AgentRequest, act_phase
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))

        async def never_satisfying_act(plan, request):
            return {"action": "suggest", "confidence": 0.0, "result": {"summary": "still trying", "details": {}, "proposals": [], "questions": []}}

        from api.orchestrator import loop as loop_module
        monkeypatch.setattr(loop_module, "act_phase", never_satisfying_act)

        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "loop-r2", "tricky task", "ws1")

        resp = await run_agent_loop(req)
        assert resp.status == "success"

    async def test_max_iterations_escalates(self, tmp_path, monkeypatch):
        from api.orchestrator.loop import run_agent_loop, AgentRequest, reflect_phase
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))

        async def never_satisfied(*a, **kw):
            from api.orchestrator.loop import ReflectResult
            return ReflectResult(False, "never ok")

        from api.orchestrator import loop as loop_module
        monkeypatch.setattr(loop_module, "reflect_phase", never_satisfied)

        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "loop-escalate", "hard task", "ws1")
        resp = await run_agent_loop(req)
        assert resp.status == "escalated"

    async def test_checkpoint_is_called(self, tmp_path, monkeypatch):
        from api.orchestrator.loop import run_agent_loop, AgentRequest
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))

        calls = []
        from api.orchestrator import loop as loop_module
        orig_save = loop_module.save_checkpoint

        async def tracking_save(state):
            calls.append(("save", state.request_id, len(state.phases)))
            await orig_save(state)

        monkeypatch.setattr(loop_module, "save_checkpoint", tracking_save)

        agent = _make_agent("TestAgent")
        req = AgentRequest(agent, "loop-r3", "task", "ws1")
        await run_agent_loop(req)
        assert len(calls) >= 4


class TestLoopState:
    def test_init_creates_timestamps(self):
        from api.orchestrator.state import LoopState
        state = LoopState("req-1")
        assert state.request_id == "req-1"
        assert state.phases == {}
        assert state.created_at is not None
        assert state.updated_at == state.created_at

    def test_add_phase(self):
        from api.orchestrator.state import LoopState
        state = LoopState("req-1")
        state.add_phase("plan_0", {"key": "val"})
        assert state.phases["plan_0"] == {"key": "val"}
        assert state.updated_at != state.created_at

    def test_to_dict(self):
        from api.orchestrator.state import LoopState
        state = LoopState("req-1")
        state.add_phase("plan_0", {"a": 1})
        d = state.to_dict()
        assert d["request_id"] == "req-1"
        assert d["phases"] == {"plan_0": {"a": 1}}
        assert "created_at" in d
        assert "updated_at" in d

    def test_serialize_phases_pydantic_model_dump(self):
        from api.orchestrator.state import LoopState
        from pydantic import BaseModel
        class M(BaseModel):
            x: int
        state = LoopState("r1")
        state.phases["m"] = M(x=42)
        ser = state._serialize_phases()
        assert ser["m"] == {"x": 42}

    def test_serialize_phases_primitive(self):
        from api.orchestrator.state import LoopState
        state = LoopState("r1")
        state.phases["s"] = "hello"
        state.phases["i"] = 42
        state.phases["f"] = 3.14
        state.phases["b"] = True
        state.phases["l"] = [1, 2]
        state.phases["d"] = {"k": "v"}
        ser = state._serialize_phases()
        assert ser["s"] == "hello"
        assert ser["i"] == 42
        assert ser["f"] == 3.14
        assert ser["b"] is True
        assert ser["l"] == [1, 2]
        assert ser["d"] == {"k": "v"}

    def test_serialize_phases_dict_method(self):
        from api.orchestrator.state import LoopState
        state = LoopState("r1")
        class HasDict:
            def dict(self):
                return {"from_dict": True}
        state.phases["obj"] = HasDict()
        ser = state._serialize_phases()
        assert ser["obj"] == {"from_dict": True}

    def test_serialize_phases_fallback_str(self):
        from api.orchestrator.state import LoopState
        state = LoopState("r1")
        state.phases["obj"] = object()
        ser = state._serialize_phases()
        assert isinstance(ser["obj"], str)

    def test_from_dict(self):
        from api.orchestrator.state import LoopState
        data = {"request_id": "r1", "phases": {"plan_0": {"a": 1}}, "created_at": "t1", "updated_at": "t2"}
        state = LoopState.from_dict(data)
        assert state.request_id == "r1"
        assert state.phases == {"plan_0": {"a": 1}}
        assert state.created_at == "t1"
        assert state.updated_at == "t2"


class TestStatePersistence:
    async def test_load_or_create_new(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.state import load_or_create_state
        state = await load_or_create_state("fresh-req")
        assert state.request_id == "fresh-req"
        assert state.phases == {}

    async def test_load_or_create_existing(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.state import load_or_create_state, save_checkpoint, LoopState
        state = LoopState("existing-req")
        state.add_phase("plan_0", {"done": True})
        await save_checkpoint(state)
        loaded = await load_or_create_state("existing-req")
        assert loaded.request_id == "existing-req"
        assert loaded.phases == {"plan_0": {"done": True}}

    async def test_load_or_create_corrupt_json(self, tmp_path, monkeypatch, caplog):
        caplog.set_level(logging.WARNING)
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.state import STATE_DIR
        (STATE_DIR / "bad.json").write_text("{invalid json!!!}")
        from api.orchestrator.state import load_or_create_state
        state = await load_or_create_state("bad")
        assert state.request_id == "bad"
        assert state.phases == {}
        assert any("Failed to load state" in msg for msg in caplog.messages)

    async def test_save_checkpoint_writes_file(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.state import save_checkpoint, LoopState, STATE_DIR
        state = LoopState("save-me")
        state.add_phase("act_0", {"result": "ok"})
        await save_checkpoint(state)
        saved = json.loads((STATE_DIR / "save-me.json").read_text())
        assert saved["request_id"] == "save-me"
        assert saved["phases"] == {"act_0": {"result": "ok"}}

    async def test_save_checkpoint_handles_oserror(self, monkeypatch, caplog):
        caplog.set_level(logging.ERROR)
        from api.orchestrator.state import save_checkpoint, LoopState, STATE_DIR
        import os

        state = LoopState("fail-write")

        original_state_dir = STATE_DIR
        state_dir_str = str(original_state_dir)
        try:
            os.makedirs(state_dir_str, exist_ok=True)
            readonly = (original_state_dir / f"{state.request_id}.json")
            readonly.touch()

            import stat
            os.chmod(str(readonly), stat.S_IREAD)

            monkeypatch.setattr("api.orchestrator.state.STATE_DIR", original_state_dir)
            state.phases["some_data"] = "x" * 10000
            await save_checkpoint(state)
            assert any("Failed to save checkpoint" in msg for msg in caplog.messages)
        finally:
            if readonly.exists():
                os.chmod(str(readonly), stat.S_IWRITE)
                readonly.unlink()
