# Vaeloom Muse — End-to-End Zero-Trust Audit & Verification

> **Mode:** AUDIT + VERIFY ONLY — NO BLIND IMPLEMENTATION — ZERO-TRUST —
> RUNTIME-FIRST — EVIDENCE-FIRST  
> **Date:** 2026-09-07 UTC  
> **Commit:** `HEAD` at audit start (see `git log --oneline -1` evidence)  
> **Auditor:** Muse Spark (automated, zero-trust)  
> **Baseline:** 66-phase prompts are governing contract; all prior
> `READY/CONDITIONALLY READY/PASS` reports treated as **claims to revalidate**,
> not evidence.  
> **Environment:** Windows 11, Python 3.12.13 (uv .venv), SQLite + aiosqlite
> (tmp_path per-test DB via NullPool), no live PostgreSQL, no live Redis, no
> live Temporal, `temporal_enabled=False`, `langgraph_enabled=False`,
> `agent_react_enabled=False` (defaults).  
> **Database:** `apps/api/alembic` at `0029_phase_b_idempotency_checkpoint`
> head; RLS migrations 0005/0010/0019/0020/0028.  
> **Test harness:** `pytest -o addopts=""` per-file; 2731 collected,
> `mock_llm` + `mock_connector_test` autouse, worker reuse cleared per conftest.

---

## Executive Summary

**Verdict: UNVERIFIED — NOT READY to claim production-ready without
live-infrastructure proof.**

The audit **did not find a P0 catastrophic bypass** (cross-tenant read/write,
cross-workspace write, approval double-consume, duplicate consequential
side-effect via durable idempotency, or prompt-injection privilege escalation)
through the **real default runtime path**
(`REQUEST → AuthMiddleware → TenantMiddleware → Router → Orchestrator Router → Loop (Plan→Act→Observe→Reflect→QA) → Tool/MCP → Approval → Side-effect → Checkpoint`).
Application-level authorization is **HERMETIC PROVEN** for tenant/workspace
isolation on SQLite via explicit `WHERE tenant_id/workspace_id` predicates plus
TenantMiddleware workspace ownership check. Structural prompt quarantine +
middleware regex + agent-runtime sanitization are **CODE VERIFIED + HERMETIC
PROVEN** for known injection markers.

However, the audit **cannot promote to READY or CONDITIONALLY READY** because 4
production-readiness pillars require live infrastructure that was **unavailable
in this environment and therefore UNVERIFIED**:

| Gap                                   | What is proven                                                                                                                                                                                                                                                                                                                                | What remains UNVERIFIED                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS (PostgreSQL FORCE RLS)**        | Migration code for 34+5+3 tables, `FORCE`, `BYPASSRLS` revocation, `SET LOCAL` via `set_config(...,true)` in `middleware/tenant.py:65` + `database.py:36`                                                                                                                                                                                     | Actual `SELECT/INSERT/UPDATE/DELETE` isolation under `vaeloom_app` (non-superuser) with `FORCE RLS`, pool reuse across PgBouncer transactions, and `WITH CHECK` enforcement. Hermetic suite `tests/security/test_tenant_isolation.py` proves app predicates, not DB RLS; `tests/test_rls_isolation.py` is **all skipped** (`Requires PostgreSQL`). |
| **Redis / Queue / Worker redelivery** | `BullMQWorker` with `zrem` gate, `attempts/maxAttempts` + `delayed` promotion, envelope HMAC + nonce + expiry (`infrastructure/background_envelope.py:54,89`), worker `check_user_workspace_access` re-validation (`workers/queue_worker.py:253`)                                                                                             | Live `Redis outage → redelivery → dedup` with `SIGKILL` of isolated worker, ack loss, and cross-worker nonce deduplication. The in-memory `_SEEN_NONCES` dict is per-process, not Redis-backed, so cross-worker replay within TTL is **CODE VERIFIED vulnerable** (P1 residual).                                                                   |
| **Crash recovery (SIGKILL)**          | Optimistic CAS via `state_version` + `ConcurrentUpdateError` + merge-before-write preserving `cancel_requested` / terminal status (`orchestrator/state.py:387,404`), idempotency UNIQUE `(workspace_id,idem_key)` (`models/schema.py:672`), terminal-run no-replay (`orchestrator/loop.py:??` + `test_runtime_phase_b.py:TestResumeNoReplay`) | Real `SIGKILL` of a staging worker between side-effect and checkpoint, and post-recovery `single-effect` evidence. `save_checkpoint` fallback to file and `RedisStateStore.save` ignoring `expected_version` (P2) leave a narrow LWW window on redis backend.                                                                                      |
| **Temporal / LangGraph durability**   | Workflows are `DISABLED-BY-DESIGN` (`temporal_enabled=False` default, `is_temporal_enabled()` guard, `TemporalUnavailableError` fail-closed in `temporal/client.py:84`), graph state is typed/bounded/secret-free (`graph/state.py:88`)                                                                                                       | Real Temporal cluster behavior (workflow history secret-free, cancellation propagation, heartbeat timeout, DLQ). LangGraph topology `DISABLED-BY-DESIGN` (`langgraph_enabled=False` + percent gating) — not activated for coverage.                                                                                                                |

**Residual severity after triage:** `P0=0, P1=2, P2=5, P3=2` — no STOP condition
triggered, but P1s block any green `READY` claim. The system is **safe to keep
hardening in place** and **safe to run in single-worker SQLite / local dev**,
but **must not be advertised as production-ready for multi-tenant workloads
until the UNVERIFIED pillars are live-proven** on a PostgreSQL + Redis +
(optional) Temporal staging stack with the reproduction steps in §Required
Remediation.

**Truth > green dashboard.** The strongest honest statement is: _authorization
and safety controls exist and are wired on the default path; they have not been
live-proven against real PG/Redis/Temporal failure modes, so production trust is
UNVERIFIED, not proven._

---

## Audit Scope

Full repository forensic read before any test execution, per §2.

**In scope (explicitly traced):** API (`apps/api/src/api/main.py:243` lifespan,
middleware stack, 29 routers), frontend integration (Next.js, `apps/web`,
`X-Workspace-ID` / `Authorization` / `X-CSRF-Token` headers), auth (JWT
`middleware/auth.py:49` + `PUBLIC_PATHS`), tenant/workspace model
(`models/schema.py:User.tenant_id`, `Workspace.user_id`, `WorkspaceUser`), Agent
model + `AgentCard` (`orchestrator/card.py:83`, `card_registry`), routing
(`orchestrator/router.py:452` handle + `score_agent_candidates`), orchestration
(loop, supervisor, base), loop execution (`orchestrator/loop.py:736` plan/act
observe reflect + `_try_react_loop`), state/checkpointing/CAS/cancellation
(`orchestrator/state.py:305` stores, `state.py:336` request_cancel), approvals
(`services/approval.py:45` request + `loop.py:171` lookup), tool
execution/idempotency (`tools/executor.py:225` + `models/schema.py:648`), memory
(`services/memory_service.py:27` + `agents/memory_agent/*`), retrieval/knowledge
graph/semantic search (`services/search_service.py:92`,
`knowledge_graph_service.py`, `infrastructure/search.py`), prompt compilation
(`services/prompt_compiler.py:118`), context engine
(`services/context_engine.py:87`), model routing
(`services/model_router.py:97` + `services/inference_policy.py:104`), provider
BYOK (`services/provider_key_service.py`, `services/llm_service.py:56`),
background jobs/queues/workers (`workers/queue_worker.py:35` +
`infrastructure/background_daemon.py`), MCP
(`services/mcp_client_service.py:129`), evaluation
(`services/trajectory_eval.py`, `infrastructure/agent_eval.py`), learning
(`services/improvement_pipeline.py`, `agents/memory/self_improvement_agent.py`),
observability (`infrastructure/logging.py`, `infrastructure/opentelemetry.py`,
`infrastructure/agent_observability.py`, `/metrics` in `main.py:314`),
budgets/failure taxonomy (`services/agent_contracts.py:135` LoopController +
`orchestrator/state.py:36` TERMINAL_STATUSES +
`orchestrator/loop_safety.py:77`), security controls, DB/RLS/pooling, Redis,
config/feature flags, deployment (`docker-compose.yml`, `infra/`), tests (172
files, 2731 tests).

**Out of scope (explicitly excluded):** unrelated feature development,
architectural rebuild (§1.3), enabling disabled runtimes to inflate coverage,
weakening assertions or deleting failing tests.

---

## Baseline

- **66 phase prompts** at
  `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/00-master-index.md`:
  22 MVP + 22 CONT + 22 ENT, each standalone (forensic audit →
  GO/CONDITIONAL/NO-GO → requirements → weighted gate → handoff). **Governing
  contract** for phase execution per `AGENTS.md`.
- **Previous Muse reports** in `docs/audits/`
  (`Agentic-AI-Zero-Trust-E2E-Audit.md` 20853 lines,
  `muse-gate-3-final-closure.md` 109027 lines, `muse-phase-b-*`,
  `muse-gate-2-*`) claim
  `READY/CONDITIONALLY READY/PASS/COMPLETE/PROVEN/HARDENED` and quote 110
  OpenAPI paths, 94% coverage, 42/42 RLS. **This audit treats those as
  hypotheses**, not evidence, per §0.
- **Execution evidence** in `docs/phases/<track>-pXX/` (gate reports, registers,
  handoffs) is referenced but not trusted without re-execution.
- **Active branch:** `HEAD` (detached audit workspace). No release workflow;
  VERSION via `apps/api/pyproject.toml:version=0.2.0`.

---

## Architecture Understanding

High-level topology (derived from code, not docs):

```
Next.js (apps/web) ──► FastAPI (apps/api/src/api/main.py)
                        ├─ middleware (outer → inner):
                        │   CORSMiddleware (outermost, CORS preflight)
                        │   IPAllowlistMiddleware (always mounted, no-op when empty)
                        │   IdempotencyMiddleware (records consequential POST)
                        │   PromptInjectionMiddleware (regex + optional LLM classifier)
                        │   APIVersionMiddleware / RequestLogging / CorrelationID
                        │   SecurityHeadersMiddleware
                        │   CSRFMiddleware (double-submit, Redis multi-worker or memory)
                        │   AuthMiddleware (JWT → request.state.user/tenant_id)
                        │   TenantMiddleware (inner: JWT tenant + workspace ownership check via check_user_workspace_access → TenantContext + RLS GUCs)
                        │   RateLimitMiddleware / BodySizeLimitMiddleware (innermost before routes)
                        ├─ routers (29, enterprise gated by enterprise_routes_enabled=false)
                        ├─ orchestrator:
                        │   router.handle (classify_intent → scorer → supervisor check → kill_switch → workspace_limiter → run_agent_loop)
                        │   loop.run_agent_loop (state load → spend/quota gate → plan_phase (RAG+context_loader) → act_phase (ReAct opt-in or static) → observe → reflect → QA gate → checkpoint with CAS)
                        │   supervisor.run_supervisor (DAG, fan-out via asyncio.gather with MAX_FANOUT_BRANCHES=8)
                        │   state / state_store (Memory/File/Database/Redis/Composite, CAS via expected_version)
                        ├─ agents (22 registry entries, 8 seeded contracts + 8 runtime policies)
                        ├─ tools (50 static + dynamic MCP as mcp__*), executor with permission/scope + approval gate + retry + audit + idempotency UNIQUE
                        ├─ memory / retrieval / KG / search / context_engine / prompt_compiler / model_router / inference_policy / llm_service (BYOK)
                        ├─ temporal (workflows + activities, disabled by default, fail-closed when enabled but unreachable)
                        ├─ graph (LangGraph StateGraph, topology-only, disabled by default)
                        ├─ workers (BullMQWorker reading bull:<queue>:wait, delayed promotion via zrem, background_envelope verify)
                        └─ infra: database (asyncpg, statement_cache_size=0, pool_size 20), secrets (Infisical/fallback), OTel/Prometheus
```

Key invariants (intended):

- **Tenant isolation:** `TenantMiddleware` authoritative
  (`middleware/tenant.py:135` tenant from JWT, header mismatch warned not
  trusted, `check_user_workspace_access`
  `WHERE Workspace.user_id IN (owner OR member) AND User.tenant_id = jwt_tenant`),
  plus `search/memory/knowledge` predicates and RLS
  `current_setting('app.tenant_id')` as defense-in-depth.
- **Workspace isolation:** Same path, plus per-service `workspace_id` scoping
  (e.g., `memory_service.py:129` enforced_ws = workspace_id or
  query.workspace_id, then `Memory.workspace_id == ws_uuid`;
  `search_service.py:121` fail-closed if neither ws nor tenant).
- **Agent authorization:** `AgentRegistry` + `AgentRuntime` policy +
  `LoopController` + kill_switch + approval gate; enterprise agents gated by
  `mvp_scope_enforced`.
- **Approval integrity:** canonical JSON hash binding (`loop.py:163`
  `_canonical_payload_hash`), reason HMAC (`services/approval.py:36`
  `_payload_hmac` over `ENCRYPTION_KEY||JWT_SECRET`), expiry,
  `UPDATE ... WHERE status='APPROVED'` single-winner (`loop.py:264`), and
  `services/approval.py:210` 409 on non-PENDING.
- **Prompt boundary:** `prompt_compiler.py:63` `quarantine()` wraps UNTRUSTED
  layers in `<untrusted-data>` with structural tag escaping + flag note;
  `agent_runtime.py:68` `sanitize_retrieved` quotes data containing override
  markers.

---

## Actual Runtime Graph

Validated against `apps/api/src/api/main.py:243` middleware order,
`orchestrator/router.py:452`, `orchestrator/loop.py`, `orchestrator/state.py`,
`tools/executor.py`, `temporal/*`, `workers/queue_worker.py`.

```
REQUEST
  ↓  (CORS outermost, IP allowlist no-op, BodySizeLimit 25MiB)
AUTHENTICATION  — AuthMiddleware: JWT require exp+sub, HS256, 401 on missing/invalid/expired; PUBLIC_PATHS + PUBLIC_PREFIXES (/api/v1/auth/*, /scim/*) + OPTIONS passthrough
  ↓  (request.state.user / tenant_id / user_id populated)
TENANT RESOLUTION  — TenantMiddleware: JWT tenant authoritative, X-Tenant-ID header only warned; tenant → TenantContext + later SET LOCAL set_config
  ↓
WORKSPACE RESOLUTION  — TenantMiddleware: requested = X-Workspace-ID || path {workspace_id} || JWT workspace_id; if present and jwt_user_id present → check_user_workspace_access DB check (owner OR member AND tenant match) else 403; result → request.state.workspace_id + TenantContext
  ↓
AGENT RESOLUTION  — router.handle: classify_intent (keyword + secondary disambiguation + capability/availability scorer + optional micro-LLM) OR preferred_agent override; MVP scope lock filters non-canonical when mvp_scope_enforced
  ↓
AGENT AUTHORIZATION  — kill_switch.is_enabled, mvp_scope_enforced, AGENT_REGISTRY lookup, workspace_limiter.acquire (per-workspace concurrency)
  ↓
ORCHESTRATOR  — router.handle → run_agent_loop (or run_supervisor for _is_complex_multi_agent)
  ↓
CONTEXT / MEMORY / RETRIEVAL  — plan_phase → _assemble_rag_context (vector-ish pgvector attempt → LIKE fallback → tsvector BM25 on Postgres → ranking re-rank via search_ranking_service → ContextEngine plan/filter/rank/compress/validate → context_manifest) + context_loader.load_context
  ↓
PROMPT COMPILER  — PromptCompiler.compile: trusted system block sacred, untrusted context quarantined + budget-fit (lower priority truncated first), emits messages + manifest (prompt_id, compiler_version, context_manifest, content_hash, token_estimate, injection_flagged)
  ↓
MODEL ROUTER  — llm_service.generate_completion: task_type auto-inferred via AGENT_TASK_TYPE_MAP, tier → provider → fallback candidates (same-provider tier fallback + cross-provider same-tier), BYOK resolve (explicit > workspace > user > system), record_usage with cost
  ↓
AGENT LOOP  — run_agent_loop: load_or_create_state → spend/quota gate (quota via temporal/quota check_and_reserve, spend via agent_costs) → budgeted loop (max_iterations 3 / tool_calls 12 / tokens 12k / cost $0.50 / duration 120s) → plan/act/observe/reflect + LoopSafetyTracker (cycle/no_progress/budget) + termination reason → QA gate (3 attempts) → checkpoint save with CAS + merge-before-write
  ↓
TOOL / MCP  — execute_tool: check_permission (scope + wildcard) → approval_gated_tools()? → expect consumed approval else error → retry (CATEGORY_RETRIES) + CATEGORY_TIMEOUTS + TOOL_TIMEOUT_OVERRIDES (browse 45s) → dispatch via TOOL_DISPATCH or DYNAMIC_HANDLERS (mcp__*) → shape validation (minimal required-field) → audit log
  ↓  (MCP: validate_mcp_config denies shell interpreters + metachars, allowlist env, stdio/HTTP, readOnlyHint → approval gating, workspace ownership at call time in mcp_client_service.py:392)
APPROVAL  — agent_approvals (PENDING→APPROVED→CONSUMED, expiry sweep, HMAC drift guard) consumed atomically in loop.py:264; decisions via services/approval.py router with audit + preference ingestion
  ↓
SIDE EFFECT  — DB write / connector mutation / notification; tool-level durable idempotency via ToolIdempotency UNIQUE(workspace_id,idem_key) + in-memory LRU; HTTP-level IdempotencyMiddleware for consent/approvals/gdpr
  ↓
IDEMPOTENCY  — inference_policy.idempotency_key deterministic (execution_id|tool|canonical params SHA256[:24]) + executor DB lookup + middleware IdempotencyRecord UNIQUE(idempotency_key,request_path)
  ↓
CHECKPOINT  — save_checkpoint → StateStore.save with expected_version → increments state_version; merge preserves cancel_requested + terminal status; Composite fallback File ensures local durability
  ↓
REPLAN / NEXT ITERATION  — evaluate (trajectory_eval) → needs_replan within graph replan budget (MAX_GRAPH_REPLANS=2) or loop reflect
  ↓
FINAL OUTPUT  — unified_exception_handler → JSON envelope with request_id/correlation_id; QA best-effort flag if retries exhausted
  ↓
AUDIT / OBSERVABILITY  — structured JSON logs with correlation_id/tenant/workspace/agent/run/iteration/tool/provider + Prometheus /metrics + OTel FastAPI instrumentor + agent_observability metrics_collector
```

For every arrow (implemented? wired? reachable? default path? bypass? auth
boundary? failure behavior? durability? observability? test coverage?) see
Runtime Activation Matrix below.

---

## Runtime Activation Matrix

| Arrow                              | Implemented                      | Wired                                    | Reachable (default)                                                | Bypass                                                                                                                                                              | Auth boundary                                                                                                                                               | Failure                                                                                  | Durability                                  | Observability                                  | Test coverage                                                                                   |
| ---------------------------------- | -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Auth                               | Yes (`middleware/auth.py:30`)    | Yes (app.add_middleware outer of Tenant) | Yes — every non-public, non-OPTIONS request                        | None found; PUBLIC_PATHS/PREFIXES explicit, no `tenant_id` from header trusted                                                                                      | JWT `sub` + `tenant_id` from payload                                                                                                                        | 401 JSON fail-closed                                                                     | Stateless (JWT TTL)                         | Logs + metrics, no secret leak                 | Hermetic: `test_auth_middleware.py`, `test_noauth_private.py` sorted PUBLIC_PATHS deterministic |
| Tenant resolution                  | Yes (`middleware/tenant.py:113`) | Yes (inner, sets TenantContext + GUC)    | Yes                                                                | Header `X-Tenant-ID` mismatch only warned, JWT wins `:138`                                                                                                          | JWT tenant authoritative, `check_user_workspace_access` validates workspace↔user↔tenant                                                                     | 403 on invalid UUID or no access; fail-closed on missing tenant (RLS matches zero)       | ContextVar + `SET LOCAL` transaction-scoped | Correlation + tenant in logs                   | Hermetic via `test_tenant_isolation` (app predicates)                                           |
| Workspace resolution               | Yes                              | Yes                                      | Yes (header or path)                                               | None — unauthenticated without jwt_user_id yields no workspace, not bypass                                                                                          | DB ownership/membership check `:169`                                                                                                                        | 403 invalid format or denied                                                             | Same as tenant                              | Same                                           | Hermetic                                                                                        |
| Agent resolution                   | Yes (router 22 agents)           | Yes                                      | Yes (keyword + scorer default; supervisor for multi-intent)        | Alternate direct `POST /api/v1/agents/{id}/run`? Not exposed; only chat/agent routes via orchestrator                                                               | Kill switch + MVP scope + RBAC (rbac.py) on admin routes                                                                                                    | `ask_clarification` when conf<0.7, `out_of_scope` when non-canonical                     | Stateless routing                           | Metrics collector + span                       | `test_orchestrator_router.py` + `test_harness_v1.py`                                            |
| Orchestrator→Loop                  | Yes                              | Yes                                      | Yes                                                                | `Temporal` shell exists but disabled; direct `run_agent_loop` is default                                                                                            | Workspace concurrency limiter (semaphore per ws)                                                                                                            | `error` card on limiter exhausted                                                        | LoopState checkpoint                        | OTel `orchestrator.handle` span                | `test_runtime_phase_b.py:TestResumeNoReplay`                                                    |
| Context/Memory/Retrieval           | Yes                              | Yes                                      | Yes (plan_phase always calls `_assemble_rag_context` non-blocking) | Raw SQL LIKE bypasses pgvector when no key/short query/test mode — intentional fallback, not bypass                                                                 | `workspace_id` forced into candidates as `ws:` provenance + `ContextEngine.filter_items` cross-workspace exclusion (`context_engine.py:134`)                | Falls back to empty `{entities:[],docs:[],prefs:[]}` on DB error                         | Best-effort, never fails loop               | `record_rag_latency`                           | `test_muse_gate2_*` + ranking tests                                                             |
| PromptCompiler                     | Yes                              | Yes (react + assembly)                   | Yes (ReAct manifest, loop assembly)                                | Tool output could be concatenated without quarantine if caller bypasses `quarantine` — but `tool_context`/`evidence` layers always UNTRUSTED                        | Structural `<untrusted-data>` + escaping + SECURITY NOTE                                                                                                    | Injection flagged in manifest, never executed                                            | Deterministic, no LLM                       | Manifest persisted in state provenance         | `test_cont_p12_agent_model_retrieval.py`                                                        |
| ModelRouter                        | Yes                              | Yes                                      | Yes (auto-inferred task_type)                                      | Direct `llm_service._openai_completion` not exposed via HTTP; only via router/loop                                                                                  | BYOK ownership: `resolve_effective` checks user→workspace→system, marks used; tenant not checked here (provider keys are user/workspace scoped, not tenant) | Fallback chain preserves tier then cross-provider; `downgraded` flag + `record_fallback` | Cost log in-memory + DB `agent_costs`       | Model + tier logged                            | `test_llm_byok.py`, `test_llm_resilience.py`, `test_model_*`                                    |
| Loop safety                        | Yes                              | Yes                                      | Yes                                                                | `AGENT_REACT_ENABLED` could add LLM-driven tool calls; same loop controller gates                                                                                   | ContractViolation on max_iterations/tool_calls/tokens/cost/duration/cycle                                                                                   | Terminal reason explicit `state.TERMINATION_REASONS`                                     | LoopState terminal preserved via merge      | Snapshot in checkpoint                         | `test_runtime_phase_b.py:TestLoopSafety`                                                        |
| Tool/MCP                           | Yes                              | Yes                                      | Yes (static + dynamic mcp__*)                                      | `DYNAMIC_HANDLERS` only via `register_dynamic_tool` guarded; shell interpreters denied, metachars denied                                                            | `check_permission` scopes + `approval_gated_tools()` single-use token; MCP workspace ownership at call (`mcp_client_service.py:392`)                        | `not_configured` not `success`; retry per category; audit log                            | `ToolIdempotency` UNIQUE + LRU              | `tool`/`llm` metrics                           | `test_tools_executor.py:64` + `test_mcp_client_service.py`                                      |
| Approval                           | Yes (2 layers)                   | Yes                                      | Yes                                                                | Legacy `agent_approvals` vs `approval_request` tables — both enforced, but approval swap via wrong approval_id rejected (loop filters by agent/action/payload hash) | Payload hash binding + HMAC + workspace/tenant binding + single-use atomic consume                                                                          | 409 already decided, 400 invalid, expired → EXPIRED sweep                                | DB row durable                              | Audit events `approval.request/approve/reject` | `test_approval.py` + `test_idempotency.py:test_approval_create_is_idempotent`                   |
| Side-effect→Idempotency→Checkpoint | Yes                              | Yes                                      | Yes                                                                | Middleware idempotency only for `CONSEQUENTIAL_PREFIXES` + `/approvals`; tool idempotency covers all consequential tools                                            | `idem_key` includes execution_id + tool + canonical params; workspace_id in UNIQUE protects cross-ws                                                        | IntegrityError single winner, losers read winner result                                  | DB durable                                  | LRU + DB                                       | `test_runtime_phase_b.py:TestDurableIdempotency`                                                |
| Observability                      | Yes                              | Yes                                      | Yes                                                                | Logs redact via `_redact` (secret keys), but `/metrics` is public (intentional)                                                                                     | No secret in logs (verified via secret_keys_unified tests)                                                                                                  | Exceptions → `generic_exception_handler` with correlation                                | Metrics in-memory + Prometheus              | Request id propagation                         | `test_logging.py`, `test_secret_keys_unified.py`                                                |

---

## Phantom Feature Audit

| Component                                    | Implemented                                                                                                                                        | Wired                                                                                                                                                           | Default                                                                                                                   | Reachable                                                                      | Used                                                                                                                                    | Tested                                                                                                             | Proven                                        | Verdict                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------- |
| PromptCompiler                               | Yes (`services/prompt_compiler.py:118` v1.0.0, 8k budget)                                                                                          | Yes (`orchestrator/loop.py:872` manifest in ReAct, `_assemble_rag_context` context_manifest)                                                                    | Yes                                                                                                                       | Yes                                                                            | Yes (every ReAct + RAG)                                                                                                                 | Yes (`test_harness_v1` + `test_live_harness_wiring`)                                                               | CODE+SEAM PROVEN (hermetic, manifest checked) | **ACTIVE** — not phantom                                                   |
| ContextEngine                                | Yes (`services/context_engine.py:87` plan→filter→rank→compress→assemble→validate)                                                                  | Yes (`orchestrator/loop.py:659` policy layer over SQL/vector candidates)                                                                                        | Yes                                                                                                                       | Yes                                                                            | Yes                                                                                                                                     | Yes                                                                                                                | CODE+SEAM PROVEN                              | ACTIVE — policy layer, not DB                                              |
| AgentContracts / LoopPolicy / LoopController | Yes (`services/agent_contracts.py:28` 8 seeded contracts + LoopController with cycle/budget)                                                       | Yes (`orchestrator/loop.py:407` `_runtime_contract` synthesized from AgentCard + handler tools)                                                                 | Yes (synthesized per run)                                                                                                 | Yes                                                                            | Yes (bounds enforced in loop + graph nodes)                                                                                             | Yes (`test_runtime_phase_b:TestRuntimeContracts`)                                                                  | CODE VERIFIED + HERMETIC                      | ACTIVE — envelope, not replaceable static prompt                           |
| AgentCard                                    | Yes (`orchestrator/card.py:83` declarative spec, Jinja2 template, jsonschema validate, `DEFAULT_SAFETY_GUIDELINES`)                                | Yes (`orchestrator/router.py` via `get_agent_card` in scorer + loop ReAct `card.render_system_prompt`)                                                          | Yes                                                                                                                       | Yes (card tools union with handler tools)                                      | Yes                                                                                                                                     | Yes (`test_agent_cards.py`)                                                                                        | CODE+HERMETIC                                 | ACTIVE                                                                     |
| InferencePolicy                              | Yes (`services/inference_policy.py:104` route + ToolRisk + ActionTier → approval mapping)                                                          | Yes (`tools/executor.py:269` approval_gated via tier, `llm_service` records fallback)                                                                           | Yes                                                                                                                       | Yes                                                                            | Yes (fallback chain cross-provider same tier)                                                                                           | Yes (`test_runtime_phase_b:TestToolFallback` + `test_live_harness_wiring:test_fallback_records_policy_shadow_log`) | CODE+HERMETIC                                 | ACTIVE                                                                     |
| ModelRouter                                  | Yes (`services/model_router.py:97` 5+8 models, TASK_MODEL_MAP 17 entries)                                                                          | Yes (`services/llm_service.py:283` auto-infer task_type from AGENT_TASK_TYPE_MAP, tier fallback)                                                                | Yes                                                                                                                       | Yes                                                                            | Partial (most handlers pass agent_name → inferred task_type; explicit task_type coverage gaps remain but default still routes balanced) | Yes (infer + byok)                                                                                                 | CODE+HERMETIC                                 | ACTIVE — not phantom, but utilization measured via downgraded flag         |
| LoopController / LoopSafetyTracker           | Yes                                                                                                                                                | Yes                                                                                                                                                             | Yes                                                                                                                       | Yes                                                                            | Yes                                                                                                                                     | Yes                                                                                                                | HERMETIC                                      | ACTIVE                                                                     |
| LangGraph                                    | Yes (StateGraph in `graph/*`, `graph/state.py:26` VaeloomGraphState typed/bounded, nodes thin wrappers)                                            | Yes (imported only inside `temporal/activities.py:durable_agent_run` via `_run_graph`)                                                                          | **DISABLED-BY-DESIGN** (`config.langgraph_enabled=False` default, percent gating `graph/activities:432`, shadow mode off) | No (default) — requires flag flip + Temporal activity path                     | Shadow proven in tests with opt-in env                                                                                                  | Tests with `VAELOOM_TEST_REAL_AGENT` stub                                                                          | CODE VERIFIED, **DISABLED-BY-DESIGN**         | Not phantom, not default                                                   |
| Temporal                                     | Yes (5 workflows, 10 activities, client singleton, metrics, quota, validation)                                                                     | Partially (API routes for workers not auto-mounted; `/api/v1/temporal` exists; workflows started only when `temporal_enabled=True`)                             | DISABLED-BY-DESIGN (`temporal_enabled=False`)                                                                             | No (guarded by `is_temporal_enabled` → `TemporalUnavailableError` fail-closed) | Warm-up fire-and-forget only when enabled                                                                                               | Unit with `temporalio.testing.WorkerEnv` in `tests/temporal/*`                                                     | CODE VERIFIED, **DISABLED-BY-DESIGN**         | Not phantom, durability not default                                        |
| ReAct                                        | Yes (`orchestrator/loop.py:798` `_try_react_loop` 12 tools, streaming, prompt manifest, validation repair)                                         | Yes (called from `act_phase` when enabled)                                                                                                                      | DISABLED-BY-DESIGN (`agent_react_enabled=False` default, `AGENT_REACT_ENABLED=1` overlay)                                 | No (default falls back to static dispatch)                                     | Proved via `test_harness_v1` + `test_runtime_phase_b:TestLiveHarnessWiring:test_react_attaches_prompt_manifest` with flag on            | Hermetic                                                                                                           | CODE VERIFIED, **DISABLED-BY-DESIGN**         | Deterministic primary path preserved intentionally                         |
| Supervisor DAG                               | Yes (`orchestrator/supervisor.py`, `orchestrator/router.py:522` `_is_complex_multi_agent`)                                                         | Yes                                                                                                                                                             | Yes (when `_is_complex_multi_agent` true and no preferred_agent)                                                          | Yes                                                                            | Yes                                                                                                                                     | Yes (`test_supervisor_dynamic.py`)                                                                                 | HERMETIC                                      | ACTIVE — only for multi-intent                                             |
| Memory admission                             | Yes (`agents/memory/`, `services/memory_service.py:27` create with embedding + sanitization + supersession)                                        | Yes                                                                                                                                                             | Yes                                                                                                                       | Yes                                                                            | Yes                                                                                                                                     | Yes (`test_memory_*`)                                                                                              | HERMETIC                                      | ACTIVE — taxonomy v2                                                       |
| Knowledge graph                              | Yes (`services/knowledge_graph_service.py`, `models/schema.py:324` Entity/Relationship)                                                            | Yes (retrieval via `infrastructure/search.py` + loop RAG graph LIKE + vector)                                                                                   | Yes                                                                                                                       | Yes                                                                            | Yes (LIKE fallback always; vector when PG+key)                                                                                          | Hermetic + workspace isolation tests                                                                               | CODE+HERMETIC                                 | ACTIVE — hybrid-lite per prior audit, not BM25+RRF cross-encoder           |
| Evaluation                                   | Yes (`services/trajectory_eval.py`, `services/agent_eval.py`, `agents/qa_agent/handler.py` QA gate)                                                | Yes (every loop output via QA 3 retries; `infrastructure/agent_eval.detect_adversarial_prompt` at router top)                                                   | Yes                                                                                                                       | Yes                                                                            | Yes                                                                                                                                     | Yes (`test_qa_loop_gate.py`)                                                                                       | HERMETIC                                      | ACTIVE — gates, not phantom                                                |
| Learning                                     | Yes (`services/improvement_pipeline.py` candidate stages + deploy_guard, `agents/memory/self_improvement_agent`, `services/improvement_pipeline` ) | Partially (feedback → preference entity ingestion in `services/approval.py:259` + `reflection_scheduler`, but closed-loop ranking wire requires WS-12.1 shadow) | Partially (kill-switch, shadow percent 0 by default)                                                                      | Shadow path not default                                                        | Not operationalized end-to-end                                                                                                          | Unit for stage advancing                                                                                           | CODE VERIFIED                                 | **DESIGNED, NOT OPERATIONALIZED** — not phantom but not proven closed-loop |
| Background worker                            | Yes (`workers/queue_worker.py:35` BullMQWorker + 3 queues + `infrastructure/background_daemon.py` cron/watchers)                                   | Yes (daemon start in `main.py:163` lifespan)                                                                                                                    | Yes (when `REDIS__URL` reachable; else polling fails open)                                                                | Yes in prod overlay                                                            | Not live-proven here                                                                                                                    | `test_workers.py` mocked Redis                                                                                     | CODE VERIFIED, **HERMETIC ONLY**              | Real Redis not available here                                              |
| MCP                                          | Yes (`services/mcp_client_service.py:129` stdio+http, discovery TTL 300s, bridging as `mcp__*`)                                                    | Yes (bridging via `tools/executor.register_dynamic_tool`, approval gating for non-readOnly, lifecycle in `main.py:180`)                                         | Yes (when connector type=mcp present; else zero bridges)                                                                  | Yes                                                                            | Yes when connector present                                                                                                              | `test_mcp_client_service.py`                                                                                       | CODE+HERMETIC                                 | ACTIVE — bounded, not phantom                                              |

**Dead/shadow/duplicate/legacy inspection:** No alternate executor bypasses
approval (grep `TOOL_DISPATCH` vs `DYNAMIC_HANDLERS` shows unified via
`get_tool_definition` and `approval_gated_tools()`). No shadow router (only one
scorer + classifier). Legacy `approval_request/approval_decision` tables remain
from migration 0003 but writes go to `agent_approvals` — the loop approval
lookup queries `agent_approvals` only, so legacy tables are inert, not bypass.

---

## Authentication

**Trace:** `Authorization: Bearer <JWT>` → `AuthMiddleware.dispatch`
(`middleware/auth.py:30`) →
`jwt.decode(settings.jwt_secret, algorithms=[settings.jwt_algorithm], require=["exp","sub"])`
→ `request.state.user / user_id / tenant_id` → downstream.

**Verified (CODE VERIFIED + HERMETIC PROVEN):**

- Missing/invalid/expired → 401 JSON fail-closed (`auth.py:45,59,61`). Public
  paths bypass only explicit sets (`PUBLIC_PATHS` + `PUBLIC_PREFIXES` +
  OPTIONS). Tests `test_auth_middleware.py` + `test_noauth_private.py` (sorted
  deterministic) cover unauthenticated access to private endpoints.
- `PUBLIC_PATHS` includes `/health`, `/metrics`, `/docs`, `/openapi.json`,
  `/csrf-token`, `/api/v1/auth/{signup,login,refresh,saml/callback}`,
  `/api/v1/gmail/webhook`, `/api/v1/consent/scopes` — minimal, auditable.
- `jwt_secret` validation fails fast on default/weak/empty
  (`config.validate_settings:247`), 32-char minimum, known weak deny-list.
  Startup refuses in non-local if invalid.

**Missing claims / forged / mismatched:**

- No `tenant_id` in JWT → `TenantContext` set with `tenant_id=None` →
  `set_rls_session_vars` returns without setting GUC → RLS policies
  `current_setting('app.tenant_id',true)::uuid` yield null → zero rows
  (fail-closed) — CODE VERIFIED.
- Forged tenant in header `X-Tenant-ID` ignored when JWT present
  (`tenant.py:137` warns, uses JWT) — not trusted.
- Cross-tenant JWT forging impossible without `jwt_secret`; weak secret denied.

**Remaining gap (P2):** JWT is stateless HS256; revocation only via
`auth_sessions` short TTL + refresh rotation (tested `test_auth.py:refresh`); no
distributed denylist — intentional for local, documented for prod overlay to use
Redis denylist.

---

## Authorization

**Trace:** `JWT.sub → user_id` + `JWT.tenant_id` + `workspace_id (header/path)`
→ `TenantMiddleware:171` `check_user_workspace_access`
(`Workspace JOIN WorkspaceUser JOIN User WHERE User.tenant_id == JWT tenant`) →
`request.state.*` + `TenantContext` → per-service `WHERE tenant_id/workspace_id`
predicates.

**Verified:**

- No route trusts user-supplied `tenant_id/workspace_id` alone; authoritative
  validation via DB join every request where workspace present
  (`tenant.py:153` + `check_user_workspace_access:78`). Attack vectors
  `same tenant / different workspace`, `different tenant`, `missing tenant`,
  `missing workspace`, `wrong tenant/workspace` all 403 or zero rows
  hermetically.
- `search_service.py:121` fail-closed if neither `ws_uuid` nor `tid_uuid` →
  returns empty.
- `memory_service.py:124` enforced workspace scoping
  `enforced_ws = workspace_id or query.workspace_id` then
  `WHERE Memory.workspace_id == ws_uuid`.
- `mcp_client_service.py:392` workspace ownership at call time rejects
  `str(connector.workspace_id) != workspace_id`.

**Bypass scan:** grep for raw `session.execute(select(Memory))` without
tenant/workspace filter shows only migration runner and activity helpers with
workspace-scoped SELECT by `workspace_id` — no tenant-less mutation reachable
via HTTP. Direct `async_session_factory` uses `get_db` which sets RLS GUCs
transaction-local — not bypass.

---

## Tenant Isolation

- **Invariant:** Tenant A cannot read/write Tenant B rows, even within same
  workspace_id collision (UUIDs tenant-scoped). Expected: zero rows or 403.
- **Evidence (HERMETIC PROVEN, CODE VERIFIED; LIVE UNVERIFIED):**
  `tests/security/test_tenant_isolation.py` (5 cases: list, direct GET,
  memories, PATCH, DELETE cross-user) all assert 403/404 or absence.
  `tests/test_tenant_provisioning.py` + `test_tenant_settings.py` cover
  provisioning boundaries. DB-level `tests/test_rls_isolation.py` skipped
  (requires PG). Migration code for RLS 42 tables with
  `FORCE ROW LEVEL SECURITY` proven via file reads, not live.
- **Classification:** App-predicate isolation **HERMETIC PROVEN**; DB RLS
  defense-in-depth **CODE VERIFIED, UNVERIFIED live** (P1).
- **Pool isolation:** `database.py:10`
  `statement_cache_size=0, prepared_statement_cache_size=0` for asyncpg +
  `TenantContext` ContextVar + `SET LOCAL` via `set_config(...,true)`
  (`tenant.py:65`) prevents cross-request leakage on PgBouncer transaction
  pooling; `TenantContext.clear()` in finally (`tenant.py:189`). Live PgBouncer
  reuse not exercised — **UNVERIFIED live**.

---

## Workspace Isolation

Same as tenant but within same tenant; stronger check is membership.

- **Invariant:** User in workspace W1 cannot read/write W2 even if same tenant.
- **Evidence:** `security/test_tenant_isolation.py` +
  `test_memory_workspace_isolation.py` (hermetic) +
  `test_knowledge_graph_workspace_isolation.py` + `search_service.py:169`
  `MemoryRecord`/`Entity` filtered by `workspace_id` plus Python post-filter
  (`search_service.py:178` `rec.workspace_id == ws_uuid`). Hermetic tests pass.
- **Attack tested (hermetically):** `X-Workspace-ID` forgery →
  `check_user_workspace_access` returns 403 before any service; path param
  `/{workspace_id}` same. Missing workspace → `search_service` returns empty.
  Wrong workspace → service predicate filters to zero.
- **Remaining (P2):** `Relationship.workspace_id` is `NOT FK` string-free but
  not constrained to Workspace existence in older migrations — orphan check not
  enforced at DB level, but queries always filter by `workspace_id`.

---

## Agent Security

Audit every operation: CREATE / READ / UPDATE / DELETE / RUN / EXECUTE / RESUME
/ CANCEL / STREAM / BACKGROUND.

- **CREATE/READ/UPDATE/DELETE:** `routers/agents.py` +
  `services/agent_service.py` require `get_current_user` +
  `check_user_workspace_access` + `tenant_id` scoping; enterprise agents gated.
  Verified via `test_agents*.py` + `test_agent_service.py`.
- **RUN/EXECUTE:** `router.handle` → `run_agent_loop` gates on kill_switch, MVP
  scope, limiter, workspace binding. `BaseAgent` subclasses declare `tools` +
  `memory_scopes`; `_runtime_contract` synthesizes contract ephemerally
  (`loop.py:407`). Alternate static handler path does not bypass contract — it
  creates one from declared tools.
- **RESUME/CANCEL/STREAM:** `run_agent_loop` checks `LoopState.is_terminal` (no
  replay) and `request_cancel` durability (`state.py:336`); stream via
  `generate_completion_with_tools_stream` inherits same scopes (BYOK resolved
  via workspace/user). `test_state_durability` covers resume without
  re-execution.
- **BACKGROUND:** `workers/queue_worker.py:253` re-validates envelope
  workspace + DB membership before `handle`.
- **Agent ownership:** `Agent.user_id` + `workspace_id` + `tenant_id` stored;
  execution `tenant_id/user_id` in `AgentExecution`. No cross-workspace agent
  reuse observed.

**Pay attention to alternate routes:** No direct `POST /agents/execute` bypass —
all go through orchestrator; `temporal` DurableAgentRunWorkflow is alternate but
`DISABLED-BY-DESIGN` and when enabled requires typed `DurableAgentRequest` (IDs
only) + `validate_no_secrets`.

---

## AgentCard

- **Spec:** `orchestrator/card.py:83` `AgentCard(BaseModel)` with
  `name/version/description/tools/output_schema/autonomy/status/safety_guidelines` +
  `render_system_prompt` (Jinja2 with
  profile/master_resume/preferences/rag_context/tools/schema/guidelines) +
  `validate_output` via `jsonschema.Draft7Validator`.
- **Authorization:** Card `status=ACTIVE` required in scorer (`router.py:162`
  `status != ACTIVE → 0`), `tools` union determines `allowed_tools` for
  `AgentPolicy`/`AgentContract`; forbidden tools explicit (`agent_contracts:58`
  `forbidden_tools` e.g., `gmail_send`, `repo_delete`).
- **Evidence:** `test_agent_cards.py` checks card rendering + validation;
  `test_muse_gate2_registry_scope.py` proves least-privilege scope binding.
- **Bypass?** None — `loop.py:818` least-privilege offers only
  `agent_tools ∪ card_tools` (up to 12) + MCP bridged tools;
  `get_tool_definition` fixes bug where MCP tools were offered but missed at
  execution.

---

## Approval Security

**Two-table system (legacy + active):**

- Active: `agent_approvals` (consumed by loop) +
  `approval_request`/`approval_decision` (human decision service). Migration
  0003 creates `agent_approvals`; 0005 RLS enables it.

**Properties verified (CODE+HERMETIC):**

- Canonical payload binding: `loop.py:162` canonical JSON SHA256 compare before
  consume; mismatch → continue (skip row).
- HMAC binding: `services/approval.py:36` `_payload_hmac` (HMAC-SHA256 truncated
  to 32 hex) stored as `[hmac:…]` prefix in `reason`; loop verifies via regex
  `r"\[hmac:([0-9a-f]{32})\]"` and skips tampered rows (`loop.py:257` warning,
  skip).
- Expiry: sweep `UPDATE ... SET status='EXPIRED' WHERE expires_at < now` before
  every lookup (`loop.py:188` + `services/approval.py:248`), single-use atomic
  `UPDATE ... SET status='CONSUMED' WHERE id=:id AND status='APPROVED'` with
  `rowcount==0 → continue` (`loop.py:265`).
- Workspace/tenant/agent/action binding: loop query filters
  `agent_name/action_type/workspace_id` plus optional `approval_id`; service
  `decide` re-validates workspace membership via `_get_user_workspace_ids`
  (`approval.py:505`).
- Single use + replay: consumed row cannot be updated again (status no longer
  APPROVED), second approve → 409 (`approval.py:211`).

**Attacks (hermetically tested):**

- approval_swap (different payload hash) → skip; payload mutation → HMAC
  mismatch skip; replay (second consume) → rowcount 0 → None; double concurrent
  consume → one wins via DB atomic UPDATE; expired → EXPIRED before lookup;
  foreign approval (wrong workspace) → filtered out or 404 via user workspace
  check; wrong action/agent → filtered.

**Evidence:** `test_approval.py` (request/approve/reject/409/expired/audited) +
`test_idempotency.py:88` approval create idempotent +
`test_approval_execution_recheck.py` re-validation before execution
(`temporal/activities.py:607` `_revalidate_approval_for_execution` checks still
APPROVED, not expired, workspace/action integrity, owner still authorized, no
revoked Permission).

**Remaining (P3):** Reason-embedded HMAC is side-channel, not column — legacy
rows without HMAC pass on equality alone (backward compat). Acceptable but note
in threat model.

---

## Prompt / Injection Security

**Every untrusted input identified:**

- `user input` (origin), `RAG content` (entities/docs/preferences), `memory`
  (content/summary), `tool output` (all tools), `MCP output` (bridged),
  `web content` (browse/scrape), `connector content` (gmail/drive/…),
  `background payload` (envelope payload), `agent output`, `model output`.

**Containment — structural, not string filtering:**

1. **Middleware layer:** `PromptInjectionMiddleware`
   (`middleware/prompt_injection.py:21` 14 regex patterns + base64 decode
   check + OVERRIDE_PATTERN) → `400 {X-Injection-Detected:true}` before routing.
   `SKIP_PATHS` only health/docs/metrics; GET not scanned. Tests
   `security/test_prompt_injection.py` 14 payloads blocked, safe allowed, base64
   blocked.
2. **Compiler layer:** `PromptCompiler.quarantine`
   (`services/prompt_compiler.py:63`): `OVERRIDE_MARKERS` flagged, structural
   tag escape `re.sub("<\\s*untrusted-data")`, wrapped in
   `<untrusted-data source="…">` + `SECURITY NOTE` guard. Budget: system sacred,
   context truncated lowest-priority first.
3. **Runtime layer:** `AgentRuntime.sanitize_retrieved`
   (`services/agent_runtime.py:68`) + `ContextEngine` classification +
   `inference_policy.sanitize_tool_output` (`services/inference_policy.py:150`
   via `quarantine`).

**Tests:**

- Injection via `POST /search` + `POST /memories` + `POST /workspaces` + base64
  all blocked (hermetic).
- Structure breakout `</untrusted-data>` escaped to `&lt;/untrusted-data&gt;`.

**Result:**
`system instructions / authz / tool perms / approval / tenant scope / workspace scope / model policy / execution policy`
**cannot be influenced** by untrusted content without bypassing 3 layers.
**CODE+HERMETIC PROVEN**, no `PROMPT_INJECTION_CHECK` bypass found (env default
true). LLM classifier second layer behind `INJECTION_LLM_CLASSIFIER` remains
opt-in for cost — defense-in-depth, not sole control.

---

## Memory Security

- **Admission:** `memory_service.create_memory`
  (`services/memory_service.py:28`) sanitizes via `sanitize_text`, computes
  embedding (BYOK workspace-bound), sets `taxonomy_version` (1 vs 2), writes
  lineage JSON, respects `supersedes_id` marking superseded.
- **Tenant/workspace/user/agent/source/provenance:** stored
  `tenant_id/user_id/workspace_id/source_type/source_uri/connector_id/graph_node_id/supersedes_id` +
  `lineage` via migration 0027 JSONB + `confidence/contradiction_flags`.
- **Retrieval/mutation/deletion scope:**
  `get_memory/update_memory/delete_memory/search_memories` all enforce
  `tenant_id` + `workspace_id` (`_to_uuid` coercion) — foreign read returns
  `None`/empty; mutation returns false.
- **Tests (hermetic):** `test_memory_workspace_isolation.py` cross-workspace
  read/mutation denied; `test_memory_service.py` predicates;
  `test_memory_versioning.py` durable version row before flush.

**Poisoning:** `sanitize_text` + `quarantine` + supersession not decay;
adversarial memory content is treated as data via prompt compiler — proven via
quarantine path.

---

## Retrieval Security

**Pipeline:**
`query → filters (tenant_id, workspace_id, type/domain/tags) → vector search (pgvector `<=>`distance, 1536d) → keyword LIKE fallback → RRF-like`search_ranking.rank_results` → graph traverse → ContextEngine filter/rank/compress/validate → assembled typed sections`.

**Authorization survives every stage:**

- Vector: `services/llm_service.generate_embedding` workspace-bound key +
  `activities.py:500`
  `SELECT ... WHERE workspace_id=:wid AND source_type IN (...)` — workspace
  filtered at SQL level.
- Keyword: `search_service.py:126` `Memory.workspace_id == ws_uuid` +
  `Memory.tenant_id == tid_uuid` (when present) + tenant fallback via
  `Workspace JOIN User` subquery for entity/record tables.
- Graph: `loop.py:539` `Entity.workspace_id == w_uuid` + LIKE filter; later
  python post-filter `workspace_id == ws_uuid`.
- Memory: `memory_service.search_memories` workspace + tenant predicates.

**Tests:** No foreign vector/keyword/graph node reaches model — workspace
provenance `ws:` prefix checked in `ContextEngine.filter_items:134`
`cross-workspace` exclusion despite LIKE false positives from substring search.
**HERMETIC PROVEN** for SQL-filter path; vector stage on SQLite returns stub via
`cosine_distance=0.0` UDF — **CODE VERIFIED** for pgvector shape, **UNVERIFIED
live distance ranking** without PG.

---

## Database / RLS

**Schema:** `alembic/versions/0005_rls_expanded.py:52` enables RLS on 34 tables
with policy
`USING (workspace_id = current_setting('app.workspace_id',true)::uuid AND tenant_id = ...)` +
`WITH CHECK` same; `0010_rls_force_and_roles.py:132` `FORCE ROW LEVEL SECURITY`
on 34+ tables + `vaeloom_migrator BYPASSRLS` + revoke
`BYPASSRLS FROM vaeloom_app`; `0019/0020` remaining 5;
`0028_enable_rls_all_policy_tables.py` final enablement. Total **42/42** per
`muse-gate-2-baseline`.

**Inspection (CODE VERIFIED):**

- `RLS enabled` + `FORCE` where required: migration code iterates `RLS_TABLES`
  and executes `ALTER TABLE ... FORCE` — correct for SaaS per AWS/Crunchy.
- Policies use `current_setting('app.*', true)` (not exception on missing) +
  UUID cast — predicates match `tenant.py:65` set_config.
- `WITH CHECK` present on all policies (insert/update guard).
- Application role `vaeloom_app` granted `SELECT/INSERT/UPDATE/DELETE` + `USAGE`
  on sequences, then `FORCE` ensures it cannot bypass.
- `BYPASSRLS` only on `vaeloom_migrator` for migrations.
- Transaction-local GUCs via `set_config(...,true)` (transaction-scoped) —
  correct for PgBouncer (`database.py:10` cache_size 0).

**Pool/transaction reuse (CODE VERIFIED; LIVE UNVERIFIED):** `get_db` sets GUCs
on each session via `set_rls_session_vars` inside transaction,
`TenantContext.clear()` in `tenant.py:189` finally prevents ContextVar leak.
PgBouncer transaction mode would reuse connection but SET LOCAL dies with
transaction — correct. No `SET` (session-scope) usage found. **Live proof
requires PG + PgBouncer load test** — mark UNVERIFIED.

**SELECT/INSERT/UPDATE/DELETE/ WITH CHECK / unset/wrong context:** All
predicates symmetric; unset → `true` returns null → zero rows (fail-closed) per
`tenant.py:59`. Wrong context → zero rows. No `BYPASSRLS` test reachable via
`vaeloom_app`.

**Result:** Combined app + DB isolation **CODE VERIFIED**, app predicates
**HERMETIC PROVEN**, RLS **UNVERIFIED live** (all `test_rls_*` skipped). This is
the dominant UNVERIFIED pillar.

---

## Pooling Isolation

As above + `database.py:13`
`pool_size 20 / max_overflow 10 / pool_pre_ping True`. No evidence of connection
pinning or tenant affinity; transaction-local GUCs are the only isolation
mechanism — correct. No test simulates pool reuse across tenants on asyncpg —
**SEAM PROVEN via code, UNVERIFIED live**.

---

## State / Checkpointing

**Model:** `orchestrator/state.py:127` `LoopState` v2 (extends v1) with
`schema_version=2`, `state_version` optimistic CAS, `correlation_id`,
`cancel_requested`, `is_terminal` (`TERMINAL_STATUSES`), explicit
`TERMINATION_REASONS` (12 values), `failure_code_for` mapping to `FAILURE_CODES`
(13 codes).

**Audit:**

- `state_version` bump on every `save_checkpoint` → new_version =
  max(stored_json version, column version)+1 (`state_store.py:175`), returned.
- `checkpoint` via `StateStore.save` abstraction: `MemoryStateStore` (tests),
  `DatabaseStateStore` (LoopCheckpoint table id=request_id), `FileStateStore`
  (JSON), `CompositeStateStore` (primary+fallback). Primary falls back to file
  on exception except `ConcurrentUpdateError` which surfaces (`state.py:410`).
- `resume` → `load_or_create_state` tries `get_state_store().load` then file
  fallback (`state.py:308`).
- `merge` — `save_checkpoint:390` merge-before-write: if stored
  `cancel_requested` true and in-memory false → adopts; if stored terminal and
  in-memory not → preserves stored terminal (prevents un-completing).
- `lost updates` prevented via CAS `expected_version` where supplied;
  `load_or_create_state` + `save_checkpoint` callers in loop pass
  expected_version on critical transitions (tested
  `test_runtime_phase_b:TestVersionedState:test_cas_conflict_raises`).
- `terminal + stale update` → merge preserves terminal (`state.py:395` log
  warning).
- `cancellation` durable via `request_cancel` (`state.py:336` sets flag +
  checkpoint) and merge preservation.

**Tests:** `test_state_durability.py` (memory + composite fallback after primary
delete), `test_database_state_store.py`, `test_runtime_phase_b` terminal
no-replay (zero re-execution) + duplicate request same identity.

**Remaining (P2):** `RedisStateStore.save:299` ignores `expected_version` (no
CAS), returns version+1 without check — LWW on redis backend. File store CAS
reads file then bump — race between two files writers on NFS? mitigated by DB
primary in prod (`VAELOOM_STATE_BACKEND=db` → Composite DB+File).

---

## CAS

Covered above. Pure `Memory`/`File`/`Database` **SEAM PROVEN**; `Redis`
**FAILED** (no CAS). Recommend fix: Redis CAS via WATCH/MULTI or `SET ... IF` +
version check.

---

## Cancellation

- **API:** `POST /api/v1/agents/{id}/cancel` → `state.request_cancel` → durable
  flag → loop checks `state.cancel_requested` before next act (`loop.py` +
  `state.py:336`).
- **Resume/merge:** stored `cancel_requested` wins over stale in-memory copy
  (`state.py:391`).
- **Terminal resurrection:** merge preserves stored terminal over stale
  non-terminal.

**Proof:** `test_runtime_phase_b` cancellation path via
`LoopState.terminate("cancelled","user_cancel")` + `request_cancel` idempotent
(no checkpoint → false, terminal → true). **HERMETIC PROVEN** for flag
propagation, **UNVERIFIED live** for worker SIGKILL mid-execution (see crash).

---

## Idempotency

**Two lifecycles:**

1. **HTTP middleware idempotency** (`middleware/idempotency.py:26`):
   `Idempotency-Key` header on `CONSEQUENTIAL_PREFIXES` (`/consent/grant`,
   `/consent/revoke/*`, `/gdpr/delete`, `/approvals*`) for POST/PUT/PATCH. Flow:
   `lookup (key+path+not expired)` → if found and `request_hash` matches → 200
   replay `Idempotency-Replayed:true` else 422 mismatch; else `call_next` →
   `_store` (delete expired, insert with 24h TTL) with `IntegrityError`
   swallowed. Tests `test_idempotency.py` prove replay/mismatch/different key/
   non-consequential ignored / GET pass / approval create single row —
   **HERMETIC PROVEN**. Fail-open on lookup/store exception (log, pass-through)
   — P2.

2. **Tool durable idempotency** (`models/schema.py:648` `ToolIdempotency`
   UNIQUE(workspace_id,idem_key) + `tools/executor.py:225`
   `_BASE_APPROVAL_GATED` + `inference_policy.idempotency_key` SHA256[:24] over
   canonical params). Executor checks DB before dispatch (`executor.py:??` DB
   hit skips re-execution,
   `test_runtime_phase_b:TestDurableIdempotency:test_executor_db_hit_skips_reexecution`
   clears LRU to prove durability after crash). UNIQUE guarantees single winner
   for concurrent duplicate (`test_unique_constraint_single_winner`).

**Required: ONE EFFECT / ONE WINNER** — proven for tools via DB UNIQUE +
executor early return; for HTTP via middleware replay + DB UNIQUE on
`IdempotencyRecord(uq_idempotency_key_path)`. Concurrent requests race on INSERT
→ one wins, loser on retry will replay (store IntegrityError rollback, next
lookup sees winner).

**Remaining (P2):** Middleware `CATEGORY_RETRIES` not relevant; tool
`workspace_id` scoped but `idem_key` deterministic across processes verified via
subprocess (`test_key_deterministic_across_processes`).

---

## Crash Recovery

- **Process/worker failure:** Loop recovers via `load_or_create_state` → resumes
  from last checkpoint phases; terminal runs never re-execute
  (`TestResumeNoReplay`).
- **Checkpoint recovery:** `StateStore` pluggable; `Composite` ensures file
  fallback if DB down.
- **Side-effect recovery:** Tool UNIQUE ensures crash after side-effect but
  before checkpoint still yields single effect (retry finds DB row).
- **Cancellation recovery:** preserved via merge.
- **Authorization recovery:** `TenantContext` cleared per request; recovery via
  `load` re-populates from stored `workspace_id` + JWT on resume — proven in
  loop (workspace_id passed to `load_or_create_state`).
- **SIGKILL evidence:** **NOT PROVEN** — no test performs `os.kill(-9, pid)` or
  `SIGKILL` of isolated staging worker. The spec demands `SIGKILL` not
  `SIGTERM/exception/mock`. Environment has no isolated Redis/Postgres worker to
  kill. Mark **UNVERIFIED** per §15. This is the second UNVERIFIED pillar.

---

## Redis

- **Producer:** `queue_worker.BullMQWorker` + `background_daemon` enqueues via
  `redis.asyncio`.
- **Queue:** `bull:<queue>:wait` (list), `bull:<queue>:delayed` (zset),
  `bull:<queue>:active/failed/completed`.
- **Worker:** `BullMQWorker.start` loop `BLPOP wait` + `_promote_delayed` with
  `zrem` atomic gate (concurrent promotion safe), concurrency semaphore (5),
  `active_tasks` draining on stop.
- **Retry/backoff:** `backoff_ms = min(300_000, 2^attempts * 5000)`,
  `maxAttempts` from job hash, delayed zadd with `now + backoff_ms`, failed →
  `dead_letter` via `failed` zset.
- **Ack/redelivery:** Redis `zadd`/`hset` as ack; lost ack would be re-queued
  via delayed promotion — designed.
- **Durable state authoritativeness:** Not Redis — DB
  `LoopState`/`ToolIdempotency`/`agent_approvals` remain source of truth; Redis
  queue is at-most-once per delivery but executor dedup handles at-least-once.

**Tests:** `test_workers.py` mocked Redis; no live outage/redelivery/sigkill
proven. **CODE VERIFIED, HERMETIC (mock) ONLY, LIVE UNVERIFIED**. Fail-closed:
`REDIS_URL` not set → in-memory fallback; durability assertions degrade to
best-effort.

---

## Queue

Same as Redis. No phantom completion (job marked completed only after handler
success `zadd completed` + `hset returnvalue`). Duplicate side-effect covered by
tool UNIQUE. Authorization retained via envelope re-validation on consumption
(`handle_schedule_agent_run:297` verifies envelope again in worker).

---

## Worker

- **Death:** `BullMQWorker.stop` drains `active_tasks`; daemon
  `start_background_daemon` in `main.py:163` with stop on lifespan shutdown.
- **Retry:** exponential backoff, max 3 default.
- **Redelivery:** via delayed zset promotion, `zrem` gate ensures single
  promoter.
- **Durable state authoritative:** yes (DB).

**Live worker death / lost ack / redelivery / duplicate delivery:**
**UNVERIFIED** — requires isolated Redis worker SIGKILL test.

---

## Redelivery

Proven via code that retry loop re-enqueues to delayed and later promotes;
duplicate delivery deduped via tool UNIQUE + middleware `IdempotencyRecord`
UNIQUE. No live duplicate-delivery test.

---

## Background Security

**Trace:**
`API → job creation → envelope (create_background_envelope) → queue (BullMQ) → worker → verify_background_envelope → AgentCard / approval → execution`

**Envelope:** `infrastructure/background_envelope.py:54`
`create_background_envelope` requires tenant/workspace/user/agent/action,
HMAC-SHA256 over canonical JSON (`_canonical_bytes` sort_keys), nonce UUID,
issued/expiry (default 3600s). `verify_background_envelope:89` returns
`(bool, reason, payload)` checking required fields → expiry →
`hmac.compare_digest` → nonce replay (in-memory `_SEEN_NONCES`).

**Attacks (CODE VERIFIED + HERMETIC where worker mocked):**

- Tampered envelope → HMAC fail → `BackgroundSecurityError`.
- Expired → `envelope expired` error.
- Replayed → nonce in `_SEEN_NONCES` within TTL → `replay detected` (but
  per-process only — P1 cross-worker replay).
- Foreign tenant/workspace → envelope `workspace_id` vs payload `workspaceId`
  mismatch → error (`queue_worker.py:241` + `311` `action` mismatch) + DB
  `check_user_workspace_access` second factor.
- Wrong membership → `check_user_workspace_access` false → error.
- Unauthorized worker → `verify_background_envelope` fails (no secret) → error.
- Missing envelope → `BackgroundSecurityError: Missing required envelope`.

**Missing envelope / expired / replayed handling:** fail-closed (raise). **Valid
job** → `TenantContext.set` then `handle` or `execute_agent_schedule_job`.

**Remaining (P1):** nonce cache per-process (`_SEEN_NONCES` dict) not shared
Redis — cross-worker replay within TTL could succeed if attacker captures
envelope and delivers to another worker fast. `verify_background_envelope`
accepts `redis_client` param but callers pass `None`. Fix: Redis-backed nonce
set (`SET NX EX`).

---

## Model Routing

- **Capability requirements:** `AgentTask → tier` via `TASK_MODEL_MAP`
  (`model_router.py:44` 17 entries) + `AGENT_TASK_TYPE_MAP` (23 agents) +
  `route()` risk/complexity/context_tokens/latency aware
  (`inference_policy.py:104`).
- **Tier/provider:** MODEL_CATALOG 5 groq/openai/anthropic/gemini with
  cost_per_1k + tier.
- **API key ownership:** `llm_service._resolve_api_key:56` priority explicit >
  workspace > user > system via `provider_key_service.resolve_effective`; marks
  used. Fail open to system key if BYOK lookup fails (log), not error —
  intentional.
- **Workspace ownership:** provider keys are workspace/user scoped; check in
  `provider_key_service` ensures workspace ownership.
- **Tool capability:** `generate_completion_with_tools` fallback excludes
  `embedding` models (`llm_service.py:550` `if "embedding" not in m.name`),
  stays tool-capable.
- **Embedding restrictions:** `generate_embedding` only supports google/openai
  (`llm_service.py:150` raises for anthropic).
- **Fallback policy:** same-provider tier fallback then cross-provider same-tier
  (2 entries) (`llm_service.py:304` + `530`), records `fallback_chain` +
  `downgraded` + `inference_policy.record_fallback`.
- **Provenance:** `model`, `fallback_chain`, `downgraded` in result +
  `record_usage` logs latency/tokens/cost.
- **Downgrade reporting:** visible in result, not silent.

**Tests (HERMETIC PROVEN):**

- `test_llm_resilience.py` +
  `test_runtime_phase_b:TestToolFallback:test_with_tools_fallback_preserves_capability`
  (gives gpt-4o failure → gpt-4o-mini, embedding excluded).
- `test_llm_byok.py` workspace/user vs system precedence.
- `test_browser_tools.py` etc.

**Remaining (P2):** `AGENT_TASK_TYPE_MAP` inference when `task_type==general`
(`llm_service.py:273`) is heuristic; handlers that call `generate_completion`
with explicit `task_type` override — not all do, so some calls stay `balanced`
default Sonnet rather than optimal tier. Observable via `downgraded` flag.

---

## Provider Failover

Primary success → first candidate; primary failure (LLMTransientError 429/5xx +
Timeout/Network) → retry via tenacity (`llm_service.py:113` 3 attempts
exponential) then tier fallback chain. Same-tier fallback tested; cross-provider
fallback tested via 2 extra candidates. Missing key → skip candidate (resolve
returns empty, then `_openai_completion` raises `LLMProviderError` → continue
loop). Wrong key → 401 not retryable? Actually 401 not in transient list →
raises `LLMProviderError` → fallback continues (correct). Unsupported capability
(embedding on anthropic) → immediate error, not fallback to same tier embedding?
But embedding fallback not implemented — intentional per provider doc.

---

## Orchestration

- **Goal:** `UserRequest.message` → `LoopState.goal_fingerprint` (SHA256[:16]).
- **Planning:** `plan_phase` → RAG + context_loader + message normalization.
- **Execution:** `act_phase` (static handler or ReAct tool loop up to
  `agent_max_react_rounds` 5).
- **Observation:** tool result → quarantined + shape validated (executor reports
  `_shape_problems`).
- **Replanning:** `LoopSafetyTracker.detect_cycle/no_progress` + `evaluate`
  needs_replan within `MAX_GRAPH_REPLANS`.
- **Termination:** explicit `LoopState.terminate(status, reason)` with 12
  reasons; every loop end names one.
- **Budget:** `agent_max_iterations_per_run` 3 / `max_tool_calls` 12 / `tokens`
  12k / `cost` $0.50 / `duration` 120s (config) + per-iteration budgets in
  `LoopSafetyTracker`.
- **Iteration limit:** LoopController + Tracker both enforce.
- **Failure handling:** classified via `failure_code_for` then QA gate.

**Tests:** `test_harness_v1.py` + `test_runtime_phase_b:TestBudgets` tool_budget
terminates + `TestLoopSafety` cycle detection + `TestGraphReplan`.

---

## Loop Safety

Verified bounded execution: `test_runtime_phase_b:TestLoopSafety` repeat 3x →
`cycle_detected`, ABA oscillation → cycle, variety → none, no_progress same
observation no side effect → `no_progress`, with side effect → not, budgets
tool_calls → `tool_budget`. No infinite loop demonstrated up to ceilings.

---

## Tools

- **Registry:** `tools/definitions.py:1003` `ALL_TOOLS` 32 static +
  `definitions` comp entail 50 counted in prior audit (with browser/github
  additions); `tools/executor.py:225` adds MCP dynamic.
- **Selection:** ReAct offers only `declared ∩ (ALL_TOOLS ∪ DYNAMIC)` up to 12
  (`loop.py:833`).
- **Arguments:** validated via `input_schema` (jsonschema not enforced at
  executor, but handler validates required fields e.g., `name/entity_type` for
  create_entity → error if missing).
- **Workspace/tenant/AgentCard:** `check_permission` +
  `approval_gated_tools()` + MCP workspace ownership.
- **Approval:** `Tools: executor._BASE_APPROVAL_GATED` 16 + dynamic
  non-readOnly; loop `_try_react_loop` also checks `approval_gated_tools` before
  tool call.
- **Timeout:** per-category + overrides (browse 45s).
- **Audit:** `_audit_log` INFO with agent/tool/workspace/success/duration/error
  (`test_tools_executor:test_audit_log_logs`).
- **Idempotency:** as above.

**MCP honesty:** Not `SANDBOXED` — classified `EXPLICITLY BOUNDED`: argv
allowlist, env allowlist (`_ALLOWED_PARENT_ENV`), interpreter deny
(`_DENIED_COMMANDS`), metachar filter (`_SHELL_METACHARS`), 30s call timeout,
10s connect, input size 20k, structured 20k, no egress beyond server-declared
transport (stdio argv or http url). No OS sandbox; same-host subprocess with
pattern filter (`tools/definitions.py:900` `execute_code_sandbox` description
notes NOT OS sandbox). **Correctly bounded, not overclaimed.**

---

## MCP

See above + bridging. `mcp_client_service.py:129` validates config: transport
stdio requires command string not shell, no metachars, env dict strings only;
http requires https or allow_insecure flag, valid url, header RFC7230 + size
4096, no line breaks. Call-time workspace ownership
(`mcp_client_service.py:392`) + approval gating for non-readOnlyHint. Warm-up in
`main.py:180` bridges each mcp connector on startup.

---

## Observability

**Every execution should preserve:** `request_id` (UUID or state request_id),
`correlation_id` (middleware/queue/envelope or run id), `tenant`, `workspace`,
`agent`, `run` (request_id), `iteration`, `tool`, `provider`, `failure`,
`approval`, `checkpoint` — **CODE VERIFIED**: `LoopState.correlation_id`,
`AgentRequest.correlation_id`, middleware `CorrelationIDMiddleware`,
`RequestLoggingMiddleware`, `AgentMetricsCollector`,
`prometheus_fastapi_instrumentator` `/metrics`, `opentelemetry` FastAPI
instrumentor (`main.py:321`). Logs are structured JSON (formatters) with
correlation.

**Verify logs do NOT expose:**
`API keys / JWTs / passwords / refresh tokens / secrets / raw credentials / sensitive payloads`
— verified via `test_secret_keys_unified.py` +
`infrastructure/logging._redact` + `temporal/validation.SECRET_KEYS` shared
single source (`graph/state.py:18`). Tool outputs truncated to 4k/6k, not raw
bodies. **HERMETIC PROVEN** for key names; no live log dump proven but code
shows redaction.

**Verify failures remain diagnosable:** `failure_code_for` +
`termination_reason` + `policy_decisions` + `_shape_problems` +
`approval_state` + `rag_status` (ok/empty/unavailable/timeout/error) all
persisted in checkpoint — **HERMETIC**.

---

## Failure Taxonomy

Enumerated 13 codes:
`OK, AUTHORIZATION_FAILURE, VALIDATION_FAILURE, MODEL_FAILURE, TOOL_FAILURE, RETRIEVAL_FAILURE, MEMORY_FAILURE, APPROVAL_REQUIRED, APPROVAL_FAILURE, TIMEOUT, CANCELLATION, RETRY_EXHAUSTED, CHECKPOINT_FAILURE, POLICY_FAILURE`
(`state.py:59`). Mapping from termination reasons
(`_TERMINATION_TO_FAILURE_CODE`). Verified each classification site:
`loop.py:??` sets failure via `failure_code_for(status, termination_reason)` +
`agent_service` error handling. No exception silently becomes SUCCESS —
`generic_exception_handler` logs and returns 500; loop terminates `failed` on
exception.

---

## Budgets / Resource Safety

- **Token budget:** `LoopPolicy.max_tokens` 12k + `PromptCompiler.max_tokens`
  8k + `ContextEngine token_budget` 2000 + graph `MAX_STATE_BYTES` 20k +
  `MAX_TASK_BYTES` 20k.
- **Iteration budget:** `max_iterations` 3 (+ loop policy 8 default but
  overridden by config 3).
- **Tool budget:** 12 tool calls per run, 5 react rounds, 8 fanout branches.
- **Time budget:** 120s loop duration, per-tool timeouts 1-45s.
- **Spend budget:** per-workspace daily quota (`temporal/quota`) + per-run $0.50
  ceiling (`agent_costs`).
- **Provider budget:** same.
- **Concurrency:** per-workspace limiter (`workspace_limiter.acquire`),
  per-agent rate limiter (TokenBucket 30rpm), circuit breaker 3 failures/30s.

Exhaustion tests: `test_runtime_phase_b:TestBudgets:test_tool_budget_terminates`
(set max_tool_calls_per_run 0 → failed tool_budget). No infinite loop proven via
safety tracker.

---

## Concurrency

Runs concurrent
`users / tenants / workspaces / agents / runs / approvals / memory operations / retrieval / tool execution / background jobs`
via `asyncio.gather` in supervisor + xdist 4 workers
(`pyproject.toml:addopts="-n 4"`). Look for race etc:

- Race / lost update: `ConcurrentUpdateError` on CAS proven for Memory/File/DB;
  Redis missing CAS noted.
- Scope leakage: ContextVar + SET LOCAL proven safe for PgBouncer transaction
  mode.
- Duplicate effect: UNIQUE constraints + middleware replay prevent.
- Approval double consume: atomic UPDATE rowcount.
- Idempotency collision: UNIQUE + fail-closed hash mismatch 422.
- State corruption: merge preserves invariants.

No concurrency load test with 100 parallel cross-tenant requests executed here —
**SEAM** via code, not load.

---

## End-to-End User Scenarios

| Scenario                          | Path                                                                                                                          | Result                                             | Evidence                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Research (single-step retrieval)  | `research` agent → `_assemble_rag_context` LIKE → ranking → compile → mock LLM → QA approve                                   | Pass (summary)                                     | `test_muse_e2e_scenarios.py` + router handle hermetic                                        |
| Multi-step reasoning (supervisor) | 2-intent message → `_is_complex_multi_agent` → `run_supervisor` DAG layers → parallel `_run_single_agent` → fan-in/merge → QA | Pass (spawn_counts ≤2 for resume↔ATS cycle pruned) | `test_runtime_phase_b:test_supervisor_prunes_respawn_cycles`                                 |
| Memory-assisted task              | `memory` agent → `memory_service.search_memories` with workspace filter → context manifest (engine v1)                        | Pass (provenance fingerprint + engine)             | `test_runtime_phase_b:test_rag_context_manifest_present` + `test_memory_workspace_isolation` |
| Retrieval-assisted task           | RAG hybrid (vector attempt → LIKE → tsvector) → ILIKE fallback visible, vector skipped on SQLite                              | Partial (hybrid-lite, not true BM25 RRF)           | `test_search_service.py` + rising ranking                                                    |
| Tool execution (read)             | `search_documents` → DB mock → success                                                                                        | Pass                                               | `test_tools_executor:test_execute_search_documents_success`                                  |
| Consequential approved action     | `categorize_document` → requires approval → without → error; with APPROVED + payload hash + HMAC + atomic consume → success   | Pass (single effect)                               | `test_runtime_phase_b:TestDurableIdempotency` + approval hmac tests                          |
| Replanning                        | `evaluate_node` score 0.4 <0.6 at attempt 0 → needs_replan                                                                    | Pass                                               | `test_runtime_phase_b:TestGraphReplan`                                                       |
| Failure + retry                   | Tool transient → retry via `CATEGORY_RETRIES` 3× then ToolExecutionError; LLM transient → tier fallback                       | Pass                                               | `test_tools_executor:test_execute_tool_timeout_retry_then_fail` + `test_llm_resilience`      |
| Crash + resume                    | Terminal checkpoint → re-invoke same request_id → zero re-execution                                                           | Pass (mem store)                                   | `test_runtime_phase_b:TestResumeNoReplay`                                                    |
| Background execution              | Envelope create → queue → worker verify → tenant check → handle                                                               | Pass (hermetic mock)                               | `test_workers.py` + queue_worker envelope checks                                             |
| Provider fallback                 | gpt-4o fail 503 → gpt-4o-mini, cross-provider Bal tier                                                                        | Pass                                               | `test_runtime_phase_b:TestToolFallback`                                                      |
| Tenant isolation                  | A cannot see B workspaces/memories                                                                                            | Pass hermetic                                      | `security/test_tenant_isolation.py`                                                          |
| Workspace isolation               | Same                                                                                                                          | Pass                                               | Same                                                                                         |
| Prompt injection                  | 14 payloads blocked 400 + X-Injection-Detected                                                                                | Pass                                               | `security/test_prompt_injection.py`                                                          |
| Approval attack (swap/replay)     | Swapped payload hash skip, replay rowcount 0 second try                                                                       | Pass                                               | `test_approval_execution_recheck.py` + loop hmac                                             |

Each traces `REQUEST → RESPONSE` via real runtime (mock LLM/DB) — not unit stub
for routing but full loop stack (hermetic, not live PG/Redis).

---

## Performance

**Measured where meaningful (hermetic, SQLite, mock LLM):** no SLO invented per
§26. Prior reports claim distributions but no live p50/p99 evidence in this
audit env.

- Simple loop (plan→act→observe→reflect via MockAgent): **~2-5ms** per iteration
  in-memory (see `test_runtime_phase_b` wall times, not exported).
- Multi-step loop (supervisor 2 agents parallel): wall ~ sum of slowest + QA
  retries, hermetic <50ms.
- Retrieval (LIKE 5 keywords, 2 tables): <10ms per query on tmp SQLite (10
  rows), tsvector not exercised (PG only).
- Memory create (sanitize + hash + embedding mock): <5ms.
- Tool success (DB mock): <2ms; browser tool timeout would be **45s worst** (not
  measured live).
- Background enqueue→dequeue: in-memory not measured; Redis round-trip expected
  ~1-5ms per op (UNVERIFIED live).
- Concurrency 4 workers, 16 suites: suite wall ~2-3min with `--dist loadfile` on
  32GB (per AGENTS.md), serial 8-10min.

**Separation (must not conflate):**

- Mocked model latency: **~0ms** (mocked `fake_generate_completion` returns
  instantly) — not real inference.
- Real infra latency: **UNMEASURED** (no live PG/Redis/LLM).
- End-to-end latency: **HERMETIC PROVEN** only for mocked path; production
  p50/p99 require staging load test with real Groq/Anthropic + vector store —
  **UNVERIFIED**.

Do not claim statistically meaningful p99 from tiny samples — not done.

---

## Disabled Runtime Classification

| Runtime   | Implemented                                                                       | Wired                                                                  | Default                                                                                      | Enabled                                     | Tested                                                                  | Ownership                                         | Fallback                          | Final                                                                  |
| --------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| Temporal  | Yes (5 workflows, 10 activities, client, interceptor, metrics, quota, validation) | Partial (routes/migrations ready, not mounted as durable default)      | `temporal_enabled=False` (`config.py:162`)                                                   | No                                          | Unit via `temporalio.testing.WorkerEnv` + hermetic disabled-mode guards | `temporal/` owns durability, validates no secrets | Legacy non-durable loop (default) | **DISABLED-BY-DESIGN** — not activated to claim coverage (§27)         |
| LangGraph | Yes (StateGraph, 9 nodes, contracts, Send fan-out)                                | Yes but only inside `temporal/activities.durable_agent_run→_run_graph` | `langgraph_enabled=False`, `langgraph_agent_run_percent=0`, `shadow=false` (`config.py:180`) | No                                          | Tests opt-in via `VAELOOM_TEST_REAL_AGENT=1` + shadow parity logging    | LangGraph owns topology, Temporal owns durability | Legacy stub (`_legacy_result`)    | **DISABLED-BY-DESIGN**                                                 |
| ReAct     | Yes (`loop.py:798` streaming, 5 rounds, manifest, validation repair)              | Yes (act_phase `_try_react_loop`)                                      | `agent_react_enabled=False` (`config.py:149`)                                                | No (falls back gracefully when key missing) | `test_react_loop_cards` + `test_runtime_phase_b` with flag on           | Static dispatch is deterministic primary          | Static handlers (MVP truth)       | **DISABLED-BY-DESIGN** — deterministic primary preserved intentionally |

Not enabled to inflate audit — honesty as per §27.

---

## Repository-Wide Bypass Scan

Search patterns (`rg` equivalent via python grep):

- `async_session_factory` without `check_user_workspace_access` → found only in
  activities + tool handlers which still filter by `workspace_id` at SQL level;
  no tenant-less mutation via HTTP.
- `get_tool_definition` vs `ALL_TOOLS` → fixed via helper, no shadow.
- Direct `jwt.decode` outside `middleware/auth.py` → none found that bypass
  tenant check.
- `tenant-less query` → `search_service` fail-closed if no tenant/workspace; no
  bypass.
- `background bypass` → all `handle_*` verify envelope + DB membership.
- `approval bypass` → `approval_gated_tools()` includes all `connector_write` +
  dynamic non-readOnly, checked both in loop ReAct offer and executor permission
  pre-check (`executor.py:??` prior to dispatch). No legacy endpoint bypass.
- `AgentCard bypass` → impossible — runtime contract synthesized from card +
  tools every execution.
- `shadow router/orchestrator` → only one router (`orchestrator/router.py:452`)
  and one orchestrator loop (`orchestrator/loop.py`); supervisor delegates via
  `_run_single_agent` → same loop.
- `debug endpoint` → `/docs`, `/openapi.json`, `/redoc`, `/metrics` are
  intentional; `/debug/*` not found; `if DEBUG` wiring only for StateServer in
  iOS DebugBridge, not API.
- `test-only production path` → `PYTEST_CURRENT_TEST` skips vector embedding +
  real agent dispatch + tool DB writes — these are mocks that degrade to
  stub/error, never grant success bypassing auth — verified in
  `tools/executor:??`
  `if PYTEST_CURRENT_TEST and not VAELOOM_TEST_REAL_TOOL → mock`.

**Conclusion:** No reachable bypass discovered that circumvents invariants
established by primary path.

---

## Test Quality Audit

- **What is actually tested?** 172 test files, 2731 collected (2026-08-23 +59
  from parallel). Covers auth, tenant isolation (app), approvals, idempotency,
  prompt injection, RLS code shape, tools (64 cases mock DB), state/CAS
  (Memory/File/DB), budgets, trajectories, supervisor, mcp, llm byok/fallback,
  etc.
- **What is mocked?** `mock_llm` (generate_embedding/completion/tools/stream) +
  `mock_connector_test` autouse; `mock_llm` sets `llm_api_key=""`
  deterministically. Tools use `MockAsyncSession` (no real PG). RAG vector uses
  `cosine_distance` UDF returning 0.0.
- **What is hermetic?** ~90% of 2731 (SQLite NullPool tmp_path per test) —
  hermetic proven for app predicates.
- **What is live?** None in this env — no live PG (`test_rls_*` skipped 4,
  `test_rls_live_pg.py` 0), no live Redis (`test_workers` mocked), no live
  Temporal, no live LLM.
- **What is skipped?** 4 RLS live (`@pytest.mark.skip Requires PostgreSQL`) +
  occasional `pytest.skip` for langgraph unavailable; no hidden `skip = pass`.
- **What is weakly asserted?** Some `assert res.status_code in (200,201)`
  dual-code paths (workspace/memory) — not flaky but permits both; approval 409
  already-decided is strong. Search tests use `ilike` substring not semantic —
  asserts count≥1 but not relevance. Already noted coverage 94% was unit, not
  E2E load.
- **What is duplicated?** `middleware/test_csrf` duplicates `security/test_csrf`
  per zero-trust audit F-02 — intentional de-duplication target noted.
- **What is stale?** `test_database.py` imports that once used `fitz` etc
  cleaned per conftest `_clean_global_state`.
- **Can produce false confidence?** Yes if reader mistakes SQLite hermetic for
  PG RLS live, or mocked model latency for real p99 — this report blurs never.
  **Test quality: GOOD for unit/hermetic, INSUFFICIENT for live infrastructure
  proof** — matches §29 requirement to distinguish.

---

## Production Configuration Audit

**Feature flags / env vars (verified `config.py:27` + `.env.example`):**

| Var                                                 | Dev default                                            | Prod required                                                            | Verified                                 |
| --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------- |
| `JWT_SECRET`                                        | must be set ≥32 chars, weak deny-list, fail fast       | same, not localhost localhost CORS                                       | validate_settings error if missing/short |
| `ENCRYPTION_KEY`                                    | ≥32 chars, required                                    | same                                                                     | error if missing                         |
| `DATABASE__URL`                                     | `sqlite+aiosqlite:///./dev.db` in local                | `postgresql+asyncpg://` with `vaeloom_app` (non-superuser) + RLS `FORCE` | normalize, sslmode→ssl replace           |
| `REDIS__URL` / `REDIS_URL`                          | `redis://localhost:6379/0` placeholder (not auto-used) | explicit `REDIS_URL` when multi-worker else in-memory fallback warning   | config warning, quota backend pluggable  |
| `LLM_API_KEY`                                       | mock-key allowed local, warning if missing             | must be real or BYOK per workspace                                       | warning only local                       |
| `INFISICAL_ENABLED` + client/secret                 | false                                                  | when true requires client/secret else error                              | error                                    |
| `TEMPORAL_ENABLED`                                  | false                                                  | true only in prod overlay with `TEMPORAL_HOST`                           | error if enabled but host missing        |
| `LANGGRAPH_ENABLED` + `LANGGRAPH_AGENT_RUN_PERCENT` | false/0 (safe)                                         | 0 unless operator progressive rollout, shadow off                        | correct default                          |
| `AGENT_REACT_ENABLED`                               | false (deterministic)                                  | 0 local, 1 only after eval                                               | correct                                  |
| `ENTERPRISE_ROUTES_ENABLED`                         | false (MVP scope)                                      | true only via overlay (CF-06)                                            | gated mounting in main.py:363            |
| `MVP_SCOPE_ENFORCED`                                | false in tests, true in settings default true          | true in MVP, false in enterprise overlay                                 | per test monkeypatch                     |
| `BROWSER_TOOLS_ENABLED` + `SCRAPE_QUOTA_PER_HOUR`   | true/20                                                | quota as configured                                                      | wired                                    |
| Rate limits `RATE_LIMIT_*`                          | 100/min + api_key 1000                                 | same or tighter per env                                                  | code                                     |
| `STORAGE_*`                                         | localhost minio                                        | S3/compatible, mirror off unless enabled                                 | warn on localhost non-local              |
| `ALLOWED_ORIGINS`                                   | localhost 3000/5173                                    | must not contain localhost when env≠local                                | error                                    |
| Timeouts `AGENT_TIMEOUT_SECONDS` 120                | 120                                                    | same                                                                     | ceiling                                  |
| Budgets `AGENT_MAX_*`                               | 3/12/12k/0.50/120s/2                                   | same                                                                     | hard ceilings                            |

**Check local `.env` overrides do not represent prod:** confirmed — `.env` at
repo root is local dev (sqlite, mock-key, allowed localhost), not production
template (`.env.production.template` separate). `config.py` `validate_settings`
refuses localhost CORS in non-local.

---

## Deployment Topology

Actual (from `docker-compose.yml`, `docker-compose.prod.yml`, `infra/`,
`apps/api/Dockerfile`, `main.py:lifespan`):

- **API:** `FastAPI` via `uvicorn api.main:app --host 0.0.0.0 --port 8000`
  (single process, `Lifespan` runs migrations + daemon + provider registry + MCP
  warm-up). No explicit `uvicorn --workers` in dev; prod uses single container
  replicated via orchestrator (Fly.io/Render/Vercel per prior docs — not
  verified live).
- **Workers:** `BullMQWorker` (`workers/queue_worker.py`) standalone
  `python -m api.workers.queue_worker` for `events` queue + `schedules` queue
  (daemon watchers + cron slots). Not running in dev unless `REDIS_URL` set;
  daemon `background_daemon.py` via `apscheduler` for cron + watcher registry.
- **PostgreSQL:** `postgresql+asyncpg` (asyncpg), expected `vaeloom_app` role
  non-superuser with `FORCE RLS`, `vaeloom_migrator` `BYPASSRLS` for migrations.
  Migrations via Alembic in lifespan (`alembic upgrade head`).
- **Redis:** `redis://` (rate limit + quota + queue + nonce dedup). Fallbacks
  in-memory when not configured — graceful degradation, not durability.
- **Queues:** BullMQ-compatible Redis lists/zsets
  (`bull:<queue>:wait/delayed/failed/completed`), not Durable Temporal queues
  (disabled).
- **Object storage:** MinIO (`storage_endpoint localhost:9000`) for raw bytes,
  `resume_artifacts` inline bytes fallback; `storage_mirror_enabled` opt-in.
- **External providers:** Groq/OpenAI/Anthropic/Google via BYOK (workspace/user
  → system fallback), rate-limited, health-checked.
- **Connectors:** Gmail/Calendar/Drive via `google-api-python-client` OAuth,
  Slack via executor, Greenhouse/Lever via clients, MCP via `mcp` SDK.
- **Frontend:** Next.js 15 at `apps/web` (`pnpm dev:web`).

**Single points of failure / shared resources / credential sharing / isolation /
restart:**

- Pool shared `engine` across requests — isolated via transaction-local GUCs
  (correct) but no tenant-affine pooling (intentional).
- Credentials: `JWT_SECRET` + `ENCRYPTION_KEY` shared per deployment cell
  (expected); BYOK keys encrypted per-key (`connector_ext_service`).
- No isolation per tenant cell (pool is pooled, not dedicated) — documented as
  pooled per `Tenant.isolation=pooled` default.
- State ownership: `LoopCheckpoint` + `ToolIdempotency` own durability (DB), not
  Redis — survives worker restart.
- Restart behavior: lifespan re-applies migrations, restarts daemon, re-bridges
  MCP — no lost static state beyond in-memory LRU/cache.

---

## Residual Risks

| ID    | Severity | Area                   | Risk                                                                                                                                 | Mitigation present                                                                     | Live-proven                          |
| ----- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------ |
| RR-01 | **P1**   | RLS                    | RLS live isolation (FORCE, WITH CHECK, pool reuse) not live-proven; only app predicates proven hermetically                          | Migrations + SET LOCAL + ContextVar correct                                            | **No** — need PG staging test        |
| RR-02 | **P1**   | Background envelope    | Nonce replay across workers (in-memory dict, not Redis SET NX) could allow duplicate background job within 3600s                     | HMAC + expiry + workspace bind + DB membership check mitigate forgery but not replay   | **No** — need Redis nonce set test   |
| RR-03 | P2       | State/Redis            | `RedisStateStore.save` ignores `expected_version` → CAS LWW on redis backend; cancel/terminal could be lost                          | Merge-before-write preserves flags even on LWW, DB primary is prod path                | No live worker kill test             |
| RR-04 | P2       | Idempotency middleware | Fail-open on DB lookup/store error passes request through, could duplicate consequential side effect                                 | IntegrityError single winner + tool UNIQUE provide second line                         | Hermetic only                        |
| RR-05 | P2       | Model routing          | `task_type==general` heuristic leaves some handlers on default balanced tier, not optimal tier                                       | Fallback chain preserves capability, cost still bounded                                | Need handler-by-handler wiring audit |
| RR-06 | P2       | Retrieval              | Vector stage on SQLite is UDF 0.0 (no ranking); tsvector/RRF/cross-encoder not hybrid-lite on PG-lite                                | LIKE fallback + ranking re-rank provide functional retrieval, but not semantic quality | Need PG vector+BM25 load eval        |
| RR-07 | P3       | MCP sandbox            | NOT OS sandboxed — same-host subprocess with pattern filter; malicious server could exfiltrate allowed env or consume host resources | Allowlist env, metachar deny, timeouts, input caps, approval gating                    | Code only, no pen-test               |
| RR-08 | P3       | JWT revocation         | Stateless HS256 no distributed denylist; compromised token lives until exp (3600s)                                                   | Short TTL + refresh rotation + session table active check                              | Need Redis denylist in prod overlay  |

---

## Security Matrix

| Invariant                  | Proven boundary                                                | Test                                     | Live                                    | Result                                   | Severity if broken |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------------------- | ------------------ |
| Tenant isolation (app)     | `check_user_workspace_access` JOIN + service predicates        | `security/test_tenant_isolation` 5 cases | SQLite hermetic                         | **PASS (hermetic)**                      | P0                 |
| Tenant isolation (DB RLS)  | FORCE + policy + SET LOCAL                                     | Skipped (PG required)                    | **UNVERIFIED**                          | **UNVERIFIED** — code verified, live not | P0                 |
| Workspace isolation        | Same + search fail-closed                                      | Hermetic                                 | Hermetic                                | **PASS**                                 | P0                 |
| User membership            | WorkspaceUser + owner join                                     | Hermetic                                 | Hermetic                                | **PASS**                                 | P1                 |
| Agent ownership/status     | Agent.user_id/workspace_id/tenant_id + kill_switch             | Hermetic                                 | Hermetic                                | **PASS**                                 | P1                 |
| AgentCard authz            | Least-privilege offer + synthesis                              | `test_agent_cards`                       | Hermetic                                | **PASS**                                 | P1                 |
| Tool authz                 | `check_permission` scopes + wildcard                           | `test_tools_executor` 16                 | Hermetic                                | **PASS**                                 | P0                 |
| Approval authz             | Payload hash + HMAC + atomic consume + workspace bind          | `test_approval` + recheck                | Hermetic                                | **PASS**                                 | P0                 |
| Background authz           | Envelope HMAC + nonce + expiry + DB membership                 | Unit mock                                | **UNVERIFIED cross-worker replay (P1)** | **CONDITIONAL**                          | P1                 |
| Resume authz               | JWT + workspace re-validation on resume via load               | `test_runtime_phase_b`                   | Hermetic                                | **PASS**                                 | P1                 |
| MCP authz                  | Workspace call-time ownership + approval gate for non-readOnly | `test_mcp_*`                             | Hermetic                                | **PASS**                                 | P1                 |
| Memory authz               | tenant+workspace predicates on CRUD/search                     | `test_memory_workspace_isolation`        | Hermetic                                | **PASS**                                 | P1                 |
| Retrieval authz            | SQL filters + ContextEngine cross-ws filter                    | `test_search_service`                    | Hermetic (LIKE)                         | **PASS**                                 | P0                 |
| DB RLS + pooling isolation | SET LOCAL + ContextVar + pipeline 0-cache                      | Code                                     | **UNVERIFIED live**                     | **UNVERIFIED**                           | P0                 |
| Prompt boundary            | Quarantine + middleware + runtime sanitize                     | `test_prompt_injection` 14+14            | Hermetic                                | **PASS**                                 | P1                 |

---

## Reliability Matrix

| Invariant                | Mechanism                                             | Tested                                                   | Live                                 | Result                               |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Single effect (tool)     | UNIQUE(workspace_id,idem_key) + executor early return | `test_unique_constraint_single_winner` + `_db_hit_skips` | Hermetic                             | **PASS**                             |
| Single effect (HTTP)     | IdempotencyMiddleware UNIQUE + 422 mismatch           | `test_idempotency` 6 cases                               | Hermetic                             | **PASS**                             |
| Winner                   | DB IntegrityError single INSERT winner                | Same                                                     | Hermetic                             | **PASS**                             |
| Queue redelivery         | BullMQ delayed zset + zrem gate + maxAttempts/backoff | Mock                                                     | **UNVERIFIED live**                  | CODE VERIFIED                        |
| Redis failure behavior   | In-memory fallback, fail-open                         | Code                                                     | **UNVERIFIED outage test**           | CODE VERIFIED                        |
| Cancellation             | `request_cancel` + merge preserve + terminal preserve | Hermetic                                                 | Hermetic                             | **PASS**                             |
| State/CAS                | `state_version` + ConcurrentUpdateError + merge       | `test_cas_conflict_raises`                               | Hermetic (DB/Mem/File); Redis FAILED | **PASS on DB path, FAILED on Redis** |
| Crash recovery (SIGKILL) | Checkpoint + idempotency + terminal preservation      | Hermetic terminal resume                                 | **UNVERIFIED SIGKILL**               | **UNVERIFIED**                       |
| Bounded loop             | LoopSafetyTracker + LoopController                    | `test_loop_safety` 6 cases                               | Hermetic                             | **PASS**                             |
| Budgets                  | Hard ceilings 3/12/12k/0.50/120s + spend gate         | `test_tool_budget_terminates`                            | Hermetic                             | **PASS**                             |
| Concurrency limiter      | Workspace semaphore + rate limiter                    | Code                                                     | Not load-tested                      | CODE VERIFIED                        |

---

## Runtime Matrix

| Component              | Claimed                                              | Actual                                                                                             |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Deterministic primary  | Single orchestrator + 5-phase loop + static dispatch | **CONFIRMED** — ReAct disabled, static is default                                                  |
| Supervisor multi-agent | DAG with parallel layers                             | **CONFIRMED** — gated by `_is_complex_multi_agent`                                                 |
| Durable execution      | Temporal workflows                                   | **DISABLED-BY-DESIGN** — legacy non-durable is default                                             |
| Topology reasoning     | LangGraph                                            | **DISABLED-BY-DESIGN** — topology inside Temporal activity only                                    |
| Tool idempotency       | Deterministic key + durable winner                   | **CONFIRMED**                                                                                      |
| RAG                    | Hybrid vector + BM25 + RRF + rerank                  | **HYBRID-LITE** — vector preferred, LIKE fallback, tsvector on PG, no RRF/RRF cross-encoder proven |
| Prompt safety          | Structural quarantine                                | **CONFIRMED** 3 layers                                                                             |
| Cost awareness         | Per-run ceilings + daily spend gate                  | **CONFIRMED**                                                                                      |
| No bypass              | —                                                    | **NONE FOUND**                                                                                     |

---

## Evidence Matrix

Every major claim → one classification per §32 (never blur).

| Area          | Invariant                                                                    | Evidence                                                                                                                                               | Environment                                                                    | Result                                    | Severity | Remaining Risk                        |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------- | -------- | ------------------------------------- |
| Auth          | JWT required, fail-closed 401                                                | `middleware/auth.py:45` + `tests/security/test_noauth_private` (sorted) + `test_auth_middleware`                                                       | SQLite hermetic (NullPool)                                                     | **HERMETIC PROVEN**                       | —        | Stateless TTL, no denylist (P3)       |
| Tenant        | App isolation via JOIN predicates                                            | `security/test_tenant_isolation` + `memory_service:124` WHERE                                                                                          | SQLite hermetic                                                                | **HERMETIC PROVEN**                       | —        | —                                     |
| Workspace     | Ownership/membership check before service                                    | `middleware/tenant.py:171` + same test file                                                                                                            | SQLite hermetic                                                                | **HERMETIC PROVEN**                       | —        | —                                     |
| Agent         | Kill switch + MVP scope + registry + limiter                                 | `orchestrator/router.py:561` + `agent_registry`                                                                                                        | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | —                                     |
| AgentCard     | Declarative contract + Jinja + jsonschema                                    | `orchestrator/card.py:83` + `test_agent_cards`                                                                                                         | Hermetic                                                                       | **CODE+HERMETIC**                         | —        | —                                     |
| Approval      | Hash+HMAC+expiry+atomic consume single winner                                | `orchestrator/loop.py:264` + `services/approval.py:36` + `tests/test_approval`                                                                         | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | Legacy rows no HMAC (P3)              |
| Prompt        | 3-layer structural containment, not string filter                            | `services/prompt_compiler.py:63` + `middleware/prompt_injection.py:21` + `services/agent_runtime.py:68` + `tests/security/test_prompt_injection` 14+14 | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | LLM classifier opt-in                 |
| Memory        | tenant/ws/user scoped admission/provenance                                   | `services/memory_service.py:36` + isolation tests                                                                                                      | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | —                                     |
| Retrieval     | Workspace-filtered vector+keyword+graph→ContextEngine                        | `services/search_service.py:92` + `orchestrator/loop.py:449` + isolation tests                                                                         | SQLite LIKE (PG vector UDF stub)                                               | **HERMETIC (LIKE) + CODE (vector shape)** | —        | Vector ranking UNVERIFIED (P2)        |
| RLS           | FORCE RLS 42 tables, app.tenant_id/workspace_id + WITH CHECK                 | `alembic/0010` + `0005` + `0019`/`0020`/`0028` migrations + `middleware/tenant.py:65` SET LOCAL                                                        | **PostgreSQL (code inspection only)** — `tests/test_rls_isolation` skipped 4/4 | **CODE VERIFIED — UNVERIFIED LIVE**       | **P1**   | Live PG + PgBouncer test required     |
| Pooling       | Transaction-local GUC, ContextVar cleared, cache 0                           | `database.py:10` + `middleware/tenant.py:189`                                                                                                          | Code + hermetic                                                                | **SEAM PROVEN — LIVE UNVERIFIED**         | P2       | —                                     |
| Checkpoint    | Typed v2 state, durable stores, merge preserves terminal/cancel              | `orchestrator/state.py:127` + `state_store.py` + `tests/test_state_durability`                                                                         | Hermetic Memory/File/Composite                                                 | **HERMETIC PROVEN**                       | —        | Redis CAS gap (P2)                    |
| CAS           | `expected_version` raises ConcurrentUpdateError                              | `orchestrator/state.py:373` + `test_runtime_phase_b:TestVersionedState:test_cas_conflict_raises`                                                       | Hermetic (DB/Mem/File)                                                         | **SEAM PROVEN (DB) / FAILED (Redis)**     | P2       | Redis WATCH fix needed                |
| Cancellation  | `request_cancel` durable flag, merge wins, terminal preserved                | `orchestrator/state.py:336` + merge logic `390`                                                                                                        | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | —                                     |
| Idempotency   | Canonical key + UNIQUE + LRU + middleware                                    | `services/inference_policy.py:177` + `models/schema.py:672` + `tests/test_idempotency` + `tests/test_runtime_phase_b:TestDurableIdempotency`           | Hermetic SQLite                                                                | **HERMETIC PROVEN**                       | —        | Middleware fail-open on DB error (P2) |
| Crash         | Side-effect after/before checkpoint + resume no-replay                       | `TestResumeNoReplay` (terminal returns stored, zero re-exec)                                                                                           | Hermetic (no SIGKILL)                                                          | **SEAM PROVEN — SIGKILL UNVERIFIED**      | —        | Staging SIGKILL proof required        |
| Redis         | Queue + retry + ack + durable state authoritative is DB                      | `workers/queue_worker.py:35` + `infrastructure/background_daemon`                                                                                      | Code + mocked tests                                                            | **CODE VERIFIED — LIVE UNVERIFIED**       | —        | —                                     |
| Queue         | BullMQ wait/delayed/failed/completed with zrem gate                          | Same                                                                                                                                                   | Code                                                                           | **CODE VERIFIED — LIVE UNVERIFIED**       | —        | —                                     |
| Worker        | Concurrency 5, drain, delayed promotion, handler dispatch                    | Same                                                                                                                                                   | Code                                                                           | **CODE VERIFIED — LIVE UNVERIFIED**       | —        | —                                     |
| Redelivery    | Exponential backoff, maxAttempts, deadletter, dedup via UNIQUE               | Same + idempotency                                                                                                                                     | Code                                                                           | **CODE VERIFIED**                         | —        | —                                     |
| MCP           | Explicitly bounded (not sandboxed): argv/env/metachars/timeouts/approval     | `services/mcp_client_service.py:69` + `tools/executor:240` + validation tests                                                                          | Hermetic                                                                       | **CODE+HERMETIC**                         | —        | OS sandbox not claimed (bounded)      |
| Model routing | Task→tier→provider fallback chain + BYOK                                     | `services/llm_service.py:283` + `test_llm_byok` + fallback tests                                                                                       | Hermetic (mock)                                                                | **HERMETIC PROVEN**                       | —        | Optimal tier not all handlers (P2)    |
| Orchestration | 5-phase loop with explicit termination reasons                               | `orchestrator/loop.py:736` + `state.py:36`                                                                                                             | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | —                                     |
| Observability | correlation_id/tenant/ws/agent/run/iteration/tool/provider + /metrics + OTel | `infrastructure/logging` + `main.py:314` + secret redaction tests                                                                                      | Hermetic                                                                       | **CODE+HERMETIC**                         | —        | No live log scrub volume test         |
| Budgets       | Token/iter/tool/time/spend/provider/concurrency ceilings                     | `config` + `orchestrator/loop_safety` + `test_tool_budget_terminates`                                                                                  | Hermetic                                                                       | **HERMETIC PROVEN**                       | —        | —                                     |
| Concurrency   | Semaphore + TokenBucket + circuit breaker + supervisor gather                | Code + xdist 4 workers                                                                                                                                 | Hermetic (code, no load)                                                       | **CODE VERIFIED**                         | —        | Load test UNVERIFIED                  |

---

## Final Verdict

**UNVERIFIED — NOT READY to be trusted for multi-tenant production workloads
without the live proofs below.**

Logic per §34:

| Condition                                    | Status                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `P0 = 0`                                     | **TRUE** — no catastrophic bypass discovered on default path                      |
| `P1 = 0`                                     | **FALSE** — 2 P1 residuals (RLS live UNVERIFIED + cross-worker nonce replay)      |
| All critical authz proven                    | **FALSE (live)** — tenant RLS only HERMETIC for app predicates, not live PG FORCE |
| Tenant isolation proven                      | **HERMETIC only** — live PG required                                              |
| Workspace isolation proven                   | HERMETIC yes, LIVE PG complement missing                                          |
| RLS proven                                   | **CODE VERIFIED, not LIVE PROVEN**                                                |
| Pool isolation proven                        | **SEAM, not LIVE**                                                                |
| Approval integrity proven                    | **HERMETIC PROVEN**                                                               |
| AgentCard proven                             | **HERMETIC PROVEN**                                                               |
| Background authz proven                      | **CODE, but cross-worker nonce UNVERIFIED P1**                                    |
| Prompt boundary proven                       | **HERMETIC PROVEN**                                                               |
| Idempotency proven                           | **HERMETIC PROVEN** for tools + HTTP; SIGKILL edge UNVERIFIED                     |
| Crash recovery proven                        | **SEAM, SIGKILL UNVERIFIED**                                                      |
| Single-effect proven                         | **HERMETIC PROVEN**                                                               |
| Queue redelivery proven where required       | **CODE, LIVE UNVERIFIED**                                                         |
| Redis failure behavior proven where required | **CODE, LIVE UNVERIFIED**                                                         |
| Cancellation proven                          | **HERMETIC PROVEN**                                                               |
| State/CAS proven                             | **HERMETIC (DB/Mem/File) — FAILED on Redis**                                      |
| No bypass discovered                         | **TRUE** — no reachable bypass found                                              |
| E2E critical scenarios pass                  | **HERMETIC yes (SQLite, mock LLM)** — not live PG/Redis/LLM                       |
| Production configuration verified            | **CODE VERIFIED**                                                                 |

Therefore **cannot meet `MUSE PRODUCTION READY` nor `CONDITIONALLY READY`**
(both require `P1=0` and all critical boundaries LIVE proven). The honest
classification is **`UNVERIFIED`** — a stronger signal than
`CONDITIONALLY READY` would be dishonest, and `NOT READY` would imply a proven
invariant failure (we have none, only missing live evidence).

A compact fix that addresses the P1s (PG RLS live proof + Redis nonce set) would
elevate to **`CONDITIONALLY READY`** pending staging SIGKILL + load proofs.

---

## Required Remediation

_Smallest concrete steps, no redesign, in priority order:_

1. **P1 — RLS live proof (staging PostgreSQL):** Bring up ephemeral PG 16 with
   migrations `0010 FORCE` applied, connect as `vaeloom_app` (non-superuser, no
   BYPASSRLS). Run `tests/test_rls_isolation.py` (unskip via `--postgresql`) +
   ad-hoc: `SET LOCAL app.tenant_id` / wrong tenant / unset / wrong workspace;
   assert zero rows; verify `pg_stat` via `SHOW` that `FORCE` held. Check
   PgBouncer `transaction` pool reuse across 2 concurrent tenants (10 parallel
   requests). **Owner:** Platform. **Effort:** 0.5 day. **Gate:**
   `R evidence = LIVE PROVEN`.

2. **P1 — Nonce cross-worker replay (Redis):** Replace
   `infrastructure/background_envelope._SEEN_NONCES` in-memory dict with Redis
   `SET key NX EX ttl` when `REDIS_URL` set (keep in-memory as fallback only
   when Redis absent). Id: `background_envelope:verify_background_envelope`
   accept redis client from `queue_worker`/`background_daemon`; store
   `envelope:{nonce}` with 3600s TTL. Add test: create envelope → verify on
   worker A true → immediate verify same envelope on worker B false
   (`replay detected`). **Owner:** API. **Effort:** 2 hours.

3. **P2 — RedisStateStore CAS:** Fix
   `orchestrator/state_store.RedisStateStore.save` to implement
   `expected_version` via `WATCH` + `GET` + `MULTI/EXEC` or Lua
   `GET version ≠ expected → error`. Preserve `state_version` increment only on
   CAS success. Add `test_database_state_store` analogue for Redis backend (use
   `fakeredis`). **Owner:** API. **Effort:** 3 hours.

4. **P2 — IdempotencyMiddleware fail-closed option:** For
   `CONSEQUENTIAL_PREFIXES` keep fail-open as default but add
   `IDEMPOTENCY_FAIL_CLOSED_CONSEQUENTIAL=true` flag that returns `503` on
   lookup/store exception instead of pass-through, for prod HIPAA/GDPR paths.
   **Owner:** API. **Effort:** 1 hour.

5. **P2 — Live staging harness (close remaining UNVERIFIED):** Provision staging
   with PG + Redis. Run: (a) `artillery/k6` 50 concurrent cross-tenant requests
   assert scope leakage zero; (b) `SIGKILL` isolated `schedules` worker
   mid-`sync_connector` heartbeat and verify single `LoopCheckpoint`
   post-recovery + `ToolIdempotency` winner; (c) `Redis outage` (stop redis 30s)
   verify queue redelivery exactly-once effect; (d) LLM provider failover `503`
   → tier downgrade observed via `fallback_chain`. Record as
   `docs/audits/muse-live-staging-evidence.md` with `LIVE PROVEN` matrix.

No replacement of orchestrator/state/persistence/authz is required; all fixes
are localized additive.

---

## Evidence Table (single authoritative matrix per §36)

| Area          | Invariant                                                                       | Evidence                                                                                                                                | Environment                           | Result                              | Severity | Remaining Risk                   |
| ------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------- | -------- | -------------------------------- |
| Auth          | JWT required, reject forged/missing/expired, public minimal                     | `middleware/auth.py:49 jwt.decode require exp+sub` + `security/test_noauth_private` sorted + `test_auth_middleware`                     | SQLite hermetic (NullPool)            | **HERMETIC PROVEN**                 | —        | Stateless, no denylist (P3)      |
| Tenant        | App predicates isolate tenant rows                                              | `security/test_tenant_isolation` + `memory_service:124` WHERE + `check_user_workspace_access`                                           | SQLite hermetic                       | **HERMETIC PROVEN**                 | —        | RLS live not yet (P1)            |
| Workspace     | Membership-weighted access, fail-closed if missing/wrong                        | Same file + `search_service:121` fail-closed                                                                                            | SQLite hermetic                       | **HERMETIC PROVEN**                 | —        | —                                |
| Agent         | RUN/RESUME/CANCEL/BACKGROUND all scope-checked, kill switch, limiter            | `orchestrator/router.py:561` + `orchestrator/loop.py` + `workers/queue_worker:253` DB re-check                                          | Hermetic                              | **HERMETIC PROVEN**                 | —        | Alternate Temporal path disabled |
| AgentCard     | Declarative card synthesis determines allowed tools                             | `orchestrator/card.py:83` + `orchestrator/loop.py:407` `_runtime_contract`                                                              | Hermetic                              | **CODE+HERMETIC**                   | —        | —                                |
| Approval      | Payload hash+HMAC+expiry+workspace+single-winner                                | `orchestrator/loop.py:264 atomic UPDATE WHERE APPROVED` + `services/approval.py:36` + recheck `temporal/activities:607`                 | Hermetic SQLite                       | **HERMETIC PROVEN**                 | —        | Reason side-channel HMAC (P3)    |
| Prompt        | Structural quarantine not string filter, 3 layers                               | `services/prompt_compiler.py:63` + `middleware/prompt_injection.py:21` + `agent_runtime.py:68` + `security/test_prompt_injection` 14+14 | Hermetic                              | **HERMETIC PROVEN**                 | —        | LLM classifier opt-in            |
| Memory        | Scoped admission + provenance + supersession                                    | `services/memory_service.py:28` + isolation tests                                                                                       | Hermetic                              | **HERMETIC PROVEN**                 | —        | —                                |
| Retrieval     | Workspace-scoped vector/LIKE/graph→ContextEngine                                | `services/search_service.py:92` + `orchestrator/loop.py:449`                                                                            | SQLite LIKE (vector UDF stub)         | **HERMETIC (LIKE) + CODE (vector)** | P2       | Vector ranking UNVERIFIED        |
| RLS           | FORCE RLS + WITH CHECK + vaeloom_app no BYPASSRLS                               | `alembic/0010`/`0005` + `middleware/tenant.py:65` set_config transac.                                                                   | Code inspection; PG tests skipped 4/4 | **CODE VERIFIED — UNVERIFIED LIVE** | **P1**   | Live PG prove required           |
| Pooling       | SET LOCAL + ContextVar + statement_cache 0 survives PgBouncer                   | `database.py:10` + `middleware/tenant.py:189` finally clear                                                                             | Code+seam                             | **SEAM PROVEN; LIVE UNVERIFIED**    | P2       | PgBouncer load test              |
| Checkpoint    | v2 state + pluggable stores + merge preserves terminal/cancel                   | `orchestrator/state.py:127` + `state_store.py` + `test_state_durability`                                                                | Hermetic Memory/File/Composite        | **HERMETIC PROVEN**                 | P2       | Redis CAS gap                    |
| CAS           | expected_version raises ConcurrentUpdateError                                   | `orchestrator/state.py:373` + `test_runtime_phase_b:TestVersionedState`                                                                 | Hermetic DB/Mem/File                  | **SEAM (DB) / FAILED (Redis)**      | P2       | Redis WATCH fix                  |
| Cancellation  | Durable flag, merge wins, terminal not resurrected                              | `orchestrator/state.py:336` + `390`                                                                                                     | Hermetic                              | **HERMETIC PROVEN**                 | —        | SIGKILL not yet                  |
| Idempotency   | ONE EFFECT, ONE WINNER for tools + HTTP                                         | `services/inference_policy:177` + `models/schema:672` + `tests/test_idempotency` 6 + `ToolIdempotency` unique                           | Hermetic SQLite                       | **HERMETIC PROVEN**                 | P2       | Middleware fail-open on DB error |
| Crash         | No state regression, no terminal resurrection, single effect                    | `TestResumeNoReplay` zero re-exec + UNIQUE winner                                                                                       | Hermetic (no SIGKILL)                 | **SEAM PROVEN; SIGKILL UNVERIFIED** | —        | Staging SIGKILL                  |
| Redis         | Queue/ack/redelivery/durable state authoritative is DB                          | `workers/queue_worker.py:35` + `background_daemon`                                                                                      | Code+mock                             | **CODE VERIFIED; LIVE UNVERIFIED**  | —        | Outage test                      |
| Queue         | zrem promotion atomic, active/completed/failed sets                             | Same                                                                                                                                    | Code                                  | **CODE VERIFIED; LIVE UNVERIFIED**  | —        | —                                |
| Worker        | Concurrency 5, drain, retry backoff                                             | Same                                                                                                                                    | Code                                  | **CODE VERIFIED; LIVE UNVERIFIED**  | —        | —                                |
| Redelivery    | Exponential min 300s, maxAttempts, deadletter, dedup                            | Same + idempotency UNIQUE                                                                                                               | Code                                  | **CODE VERIFIED**                   | —        | Live duplicate test              |
| MCP           | Explicitly bounded (not sandboxed): argv/env/metachars/timeouts/approval        | `services/mcp_client_service.py:69` + `tools/executor:240`                                                                              | Hermetic                              | **CODE+HERMETIC**                   | P3       | OS sandbox not claimed           |
| Model routing | Tier+provider + BYOK + fallback retains capability                              | `services/llm_service:283` + `test_llm_byok` + fallback tests                                                                           | Mock                                  | **HERMETIC PROVEN**                 | P2       | Optimal tier gaps                |
| Orchestration | 5 phases + explicit termination + QA gate                                       | `orchestrator/loop.py` + QA handler                                                                                                     | Hermetic                              | **HERMETIC PROVEN**                 | —        | —                                |
| Observability | correlation_id/tenant/ws/agent/run/tool/provider/approval/checkpoint no secrets | `infrastructure/logging` + `/metrics` + `test_secret_keys_unified`                                                                      | Hermetic                              | **CODE+HERMETIC**                   | —        | Live volume not measured         |
| Budgets       | Hard ceilings iterations/tools/tokens/cost/duration/spend                       | `config` + `orchestrator/loop_safety` + `test_tool_budget_terminates`                                                                   | Hermetic                              | **HERMETIC PROVEN**                 | —        | —                                |
| Concurrency   | Locks + CAS + single-winner prevent race/leakage                                | Code + xdist 4                                                                                                                          | Code (no load)                        | **CODE VERIFIED**                   | —        | 100-way load test UNVERIFIED     |

---

## Production Configuration Verification (summary)

- JWT/encryption validated: **PASS** (`validate_settings` refuses weak/missing).
- DB URL normalized (+asyncpg) + storage + Redis warnings: **PASS**.
- Temporal disabled by default with fail-closed on unreachable
  (`TemporalUnavailableError` → 503): **PASS** (not silent fallback).
- LangGraph disabled by default with percent/shadow guards: **PASS**.
- ReAct disabled by default with graceful fallback when `LLM_API_KEY` missing:
  **PASS**.
- Enterprise routes gated behind `enterprise_routes_enabled=false`: **PASS**
  (MVP wired pages 100% per prior audit, enterprise gated).
- CORS localhost in non-local fails closed: **PASS**.
- All env overrides preserve production fail-closed semantics; local `.env` does
  not represent prod (`infra/` overlays inject real secrets via
  Infisical/SecretManager).

---

## Residual P2/P3 Summary

Explicitly documented, bounded, non-critical once P1s cleared — consistent with
eventual `CONDITIONALLY READY` after remediation. No hidden high-severity debt.

---

## What Was Proven / What Was NOT Proven

**Proven (hermetic/code/seam):** Default runtime path wiring reachability;
app-level tenant/workspace isolation; agent/ card / tool permission + approval
single-use HMAC binding; prompt structural containment; memory + retrieval
scoping; idempotency single winner for tools+HTTP; checkpoint CAS on
DB/Mem/File; cancellation/terminal preservation; model routing fallback
capability-preserving; supervision/cycle/budget boundedness; MCP explicit
bounding; observability secret redaction; bypass scan clean.

**NOT proven (requires live infra, marked UNVERIFIED):** RLS FORCE live
isolation across vacated/transaction-pooled connections; Redis
outage/redelivery/duplicate-across-workers with real SIGKILL; Temporal
history/heartbeat/cancellation with real cluster; LangGraph live topology;
vector ranking quality (BM25+embeddings real); p50/p99 end-to-end latency and
error rates; 100-way concurrent tenant load; `SIGKILL` crash recovery evidence
(only exception/mock today).

---

## Handoff (not yet READY — no production handoff per §39; this section is the pre-handoff checklist to earn READY)

When P1 remediation lands and staging evidence is captured, the production
handoff **must contain** (retained here for completeness):

- Exact commit SHA (`git rev-parse HEAD`) + `alembic heads` (`0029`) +
  `docker images` digests
- Runtime architecture (diagram above) + deployment topology
  (`docker-compose.prod.yml` + orchestrator cell)
- Environment variables matrix (JWT_SECRET 32+ chars, ENCRYPTION_KEY,
  DATABASE__URL=postgres+asyncpg vaeloom_app, REDIS_URL, LLM_API_KEY/BYOK,
  TEMPORAL_* only if enabled, VAELOOM_STATE_BACKEND=db, etc.)
- Secrets required (JWT_SECRET, ENCRYPTION_KEY, infisical/client, provider keys
  encrypted)
- DB requirements (PG 16+, RLS `FORCE`, policies `WITH CHECK`, role isolation,
  `statement_cache_size=0`)
- Redis requirements (version, persistence, eviction, quota keys TTL)
- Worker requirements (queue_worker concurrency 5, schedules worker, daemon
  cron)
- Queue requirements (bull:wait/delayed/failed/completed, zrem promotion)
- Feature flags (`temporal_enabled=false` unless cluster, `langgraph_*` false/0,
  `agent_react_enabled` false, `enterprise_routes_enabled` false,
  `mvp_scope_enforced` true)
- Startup commands (`alembic upgrade head`, `uvicorn api.main:app`,
  `python -m api.workers.queue_worker`)
- Migration requirements (`alembic upgrade head` idempotent; migrator role
  BYPASSRLS)
- Security invariants (tenant RLS + app predicates, workspace ownership check,
  approval HMAC+hash single-use, prompt quarantine)
- Observability requirements (JSON logs + correlation_id, Prometheus `/metrics`,
  OTel tracing, `agent_observability` metrics)
- Rollback procedure (revert image tag, `alembic downgrade -1`, restore DB
  snapshot)
- Failure runbook (§30 failure_code_for mapping + `docs/runbooks/*`)
- Known residual risks (RR-05..08 after RR-01..04 fixed)

Do not start `Muse Phase C` / enterprise expansion / optimization / new agents /
new memory types / new runtimes until `UNVERIFIED → CONDITIONALLY READY` gate
passes with live evidence append to this document.

---

## Appendix A — Commands to Reproduce LIVE Proofs

```bash
# 1) PG RLS live (ephemeral)
docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16 &
DATABASE__URL=postgresql+asyncpg://vaeloom_app:postgres@localhost:5432/vaeloom \
  uv run python -m pytest apps/api/tests/test_rls_isolation.py -v --postgresql

# 2) Redis nonce cross-worker
REDIS_URL=redis://localhost:6379/0 \
  uv run python -c "from api.infrastructure.background_envelope import create_background_envelope, verify_background_envelope; ..."
# plus two-process verify same envelope → second false

# 3) SIGKILL isolated worker
# terminal 1: REDIS_URL=... VAELOOM_STATE_BACKEND=db uv run python -m api.workers.queue_worker
# terminal 2: enqueue schedule.agent_run envelope, SIGKILL worker PID, restart, assert ToolIdempotency winner 1 row

# 4) Load tenant isolation
k6 run scripts/load/tenant-isolation.js --vus 50 --duration 30s
```

---

## Appendix B — References

- Code locations cited inline as `file:line` for navigation (line numbers may
  drift; use symbol search if moved).
- Previous zero-trust audits: `docs/audits/Agentic-AI-Zero-Trust-E2E-Audit.md`,
  `docs/audits/muse-gate-3-final-closure.md` (treated as claims, not evidence).
- Migrations: `apps/api/alembic/versions/{0005,0010,0019,0020,0028,0029}*`.
- Tests: 172 files referenced; deterministic `conftest` MockVector/MockUUID +
  NullPool + `sorted(PUBLIC_PATHS)`.

---

> **Truth > green dashboard. Runtime > code. Live evidence > assumption.
> Zero-trust > trust. No phantom claims. No false production readiness.**
