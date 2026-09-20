from collections import defaultdict


class AgentMetricsCollector:
    """In-memory and Prometheus-compatible metrics aggregator."""

    def __init__(self):
        self._counters: dict[str, int] = defaultdict(int)
        self._histograms: dict[str, list[float]] = defaultdict(list)

    def increment(self, metric_name: str, count: int = 1) -> None:
        self._counters[metric_name] += count

    def record_timing(self, metric_name: str, duration_ms: float) -> None:
        self._histograms[metric_name].append(duration_ms)

    def get_count(self, metric_name: str) -> int:
        return self._counters[metric_name]

    def get_average_timing(self, metric_name: str) -> float:
        vals = self._histograms[metric_name]
        return (sum(vals) / len(vals)) if vals else 0.0
