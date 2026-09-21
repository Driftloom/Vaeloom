"""Tests for AI Agent Observability, Token Accounting, Cost Budgets, Cycle Prevention,
and Dynamic Kill Switches.
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
from api.orchestrator.loop_safety import LoopSafetyTracker, tool_fingerprint


def test_loop_safety_budget_enforcement_tokens():
    """Verify LoopSafetyTracker trips token_budget when token threshold is reached."""
    tracker = LoopSafetyTracker(max_tokens=1000)
    tracker.record_tool("search_documents", tokens=600, cost_usd=0.01)
    assert tracker.check_budgets() is None

    tracker.record_tool("get_document_content", tokens=450, cost_usd=0.005)
    assert tracker.check_budgets() == "token_budget"


def test_loop_safety_budget_enforcement_cost():
    """Verify LoopSafetyTracker trips cost_budget when USD spending limit is exceeded."""
    tracker = LoopSafetyTracker(max_cost_usd=0.05)
    tracker.record_tool("synthesize_documents", tokens=100, cost_usd=0.03)
    assert tracker.check_budgets() is None

    tracker.record_tool("query_graph", tokens=100, cost_usd=0.025)
    assert tracker.check_budgets() == "cost_budget"


def test_loop_safety_cycle_detection():
    """Verify LoopSafetyTracker detects infinite tool call loops."""
    tracker = LoopSafetyTracker()
    fp = tool_fingerprint("search_documents", {"query": "security"})

    tracker.record_tool(fp)
    assert tracker.detect_cycle() is None

    tracker.record_tool(fp)
    assert tracker.detect_cycle() is None

    # 3x identical consecutive tool call
    tracker.record_tool(fp)
    assert tracker.detect_cycle() == "cycle_detected"


def test_agent_kill_switch():
    """Verify dynamic circuit breaking via AgentKillSwitch."""
    switch = AgentKillSwitch()
    assert switch.is_enabled("document_agent") is True

    switch.disable("document_agent", reason="Emergency maintenance")
    assert switch.is_enabled("document_agent") is False

    status = switch.get_status()
    assert "document_agent" in status["disabled_agents"]
    assert status["overrides"]["document_agent"]["reason"] == "Emergency maintenance"

    switch.enable("document_agent")
    assert switch.is_enabled("document_agent") is True


def test_agent_metrics_collector_aggregation():
    """Verify metrics aggregation, success rates, latency calculation, and cost accounting."""
    collector = AgentMetricsCollector()

    for i in range(10):
        collector.record(
            AgentMetric(
                timestamp=100.0 + i,
                agent_name="document_agent",
                success=True if i < 9 else False,
                latency_ms=100.0 + (i * 20),
                cost_usd=0.002,
                error_type=None if i < 9 else "RateLimitError",
                confidence=0.9,
            )
        )

    stats = collector.get_agent_stats("document_agent")
    assert stats["total_calls"] == 10
    assert stats["success_rate"] == 0.9
    assert stats["error_count"] == 1
    assert stats["error_types"].get("RateLimitError") == 1
    assert stats["total_cost_usd"] == 0.02
    assert stats["p95_latency_ms"] >= 260.0


def test_latency_histograms():
    """Verify in-process latency histogram recording for RAG, Tools, and Embeddings."""
    record_rag_latency(45.5)
    record_tool_latency(120.0)
    record_embedding_latency(22.0)

    snapshots = get_latency_snapshots()
    assert snapshots["rag"]["count"] >= 1
    assert snapshots["tool"]["count"] >= 1
    assert snapshots["embedding"]["count"] >= 1
