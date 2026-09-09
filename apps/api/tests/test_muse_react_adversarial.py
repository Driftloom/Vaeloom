"""Muse ReAct adversarial (§28), metrics (§24), secrets (§27), config (§29),
performance (§30) — zero-trust.

Reuses the scripted-provider harness pattern from test_muse_react_e2e
(scripts keyed by [TAG x]); every attack runs through the real ReAct path
(act → _try_react_loop → executor) with real tools/DB.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid

import pytest
from sqlalchemy import select

from api.config import Settings, settings
from api.models.schema import Document, Entity
from api.orchestrator.loop import AgentRequest, _try_react_loop, run_agent_loop
from api.services.llm_service import LLMService

import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from test_muse_react_e2e import (
    ReactE2EAgent,
    SCRIPTS,
    SEEN,
    _FakeAsyncClient,
    _scripted_stream,
)

TAGLESS_ANSWER = '{"summary": "Adversarial probe handled.", "proposals": []}'


class _SessionCtx:
    def __init__(self, s):
        self.s = s

    async def __aenter__(self):
        return self.s

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def adv_harness(monkeypatch, db_session, tmp_path):
    import httpx as _httpx_mod
    from api.services import llm_service as mod

    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "test-key-32-chars-long-for-tests!!")
    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", _scripted_stream)
    monkeypatch.setattr(LLMService, "generate_completion",
                        LLMService._ORIGINAL_GENERATE_COMPLETION)
    monkeypatch.setattr(LLMService, "generate_completion_with_tools",
                        LLMService._ORIGINAL_GENERATE_COMPLETION_WITH_TOOLS)
    monkeypatch.setattr(_httpx_mod, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(mod.llm_service, "provider", "openai")
    monkeypatch.setattr(mod.llm_service, "model", "gpt-4o-mini")
    monkeypatch.setattr(mod.llm_service, "api_key", "test-key-32-chars-long-for-tests!!")
    mod.clear_provider_failure_injection()

    from sqlalchemy.ext.asyncio import async_sessionmaker as _maker
    _session_maker = _maker(db_session.bind, expire_on_commit=False)
    monkeypatch.setattr("api.database.async_session_factory", _session_maker)
    monkeypatch.setattr("api.agents.memory.consolidator.async_session_factory", _session_maker)

    import api.orchestrator.loop as _loopmod
    try:
        _loopmod._rate_limiter._buckets.clear()
        _loopmod._rate_limiter._slots.clear()
    except Exception:
        pass

    import api.orchestrator.loop as _loopmod
    try:
        _loopmod._rate_limiter._buckets.clear()
        _loopmod._rate_limiter._slots.clear()
    except Exception:
        pass

    state_dir = tmp_path / "adv-state"
    state_dir.mkdir(exist_ok=True)
    monkeypatch.setenv("VAELOOM_STATE_DIR", str(state_dir))
    import api.orchestrator.state as _st
    monkeypatch.setattr(_st, "STATE_DIR", state_dir)

    from api.middleware.tenant import TenantContext
    TenantContext.set("tenant-adv", None, "user-adv")
    SCRIPTS.clear()
    SEEN.clear()
    yield {"db": db_session, "mod": mod}
    mod.clear_provider_failure_injection()
    TenantContext.clear()


def _areq(ws: str, tag: str, db=None, agent_name: str = "react_e2e") -> AgentRequest:
    return AgentRequest(
        agent=ReactE2EAgent(), request_id=f"req-{tag}-{uuid.uuid4().hex[:8]}",
        message=f"Probe this. [TAG {tag}]", workspace_id=ws, agent_name=agent_name,
        db=db, correlation_id=f"corr-{tag}", user_id="user-adv", tenant_id="tenant-adv")


# ── Privileged tool escalation (§28) ──────────────────────────────────

@pytest.mark.asyncio
async def test_adv_privileged_tool_denied(adv_harness):
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    SCRIPTS["adv-escalate"] = [
        {"tool": ("execute_code_sandbox", {"language": "python", "code": "print(1)"})},
        {"tool": ("search_documents", {"query": "x"})},
        {"text": TAGLESS_ANSWER},
    ]
    req = _areq(ws, "adv-escalate", db=db)
    resp = await run_agent_loop(req)
    assert resp.status == "success", (resp.status, resp.final_result)
    from api.orchestrator.state import load_or_create_state
    st = await load_or_create_state(req.id)
    rounds = (st.phases.get(f"react_run_{req.id}") or {}).get("rounds", [])
    denied = [r for r in rounds if r["tool"] == "execute_code_sandbox"]
    assert len(denied) == 1, "privileged attempt left no ledger trace"
    blob = json.dumps(denied[0], default=str).lower()
    assert "denied" in blob or "not allowed" in blob, blob


# ── Fake tool name (§28) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_adv_fake_tool_skipped(adv_harness):
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    SCRIPTS["adv-fake"] = [
        {"tool": ("exfiltrate_everything", {"target": "all"})},
        {"text": TAGLESS_ANSWER},
    ]
    req = _areq(ws, "adv-fake", db=db)
    resp = await run_agent_loop(req)
    assert resp.status == "success"
    from api.orchestrator.state import load_or_create_state
    st = await load_or_create_state(req.id)
    rounds = (st.phases.get(f"react_run_{req.id}") or {}).get("rounds", [])
    assert rounds and rounds[0]["tool"] == "exfiltrate_everything"
    assert rounds[0]["result_status"] == "unknown_tool"


# ── Infinite loop: model always continues (§11/§28) ───────────────────

@pytest.mark.asyncio
async def test_adv_infinite_loop_bounded(adv_harness):
    from api.config import settings as _s
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    await db.execute(select(Entity).limit(1))  # session warmup
    SCRIPTS["adv-loop"] = [{"tool": ("search_documents", {"query": "forever"})}] * 12
    req = _areq(ws, "adv-loop", db=db)
    t0 = time.monotonic()
    resp = await run_agent_loop(req)
    dt = time.monotonic() - t0
    # Deterministic stop: cycle detection fires at 3 identical consecutive calls.
    assert dt < 120, f"runaway loop took {dt:.1f}s"
    assert resp.status in ("failed", "escalated", "success"), (resp.status, resp.final_result)
    from api.orchestrator.state import load_or_create_state
    st = await load_or_create_state(req.id)
    rounds = (st.phases.get(f"react_run_{req.id}") or {}).get("rounds", [])
    assert len(rounds) <= 5, f"unbounded tool rounds: {len(rounds)}"
    terms = ((st.termination_reason or "") + json.dumps(
        (st.phases.get(f"react_run_{req.id}") or {}), default=str))
    assert ("cycle" in terms or resp.termination_reason in (
        "cycle_detected", "max_iterations", "success", "no_progress")), terms


# ── Repeated once-only side effect (§13/§28) ──────────────────────────

@pytest.mark.asyncio
async def test_adv_repeated_side_effect_single_execution(adv_harness):
    from api.services.approval import ApprovalManager
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    args = {"name": "Once Entity", "entity_type": "company"}
    mgr = ApprovalManager()
    pre = await mgr.request_approval("react_e2e", "create_entity",
                                     {"tool": "create_entity", "args": args},
                                     "once", ws, None, 60, db)
    await db.commit()
    await mgr.decide(str(pre.id), "APPROVED", str(uuid.uuid4()), "ok", db)
    await db.commit()
    # Model requests the IDENTICAL once-only action twice.
    SCRIPTS["adv-repeat"] = [
        {"tool": ("create_entity", dict(args))},
        {"tool": ("create_entity", dict(args))},
        {"text": TAGLESS_ANSWER},
    ]
    req = _areq(ws, "adv-repeat", db=db)
    resp = await run_agent_loop(req)
    rows = (await db.execute(select(Entity).where(
        Entity.workspace_id == uuid.UUID(ws),
        Entity.canonical_name == "Once Entity"))).scalars().all()
    assert len(rows) == 1, f"side effect executed {len(rows)}x"
    # Second identical request could not consume a second approval: it either
    # paused for re-approval or answered — but never executed twice.
    assert resp.status in ("success", "failed"), (resp.status, resp.final_result)


# ── Approval swap (§14/§28) ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_adv_approval_swap_rejected(adv_harness):
    from api.orchestrator.loop import act_phase
    from api.orchestrator.state import LoopState
    from api.services.approval import ApprovalManager
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    mgr = ApprovalManager()
    # Approve args-A; the run proposes args-B (different name).
    pre = await mgr.request_approval(
        "react_e2e", "create_entity",
        {"tool": "create_entity", "args": {"name": "Approved Name", "entity_type": "company"}},
        "swap setup", ws, None, 60, db)
    await db.commit()
    await mgr.decide(str(pre.id), "APPROVED", str(uuid.uuid4()), "ok", db)
    await db.commit()
    SCRIPTS["adv-swap"] = [
        {"tool": ("create_entity", {"name": "Swapped Name", "entity_type": "company"})},
    ]
    req = _areq(ws, "adv-swap", db=db)
    st = LoopState(req.id, workspace_id=ws)
    act = await act_phase({"message": req.message, "workspace_id": ws}, req, state=st)
    assert act["action"] == "request_approval", act  # did NOT consume A's approval
    still = (await db.execute(select(Entity).where(
        Entity.workspace_id == uuid.UUID(ws)))).scalars().all()
    assert [e for e in still if e.canonical_name == "Swapped Name"] == []
    from api.models.schema import AgentApproval
    orig = (await db.execute(select(AgentApproval).where(
        AgentApproval.id == pre.id))).scalar_one()
    assert orig.status == "APPROVED"  # untouched, still valid for its own payload


# ── Context flooding (§10/§28) ────────────────────────────────────────

@pytest.mark.asyncio
async def test_adv_context_flooding_capped(adv_harness):
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    db.add(Document(workspace_id=uuid.UUID(ws), path="/docs/flood.md", type="md",
                    summary="FLOOD-" + ("x" * 20000)))
    await db.commit()
    SCRIPTS["adv-flood"] = [
        {"tool": ("search_documents", {"query": "FLOOD"})},
        {"text": TAGLESS_ANSWER},
    ]
    req = _areq(ws, "adv-flood", db=db)
    resp = await run_agent_loop(req)
    assert resp.status == "success", (resp.status, resp.final_result)
    tool_msgs = [m for h in SEEN["adv-flood"] for m in h
                 if isinstance(m, dict) and m.get("role") == "tool"]
    assert tool_msgs
    assert len(json.dumps(tool_msgs[0], default=str)) <= 9000, "observation cap breached"


# ── Malformed tool response (§10) ─────────────────────────────────────

@pytest.mark.asyncio
async def test_adv_malformed_tool_response(adv_harness):
    import api.tools.executor as _ex
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    real = _ex.TOOL_DISPATCH["search_documents"]

    async def _garbage(params, workspace_id):
        return "this is not a dict at all"

    _ex.TOOL_DISPATCH["search_documents"] = _garbage
    try:
        SCRIPTS["adv-malformed"] = [
            {"tool": ("search_documents", {"query": "x"})},
            {"text": TAGLESS_ANSWER},
        ]
        req = _areq(ws, "adv-malformed", db=db)
        resp = await run_agent_loop(req)
        assert resp.status == "success", (resp.status, resp.final_result)
    finally:
        _ex.TOOL_DISPATCH["search_documents"] = real


# ── Secrets never persist (§27) ───────────────────────────────────────

@pytest.mark.asyncio
async def test_adv_secrets_redacted_in_checkpoints(adv_harness, tmp_path):
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    secret = "sk-abc123DEF456ghi789JKL012"
    db.add(Document(workspace_id=uuid.UUID(ws), path="/docs/keys.md", type="md",
                    summary=f"deploy token {secret} plus password hunter2 inside"))
    await db.commit()
    SCRIPTS["adv-secrets"] = [
        {"tool": ("search_documents", {"query": "keys"})},
        {"text": TAGLESS_ANSWER},
    ]
    req = _areq(ws, "adv-secrets", db=db)
    resp = await run_agent_loop(req)
    assert resp.status == "success"
    from api.orchestrator.state import load_or_create_state
    st = await load_or_create_state(req.id)
    snap = (st.phases or {}).get(f"react_run_{req.id}")
    blob = json.dumps(snap, default=str)
    assert secret not in blob, "raw secret persisted in checkpoint"
    assert "hunter2" not in blob, "password persisted in checkpoint"


# ── Metrics separate outcomes (§24) ───────────────────────────────────

@pytest.mark.asyncio
async def test_adv_metrics_separate_outcomes(adv_harness):
    from api.orchestrator.react_policy import get_react_stats, reset_react_metrics
    reset_react_metrics()
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    SCRIPTS["adv-m1"] = [{"text": TAGLESS_ANSWER}]
    SCRIPTS["adv-m2"] = [
        {"tool": ("search_documents", {"query": "x"})},
        {"text": TAGLESS_ANSWER},
    ]
    for tag in ("adv-m1", "adv-m2"):
        req = _areq(ws, tag, db=db)
        req.message = f"Probe this. [TAG {tag}]"
        resp = await run_agent_loop(req)
        assert resp.status == "success"
    stats = get_react_stats()
    assert stats["runs"] == 2, stats
    assert stats["tool_calls_total"] == 1, stats
    assert stats["avg_rounds"] >= 0.5
    assert stats["by_termination"].get("answered_structured", 0) == 2, stats


# ── Configuration decision (§29) ──────────────────────────────────────

def test_adv_react_default_off_deliberate():
    """ReAct stays opt-in: the default is False in the Settings model, and the
    loop degrades to static dispatch when off (no silent enablement)."""
    assert Settings.model_fields["agent_react_enabled"].default is False
    assert Settings.model_fields["agent_max_react_rounds"].default == 5


@pytest.mark.asyncio
async def test_adv_react_off_falls_back_to_static(monkeypatch, db_session):
    """Flag off → _try_react_loop returns None without touching the provider."""
    import api.orchestrator.loop as _loop
    monkeypatch.setattr(settings, "agent_react_enabled", False)
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    from test_muse_react_e2e import ReactE2EAgent
    res = await _loop._try_react_loop(
        ReactE2EAgent(), "Search my documents please", "ws-x", "react_e2e")
    assert res is None


# ── Performance (§30, mocked-transport smoke — never health latency) ──

@pytest.mark.asyncio
async def test_adv_performance_smoke(adv_harness):
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    await db.execute(select(Entity).limit(1))
    for i in range(6):
        SCRIPTS[f"perf-1-{i}"] = [{"text": TAGLESS_ANSWER}]
    for i in range(4):
        SCRIPTS[f"perf-t-{i}"] = [
            {"tool": ("search_documents", {"query": "x"})},
            {"text": TAGLESS_ANSWER},
        ]

    async def _timed(tag, **kw):
        req = _areq(ws, tag, db=db, **kw)
        req.message = f"Probe this. [TAG {tag}]"
        t0 = time.monotonic()
        try:
            resp = await run_agent_loop(req)
            ok = resp.status == "success"
        except Exception:
            ok = False
        return (time.monotonic() - t0) * 1000, ok

    single = [await _timed(f"perf-1-{i}") for i in range(6)]
    tooled = [await _timed(f"perf-t-{i}") for i in range(4)]

    def _pct(vals, p):
        s = sorted(vals)
        return s[min(len(s) - 1, int(len(s) * p))]

    assert all(ok for _, ok in single + tooled)
    rep = {
        "single_p50": round(_pct([l for l, _ in single], 0.5), 1),
        "single_p95": round(_pct([l for l, _ in single], 0.95), 1),
        "tooled_p50": round(_pct([l for l, _ in tooled], 0.5), 1),
        "tooled_p95": round(_pct([l for l, _ in tooled], 0.95), 1),
        "error_rate": 0.0,
    }
    assert rep["tooled_p50"] >= rep["single_p50"]
    assert rep["single_p95"] < 60000 and rep["tooled_p95"] < 60000


# ── Concurrency smoke on metrics (§31 support) ─────────────────────────

@pytest.mark.asyncio
async def test_adv_concurrent_runs_metered(adv_harness):
    from api.orchestrator.react_policy import get_react_stats, reset_react_metrics
    reset_react_metrics()
    db = adv_harness["db"]
    ws = str(uuid.uuid4())
    for i in range(4):
        SCRIPTS[f"adv-cc-{i}"] = [{"text": TAGLESS_ANSWER}]

    async def _one(i: int):
        tag = f"adv-cc-{i}"
        req = _areq(ws, tag, db=None, agent_name=f"react_e2e_m{i}")
        req.message = f"Probe this. [TAG {tag}]"
        return await run_agent_loop(req)

    out = await asyncio.gather(*[_one(i) for i in range(4)])
    assert all(r.status == "success" for r in out)
    assert get_react_stats()["runs"] == 4
