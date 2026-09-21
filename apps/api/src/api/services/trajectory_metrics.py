"""Per-run trajectory metrics: tool-F1, cost, latency, steps, hallucinations.

Deterministic, dependency-free supplement to services/trajectory_eval.py
(which scores a stored LoopState dict): this module records one row per run
as it happens and aggregates across runs.

- compute_tool_f1(): set-based tool-selection F1 vs an expected tool set.
  When no expected set is provided the F1 is None (not 0.0) — absence of
  an expectation must not read as failure.
- TrajectoryCollector: in-memory per-run records + summarize() aggregates.
- JSONL append hook: opt-in via TRAJECTORY_METRICS_JSONL=<path>, default
  off (env unset/empty writes nothing). Best-effort: I/O failures never
  raise into the run path.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

JSONL_ENV_VAR = "TRAJECTORY_METRICS_JSONL"


def compute_tool_f1(
    predicted_tools: list[str] | None,
    expected_tools: list[str] | None,
) -> dict[str, Any]:
    """Set-based precision/recall/F1 of executed tools vs expected tools.

    Order-insensitive, duplicates collapsed. When expected_tools is None
    (no expectation provided) precision/recall/f1 are None.
    """
    predicted = {str(t) for t in (predicted_tools or []) if t is not None}
    if expected_tools is None:
        return {
            "precision": None, "recall": None, "f1": None,
            "tp": 0, "predicted": len(predicted), "expected": None,
        }
    expected = {str(t) for t in (expected_tools or []) if t is not None}
    tp = len(predicted & expected)
    precision = (tp / len(predicted)) if predicted else (1.0 if not expected else 0.0)
    recall = (tp / len(expected)) if expected else 1.0
    denom = precision + recall
    f1 = (2 * precision * recall / denom) if denom > 0 else 0.0
    return {
        "precision": round(precision, 4), "recall": round(recall, 4),
        "f1": round(f1, 4), "tp": tp,
        "predicted": len(predicted), "expected": len(expected),
    }


@dataclass
class TrajectoryRecord:
    run_id: str
    agent_name: str = ""
    steps: int = 0
    tool_calls: int = 0
    tool_errors: int = 0
    hallucinations: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    predicted_tools: list[str] = field(default_factory=list)
    expected_tools: list[str] | None = None

    def to_dict(self) -> dict[str, Any]:
        f1 = compute_tool_f1(self.predicted_tools, self.expected_tools)
        calls = max(0, int(self.tool_calls))
        return {
            "run_id": self.run_id,
            "agent_name": self.agent_name,
            "steps": int(self.steps),
            "tool_calls": calls,
            "tool_errors": int(self.tool_errors),
            "hallucination_count": int(self.hallucinations),
            "cost_usd": round(float(self.cost_usd), 6),
            "latency_ms": round(float(self.latency_ms), 3),
            "predicted_tools": list(self.predicted_tools or []),
            "expected_tools": list(self.expected_tools) if self.expected_tools is not None else None,
            "tool_precision": f1["precision"],
            "tool_recall": f1["recall"],
            "tool_f1": f1["f1"],
            "error_rate": round(self.tool_errors / calls, 4) if calls else 0.0,
            "hallucination_rate": round(self.hallucinations / calls, 4) if calls else 0.0,
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }


def _maybe_append_jsonl(payload: dict[str, Any]) -> None:
    path = os.environ.get(JSONL_ENV_VAR, "")
    if not path:
        return  # opt-in hook, default off
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, default=str) + "\n")
    except Exception as exc:
        logger.debug(f"trajectory metrics JSONL append skipped: {exc}")


class TrajectoryCollector:
    """In-memory per-run collector with aggregate summarize()."""

    def __init__(self) -> None:
        self._records: list[dict[str, Any]] = []

    @property
    def records(self) -> list[dict[str, Any]]:
        return list(self._records)

    def record(
        self,
        run_id: str,
        agent_name: str = "",
        *,
        steps: int = 0,
        tool_calls: int = 0,
        tool_errors: int = 0,
        hallucinations: int = 0,
        cost_usd: float = 0.0,
        latency_ms: float = 0.0,
        predicted_tools: list[str] | None = None,
        expected_tools: list[str] | None = None,
    ) -> dict[str, Any]:
        row = TrajectoryRecord(
            run_id=run_id, agent_name=agent_name, steps=steps,
            tool_calls=tool_calls, tool_errors=tool_errors,
            hallucinations=hallucinations, cost_usd=cost_usd,
            latency_ms=latency_ms,
            predicted_tools=list(predicted_tools or []),
            expected_tools=list(expected_tools) if expected_tools is not None else None,
        ).to_dict()
        self._records.append(row)
        _maybe_append_jsonl(row)
        return row

    def summarize(self) -> dict[str, Any]:
        n = len(self._records)
        if n == 0:
            return {
                "runs": 0, "avg_tool_f1": 0.0, "f1_runs": 0,
                "total_cost_usd": 0.0, "avg_latency_ms": 0.0,
                "total_steps": 0, "total_tool_calls": 0,
                "total_tool_errors": 0, "total_hallucinations": 0,
                "error_rate": 0.0, "hallucination_rate": 0.0,
            }
        f1s = [r["tool_f1"] for r in self._records if r.get("tool_f1") is not None]
        calls = sum(r["tool_calls"] for r in self._records)
        errors = sum(r["tool_errors"] for r in self._records)
        halls = sum(r["hallucination_count"] for r in self._records)
        return {
            "runs": n,
            "avg_tool_f1": round(sum(f1s) / len(f1s), 4) if f1s else 0.0,
            "f1_runs": len(f1s),
            "total_cost_usd": round(sum(r["cost_usd"] for r in self._records), 6),
            "avg_latency_ms": round(sum(r["latency_ms"] for r in self._records) / n, 3),
            "total_steps": sum(r["steps"] for r in self._records),
            "total_tool_calls": calls,
            "total_tool_errors": errors,
            "total_hallucinations": halls,
            "error_rate": round(errors / calls, 4) if calls else 0.0,
            "hallucination_rate": round(halls / calls, 4) if calls else 0.0,
        }

    def reset(self) -> None:
        self._records.clear()


# Process-wide default collector (tests should construct their own).
collector = TrajectoryCollector()


def record_trajectory(run_id: str, agent_name: str = "", **kwargs: Any) -> dict[str, Any]:
    """Record one run into the process-wide collector."""
    return collector.record(run_id, agent_name, **kwargs)
