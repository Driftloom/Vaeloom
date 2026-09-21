"""Trajectory metrics + loop-safety error stops + deadline-aware sleep.

Pure unit tests (no DB, no LLM): prove record/summarize math, the JSONL
opt-in hook (default off), the agent_eval trajectory wrappers, the
LoopSafetyTracker consecutive-error / unknown-tool policy_stop trips, and
the _deadline_aware_sleep min(sleep, remaining) semantics.
"""
import json
import time

from api.infrastructure.agent_eval import score_tool_trajectory, tool_f1
from api.orchestrator.loop import _deadline_aware_sleep, _deadline_remaining_s
from api.orchestrator.loop_safety import LoopSafetyTracker
from api.services.trajectory_metrics import (
    TrajectoryCollector,
    compute_tool_f1,
)


# ── tool-F1 math ──────────────────────────────────────────────────────

class TestToolF1:
    def test_perfect_match_is_one(self):
        out = compute_tool_f1(["a", "b"], ["b", "a"])
        assert out["f1"] == 1.0
        assert out["precision"] == 1.0
        assert out["recall"] == 1.0
        assert out["tp"] == 2

    def test_partial_match_math(self):
        # tp=2, p=2/3, r=2/3 -> f1=2/3
        out = compute_tool_f1(["a", "b", "c"], ["b", "c", "d"])
        assert out["precision"] == round(2 / 3, 4)
        assert out["recall"] == round(2 / 3, 4)
        assert out["f1"] == round(2 / 3, 4)

    def test_no_expectation_is_none_not_zero(self):
        out = compute_tool_f1(["a"], None)
        assert out["f1"] is None
        assert out["precision"] is None
        assert out["expected"] is None

    def test_both_empty_is_one(self):
        assert compute_tool_f1([], [])["f1"] == 1.0

    def test_predicted_empty_expected_nonempty_is_zero(self):
        assert compute_tool_f1([], ["a"])["f1"] == 0.0

    def test_duplicates_collapsed(self):
        out = compute_tool_f1(["a", "a"], ["a"])
        assert out["f1"] == 1.0
        assert out["predicted"] == 1


# ── collector record/summarize ────────────────────────────────────────

def _collector() -> TrajectoryCollector:
    return TrajectoryCollector()


class TestCollector:
    def test_record_derives_rates_and_counts(self):
        c = _collector()
        row = c.record(
            "run-1", "memory",
            steps=3, tool_calls=4, tool_errors=1, hallucinations=2,
            cost_usd=0.01, latency_ms=150.0,
            predicted_tools=["a", "b"], expected_tools=["b", "c"],
        )
        assert row["run_id"] == "run-1"
        assert row["hallucination_count"] == 2
        assert row["error_rate"] == 0.25
        assert row["hallucination_rate"] == 0.5
        assert row["tool_f1"] == round(0.5, 4)  # tp=1 p=1/2 r=1/2
        assert row["cost_usd"] == 0.01
        assert row["latency_ms"] == 150.0

    def test_summarize_aggregates(self):
        c = _collector()
        c.record("r1", "a", steps=2, tool_calls=4, tool_errors=1,
                 hallucinations=0, cost_usd=0.02, latency_ms=100.0,
                 predicted_tools=["a", "b"], expected_tools=["a", "b"])  # f1=1
        c.record("r2", "a", steps=4, tool_calls=2, tool_errors=2,
                 hallucinations=1, cost_usd=0.04, latency_ms=300.0,
                 predicted_tools=["x"], expected_tools=["y"])  # f1=0
        s = c.summarize()
        assert s["runs"] == 2
        assert s["f1_runs"] == 2
        assert s["avg_tool_f1"] == 0.5
        assert s["total_cost_usd"] == 0.06
        assert s["avg_latency_ms"] == 200.0
        assert s["total_steps"] == 6
        assert s["total_tool_calls"] == 6
        assert s["total_tool_errors"] == 3
        assert s["total_hallucinations"] == 1
        assert s["error_rate"] == 0.5
        assert s["hallucination_rate"] == round(1 / 6, 4)

    def test_summarize_skips_none_f1_in_average(self):
        c = _collector()
        c.record("r1", predicted_tools=["a"])  # no expectation -> f1 None
        c.record("r2", predicted_tools=["a"], expected_tools=["a"])  # f1=1
        s = c.summarize()
        assert s["runs"] == 2
        assert s["f1_runs"] == 1
        assert s["avg_tool_f1"] == 1.0

    def test_summarize_empty(self):
        s = _collector().summarize()
        assert s["runs"] == 0
        assert s["avg_tool_f1"] == 0.0
        assert s["error_rate"] == 0.0

    def test_reset_clears(self):
        c = _collector()
        c.record("r1")
        c.reset()
        assert c.records == []
        assert c.summarize()["runs"] == 0


# ── JSONL hook (opt-in, default off) ──────────────────────────────────

class TestJsonlHook:
    def test_off_by_default_writes_nothing(self, monkeypatch, tmp_path):
        monkeypatch.delenv("TRAJECTORY_METRICS_JSONL", raising=False)
        target = tmp_path / "metrics.jsonl"
        _collector().record("run-off", "a", tool_calls=1)
        assert not target.exists()

    def test_on_appends_one_line_per_run(self, monkeypatch, tmp_path):
        target = tmp_path / "metrics.jsonl"
        monkeypatch.setenv("TRAJECTORY_METRICS_JSONL", str(target))
        c = _collector()
        c.record("run-a", "a", tool_calls=1)
        c.record("run-b", "a", tool_calls=2)
        lines = target.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 2
        assert [json.loads(line)["run_id"] for line in lines] == ["run-a", "run-b"]

    def test_io_failure_never_raises(self, monkeypatch, tmp_path):
        monkeypatch.setenv("TRAJECTORY_METRICS_JSONL", str(tmp_path / "nope" / "m.jsonl"))
        _collector().record("run-x")  # missing dir -> swallowed


# ── agent_eval trajectory wrappers ────────────────────────────────────

class TestAgentEvalTrajectory:
    def test_tool_f1_wrapper(self):
        assert tool_f1(["a"], ["a"]) == 1.0
        assert tool_f1(["a"], None) is None

    def test_score_pass(self):
        out = score_tool_trajectory(["a", "b"], ["a", "b"],
                                    tool_calls=2, tool_errors=0, hallucinations=0)
        assert out["tool_f1"] == 1.0
        assert out["error_rate"] == 0.0
        assert out["passed"] is True

    def test_score_fails_on_low_f1(self):
        out = score_tool_trajectory(["x"], ["y"], tool_calls=1, min_f1=0.5)
        assert out["tool_f1"] == 0.0
        assert out["passed"] is False

    def test_score_fails_on_error_rate(self):
        out = score_tool_trajectory(["a"], ["a"], tool_calls=4,
                                    tool_errors=3, max_error_rate=0.5)
        assert out["error_rate"] == 0.75
        assert out["passed"] is False

    def test_score_no_expectation_judges_errors_only(self):
        out = score_tool_trajectory(["a"], None, tool_calls=1, tool_errors=0)
        assert out["tool_f1"] is None
        assert out["passed"] is True


# ── loop-safety error stops ───────────────────────────────────────────

class TestErrorStops:
    def test_four_consecutive_errors_trip_policy_stop(self):
        t = LoopSafetyTracker()
        for _ in range(3):
            t.record_tool_outcome(success=False)
            assert t.check_error_stops() is None
        t.record_tool_outcome(success=False)
        assert t.check_error_stops() == "policy_stop"
        assert t.error_stop_detail == "consecutive_tool_errors"

    def test_success_resets_streak(self):
        t = LoopSafetyTracker()
        for _ in range(3):
            t.record_tool_outcome(success=False)
        t.record_tool_outcome(success=True)
        t.record_tool_outcome(success=False)
        assert t.check_error_stops() is None
        assert t.consecutive_tool_errors == 1

    def test_four_unknown_tools_trip_policy_stop(self):
        t = LoopSafetyTracker()
        for _ in range(3):
            t.record_tool_outcome(success=False, unknown_tool=True)
            assert t.check_error_stops() is None
        t.record_tool_outcome(success=False, unknown_tool=True)
        assert t.check_error_stops() == "policy_stop"
        assert t.error_stop_detail == "unknown_tool_rate"

    def test_policy_stop_is_valid_termination_reason(self):
        from api.orchestrator.state import TERMINATION_REASONS
        assert LoopSafetyTracker().check_error_stops() is None  # no trip, no reason
        assert "policy_stop" in TERMINATION_REASONS

    def test_custom_thresholds(self):
        t = LoopSafetyTracker(max_consecutive_tool_errors=2, max_unknown_tools=2)
        t.record_tool_outcome(success=False)
        t.record_tool_outcome(success=False)
        assert t.check_error_stops() == "policy_stop"

    def test_snapshot_carries_counters(self):
        t = LoopSafetyTracker()
        t.record_tool_outcome(success=False, unknown_tool=True)
        snap = t.snapshot()
        assert snap["consecutive_tool_errors"] == 1
        assert snap["unknown_tool_count"] == 1


# ── deadline-aware sleep ──────────────────────────────────────────────

class TestDeadlineSleep:
    def test_no_deadline_is_unbounded(self):
        assert _deadline_remaining_s(None) == float("inf")

    async def test_past_deadline_returns_true_immediately(self):
        start = time.monotonic()
        assert await _deadline_aware_sleep(30.0, time.monotonic() - 1.0) is True
        assert time.monotonic() - start < 5.0  # never slept the 30s

    async def test_zero_sleep_no_deadline(self):
        assert await _deadline_aware_sleep(0, None) is False

    async def test_short_sleep_with_future_deadline(self):
        assert await _deadline_aware_sleep(0, time.monotonic() + 60.0) is False

    async def test_sleep_capped_by_remaining(self):
        # 60s requested, ~50ms remaining: must wake after ~50ms, reporting True.
        start = time.monotonic()
        assert await _deadline_aware_sleep(60.0, time.monotonic() + 0.05) is True
        assert time.monotonic() - start < 5.0
