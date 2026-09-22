"""Loop 2: run->metrics wiring, retry span caps, gated judge grading."""
from types import SimpleNamespace

import pytest

pytestmark = pytest.mark.asyncio


def _state(**over):
    base = dict(
        completed_tool_calls=[],
        phases={},
        spent={"tool_calls": 0, "tokens": 0, "cost_usd": 0.0, "elapsed_s": 0.0},
        iteration=2,
        run_id="run-1",
        agent_id="memory",
    )
    base.update(over)
    return SimpleNamespace(**base)


def _request(tools=None):
    agent = SimpleNamespace(tools=tools if tools is not None else [])
    return SimpleNamespace(id="run-1", agent_name="memory", agent=agent)


class TestRecordRunMetrics:
    async def test_f1_computed_from_declared_tools(self, monkeypatch):
        from api.orchestrator import loop as loop_mod
        from api.services import trajectory_metrics as tm

        col = tm.TrajectoryCollector()
        monkeypatch.setattr(tm, "collector", col)
        tools = [SimpleNamespace(name="search_documents"), SimpleNamespace(name="save_memory")]
        state = _state(completed_tool_calls=[
            {"tool": "search_documents", "idem_key": "a", "status": "success"},
            {"tool": "invented_tool", "idem_key": "b", "status": "error"},
        ])
        loop_mod._record_run_metrics(state, _request(tools))
        assert len(col.records) == 1
        row = col.records[0]
        assert row["tool_f1"] is not None and row["tool_f1"] < 1.0
        assert row["predicted_tools"] == ["search_documents", "invented_tool"]
        assert row["tool_errors"] == 1
        assert row["steps"] == 3

    async def test_f1_none_without_declared_tools(self, monkeypatch):
        from api.orchestrator import loop as loop_mod
        from api.services import trajectory_metrics as tm

        col = tm.TrajectoryCollector()
        monkeypatch.setattr(tm, "collector", col)
        state = _state(completed_tool_calls=[
            {"tool": "x", "idem_key": "a", "status": "success"},
        ])
        loop_mod._record_run_metrics(state, _request([]))
        assert col.records[0]["tool_f1"] is None

    async def test_hallucinations_from_safety_phase(self, monkeypatch):
        from api.orchestrator import loop as loop_mod
        from api.services import trajectory_metrics as tm

        col = tm.TrajectoryCollector()
        monkeypatch.setattr(tm, "collector", col)
        state = _state(phases={"safety_tracker": {"unknown_tool_count": 3}})
        loop_mod._record_run_metrics(state, _request([]))
        assert col.records[0]["hallucination_count"] == 3

    async def test_never_raises(self):
        from api.orchestrator import loop as loop_mod

        loop_mod._record_run_metrics(SimpleNamespace(), SimpleNamespace())


class TestRetrySpanCaps:
    # Introspection test: needs the REAL tenacity-decorated methods, so it opts
    # out of the autouse mock_llm surface via live_provider. No network is used.
    pytestmark = pytest.mark.live_provider

    def test_all_three_retries_capped_at_60s(self):
        from api.services.llm_service import LLMService

        for meth in ("generate_embedding", "_generate_completion_with_retry", "generate_completion_with_tools"):
            stop = getattr(getattr(LLMService, meth), "retry").stop
            kinds = [type(x).__name__ for x in getattr(stop, "stops", (stop,))]
            assert "stop_after_attempt" in kinds, meth
            assert "stop_after_delay" in kinds, meth


class TestJudgeTrajectory:
    def test_heuristic_fallback_by_default(self, monkeypatch):
        from api.infrastructure import agent_eval as ev

        monkeypatch.delenv(ev.JUDGE_LIVE_ENV_VAR, raising=False)
        out = ev.judge_trajectory(["a"], ["a", "b"], judge_fn=lambda p: 1.0)
        assert out["judge"] == "heuristic" and out["live_gated"] is True
        assert out["judge_score"] is None and out["tool_f1"] is not None

    def test_live_path_with_judge_fn(self, monkeypatch):
        from api.infrastructure import agent_eval as ev

        monkeypatch.setenv(ev.JUDGE_LIVE_ENV_VAR, "1")
        out = ev.judge_trajectory(["a"], ["a", "b"], judge_fn=lambda p: "0.9")
        assert out["judge"] == "llm" and out["judge_score"] == 0.9

    def test_bad_judge_output_fails_closed(self, monkeypatch):
        from api.infrastructure import agent_eval as ev

        monkeypatch.setenv(ev.JUDGE_LIVE_ENV_VAR, "1")
        out = ev.judge_trajectory(["a"], ["a"], judge_fn=lambda p: "not-a-number")
        assert out["judge"] == "llm-error" and out["judge_score"] is None
