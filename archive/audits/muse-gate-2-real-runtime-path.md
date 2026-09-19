# Muse Gate 2 — Real Runtime Path (traced, not inferred)

Single authoritative path (no v2/legacy duplicates found by repo-wide search):

```text
HTTP/API  routers/chat.py::chat, routers/agents.py::chat|run|execute|cancel|runs
  ↓  middleware/auth.py (JWT) → middleware/tenant.py (JWT tenant + DB-verified
     workspace → request.state + TenantContext + RLS GUCs)
orchestrator/router.py::handle  (adversarial screen → classify_intent →
  keyword scorer + score_agent_candidates → micro-LLM fallback →
  supervisor DAG if multi-intent else single agent → kill-switch →
  run_agent_loop → QA gate ×3 → pending-approval attach)
  ↓  orchestrator/supervisor.py::run_supervisor (LoopController bounds,
     conditional branches, approval pause → LoopState checkpoint)
  ↓  orchestrator/loop.py::run_agent_loop  (default path; static dispatch)
     plan_phase → orchestrator/loop.py::_assemble_rag_context
       (vector[opt-in] → LIKE/tsvector entities+documents+preferences →
        search_ranking → ContextEngine policy + manifest)
     → AgentContext via orchestrator/context_loader.py
     → act_phase → _dispatch_agent (AgentCard status + runtime contract +
       per-action approval lookup with payload-hash consume)
     → observe_phase → reflect_phase → QAAgent.validate → improve_phase
       (memory_consolidator.fire-and-forget) → LoopState.terminate
     [ReAct path iff agent_react_enabled: _try_react_loop — card tools ∩
      scopes ∩ contract → approval gate → execute_tool → sanitize+quarantine
      → synthesize; validation repair-or-error]
  ↓  tools/executor.py::execute_tool  (workspace required + tamper check →
     sanitize → durable idempotency → card check → scope check → timeout/
     retry → shape validation → audit log + durable row)
  ↓  approvals: agent_approvals (payload-hash match + keyed-HMAC tamper check
     + atomic APPROVED→CONSUMED)
  ↓  state: orchestrator/state.py LoopState v2 → state_store (File/DB/Redis/
     Memory, CAS) + loop_checkpoints.tool_idempotency rows
  ↓  evaluation: services/trajectory_eval.py (post-run persist) + QA inline
  ↓  provenance: state manifest (run/agent/versions/model+fallback/tools+
     retrieval/context/policies/approvals/termination/budgets)

Alternate paths (all governed, none insecure-by-design):
- run_agent_loop_stream: same phases + SSE framing.
- LangGraph (graph/): topology + bounded replan; disabled by default.
- Temporal (temporal/ + workers/queue_worker.py + BullMQ/Redis): durable
  worker path behind envelope auth; disabled by default.
- agent_service.execute_agent (/run, /execute): LLM-only direct execution,
  tenant-filtered + active-only + workspace-member-checked (Gate 2 fix).
- Supervisor resume: checkpointed DAG continuation.

Bypass search: no alternate orchestrator/loop; no subprocess/exec/eval in
prod paths except approval-gated code-sandbox (bounded) and MCP stdio
(argv-only, interpreter denylist, env allowlist). Temporal fail-open branches
are local/test-only with prod fail-closed guards.
```

Verified by: 640-test sweep (33 files), live-PG RLS probes, approval-swap
runtime proof, cancel-vs-save race proof, crash-resume seam proofs.
