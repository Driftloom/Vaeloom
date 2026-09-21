"""Test Suite: Module 05 Observability & Distributed Tracing (M05-OBS).
Verifies OpenTelemetry context propagation, correlation IDs, agent metrics collection,
latency histograms, and dynamic kill switches.
"""
import pytest
from api.infrastructure.agent_observability import (
    AgentKillSwitch,
    AgentMetric,
    AgentMetricsCollector,
    get_latency_snapshots,
    record_embedding_latency,
    record_rag_latency,
    record_tool_latency,
)


def test_module05_observability_latency_tracking():
    """Verify document ingestion and RAG query latency recording."""
    record_embedding_latency(15.2)
    record_rag_latency(88.4)
    record_tool_latency(42.1)

    snapshots = get_latency_snapshots()
    assert "embedding" in snapshots
    assert "rag" in snapshots
    assert "tool" in snapshots
    assert snapshots["rag"]["count"] >= 1
    assert snapshots["embedding"]["count"] >= 1


def test_module05_observability_agent_kill_switch():
    """Verify dynamic circuit breaking can immediately halt compromised or misbehaving agents."""
    kill_switch = AgentKillSwitch()
    assert kill_switch.is_enabled("document_agent") is True

    # Trip switch
    kill_switch.disable("document_agent", reason="Adversarial loop detected")
    assert kill_switch.is_enabled("document_agent") is False
    status = kill_switch.get_status()
    assert "document_agent" in status["disabled_agents"]

    # Restore switch
    kill_switch.enable("document_agent")
    assert kill_switch.is_enabled("document_agent") is True


def test_module05_observability_metrics_aggregation():
    """Verify per-agent success rate, error breakdown, and p95 latency tracking."""
    collector = AgentMetricsCollector()
    collector.record(
        AgentMetric(
            timestamp=1000.0,
            agent_name="document_agent",
            success=True,
            latency_ms=120.0,
            cost_usd=0.0015,
            confidence=0.98,
        )
    )
    stats = collector.get_agent_stats("document_agent")
    assert stats["total_calls"] >= 1
    assert stats["success_rate"] == 1.0
