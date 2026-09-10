"""LangGraph direct-runner unit matrix — gating, trust, topology, bounds."""
import uuid

import pytest

from api.graph.runner import (
    ALLOWED_TRANSITIONS,
    EXPECTED_NODES,
    GRAPH_VERSION,
    assert_trusted_context_unchanged,
    clear_topology_cache,
    get_graph_stats,
    reset_graph_metrics,
    resolve_trusted_context,
    should_use_graph,
    validate_graph_topology,
)


@pytest.fixture(autouse=True)
def _clean():
    reset_graph_metrics()
    clear_topology_cache()
    yield
    reset_graph_metrics()
    clear_topology_cache()


def _ctx(**over):
    base = {"workspace_id": str(uuid.uuid4()), "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()), "agent_id": "memory",
            "request_id": str(uuid.uuid4())}
    base.update(over)
    return base


# ── Topology (§17) ───────────────────────────────────────────────────

def test_topology_validates_and_caches():
    first = validate_graph_topology()
    assert first["version"] == GRAPH_VERSION
    assert set(first["nodes"]) == EXPECTED_NODES
    assert validate_graph_topology() is first  # cached


def test_topology_map_covers_builder():
    from api.graph import get_graph_metadata
    meta = get_graph_metadata()
    assert set(meta["nodes"]) == EXPECTED_NODES
    for src, dsts in ALLOWED_TRANSITIONS.items():
        for d in dsts:
            assert d in EXPECTED_NODES or d in ("START", "END"), (src, d)


def test_topology_rejects_drift(monkeypatch):
    import api.graph.runner as _r
    monkeypatch.setattr(_r, "EXPECTED_NODES", frozenset({"nope"}))
    with pytest.raises(ValueError, match="drift"):
        validate_graph_topology()


# ── Gating (§42) ─────────────────────────────────────────────────────

def test_gate_respects_flag(monkeypatch):
    from api.config import settings
    monkeypatch.setattr(settings, "langgraph_enabled", False)
    assert should_use_graph("req-1") is False
    monkeypatch.setattr(settings, "langgraph_enabled", True)
    monkeypatch.setattr(settings, "langgraph_agent_run_percent", 0)
    assert should_use_graph("req-1") is True


def test_gate_percent_hash_stable(monkeypatch):
    from api.config import settings
    monkeypatch.setattr(settings, "langgraph_enabled", True)
    monkeypatch.setattr(settings, "langgraph_agent_run_percent", 50)
    first = [should_use_graph(f"req-{i}") for i in range(20)]
    second = [should_use_graph(f"req-{i}") for i in range(20)]
    assert first == second  # deterministic per request_id
    assert any(first) and not all(first)  # splits traffic


def test_gate_never_raises(monkeypatch):
    monkeypatch.setattr("api.graph.HAS_LANGGRAPH", False)
    assert should_use_graph("req-1") is False


# ── Trusted context (§6/§7) ──────────────────────────────────────────

def test_trusted_context_ok():
    ctx = resolve_trusted_context(**_ctx())
    assert ctx["agent_id"] == "memory"


@pytest.mark.parametrize("missing", ["workspace_id", "user_id", "tenant_id", "agent_id", "request_id"])
def test_trusted_context_missing_fails_closed(missing):
    kw = _ctx()
    kw[missing] = ""
    with pytest.raises(ValueError, match="missing"):
        resolve_trusted_context(**kw)


def test_trusted_context_middleware_fallback(monkeypatch):
    from api.middleware.tenant import TenantContext
    TenantContext.set("tenant-ctx", None, "user-ctx")
    try:
        ctx = resolve_trusted_context(workspace_id="ws-1", user_id=None,
                                      tenant_id=None, agent_id="memory",
                                      request_id="req-1")
        assert ctx["tenant_id"] == "tenant-ctx" and ctx["user_id"] == "user-ctx"
    finally:
        TenantContext.clear()


def test_trusted_context_oversized_rejected():
    kw = _ctx()
    kw["workspace_id"] = "x" * 300
    with pytest.raises(ValueError, match="too long"):
        resolve_trusted_context(**kw)


def test_assert_unchanged_passes():
    ctx = _ctx()
    final = dict(ctx)
    assert_trusted_context_unchanged(ctx, final)


@pytest.mark.parametrize("field", ["workspace_id", "user_id", "agent_id", "request_id"])
def test_assert_unchanged_rejects_mutation(field):
    ctx = _ctx()
    final = dict(ctx)
    final[field] = "EVIL"
    with pytest.raises(ValueError, match="mutated"):
        assert_trusted_context_unchanged(ctx, final)


def test_metrics_record_and_stats():
    from api.graph.runner import record_graph_run
    record_graph_run({"correlation_id": "c", "run_id": "r", "termination": "completed",
                      "node_updates": 5, "duration_ms": 10.0})
    record_graph_run({"correlation_id": "c", "run_id": "r2", "termination": "cancelled",
                      "node_updates": 2, "duration_ms": 4.0})
    stats = get_graph_stats()
    assert stats["runs"] == 2
    assert stats["by_termination"] == {"completed": 1, "cancelled": 1}
    assert stats["cancels_total"] == 1
    assert stats["avg_node_updates"] == 3.5
