AUDIT MODE: READ-ONLY / NO CODE CHANGES

HEAD: ca727d274956d5fb645e7716f10609faf028bceb

PREVIOUS BASELINE: cb9564d026b040113421af503ad9a0521a1f238c

CURRENT DECISION: CONDITIONAL IMPLEMENTATION

P0: 3

P1: 18

P2: 4

P3: 3

L1 PROVEN: 1

L2 PROVEN: 2

L3 ONLY: 9

NOT PROVEN: 11

MOCK/LOCAL: 6

REGRESSIONS: 0

---

# Vaeloom — Zero-Trust End-to-End Re-Audit & Verification Gate

**Report ID:** `langgraph-zero-trust-e2e-reverification-2026-08-29` **Mode:**
READ-ONLY / NO CODE CHANGES **Previous baseline:**
`cb9564d026b040113421af503ad9a0521a1f238c` (langgraph deep zero-trust audit
2026-08-29 — CONDITIONAL) **Current HEAD:**
`ca727d274956d5fb645e7716f10609faf028bceb` (branch `master`, 3 ahead of
origin/master, working tree clean) **Auditor:** independent zero-trust re-audit
agent

---

## 1. Executive Summary

This re-audit re-verifies the previous CONDITIONAL baseline against the current
repository. **No code, test, config, or infrastructure was modified.** The delta
since `cb9564d` is **exclusively non-runtime**: landing-page 3D fixes, an
audit-doc merge, and added _contract/interceptor_ scaffolding inside
`apps/api/src/api/graph/` plus 9 new graph unit tests. **Not a single production
code path, feature flag, or default topology changed.**

The system's **default production runtime remains the legacy `agentApi.chat`
path** (FastAPI + synchronous orchestrator loop). The durable LangGraph/Temporal
path is **opt-in, shadow-capable, MemorySaver-backed (process-local,
non-durable), and not the default**. Every blocking finding from the prior audit
is **reproduced unchanged**.

**New structural discovery (this audit):** the repository contains **two
migration systems**. At startup `main.py:150` runs **Alembic**
(`command.upgrade(alembic_cfg, "head")`, versions `0001`–`0024`, including RLS
hardening `0010_rls_force_and_roles`, `0014_memories_rls_workspace_only`,
`0019_rls_and_sanitize_hardening`, `0020_rls_remaining_5`) with a **custom
runner fallback** (`apps/api/src/api/migrations/`, only `0005_rls.py`
tenant-scoping 4 tables). Tests run on **SQLite**, where RLS is a documented
no-op. Therefore **workspace isolation is never exercised by any test**; it
depends entirely on Postgres RLS policies that are not validated in this repo's
test surface. The application-layer query `MemoryService.search_memories` and
`KnowledgeGraphService` writes filter by `tenant_id` only — not `workspace_id`
(F-03/F-04 reproduced).

**Decision: CONDITIONAL IMPLEMENTATION** — implementation may proceed only
against the bounded P0/P1 gaps enumerated in §43. The durable path MUST NOT be
promoted to default until §44 items close.

---

## 2. Audit Scope

- **In:** full monorepo (25 packages); emphasis `apps/api` (Temporal worker,
  LangGraph graph, memory/KG/RAG services, tools executor, approval, security
  middleware, BOTH migration systems) and `apps/web` (durable agent client
  wiring, chat UI).
- **Method:** static + forensic read-only review; git delta vs baseline; regex
  sweeps for
  `TODO|FIXME|mock|fallback|StateGraph|Send|interrupt|MemorySaver|RLS|workspace_id|tenant_id|pgvector|secret|interrupt_before`;
  targeted reads; OpenAPI/otel/migration inspection. **No server, test, or code
  modification executed.**
- **Out:** live cluster, real LLM, real Temporal server, real Postgres/pgvector
  — these are gated claims, not verified here.

---

## 3. Current Git Baseline

```
branch: master
HEAD: ca727d274956d5fb645e7716f10609faf028bceb
ahead of origin/master: 3
working tree: clean
log (newest first):
  ca727d2 fix(landing): render hero 3D via StageSlot + scroll-reactive camera
  cb9564d docs(audit): langgraph deep zero-trust audit 2026-08-29 CONDITIONAL
  aaf7c5b revert(landing): restore old hero and per-section scroll animation
  034beec fix(landing): gate DustField on WebGL availability
  d3f87d6 feat(landing): continuous end-to-end 3D flythrough
```

`git diff cb9564d ca727d2` shows only `apps/web` landing 3D changes, an audit
doc merge, and
`apps/api/src/api/graph/{contracts,routing,state,interceptors}.py` additions +
new `tests/graph/*` unit tests. **No production runtime change.** Working tree
clean → no uncommitted drift.

---

## 4. Previous Audit Delta Verification

| Previous Finding                       | Current Code                                                                  |    Reproduced? | Evidence Tier | Severity Now | Regression? | Status     |
| -------------------------------------- | ----------------------------------------------------------------------------- | -------------: | ------------- | ------------ | ----------- | ---------- |
| F-01 durable LangGraph not default     | `config.py:99,106`; `activities.py:431-435` returns legacy stub when disabled |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-02 no `Send` fan-out                 | grep `graph/` for `\bSend\b` → 0 hits; DAG-only                               |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-03 memory workspace leak             | `memory_service.search_memories:198-207` filters `tenant_id` only             |            YES | STATIC        | **P0**       | No          | REPRODUCED |
| F-04 KG workspace leak                 | `knowledge_graph_service.py:77` INSERT `tenant_id`, no workspace scope        |            YES | STATIC        | **P0**       | No          | REPRODUCED |
| F-05 memory closed-loop marker-only    | `MemorySaver` process-local; `write_memory` marker-only (per prior audit)     |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-06 real pgvector RAG not proven      | `tests/graph/test_rag_pgvector_mock.py` (mock); real-embedding branch only    |            YES | UNIT(mock)    | P1           | No          | REPRODUCED |
| F-07 checkpoint vs Temporal retry      | `graph/__init__.py` MemorySaver; graph_retry=0 comment                        |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-08 connector/tool mock-success       | `tools/executor.py` mock branches gmail/job/onedrive                          |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-09 approval re-check missing (ZT-02) | `activities.py:608-625`; `:622` comment only, no re-query                     |            YES | STATIC        | **P0**       | No          | REPRODUCED |
| F-10 ReAct/LLM path disabled           | `config.py:99 agent_react_enabled=False`                                      |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-11 secret-key drift (SC-01)          | temporal validation=21, graph/state=27/21, logging=26                         |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-12 scrape quota in-process (ZT-04)   | per prior audit, in-memory quota                                              |            YES | STATIC        | P2           | No          | REPRODUCED |
| F-13 tracing incomplete (F-TRC-01)     | `otelcol-config.yaml` exporters `[logging]`; span coverage partial            |            YES | STATIC        | P2           | No          | REPRODUCED |
| ZT-01 Temporal start fail-open         | worker not started by default (`temporal_enabled=False`); fail-open latent    |   YES (latent) | STATIC        | P1           | No          | REPRODUCED |
| ZT-03 LLM classifier off               | `prompt_injection.py:50` `INJECTION_LLM_CLASSIFIER` default unset/off         |            YES | STATIC        | P2           | No          | REPRODUCED |
| ZT-04 → F-12                           | same                                                                          |            YES | STATIC        | P2           | No          | REPRODUCED |
| SC-01 → F-11                           | same drift                                                                    |            YES | STATIC        | P1           | No          | REPRODUCED |
| F-TRC-01 → F-13                        | tracing incomplete                                                            |            YES | STATIC        | P2           | No          | REPRODUCED |
| F-LG-02 stale 10VU perf                | `testing/performance/k6-*` not re-run; p95 548 vs 285 stale                   |            YES | L3            | P2           | No          | REPRODUCED |
| F-LG-03 MemorySaver local (S)          | process-local checkpointer                                                    |            YES | STATIC        | P1           | No          | REPRODUCED |
| TI-02 NULL approvals                   | approval model nullable (per prior audit)                                     | YES (inferred) | STATIC        | P2           | No          | REPRODUCED |
| PR-01 COPPA 18+                        | age gate per prior audit                                                      | YES (inferred) | STATIC        | P1           | No          | REPRODUCED |

**No regression. No prior finding closed. Two migration-system discrepancy (§31)
is a NEW structural observation.**

---

## 5. Evidence Hierarchy

Enforced strictly: REAL > DOCKER > TEMPORAL > POSTGRES > REDIS > LLM >
CONNECTOR > LANGGRAPH ainvoke > WE > INTEGRATION > UNIT > STATIC > DOC > CLAIM.
No lower-tier evidence is promoted to a higher claim anywhere in this report.
(e.g., `test_rag_pgvector_mock.py` = UNIT(mocked) ≠ pgvector L1; `StateGraph`
topology ≠ multi-agent execution; `MemoryCandidate` ≠ persisted memory;
`ApprovalWorkflow` exists ≠ safe execution; Temporal retry ≠ graph checkpoint.)

---

## 6. Current Architecture

**Ingress:** `main.py` middleware stack (outermost→innermost): RateLimit →
BodySizeLimit → Tenant → Auth → CSRF → SecurityHeaders → CorrelationID →
RequestLogging → APIVersion → PromptInjection → Idempotency → IPAllowlist
(`main.py:249-272`).

**Default production path (REAL/WE):**
`Web ChatWindow (durableMode=false) → api-client.chat() → /api/v1/agents/chat → orchestrator loop → tool executor → legacy result`.

**Durable opt-in path (STATIC/UNIT):**
`Web startDurableAgent → Temporal DurableAgentWorkflow → DurableAgentRunActivity → gate(enabled/shadow/percent) → _run_graph → LangGraph StateGraph (MemorySaver) → nodes[validate_input→retrieve_context→plan→execute_tools→evaluate→finalize]`.

**State ownership:** Temporal is durable source of truth for approvals
(`ApprovalWorkflow`); LangGraph only finalizes `waiting_approval` (comment in
`graph/__init__.py`). **LangGraph is NOT a second durable engine.**

**Migrations (NEW this audit):** Alembic primary (`main.py:150`, versions
`0001`–`0024` incl. RLS `0010/0014/0019/0020`); custom runner fallback
(`migrations/runner.py`, only `0005_rls` tenant-4-table). Tests use SQLite → RLS
no-op.

---

## 7. Frontend E2E

- `apps/web/src/lib/api-client.ts`: `startDurableAgent` added (durable path
  wired) but `chat()` is default.
- `apps/web/src/components/chat/ChatWindow.tsx`: `durableMode` defaults to
  `false` → legacy chat is shipped UX.
- `ExecutionTimeline` 3s polling + safe metadata (per prior audit) — no
  fake-streaming/placeholder detected in scope.
- **Default path REAL/WE. Durable path STATIC-wired, not default.** No fake
  frontend behavior detected; this is a clarity gap, not a defect.

---

## 8. Temporal Verification

- `temporal_enabled=False` (`config.py:106`) → worker not started by default. No
  runtime worker-kill/SIGKILL evidence obtainable (DOCKER/TEMPORAL tier
  unverified).
- Activities: `DurableAgentRunActivity`, `execute_approved_action`,
  `sync_connector`, `extract_entities`, `index_graph`, `parse_document`,
  `write_memory` (ADR-038 catalogue in `workflows.py`).
- Retry/cancel/heartbeat code present (`activities.py:519-537`). **No real
  worker-restart recovery proof (L1).** ZT-01 (fail-open on worker start)
  latent.

---

## 9. LangGraph Verification

- `graph/__init__.py`: `StateGraph` built;
  `memory = MemorySaver() if MemorySaver else None`;
  `compiled = g.compile(checkpointer=memory, interrupt_before=["tool_execute"] if False else None)`.
- **interrupt_before disabled** → approval interrupt delegated to policy_check +
  `waiting_approval`; `ApprovalWorkflow` durable truth.
- **No `Send`** → single DAG; multi-agent fan-out NOT implemented (F-02).
- Checkpointer is `MemorySaver` (process-local) → **not durable across worker
  restarts** (F-05/F-07/F-LG-03).
- Nodes include `validate_input`, `retrieve_context`, `plan`, `execute_tools`,
  `evaluate`, `finalize` (per contracts/prior audit). All invoked only under
  `langgraph_enabled=True` (opt-in).

---

## 10. Agents

- 22+ agent handler classes exist under `apps/api/src/api/agents/*/handler.py`
  (analytics, application, ats, career, coding, connector, drive, github, gmail,
  job_search, learning, memory, organization, plugin, qa, recommendation,
  reflection, reminder, research, resume, scheduler, security) + 4 memory
  sub-agents (document, planning, reflection, self_improvement) +
  `MemoryAgentHandler`.
- **Registered/callable (STATIC):** handler classes exist; catalog exposed via
  `routers/agents.py:get_agent_catalog`.
- **Real L1 execution:** NOT proven. Default path uses orchestrator loop; real
  LLM reasoning gated by `agent_react_enabled=False` (F-10). LangGraph opt-in.
  **Count genuinely L1-proven: 0** (beyond legacy chat scaffold). Mock/legacy
  execution only.

---

## 11. Routing

- `graph/routing.py` added since baseline (STATIC). Routing decision typed in
  `contracts.RoutingDecision`. No positive routing execution evidence at L1.

---

## 12. Supervisor

- No supervisor node/spawn found; graph is linear/branching single-agent per
  request. Multi-agent supervision NOT implemented (F-02).

---

## 13. Multi-Agent

- **Mandatory gate FAIL.** No `Send` fan-out (`graph/` grep → 0). DAG metadata
  exists but multi-agent execution = NOT PROVEN. Classified:
  `DAG GENERATED, MULTI-AGENT EXECUTION NOT PROVEN`.

---

## 14. Handoff

- `contracts.AgentHandoff` / `state.validate_handoff_state` added (STATIC
  hardening). **No positive A→B handoff execution test at L1.** Negative
  validation present in unit tests (per prior audit). Positive execution
  unproven.

---

## 15. Memory

- `memory_service.search_memories:198-213` filters `tenant_id` only (`:207`), no
  `workspace_id` (F-03). `create_memory` embeds via `llm_service` (real
  embedding path under real LLM).
- RLS: Alembic `0014_memories_rls_workspace_only` exists (Postgres). But tests
  are SQLite → RLS never exercised → workspace isolation **unproven at test
  tier**; app-layer query relies on RLS which is not validated here.
- Memory persistence: marker-only loop closure per prior audit (F-05).
  Cross-request influence NOT proven at L1 (SQLite tests).

---

## 16. Knowledge Graph

- `knowledge_graph_service.py:77` INSERT `tenant_id`, no workspace column
  scoping verified in write/traverse (F-04). Alembic `0019/0020` claim RLS
  hardening but unverified at L1 (SQLite). Cross-workspace discovery prevention
  NOT proven.

---

## 17. RAG

- **HARD GATE NOT MET.** `memory_service.search_memories` uses
  `func.cosine_distance` (pgvector) on real-embedding branch;
  `tests/graph/test_rag_pgvector_mock.py` confirms mock-tier. **No REAL
  Postgres+pgvector retrieval with controlled value (42719) executed → RAG L1
  NOT PROVEN.** SQLite/LIKE fallback (per prior audit) does not satisfy gate.

---

## 18. Context Fusion

- `retrieve_context` node exists (STATIC). No L1 proof that retrieved context
  actually enters agent context and changes output.

---

## 19. Tools

- `tools/executor.py` contains mock result branches for gmail/job/onedrive →
  fake-success paths possible (F-08). Approval-gated tools bridged via
  `approval_gated_tools()` (loop.py, per AGENTS). Real tool execution NOT proven
  where external credentials absent → classify NOT RUNTIME VERIFIED, not PASS.

---

## 20. Connectors

- MCP integration real (per AGENTS ADR-036); REST/GraphQL connectors present.
  Many connector executions MOCK-LOCAL in tests (F-08). No real connector L1
  evidence in this audit.

---

## 21. Approval

- `execute_approved_action` (`activities.py:608`): logs and returns
  `executed: True` without re-querying current user/workspace permission (`:622`
  comment only) → **F-09/ZT-02 reproduced (P0).** Forged approval signal /
  permission-revoked scenario NOT safely rejected at execution. ApprovalWorkflow
  3600s timeout + signal pattern present (STATIC).

---

## 22. LLM

- `nodes.py:268,272,438,611` branch on `PYTEST_CURRENT_TEST` to stub LLM/DB/tool
  (F-10). `agent_react_enabled=False`. LLM service exists (STATIC), but
  **autonomous ReAct reasoning NOT enabled** (L3 only). BYOK/tenant binding
  present in `provider_keys` endpoints (STATIC). Real provider L1 not verified
  here.

---

## 23. Structured Output

- Typed contracts (`contracts.py`) exist (STATIC). No L1 proof of
  structured-output correctness under real LLM.

---

## 24. Evaluation

- `infrastructure/agent_eval.py` (AgentEvaluator) + `evaluate` node. Per prior
  audit, evaluation is **metric/heuristic-only, does not replan/change
  execution** (F-LG context). `replan_required=True` → graph immediately
  finalizes = EVALUATION IS METRIC-ONLY, not replan. NOT PROVEN at L1.

---

## 25. Prompt Injection

- `middleware/prompt_injection.py`: regex `INJECTION_PATTERNS` (`:21`, ~14
  patterns) + optional LLM classifier (`INJECTION_LLM_CLASSIFIER`, `:75`)
  default OFF (ZT-03). Returns 400 + `X-Injection-Detected`. Real control
  (STATIC/UNIT). LLM classifier off → multipart bypass risk (ZT-03). Model is
  never authorization authority (policy layer enforces).

---

## 26. Secrets

- **Drift confirmed (F-11/SC-01).** Three independent lists disagree:
  - `temporal/validation.py` SECRET_KEYS = **21**
  - `graph/state.py` SECRET_KEYS = **27**, FORBIDDEN_GRAPH_KEYS = **21**
  - `logging.py` `_REDACT_KEYS` = **26**
  - graph-only: `auth, secret_reference, session_secret, x-api-key, x_api_key`
  - temporal-only: `client_id, credentials, oauth, session, sso` → a secret in
    one list but absent in another escapes redaction/validation in that layer.
    No canonical source.

---

## 27. Workspace Isolation

- `middleware/tenant.py`: `TenantContext` + `set_rls_session_vars` (SET LOCAL
  app.tenant_id/workspace_id/user_id, Postgres only, fail-closed).
- RLS: Alembic `0010/0014/0019/0020` claim workspace-scoped policies; **but
  tests are SQLite → never exercised**. App-layer
  `search_memories`/`knowledge_graph` filter `tenant_id` only. **Workspace
  isolation unproven at L1; relies on unvalidated Postgres RLS (F-03/F-04).**

---

## 28. Idempotency

- `workflows.py` deterministic workflow IDs
  (`ingest:{workspace}:{content_hash}:{document_id}`). Migration
  `0006_idempotency` present. No L1 replay proof (TEMPORAL tier). Idempotency
  keys DB-backed per schema (STATIC).

---

## 29. Failure/Recovery

- Activity heartbeat + cancellation checks present
  (`activities.py:519-537, 501-503`). Graph failure returns `failed` (not
  legacy) so caller sees error (`:489-505`). **No real worker-kill/SIGKILL
  recovery proof (L1).**

---

## 30. Checkpointing

- **LANGGRAPH CHECKPOINT DURABILITY = FAIL (honest).** `MemorySaver`
  process-local; no `AsyncPostgresSaver`. On worker crash, Temporal retries the
  **entire activity** (`:124`), not resume-from-graph-checkpoint. Temporal
  workflow durability may independently pass (unverified L1). Distinction
  preserved per §24 of prompt.

---

## 31. Database/Migrations

- **NEW finding (structural):** two migration systems.
  - Primary: **Alembic** (`main.py:150` `command.upgrade(..., "head")`),
    versions `0001_initial_schema` → `0024_resume_sources`. Includes RLS
    hardening `0010_rls_force_and_roles`, `0014_memories_rls_workspace_only`,
    `0019_rls_and_sanitize_hardening`, `0020_rls_remaining_5`.
  - Fallback: **custom runner** (`apps/api/src/api/migrations/runner.py`, only
    `0002`–`0009`; `0005_rls.py` tenant-scopes just 4 tables:
    memories/events/usage_records/api_keys by `tenant_id`).
- **Drift/risk:** AGENTS.md claims "RLS 42/42" referencing alembic
  `0010/0019/0020`. But the **test suite runs on SQLite where all RLS is a
  no-op** (`0005_rls.py:14` skips non-postgres; alembic RLS guarded similarly).
  Therefore **workspace isolation is never validated by any test in this repo**
  — it is a production-only, unverified mechanism. This is the root of F-03/F-04
  remaining open: even if alembic RLS is correct, the application query does not
  scope by workspace and no test proves the RLS actually protects
  cross-workspace reads.
- `alembic.ini` hardcodes
  `postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom` —
  environment-specific; prod must override via env (verify in deploy).
- Schema vs models: alembic autogenerate-style versions present; models in
  `models/schema.py`. Alignment not deeply diffed (L3). **No missing-migration
  regression vs baseline** (baseline already had alembic).

---

## 32. Observability

- `infra/monitoring/otelcol-config.yaml`: OTLP `:4317/:4318`, Prometheus
  `:8889`, pipelines traces+metrics → exporters `[logging]` + `prometheus`.
  **Traces exporter = logging only (F-13/F-TRC-01) → no Jaeger/Tempo → TRACE
  STORAGE NOT PROVEN.**
- `temporal/metrics.py`: full Prometheus counters/histograms (temporal +
  langgraph, bounded labels, no secrets).
- `main.py:311`: OTel FastAPI instrumentation attempted (try/except).
- Metrics defined; **increment-at-runtime not verified (L1).** Correlation IDs
  wired (middleware).

---

## 33. Tracing

- Collector configured for traces; exporter logging-only → traces not shipped to
  a queryable backend. `record_graph_span` only on `validate_input` (per prior
  audit) → partial span coverage. **TRACE STORAGE = NOT PROVEN.**

---

## 34. Performance

- `testing/performance/k6-langgraph.js`, `k6-temporal.js` present (L3). **Not
  re-run in this read-only audit (F-LG-02 stale: 10VU p95 548 vs 285).** No
  current VU evidence. Stub vs real-LLM perf not separated here.

---

## 35. Mock/Fallback Register

| Item                           | Type                                 | Location                                             | Exposure risk                           |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------- | --------------------------------------- |
| gmail/job/onedrive tool result | MOCK                                 | `tools/executor.py`                                  | Fake-success if product shows completed |
| pgvector RAG                   | MOCK (SQLite/LIKE or mock embedding) | `test_rag_pgvector_mock.py`, memory_service fallback | RAG status misleading                   |
| LLM/DB/tool in graph nodes     | TEST-ONLY stub                       | `nodes.py:268,272,438,611` PYTEST_CURRENT_TEST       | Masks real behavior at unit tier        |
| Legacy durable stub            | `return {"summary":"stub run"}`      | `activities.py:420-425`                              | Default when graph disabled (correct)   |
| scrape quota                   | IN-PROCESS                           | per F-12                                             | Not distributed                         |
| RLS                            | POSTGRES-ONLY, no-op on SQLite       | migrations                                           | Unverified isolation                    |
| Temporal worker                | DISABLED by default                  | `config.py:106`                                      | N/A (latent)                            |

---

## 36. Autonomous Journey Matrix (J1–J10)

| J   | Journey                             | Input→Expected            | Actual                               | Tier                | Status                 |
| --- | ----------------------------------- | ------------------------- | ------------------------------------ | ------------------- | ---------------------- |
| J1  | Simple agent                        | chat→result               | legacy path default                  | WE/REAL (default)   | PASS (default)         |
| J2  | Memory write→retrieve→behavior      | persist→retrieve→behavior | marker-only loop; tenant filter only | UNIT(mocked)/STATIC | NOT PROVEN L1          |
| J3  | RAG doc→42719                       | embed→pgvector→42719      | mock-tier only                       | UNIT(mock)          | RAG L1 NOT PROVEN      |
| J4  | Multi-agent A+B+C→merge             | fan-out                   | no Send                              | STATIC              | FAIL (not implemented) |
| J5  | Tool policy→quota→result            | agent→tool→result         | mock branches                        | STATIC              | PARTIAL (mock)         |
| J6  | Approval→wait→approve→re-check→tool | rejected if revoked       | re-check absent                      | STATIC              | FAIL (F-09)            |
| J7  | Worker kill→recovery                | resume                    | MemorySaver loss, full retry         | STATIC              | FAIL (durability)      |
| J8  | WS-A→WS-B attack                    | rejection                 | tenant filter only, no WS scope      | STATIC              | FAIL (F-03/04)         |
| J9  | Injection doc→RAG→safe              | blocked                   | regex on, LLM off                    | STATIC/UNIT         | PARTIAL (ZT-03)        |
| J10 | Preference→memory→personalize       | behavior reflects         | marker-only                          | UNIT(mocked)        | NOT PROVEN L1          |

---

## 37. Security Findings

- **S1 (P0) F-03/F-04:** workspace isolation leak at app layer (tenant-only
  filter). Cross-workspace data exposure risk within same tenant.
- **S2 (P0) F-09/ZT-02:** approval permission not re-queried before side effect
  → revoked permission still executes.
- **S3 (P1) F-11/SC-01:** secret-key list drift across 3 modules →
  redaction/validation gaps.
- **S4 (P1) ZT-01:** Temporal worker start fail-open latent.
- **S5 (P2) ZT-03:** LLM injection classifier off by default → multipart bypass.
- **S6 (P1) PR-01:** COPPA 18+ age gate (per prior audit) — verify enforcement.
- **S7 (P2) TI-02:** NULL approvals handling (per prior audit).
- **S8 (P2) F-12/ZT-04:** in-process scrape quota not distributed.

---

## 38. Capability Maturity Matrix

| Capability       |   Exists | Used | Real RT | Prod Path | Mock-Free | Secure |   WS Safe | Durable | E2E |              Complete |
| ---------------- | -------: | ---: | ------: | --------: | --------: | -----: | --------: | ------: | --: | --------------------: |
| Legacy chat      |        Y |    Y |       Y |         Y |         Y |      Y | Y(tenant) |     N/A |   Y | **PARTIAL** (WS only) |
| Temporal worker  |        Y |    N |       N |         N |         - |      - |         - |       - |   N |                    NO |
| LangGraph graph  |        Y |  opt |       N |         N |         N |      Y |         N |       N |   N |                    NO |
| Durability       |        Y |    N |       N |         N |         - |      - |         - |       N |   N |                    NO |
| Memory isolation |        Y |    Y |       N |         Y |         Y |      N |     **N** |       - |   N |             NO (F-03) |
| KG isolation     |        Y |    Y |       N |         Y |         Y |      N |     **N** |       - |   N |             NO (F-04) |
| RAG              |        Y |  opt |       N |         N |         N |      Y |         Y |       - |   N |             NO (F-06) |
| Multi-agent      |  Y(meta) |    N |       N |         N |         - |      - |         - |       - |   N |                    NO |
| Handoff          | Y(types) |    N |       N |         N |         - |      Y |         - |       - |   N |                    NO |
| Approval         |        Y |    Y |       N |         Y |         Y |  **N** |         Y |       Y |   N |             NO (F-09) |
| Secrets          |        Y |    Y |       N |         Y |         Y |  **N** |         - |       - |   N |             NO (F-11) |
| Observability    |        Y |    Y |       N |         Y |         Y |      Y |         - |       - |   N |               PARTIAL |
| Frontend durable |        Y |    N |       N |         N |         Y |      Y |         Y |       - |   N |                    NO |

"Complete" awarded only if all columns Y — **none qualify.**

---

## 39. Gate Results (A–Z)

| Gate                     | Result                         | Evidence                          |
| ------------------------ | ------------------------------ | --------------------------------- |
| A Architecture           | CONDITIONAL PASS               | STATIC                            |
| B Real Agent Execution   | PARTIAL                        | legacy only; LLM gated            |
| C Routing                | CONDITIONAL                    | STATIC                            |
| D Supervisor             | FAIL                           | not implemented                   |
| E Multi-Agent            | FAIL                           | no Send                           |
| F Handoff                | NOT PROVEN                     | no positive exec                  |
| G Memory                 | PARTIAL                        | marker-only + WS leak             |
| H Knowledge Graph        | PARTIAL                        | WS leak                           |
| I Real RAG               | NOT PROVEN                     | mock-tier                         |
| J Tools                  | PARTIAL                        | mock-success                      |
| K Connectors             | MOCK-LOCAL                     |                                   |
| L Approval               | CONDITIONAL (FAIL on re-check) | F-09                              |
| M LLM                    | PARTIAL                        | gated off                         |
| N Evaluation             | PARTIAL                        | metric-only                       |
| O Security               | PARTIAL                        | 14 attacks blocked L3, ZT-03 open |
| P Workspace Isolation    | FAIL                           | F-03/F-04                         |
| Q Idempotency            | CONDITIONAL                    | STATIC                            |
| R Recovery               | PARTIAL                        | no SIGKILL proof                  |
| S Checkpointing          | FAIL                           | MemorySaver                       |
| T Observability          | PARTIAL                        | metrics defined                   |
| U Tracing                | NOT PROVEN                     | logging exporter                  |
| V Frontend               | CONDITIONAL                    | durable off                       |
| W Performance            | PARTIAL                        | stale                             |
| X Enterprise E2E         | NOT PROVEN                     |                                   |
| Y DB/Migration Integrity | CONDITIONAL                    | two systems; RLS untested         |
| Z Production Readiness   | NOT READY                      | mandatory gates fail              |

---

## 40. Critical Questions (Q1–Q40)

1. **Genuinely executable agents:** 22+ handlers exist; ~0 L1-proven (legacy
   chat scaffold only).
2. **L1-proven agents:** 0.
3. **LangGraph default prod path?** No (F-01).
4. **Temporal invokes LangGraph?** Only if `langgraph_enabled=True` (opt-in);
   default no.
5. **StateGraph executes multiple agents?** No.
6. **Send fan-out exists/executes?** No (F-02).
7. **Positive A→B handoff?** Not proven.
8. **Memory persists across requests?** Marker-only; not proven L1.
9. **Memory influences future behavior?** Not proven L1.
10. **Memory workspace isolated?** No (app-layer tenant-only, F-03).
11. **Real pgvector retrieval?** Not proven (F-06).
12. **Doc→answer controlled value?** Not executed → NOT PROVEN.
13. **KG traversal feeds answers?** Not proven L1.
14. **Cross-boundary data?** Possible within tenant via F-03/F-04.
15. **Model value bypass auth?** Policy layer enforces; handoff/agent_id
    validated in contracts (STATIC).
16. **Approval bypass?** Yes risk via F-09 (no re-check).
17. **Permission re-checked pre-side-effect?** No (F-09).
18. **Tools real or mocked?** Mixed; mock-success paths (F-08).
19. **Connectors real or mocked?** MOCK-LOCAL in tests.
20. **Real LLM drives agents?** No (gated off, F-10).
21. **ReAct enabled?** No.
22. **Evaluation replans?** No (metric-only).
23. **LangGraph checkpoint durable across workers?** No (MemorySaver).
24. **After SIGKILL?** MemorySaver lost; Temporal full retry (no resume).
25. **Temporal retries confused with checkpoints?** Distinguished; graph
    checkpoint = FAIL.
26. **Duplicate side effects prevented?** Idempotency keys (STATIC), no L1
    proof.
27. **RAG failure honest?** Mock-tier; real failure unproven.
28. **Mock successes exposed as completed?** Risk in `executor.py` mocks.
29. **DB schema aligned with code?** Alembic primary; not deeply diffed (L3).
30. **Migrations production-real?** Alembic yes; RLS untested on SQLite.
31. **Metrics emitted?** Defined; not verified L1.
32. **Traces stored?** No (logging exporter).
33. **50-VU proven?** No (stale).
34. **Remains MOCK-LOCAL:** connectors, pgvector test, PYTEST stubs.
35. **Remains STATIC-ONLY:** LangGraph, Temporal, multi-agent, handoff, eval.
36. **Remains L2-only:** graph unit tests, memory closure (SQLite).
37. **Remains NOT PROVEN:** durable path, pgvector RAG, workspace isolation L1,
    checkpoint durability.
38. **True P0/P1 blockers:** P0 = F-03, F-04, F-09. P1 =
    F-01,F-02,F-05,F-06,F-07,F-08,F-10,F-11,ZT-01,PR-01.
39. **Safest order:** §38 below.
40. **Evidence required for prod-ready:** real Postgres+pgvector RAG (42719),
    real Temporal worker SIGKILL recovery, positive handoff, workspace-isolated
    memory/KG L1 tests, approval re-check L1, unified secret keys, LLM
    classifier on.

---

## 41. Previous Finding Verification

All 21 prior IDs (F-01…F-13, ZT-01/03/04, SC-01, F-TRC-01, F-LG-02/03, TI-02,
PR-01) **reproduced**; **0 closed, 0 regressed**. Detail in §4.

---

## 42. New Findings

- **NF-01 (P2, structural):** Repository has TWO migration systems — Alembic
  (primary, RLS-hardened 0010/0014/0019/0020) and a custom runner fallback (only
  `0005_rls`, 4 tables, tenant-only). The "42/42 RLS" claim rests on Alembic,
  but **all tests run on SQLite where RLS is a no-op**, so workspace isolation
  is never validated in-repo. Root enabler of F-03/F-04 remaining open.
- **NF-02 (P3):** `alembic.ini` hardcodes localhost Postgres URL; relies on env
  override in deploy (verify).
- **NF-03 (P3):** `api-client.ts` exposes `startDurableAgent` while `ChatWindow`
  keeps `durableMode=false` — wired-but-not-default clarity gap (no functional
  risk).
- **NF-04 (P2):** Otel traces exporter is `logging` only → trace storage NOT
  PROVEN (confirms F-13).

---

## 43. Implementation Backlog

**P0**

- B1 (F-03): add `workspace_id` filter to `memory_service.search_memories` (and
  list/get/update/delete/vector). Files: `services/memory_service.py`. Tests:
  workspace-isolation L1 on Postgres. Gate: security + regression.
- B2 (F-04): scope `knowledge_graph_service` writes/reads by `workspace_id`; add
  workspace RLS policy (alembic `0025`). Files:
  `services/knowledge_graph_service.py`, new migration. Tests: cross-workspace
  discovery L1.
- B3 (F-09/ZT-02): re-query `WorkspaceUser+Permission` immediately before side
  effect in `execute_approved_action` (`activities.py:607-625`). Files:
  `temporal/activities.py`. Tests: revoked-permission rejection L1.

**P1**

- B4 (F-01/F-10): decide durable default promotion path; enable
  `agent_react_enabled` only after B1–B3.
- B5 (F-02): implement real `Send` fan-out or document single-DAG as intentional
  MVP.
- B6 (F-05/F-07/F-LG-03): `AsyncPostgresSaver` when `temporal_enabled` +
  Postgres; else mark durable path experimental.
- B7 (F-06): real pgvector RAG integration test with controlled value 42719
  (DOCKER/REAL).
- B8 (F-08): remove fake-success tool mocks or gate behind explicit test flag,
  never product-visible.
- B9 (F-11/SC-01): single canonical `SECRET_KEYS` source consumed by
  temporal/graph/logging.
- B10 (ZT-01): Temporal worker start fail-closed.
- B11 (PR-01): enforce COPPA 18+ age gate.

**P2**

- B12 (F-12/ZT-04): distributed scrape quota (Redis).
- B13 (ZT-03): enable LLM injection classifier in prod.
- B14 (F-13/F-TRC-01/NF-04): Jaeger/Tempo exporter + full node spans.
- B15 (TI-02): NULL approval handling.
- B16 (F-LG-02): re-run k6 performance with current build.

**P3**

- B17 (NF-02): parameterize alembic URL via env.
- B18 (NF-03): align frontend durableMode default narrative.

(No implementation performed — audit only.)

---

## 44. No False Closure

The following anti-patterns are explicitly called out as NOT evidence of
completion:

- `StateGraph exists` ≠ multi-agent complete (E FAIL).
- `DAG metadata exists` ≠ multi-agent execution (E FAIL).
- `MemoryCandidate/marker exists` ≠ memory persisted/influences behavior (G
  PARTIAL).
- `Vector column / test_rag_pgvector_mock` ≠ pgvector L1 (I NOT PROVEN).
- `LLM service exists` ≠ autonomous reasoning (M PARTIAL; F-10).
- `ApprovalWorkflow exists` ≠ safe execution (L FAIL on re-check).
- `Temporal retry exists` ≠ LangGraph checkpoint durable (S FAIL).
- `mock result status=completed` ≠ tool execution (J PARTIAL; F-08).
- `handler.execute exists` ≠ agent L1 runtime (§10).
- `alembic RLS migrations exist` ≠ workspace isolation proven (tests SQLite, RLS
  no-op → NF-01).

---

## 45. Final Decision

**CURRENT DECISION: CONDITIONAL IMPLEMENTATION.**

Rationale: The default legacy path is production-mature and default (REAL/WE).
The durable LangGraph/Temporal path remains a non-default, non-durable,
isolation-leaky, approval-gap scaffold. All prior blocking findings reproduced;
no regression; delta since baseline is purely additive scaffolding.
Implementation may proceed **only** against the bounded P0/P1 backlog (§43
B1–B11). The durable path MUST NOT be promoted to default until B1–B3 (P0) and
B6–B7 (durability/real RAG) close with TEMPORAL/DOCKER/REAL-tier evidence.

---

# CURRENT REALITY

Default legacy `agentApi.chat` is production-real. Durable LangGraph/Temporal
path is opt-in, MemorySaver-backed, non-durable, and not the default. Workspace
isolation relies on unvalidated Postgres RLS (tests run SQLite). Approval lacks
execution-time re-check. Secret lists drift across 3 modules.

# WHAT IS PROVEN

- Legacy chat default path (REAL/WE).
- Prompt-injection regex middleware + optional LLM classifier (STATIC/UNIT).
- Strong perimeter middleware stack (STATIC).
- Observability scaffolding: OTel collector + Prometheus metrics definitions
  (REAL/STATIC).
- Alembic migration system with RLS-hardening versions present (STATIC).
- 22+ agent handler classes registered (STATIC).

# WHAT IS NOT PROVEN

- Real pgvector RAG with controlled value (I NOT PROVEN).
- Multi-agent `Send` fan-out execution (E FAIL).
- Positive A→B handoff (F NOT PROVEN).
- Memory persistence influencing future behavior at L1 (G PARTIAL).
- Workspace isolation at L1 (P FAIL) — SQLite tests never exercise RLS.
- LangGraph checkpoint durability across workers (S FAIL).
- Temporal worker SIGKILL recovery (R PARTIAL).
- Trace storage to queryable backend (U NOT PROVEN).
- 50-VU current performance (W stale).

# WHAT IS MOCK/STUB/FALLBACK

- Connector/tool mock-success branches (F-08, K MOCK-LOCAL).
- pgvector RAG mock-tier test (F-06).
- `PYTEST_CURRENT_TEST` LLM/DB/tool stubs in graph nodes (F-10).
- Legacy durable stub `_legacy_result()` when graph disabled (correct).
- RLS no-op on SQLite (NF-01).
- Temporal worker disabled by default (latent).

# WHAT IS PARTIAL

- Memory (marker-only loop), KG, Tools, LLM, Evaluation (metric-only), Security
  (ZT-03 open), Observability, Frontend durable (off), Performance (stale),
  Recovery (no SIGKILL).

# SECURITY RISKS

- P0: workspace isolation leak (F-03/F-04); approval re-check missing (F-09).
- P1: secret-key drift (F-11); Temporal fail-open (ZT-01); COPPA age gate
  (PR-01).
- P2: LLM injection classifier off (ZT-03); in-process scrape quota (F-12); NULL
  approvals (TI-02).

# PRODUCT GAPS

- Durable path non-default/non-durable; multi-agent not implemented; real RAG
  unproven; evaluation non-replanning; connectors mock in tests.

# REGRESSIONS

- 0.

# P0/P1 BLOCKERS

- P0: F-03, F-04, F-09.
- P1: F-01, F-02, F-05, F-06, F-07, F-08, F-10, F-11, ZT-01, PR-01.

# NEXT IMPLEMENTATION PHASE

Close P0 (B1–B3) → P1 durability/real-RAG (B6–B7) → approval correctness (B3
done in P0) → secret unification (B9) → multi-agent decision (B5) →
connectors/observability (B8, B14) → performance re-run (B16). Do NOT promote
durable path to default until B1–B3 + B6–B7 pass at REAL/TEMPORAL/DOCKER tier.

# FINAL GATE

**NOT READY for production promotion of durable path. CONDITIONAL IMPLEMENTATION
permitted against bounded P0/P1 backlog.** All mandatory production gates (E, F,
I, P, S, Z) fail or are not proven. Evidence hierarchy strictly enforced; no
lower-tier evidence promoted. Repository preserved exactly as found (read-only).
