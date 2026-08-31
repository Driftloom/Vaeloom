"""Agent quality metrics and runtime kill switches.

Tracks per-agent success rate, latency, cost, and error patterns.
Provides admin endpoints for toggling agents at runtime.
"""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class AgentMetric:
    timestamp: float
    agent_name: str
    success: bool
    latency_ms: float
    cost_usd: float = 0.0
    error_type: str | None = None
    confidence: float = 0.0
    iteration_count: int = 1


class AgentMetricsCollector:
    """Collects and aggregates agent quality metrics."""

    def __init__(self, max_records: int = 10000):
        self._records: list[AgentMetric] = []
        self._max_records = max_records
        self._by_agent: dict[str, list[AgentMetric]] = defaultdict(list)

    def record(self, metric: AgentMetric) -> None:
        self._records.append(metric)
        self._by_agent[metric.agent_name].append(metric)
        # Prune if over limit
        if len(self._records) > self._max_records:
            self._records = self._records[-self._max_records:]
            self._by_agent = defaultdict(list, {
                k: v[-self._max_records:] for k, v in self._by_agent.items()
            })

    def get_agent_stats(self, agent_name: str) -> dict:
        records = self._by_agent.get(agent_name, [])
        if not records:
            return {
                "agent": agent_name,
                "total_calls": 0,
                "success_rate": 0.0,
                "avg_latency_ms": 0.0,
                "total_cost_usd": 0.0,
                "error_count": 0,
                "avg_confidence": 0.0,
            }

        successes = [r for r in records if r.success]
        errors = [r for r in records if not r.success]
        error_types = defaultdict(int)
        for e in errors:
            if e.error_type:
                error_types[e.error_type] += 1

        return {
            "agent": agent_name,
            "total_calls": len(records),
            "success_rate": round(len(successes) / len(records), 4),
            "avg_latency_ms": round(sum(r.latency_ms for r in records) / len(records), 1),
            "p95_latency_ms": round(sorted(r.latency_ms for r in records)[int(len(records) * 0.95)] if len(records) >= 2 else records[0].latency_ms, 1),
            "total_cost_usd": round(sum(r.cost_usd for r in records), 6),
            "error_count": len(errors),
            "error_types": dict(error_types),
            "avg_confidence": round(sum(r.confidence for r in records) / len(records), 4),
            "avg_iterations": round(sum(r.iteration_count for r in records) / len(records), 2),
        }

    def get_all_stats(self) -> dict:
        agents = {r.agent_name for r in self._records}
        return {agent: self.get_agent_stats(agent) for agent in sorted(agents)}

    def get_health_summary(self) -> dict:
        """Quick health check: any agent below thresholds?"""
        stats = self.get_all_stats()
        unhealthy = {}
        for agent, s in stats.items():
            issues = []
            if s["total_calls"] > 10 and s["success_rate"] < 0.8:
                issues.append(f"low success rate: {s['success_rate']:.1%}")
            if s["avg_latency_ms"] > 30000:
                issues.append(f"high latency: {s['avg_latency_ms']:.0f}ms")
            if s["error_count"] > s["total_calls"] * 0.3 and s["total_calls"] > 5:
                issues.append(f"high error rate: {s['error_count']}/{s['total_calls']}")
            if issues:
                unhealthy[agent] = issues

        return {
            "total_agents": len(stats),
            "healthy": len(stats) - len(unhealthy),
            "unhealthy": unhealthy,
        }


# ── Runtime Kill Switches ──────────────────────────────────────────

class AgentKillSwitch:
    """Runtime toggles for agent enable/disable.

    Changes take effect immediately without restart.
    """

    def __init__(self):
        self._disabled: set[str] = set()
        self._overrides: dict[str, dict] = {}

    def disable(self, agent_name: str, reason: str = "") -> None:
        self._disabled.add(agent_name)
        self._overrides[agent_name] = {"enabled": False, "reason": reason, "timestamp": time.time()}
        logger.warning("Kill switch ACTIVATED for agent '%s': %s", agent_name, reason)

    def enable(self, agent_name: str) -> None:
        self._disabled.discard(agent_name)
        self._overrides[agent_name] = {"enabled": True, "reason": "", "timestamp": time.time()}
        logger.info("Agent '%s' re-enabled", agent_name)

    def is_enabled(self, agent_name: str) -> bool:
        return agent_name not in self._disabled

    def get_status(self) -> dict:
        return {
            "disabled_agents": list(self._disabled),
            "overrides": dict(self._overrides),
        }

    def disable_all(self, reason: str = "Global kill switch") -> None:
        """Emergency: disable all agents."""
        from ..orchestrator.router import AGENT_REGISTRY
        for name in AGENT_REGISTRY:
            self.disable(name, reason)

    def enable_all(self) -> None:
        self._disabled.clear()
        self._overrides.clear()


# ── OBS-001: Latency histograms (in-process, Prometheus bridge optional)
# Lightweight histogram for retrieval / tool / embedding latencies.
# Prometheus Histograms will scrape these via custom collector when available.
class _LatencyHistogram:
    def __init__(self, name: str, buckets: list[float] | None = None):
        self.name = name
        self.buckets = buckets or [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
        self._counts: list[int] = [0] * (len(self.buckets) + 1)
        self._sum = 0.0
        self._count = 0

    def observe(self, value_ms: float) -> None:
        self._sum += value_ms
        self._count += 1
        for i, b in enumerate(self.buckets):
            if value_ms <= b:
                self._counts[i] += 1
                return
        self._counts[-1] += 1

    def snapshot(self) -> dict:
        return {"name": self.name, "count": self._count, "sum_ms": round(self._sum, 2), "buckets": self.buckets, "counts": list(self._counts)}


_rag_latency = _LatencyHistogram("vaeloom_rag_latency_ms", [5, 10, 25, 50, 100, 250, 500, 1000, 2500])
_tool_latency = _LatencyHistogram("vaeloom_tool_latency_ms", [10, 50, 100, 250, 500, 1000, 5000, 10000, 30000])
_embedding_latency = _LatencyHistogram("vaeloom_embedding_latency_ms", [50, 100, 250, 500, 1000, 2500, 5000])


def record_rag_latency(ms: float) -> None:
    _rag_latency.observe(ms)


def record_tool_latency(ms: float) -> None:
    _tool_latency.observe(ms)


def record_embedding_latency(ms: float) -> None:
    _embedding_latency.observe(ms)


def get_latency_snapshots() -> dict:
    return {
        "rag": _rag_latency.snapshot(),
        "tool": _tool_latency.snapshot(),
        "embedding": _embedding_latency.snapshot(),
    }


# Singletons
metrics_collector = AgentMetricsCollector()
kill_switch = AgentKillSwitch()
