import pytest
from uuid import uuid4
from vaeloom_agent_observability import (
    AgentMetricsCollector,
    CryptographicAuditLog,
)


def test_metrics_collector():
    collector = AgentMetricsCollector()
    collector.increment("tool_calls.total", 5)
    collector.increment("tool_calls.total", 3)
    assert collector.get_count("tool_calls.total") == 8

    collector.record_timing("turn_latency_ms", 120.0)
    collector.record_timing("turn_latency_ms", 180.0)
    assert collector.get_average_timing("turn_latency_ms") == 150.0


def test_audit_log_hash_chain_integrity():
    log = CryptographicAuditLog()
    s_id = uuid4()

    r1 = log.append_event(s_id, "career-agent", "agent_start", {"goal": "Optimize profile"})
    r2 = log.append_event(s_id, "career-agent", "tool_call", {"tool": "search_jobs"})
    r3 = log.append_event(s_id, "career-agent", "agent_complete", {"status": "ok"})

    assert log.get_chain_length() == 3
    assert r2.parent_hash == r1.current_hash
    assert r3.parent_hash == r2.current_hash
    assert log.verify_integrity() is True

    # Tampering test
    r2.payload_hash = "tampered_hash_value"
    assert log.verify_integrity() is False
