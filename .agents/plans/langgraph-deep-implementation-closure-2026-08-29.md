# LangGraph Deep Implementation + Autonomous Agent Product Closure — Plan (2026-08-29)

> **Status:** DRAFT FOR USER APPROVAL **Mode:** BUILD + AUDIT + VERIFY
> **Scope:** LangGraph / autonomous-agent layer ONLY — Temporal durability
> foundation is PROTECTED BASELINE **Repo:** Vaeloom `master` @ current HEAD
> (forensic @ `78c2d71` / `17011ea` temporal baseline) **Governing contracts:**
> `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/` +
> `AGENTS.md` + `ADR-038` + `ADR-039` +
> `docs/temporal/langgraph-production-hardening-2026-08-28.md` +
> `docs/temporal/closure-report-langgraph-2026-08-28.md` (7 LG gates PASS)
> **Branch:** continue from current `master` — no rewrite of Temporal, no
> LangGraph imports into `apps/api/src/api/temporal/workflows.py` **Primary
> objective:** turn verified `StateGraph` inside `DurableAgentRunActivity` into
> a complete, memory-aware, RAG-grounded, tool-capable, approval-safe,
> observable autonomous multi-agent product with real end-to-end journeys.

---

## 0. Absolute Context — Protected Baseline (DO NOT REGRESS)

### 0.1 Verified baseline (evidence hierarchy: real runtime > WorkflowEnvironment > ainvoke > unit)

| Area           | Evidence                                                                                                                                                                                  | File                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Temporal       | `temporal:7233` healthy, worker×2 `vaeloom-temporal-worker`, `temporal-db` + `temporal-visibility-db`                                                                                     | `docker-compose.yml:215` profile `temporal`                  |
| Worker         | 6 Workers sharing one `Client` (`ingest 20`, `agent 8`, `connectors 6`, `schedules 4`, `approvals 20`, `events 8`)                                                                        | `apps/api/src/api/temporal/worker.py:72`                     |
| Workflow IDs   | `ingest:{ws}:{hash}:{doc}` / `durable_run:{ws}:{user}:{req}` / `approval:{ws}:{id}` / `connector_sync:{ws}:{id}:{token}` `REJECT_DUPLICATE`                                               | `workflows.py:119,249,422,493,504`                           |
| Activities     | 11 (`parse_document` 60s hb15s 3×, `durable_agent_run` 120s hb30s 2×, `sync_connector` 300s hb30s 3×…) + `check_kill_switch`/`check_quota`/`record_workflow_metric`                       | `activities.py:834`                                          |
| LangGraph seam | ONLY `activities.py:508 _run_graph` imports `api.graph`; `workflows.py` 0 LangGraph imports (gate)                                                                                        | `graph/__init__.py:15` `StateGraph, START, END, MemorySaver` |
| State          | `VaeloomGraphState` 16 fields `TypedDict + add_messages`, 20KB/20 msgs×4KB/rag 8KB, 35 SECRET_KEYS recursive, `FORBIDDEN_GRAPH_KEYS`, `build_initial_state` 8KB→1KB loop truncate         | `graph/state.py:60,104,179`                                  |
| Graph          | 10 nodes `validate_input→retrieve_context→route→supervisor→agent→tool_decision→policy_check→tool_execute→evaluate→finalize` + `after_route/supervisor/tool/policy/evaluate`               | `graph/__init__.py:57`                                       |
| RAG status     | `ok                                                                                                                                                                                       | empty                                                        | unavailable | timeout | error` explicit, never fabricated, 5s timeout, workspace-filtered, 8/8/5 refs | `graph/nodes.py:77` |
| Quota          | Redis Lua `quota:{ws}:{YYYY-MM-DD}:{metric}` `INCRBY+EXPIRE`, 1000 req/100k tokens/5000c, 2 workers 20 concurrent verified                                                                | `temporal/quota.py:51`                                       |
| Flags          | `LANGGRAPH_ENABLED=false` safe default, `shadow_mode`, `percent 0-100 sha256(request_id)%100`, `checkpoint_backend=memory`, `TEMPORAL_ENABLED=false` local                                | `config.py:105,119`                                          |
| Observability  | `temporal_workflow_*` + `langgraph_run_*`/`node_*`/`tool_*` on `:9090/metrics` + `:8000/metrics`, `TracingInterceptor activity_inbound` PARTIAL, `StructuredJsonFormatter correlation_id` | `temporal/metrics.py`, `infrastructure/opentelemetry.py`     |
| Tests          | 43 graph (real `StateGraph.ainvoke` + `MemorySaver`) + 40 temporal (`WorkflowEnvironment`) + 2731 total, 233 security                                                                     | `tests/graph/*`, `tests/temporal/*`                          |
| Frontend       | `POST /agents/chat` direct + `files/connectors` Temporal polling 3s + approvals inbox                                                                                                     | `apps/web/src/components/chat/ChatWindow.tsx:341`            |

### 0.2 Known non-blocking (preserve truth, never silently hide)

1. **F-LG-02** overhead `10VU p95 548ms vs 285ms baseline` (measured with stub,
   not real LLM)
2. **F-SEC-01** direct Temporal client can place `api_key` in history before
   `validate_no_secrets` (`workflows.py:277`) — API is trusted prod boundary
3. **F-LG-03** `MemorySaver` process-local cannot cross-worker/interrupt resume
4. **F-RAG-01** SQLite/test fallback `empty` (no pgvector locally)

### 0.3 What is NOT yet an autonomous product

The topology runs but **agent execution is a stub under `PYTEST_CURRENT_TEST`**
(`graph/nodes.py:228` + `tool_execute:342`), supervisor `dag` is stored not
`Send`-executed, memory write closed-loop not wired, pgvector proof only stub,
frontend bypasses `DurableAgentRunWorkflow`, no durable `waiting_approval`
resume, evaluation is trivial, tracing is activity-only.

---

## 1. Primary Mission — What Must Become True (§1, §47)

> **Vaeloom can execute a real autonomous multi-agent task through LangGraph,
> use real memory/RAG/knowledge context, select and coordinate real agents,
> invoke authorized tools/connectors, pause for durable human approval when
> required, survive worker failure through Temporal, preserve workspace/security
> boundaries, avoid duplicate consequential side effects, provide observable
> provenance, and safely return the result to the user.**

Proving the sentence above is the closure gate — not `83 tests passed`.

```
User → Frontend (stepper + SSE) → API (auth/workspace/20KB/secret-scrub)
 → Temporal DurableAgentRunWorkflow (REJECT_DUPLICATE, quota, kill-switch)
   → DurableAgentRunActivity (ONLY LangGraph import, 120s hb30s, heartbeat 15s)
     → LangGraph VaeloomGraphState (bounded, workspace-bound, 20KB)
       ├── Validate → Retrieve (RAG 5 statuses, bounded) → Route (RoutingDecision)
       ├── Supervisor (bounded DAG ≤5/≤8/≤20, no cycles, Send layers)
       ├── Multi-agent (parallel/sequential/conditional/handoff, typed)
       ├── Tool decision → Policy (approval_gated) → Tool execution (quota/idempotency/audit)
       ├── Evaluation (bounded replan) → Memory extraction → KG update
       └── Finalize (provenance, never chain-of-thought exposure)
     → Temporal durable result → API → Frontend (source refs + approval resume)
```

---

## 2. Protected Architectural Boundary (§4 — MANDATORY GATE)

| Owner               | Owns                                                                                                                                                      | File                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Temporal**        | workflow identity/lifecycle, durability, retry, timeout, cancellation, signals, schedules, recovery, history, idempotency, durable approval               | `workflows.py`                                                |
| **LangGraph**       | routing, planning, branching, multi-agent topology, handoffs, state transitions, tool decisions, evaluation, context fusion                               | `graph/*`                                                     |
| **Domain services** | authorization, workspace isolation, quota, memory/KG persistence, connector ownership, tool permissions, approval authorization, secret management, audit | `orchestrator/*`, `services/*`, `tools/*`, `infrastructure/*` |

**Hard gates that must remain:**

```bash
grep -R "from langgraph\|import langgraph\|StateGraph\|MemorySaver\|ainvoke" apps/api/src/api/temporal/workflows.py → 0
grep -R "temporalio" apps/api/src/api/graph/ → 0 (except optional interceptors type-check)
LANGGRAPH_ENABLED=false → _legacy_result without DB/Temporal/history breach (activities.py:434)
```

---

## 3. Repository Forensics — Dependency Map (§2, §3)

### 3.1 File inventory (verified 2026-08-29)

```
apps/api/src/api/graph/              __init__.py (StateGraph 10 nodes), state.py, nodes.py, routing.py, errors.py
apps/api/src/api/temporal/           workflows.py (5), activities.py (11), validation.py, client.py, worker.py, queues.py (8), quota.py, metrics.py, interceptors.py
apps/api/src/api/orchestrator/       router.py (AGENT_REGISTRY 22, CATEGORY_KEYWORDS 15), supervisor.py (PARALLEL_SAFE 8, CHAINS 5, _build_dag), loop.py (run_agent_loop 3×, fetch_pending_approvals), base.py, state.py
apps/api/src/api/agents/             22 handlers: organization/memory/resume/ats/job_search/application/gmail/scheduler/planning/research + career/learning/github/coding/reminder/analytics/recommendation/reflection/security/connector/plugin/drive
apps/api/src/api/tools/              definitions.py (40+1 alias), executor.py (13 static approval_gated + dynamic MCP readOnlyHint==false, categories 2-10s, 20/h quota in-proc)
apps/api/src/api/services/           memory_service.py (pgvector cosine_distance), knowledge_graph_service.py (BFS traverse), retrieval via agents/memory_agent/retrieval.py + loop._assemble_rag_context, 56 others
apps/api/src/api/models/             schema.py (User,Tenant,Workspace,Connector,Document,DocumentVersion,DocumentChunk,Memory,Entity,Relationship,AgentAction,Approval 42 RLS)
apps/api/src/api/routers/            27 routers (agents, chat, memory, knowledge_graph, search, connectors, temporal …)
apps/api/src/api/infrastructure/     agent_limits, circuit_breaker (3/30s), agent_observability (kill_switch), opentelemetry, logging (_redact 14 keys), metrics
apps/web/src/app/                    workspace/[workspaceId]/** (chat→DynamicChatWindow, agents catalog, history, approvals, connectors, files, memory, jobs …)
apps/web/src/components/             chat/ChatWindow.tsx 1044 LOC (agentApi.chat + fake streamText 18ms), shared/ApprovalCard 170 LOC, memory/GraphViewer (KG not execution)
apps/web/src/lib/                    api-client.ts 2191 LOC (agentApi.execute/run/executions + temporalApi + chatStream SSE dead code), api.ts
docs/temporal/                       langgraph-readiness 89 LOC, langgraph-production-hardening ~1100 LOC, closure-report 247 LOC, catalog, runbook, ADR-038/039
infra/                               docker-compose temporal profile, k8s ConfigMap LANGGRAPH_ENABLED false, monitoring otelcol
tests/                               graph 4 files 43 tests, temporal 13 files 40 tests (WorkflowEnvironment), security 10 files 63, agents ~466, integration 8
```

Global grep hits: `LangGraph ~60` (only activities+graph), `MemorySaver 6` (only
graph), `AGENT_REGISTRY 22`, `classify_intent 2-stage keyword`, `_build_dag`
heuristic, `RAG` 8/8/5, `approval 13+dynamic`.

### 3.2 Implementation matrix (draft — formalized in PHASE 1 script)

| Capability        | Exists                           | Implemented                        | Actually Invoked      | Real Runtime       | Mock/Fallback                   | LangGraph Path          | Legacy Path                  | Missing                                   |
| ----------------- | -------------------------------- | ---------------------------------- | --------------------- | ------------------ | ------------------------------- | ----------------------- | ---------------------------- | ----------------------------------------- |
| Agent registry    | ✅ 22                            | ✅                                 | ⚠️ stub heuristic     | PYTEST mock        | stub `f"graph agent {id} stub"` | heuristic `tool_needed` | handler.execute not in graph | ReAct dispatch + TypedDef                 |
| Intent routing    | ✅ keyword                       | ✅                                 | ✅ `route_node`       | keyword only       | confidence heuristic            | YES                     | same                         | LLM classifier + RoutingDecision          |
| Supervisor        | ✅ `_build_dag`                  | ✅                                 | dag stored only       | heuristic          | LLM opt-in off                  | metadata only           | YES                          | Send layers, bounded, provenance          |
| DAG execution     | ✅                               | ⚠️                                 | NO parallel           | —                  | —                               | stored                  | loop gather                  | Send + merge + replan                     |
| Parallel agents   | ✅ super                         | ⚠️                                 | NO in graph           | super has gather   | super only                      | NO                      | YES                          | graph Send parallel                       |
| Sequential agents | ✅ chains 5                      | ⚠️                                 | NO in graph           | chains 5           | chains heuristic                | NO                      | YES                          | chain layers per Send                     |
| Agent handoff     | ❌ no TypedDict                  | ❌                                 | ❌                    | —                  | concat `[from:k untrusted]`     | NO                      | concat                       | Typed Handoff + validation                |
| Memory retrieval  | ✅                               | ✅                                 | ✅ `retrieve_context` | LIKE only          | LIKE `%query%`                  | truncated `empty`       | vector path gated            | ranking, stale/conflict                   |
| Memory writing    | ✅ ingest                        | ⚠️                                 | ❌ in graph           | ingest only        | PYTEST fallback                 | NO                      | YES                          | graph finalize extraction→persist         |
| Knowledge graph   | ✅                               | ✅                                 | ⚠️ `loop._assemble`   | LIKE only          | zero-vec fallback               | NO direct               | `retrieval.graph_traversal`  | bounded traverse + workspace filter       |
| RAG               | ✅                               | ✅                                 | ✅ `rag_status`       | fallback only      | pgvector gated                  | explicit statuses       | `_fallback`                  | pgvector proof doc→answer                 |
| Tools             | ✅ 40+dynamic                    | ✅                                 | ✅ `tool_execute`     | PYTEST mock        | `mock_*`                        | scopes empty graph v1   | executor full                | READ/WRITE taxonomy + quota + idempotency |
| MCP               | ✅ `mcp_client_service`          | ✅                                 | ✅ dynamic bridge     | probing            | discovery 300s TTL              | `mcp__Srv__Tool`        | same                         | per-workspace multi-MCP                   |
| Connectors        | ✅ 7 clients                     | ✅                                 | ⚠️ mock success       | probe only         | mock lists                      | NO graph diff           | executor mocks               | ownership + STATIC marking                |
| Approval          | ✅ `ApprovalWorkflow`            | ✅ `policy_check→waiting_approval` | finalizes only        | durable wait 3600s | forged rejected                 | finalized not interrupt | same                         | `interrupt_before` + resume               |
| Quota             | ✅ Redis Lua                     | ✅ `agent_node` pre-check          | per-agent only        | Lua atomic         | in-proc scrape                  | partial                 | activity check               | per-tool Redis slot + fail-open/closed    |
| Evaluation        | ✅ QA 3 tries                    | ⚠️ `evaluate_node` trivial         | `result→completed`    | no replan          | —                               | trivial                 | QA gate                      | bounded replan + EvaluationResult         |
| Provenance        | ✅ tags `[from:k untrusted]`     | ✅                                 | ✅                    | ctx injection      | —                               | tags                    | strings                      | mark all untrusted sources                |
| User prefs        | ✅ `type=preference`             | ⚠️                                 | fallback              | LIKE only          | LIKE                            | fallback                | prefs 5                      | closed-loop concise reports               |
| Long-term memory  | ✅                               | ⚠️                                 | ingest only           | PG                 | SQLite                          | NO graph loop           | YES                          | extraction→dedupe→resolve→persist         |
| Frontend exec     | ⚠️ `files/connectors` 3s polling | ❌ chat bypasses graph             | ingest/sync only      | fake streaming     | Temporal only                   | NO graph stepper        | `agentApi.chat` direct       | durable agent workflow UX                 |

> No `PASS` without runtime evidence. Script `scripts/audit/langgraph_matrix.py`
> will enforce.

---

## 4. Execution Plan — 21 Phases (each: AUDIT → IMPLEMENT → TEST → REAL RUNTIME VERIFY → REGRESSION → DOCUMENT)

### PHASE 0 — Repository Forensic Audit

**Goal:** freeze §2 audit + dependency map + baseline hashes.

- **Audit:** re-run globs for
  `apps/api/src/api/graph|temporal|agents|orchestrator|tools|services|models|routers`,
  global grep
  `LangGraph|StateGraph|MemorySaver|AGENT_REGISTRY|classify_intent|_build_dag|supervisor|RAG|retrieval|connector|approval|LANGGRAPH_ENABLED`.
- **Implement:** write
  `docs/temporal/langgraph-deep-implementation-closure-2026-08-29.md §3`
  Forensics + commit hash `git rev-parse HEAD`.
- **Test:** dry-run
  `uv run --project apps/api python -m api.temporal.worker --dry-run` +
  `pnpm --filter web typecheck`.
- **Verify:** `docker compose --profile temporal ps` (if available)
  `temporal:7233`, `redis PONG`, `postgres vector`.
- **Regression:** `grep workflows.py langgraph → 0`.
- **Document:** `docs/temporal/catalog.md` + dependency Mermaid.

### PHASE 1 — Actual Implementation Matrix

**Goal:** enforce §3 gate so no `implemented`→`PASS` without invocation.

- **Implement:** `scripts/audit/langgraph_matrix.py` parsing `HAS_LANGGRAPH`,
  `PYTEST_CURRENT_TEST` guards, `vec_fallback`, `mock_*`, `AGENT_REGISTRY`
  sizes; emit `docs/phases/langgraph-pXX/01-matrix.md` + CI check
  `scripts/audit/check_matrix.sh` (fails if `Actually Invoked=NO` but
  `Status=PASS`).
- **Test:** unit of script.
- **Document:** matrix in closure §3.

### PHASE 2 — Agent Registry + Real Agents (LG-02)

**Audit** `router.py:58` 22 entries — classify
`fully|partial|legacy only|stub|mock|dead|duplicate|unused` + capability vs
`MVP_CANONICAL_AGENTS` 10.

**Implement:**

- `apps/api/src/api/orchestrator/agent_definitions.py` (new) `AgentDefinition`
  dataclass
  `{id,description,capabilities,tools[],required_scopes,systemInstructions,model,timeout 120s,retry 2×,outputSchema,inputSchema,workspaceRestrictions,approvalRequired,memoryRequired,ragRequired,evaluation}`.
- `graph/nodes.py:204 agent_node` — remove `tool_needed = "search" in task`
  heuristic; call
  `AGENT_REGISTRY[agent_id].execute(content, source_type="graph", source_id=request_id, workspace_id)`
  when `not PYTEST_CURRENT_TEST` or `mock_llm` present; keep guard only for
  network (LLM) not handler shape. Enforce `tools≤12` per agent.
- Persist `LoopState` to DB `agent_executions` (keep FS `~/.vaeloom/state`
  fallback for local).

**Test:** `tests/graph/test_agent_registry.py` parametrized 22 agents
`test_agent_executable[agent_id]` → `execution_status completed` +
`result.summary ≠ stub` with `mock_llm`.

**Verify:** `temporal:7233` seed + `api:8000`
`POST /temporal/workflows/durable-agent` per agent.

**Protect:** registry still gated `mvp_scope_enforced` in `router.py:131`.

### PHASE 3 — Routing (LG-04)

**Goal:** production `RoutingDecision` {primary, secondary[], confidence∈[0,1],
candidates[], policy_filtered[], final_agent,
provenance{keywordsMatched,secondaryScores,tied}, explain}.

- **Implement:** `graph/routing.py` wraps `router.classify_intent` but returns
  `RoutingDecision` with `confidence min(score/3.0,1.0)` +
  `0.8 boost if score==2` preserved; add `validate final_agent∈AGENT_REGISTRY`,
  `policy/kill-switch filter`, `workspace/tool filter`, `mvp_scope_enforced` 10
  canonical, deterministic fallback `memory 0.5`. `route_node:133` emits
  `selected_agent=final_agent` + `metadata.route_decision`.
- **Test:** 9 cases
  `simple/ambiguous/multi-intent/unknown/adversarial/unauthorized/unavailable/invalid model/workspace mismatch`
  in `tests/graph/test_routing.py` (expand existing 6).
- **Verify:** adversarial prompt
  `detect_adversarial_prompt critical→ValidationError` path `nodes.py:62`.
- **No CoT:** `result` never contains hidden reasoning; `explain` is keywords
  only.

### PHASE 4 — Supervisor + DAG (LG-03)

**Bounds:** `depth ≤5 / fan ≤8 / total ≤20 / no cycles` (hard fail-closed
`failed` if violated, never truncated silently without provenance).

- **Implement:** `graph/nodes.py:157 supervisor_node` tightened
  `normalize→fan 8→total 20→depth 5→dedup cycle (seen set)` already correct —
  add `Send`. Use LangGraph `Send` API:

  ```python
  from langgraph.types import Send  # only in graph
  dag = await supervisor_dag(task)  # list[list[str]] layers
  # validate bounded …
  return Command(goto=[Send("agent", {"selected_agent": a, "layer": i, "subtask": task})
                        for i, layer in enumerate(dag) for a in layer])
  ```

  Keep `supervisor_dag` in `graph/routing.py:37` wrapping
  `_detect_subtasks/_build_dag` + `_try_llm_planner` opt-in
  `SUPERVISOR_LLM_PLANNER=1`. Validate
  `no invented agents, full coverage, resume→ats dependency`.

- **Test:** `tests/graph/test_supervisor_dag.py` depth/fan/total/cycle fuzz.
- **Verify:** `graph.get_graph_metadata() dag` in `metadata`.
- **Doc:** Mermaid `stateDiagram-v2 supervisor`.

### PHASE 5 — Multi-Agent + Handoff (LG-03, LG-11)

**Topologies proofs:**

```
Supervisor
 ┌────┬────┬────┐  research  analysis  extraction → synthesizer
 A→B→C  (sequential chain) | A,B,C→merge (parallel batch) | router→A|B|C (conditional) | A→B→C handoff | A ok / B fail / C ok → evaluate→replan
```

Each preserves
`workspace_id, user_id, request_id, quota, tool permission, approval`.

**Handoff contract** `graph/state.py` (new `AgentHandoff` TypedDict):

```python
class AgentHandoff(TypedDict):
    source_agent: str; target_agent: str; workspace_id: str; user_id: str
    request_id: str; task_id: str; objective: str; context_refs: list[str]
    allowed_tools: list[str]; required_scopes: list[str]; handoff_reason: str
    provenance: dict; schema_version: Literal[1]
```

Validate
`forged agent/workspace, forbidden tool, invalid schema, oversized >8KB, secrets recursive, cyclic, unknown agent`
→ `WorkspaceMismatchError/SecretPayloadError/ValidationError` never side-effect.

**Test:** `tests/graph/test_multi_agent.py` 5 topologies +
`tests/graph/test_handoff.py` 8 reject cases.

### PHASE 6 — Memory Closed Loop (LG-05)

```
Request 1 "I prefer concise reports." → graph finalize extraction → validation→dedupe(merge.py 0.85)→entity resolve→memory_service.create_memory (embedding best-effort)→provenance
→ Request 2 "Prepare my weekly report." → retrieve_context (prefs 5)→agent uses preference (concise)
```

- **Implement:** `graph/nodes.py:finalize_node` after merge add
  `memory extraction` (call `agents/memory_agent/extraction.py:extract` same as
  ingest but bounded, `PYTEST` still mock `React→Skill` but preference path
  proved via `type=preference`), then `memory_service` persist (workspace
  isolated). Keep `validate_no_secrets` at persist boundary.
- **Fix:** `services/memory_service.py:search_memories` add keyword LIKE
  fallback (mirrors `retrieval.keyword_search`) so SQLite still closes loop.
- **Test:** `tests/graph/test_memory_closed_loop.py` +
  `tests/temporal/test_memory_e2e.py` (real DB) concise assertion
  `len(summary) < 500` when preference present,
  dedup/update/delete/correction/conflict/ranking.
- **Verify:**
  `psql "SELECT type,title FROM memories WHERE workspace_id=… AND type='preference'"`.

### PHASE 7 — Knowledge Graph (LG-06)

```
Documents → Entities → Relationships → KG → traversal → context assembly → LangGraph → validated knowledge
```

- **Implement:** wire `knowledge_graph_service.traverse/find_shortest_path` into
  `retrieve_context_node` as 4th source alongside `vector/keyword/graph`
  (already in `retrieval.py` but not graph); bounded `limit 5 per entity`,
  `workspace tenant_id` filter, `embedding` vs `LIKE` dual path, batch
  `knowledge_edges` (fix N+1).
- **Tests:** entity canonicalization, duplicate `canonical_name`, relationship
  `requires_skill`, provenance, `DELETE CASCADE` edges, stale TTL.
- **Verify:** `SELECT * FROM knowledge_nodes WHERE tenant_id=…` includes new
  entity from graph finalize.

### PHASE 8 — Real RAG (LG-07)

**Keep fallback truth:** `rag_status` explicit, never fabricated
`{"entities":[],"documents":[],"preferences":[]}` on `unavailable/timeout/error`
(`nodes.py:128`).

**Implement:** enable production path when `DATABASE__URL` contains `postgres` +
`QDRANT_URL` or `ENABLE_VECTOR_RAG=1` + `llm_api_key` present:
`generate_embedding(query) → SELECT e.vector <=> :vec WHERE workspace_id=:ws ORDER BY distance LIMIT limit → workspace filter → rerank → 8/8/5 refs 8KB`
(`retrieval.py:164` already but gate `_assemble_rag_context` in `loop.py:268`).
Add `search_memories` fallback above so dev/local still `empty` not
`unavailable`.

**Blocking real data test:** `tests/graph/test_rag_real.py` +
`tests/temporal/test_rag_e2e.py`:

```sql
INSERT INTO documents(id,workspace_id,path,summary,content) VALUES (…,'Q3 OKR is 42',…);
-- generate embedding via llm_service (or deterministic hash in TEST)
```

Then `task="What is Q3 OKR?"` → assert `rag_status=ok`,
`rag_context.documents[0].snippet contains 42`, `result.summary contains 42`
(prove `doc→embedding→retrieval→answer`). Cover 7 states
`healthy|empty|unavailable|timeout|error|malformed|unauthorized` via
`tests/graph/test_hardening.py:21` expanded.

**Bounds:** `result count ≤8`, `bytes ≤8192`, provenance
`{source_id, snippet, score, workspace_id}`.

### PHASE 9 — Tools + Connectors (LG-08, LG-09)

**Classify** `tools/definitions.py:932` 40+1+MCP dynamic →
`READ|WRITE|DESTRUCTIVE|EXTERNAL_SIDE_EFFECT|APPROVAL_REQUIRED`.

Pipeline `graph/nodes.py:tool_decision(275)→policy_check(280)→tool_execute(328)`
enforces:

```
tool_decision (needs tool?) → policy (approval_gated_tools 13+dynamic, forged approved→pending) → permission(check_permission scopes) → quota(temporal/quota.check_and_reserve) → idempotency(Idempotency-Key sha256 ws/agent/tool/params UNIQUE) → execution(execute_tool 2-45s, 1-3 retries) → validation(4KB utf-8 truncate, validate_no_secrets) → audit
```

- **Gaps to fix:** quota today only `agent_node:207` pre-check; add per-tool
  `check_and_reserve` in `tool_execute_node` for
  `WRITE|DESTRUCTIVE|approval_gated`. Replace in-proc `_SCRAPE_TIMESTAMPS 20/h`
  (`executor.py`) with Redis `ZADD quota:scrape:{ws}` sliding (shared across
  replicas). Add `Idempotency-Key` header storage `agent_actions` unique index.
- **Connectors** `clients/gmail|drive|calendar|graph|greenhouse` +
  `connector_ext_service` + `mcp_client_service` — for each assert
  `ownership(FK ws), credentials(SecretManager EncryptedString), binding, scopes, timeout 5-45s, retry 3×, rate 20/h, approval 13+dynamic, idempotency, audit`.
  Where credential absent, closure table marks `STATIC NOT RUNTIME VERIFIED`
  (never fake `completed`).

**Tests:** `tests/graph/test_tool_pipeline.py` 7 categories +
`tests/temporal/test_connector_e2e.py` probe.

### PHASE 10 — Approval Mid-Graph (LG-10) — Durable

**Target:**

```
request→supervisor→agent→tool_decision→policy detects approval_required→waiting_approval
→ Temporal ApprovalWorkflow approval:{ws}:{id} wait_condition 3600s → user Approve (POST /approvals/{id}/decision)
→ resume (graph.ainvoke(None, config) or second durable_agent_run with approval_state)
→ tool executes → result → memory/provenance
```

- **Implement:** Two-step: (A) keep current
  `policy_check→waiting_approval→finalize({approval_state pending})` for v1
  (already preserves `ApprovalWorkflow` as truth); (B) behind
  `langgraph_checkpoint_backend=postgres` add true
  `interrupt_before=["tool_execute"]` + `AsyncPostgresSaver` (never sole truth —
  Temporal remains). Invalid path: forged `approval_state.status=approved`
  rejected `nodes.py:289`.
- **Tests:** 10 paths
  `approved|rejected|expired|cancelled|duplicate signal|forged|wrong user/ws|crash waiting|restart|replay`
  in `tests/temporal/test_approval_workflow.py`.
- **Verify:** real
  `tctl workflow signal --wid approval:{ws}:{id} --name decision --input '{"decision":"approved"}'`
  → second activity `execute_approved_action`.

**LangGraph checkpoint is convenience, Temporal is authority** — documented.

### PHASE 11 — LLM Provider (LG-02, LG-11)

Audit `services/llm_service.py` (anthropic 0.121/openai 2.53). Distinguish
`TEST|LOCAL|STAGING|PRODUCTION` (`service_environment + llm_api_key`).

- **Implement:**
  `generate_completion(..., response_format={json_schema: RoutingDecision|AgentPlan|EvaluationResult}, timeout 10s, retry 1× only on 429/5xx, token budget `DEFAULT_MAX_CONTEXT_TOKENS
  8000-500-1000`, invalid output→ValidationError never bypass). Provider fallback only when `BACKUP_LLM_API_KEY`
  set.
- **Doc:** state
  `mock only when llm_api_key empty AND service_environment∈{test,local}` —
  production requires key.

### PHASE 12 — Evaluation / Replan (LG-15)

Replace `evaluate_node:414` trivial with:

```python
class EvaluationResult(TypedDict):
    task_completion: bool; tool_correctness: bool; retrieval_relevance: bool
    memory_relevance: bool; policy_correctness: bool; workspace_correctness: bool
    output_schema_valid: bool; provenance_complete: bool; user_objective_met: bool
    score: float; replan_required: bool; reason: str
```

Bounds
`max iterations 20, eval attempts 3, replans 2, tool attempts 3, wall 120s`.
Never infinite loop.

**Tests:** `tests/graph/test_evaluation.py`
simple/multi/tool/security/failure/memory suites.

### PHASE 13 — Security Red-Team (LG-11)

14 attacks
`forged workspace|agent|tool|connector|approval|permission|memory|RAG|secret injection|oversized|nested secret|prompt injection|handoff injection|tool output|MCP|replay|duplicate|race|cancel bypass|kill-switch bypass|quota bypass`
→ `reject|failed closed`.

- **Implement:** provenace survival: every untrusted source wrapped
  `[UNTRUSTED SOURCE {type}:{id}]…[END]` (`nodes.py:113` already tags supervisor
  context, extend to `rag_context`, `tool output`, `mcp`, `handoff`, `memory`).
  Model never final authority — `policy_check`+`tool_execute` boundaries
  enforce.
- **Tests:** `tests/security/test_graph_redteam.py` 14 parametrized +
  `tests/security/test_prompt_injection` + `tests/temporal/test_security.py`
  history secrets.

### PHASE 14 — Chaos / Recovery (LG-13, LG-14)

Real Docker where `--profile temporal`:

```bash
docker kill vaeloom-temporal-worker-1  # worker-1
docker kill vaeloom-temporal-worker-2; docker compose --profile temporal up -d temporal-worker
docker restart vaeloom-temporal vaeloom-redis vaeloom-postgres
# in-test: RAG unavailable (kill pgvector), tool timeout 500ms, connector timeout, LLM timeout
# cancel during execution / approval via temporalApi.cancel
```

Verify
`no lost workflow (COMPLETED via remaining worker), no duplicate WRITE (idempotency key), no bypass, no leak`
(`tests/temporal/test_chaos.py:89` already `flaky 2×→success`,
`worker crash→second COMPLETED`).

### PHASE 15 — Frontend (LG-18)

Add `apps/web/src/components/execution/ExecutionTimeline.tsx` stepper +
`useExecutionPolling` hook:

```
Queued → Planning → Retrieving context → Running agents → Waiting for approval → Executing action → Evaluating → Completed|Failed|Cancelled
```

- **Implement:** (A) new `POST /api/v1/temporal/workflows/durable-agent` trigger
  (auth/CSRF/RLS/20KB/secret scrub) returning `{workflow_id}`; (B) retrofit
  `ChatWindow.tsx:341` to call it when `LANGGRAPH_ENABLED` (keep `agentApi.chat`
  fallback); (C) wire `api-client.ts:338 chatStream` SSE
  (`Accept: text/event-stream`, NDJSON `onEvent`) for token-by-token +
  `metadata.node` streaming; (D) polling fallback `setInterval 3000ms getStatus`
  for `files/connectors` already proven; (E) wire `agentApi.executions`
  (currently dead) to `workspace/[id]/executions/[executionId]/page.tsx` detail
  timeline; (F) apply
  `SWRProvider swrClass.LIVE (revalidateOnFocus:true refreshInterval:30s)` to
  `approvals/page.tsx` (currently defaults false); (G) never expose
  `chainOfThought, hidden prompts, secrets, raw reasoning`.

**States to verify:** polling, transitions, cancellation (`AbortController` +
`temporalApi.cancel`), stale/refresh/reload/duplicate 409
`WorkflowAlreadyStartedError`, accessibility (`aria-live` stepper),
loading/error/empty.

### PHASE 16 — Observability (LG-16)

Metrics already bounded (`labels: agent,mode,node,tool,status` never
`request_id`). Add `infra/monitoring/grafana/dashboards/vaeloom-graph.json`.

Extend `temporal/interceptors.py:37 TracingInterceptor` to `workflow_inbound` +
`client outbound` W3C `traceparent` (`TraceContextTextMapPropagator.inject` via
`temporalio.workflow.unsafe` headers). Wrap `nodes.py:29 record_graph_span` for
all 10 nodes (today only `validate_input`). Chain
`http request → temporal.client.start → workflow → activity → graph node → tool → llm/pg/redis`.
If SDK determinism prevents workflow header injection, document `PARTIAL` exact
gap.

Logs:
`correlation_id/workflow_id/run_id/activity_id/graph_run_id/agent/node/tool/status`
already `activities.py:87` via `activity.info()` + `_redact`.

### PHASE 17 — Performance (LG-17)

`testing/k6-langgraph.js` vs `testing/k6-temporal.js` had
`10VU p95 548ms / 20VU 1.01s / 50VU 2.81s vs 2.1s baseline`. Re-run at
`5/10/20/50/100 VUs` (100 if 32GB):

```
k6 run --vus 10 --duration 30s testing/k6-langgraph.js  # p50/p95/p99/RPS/error/graph duration/node duration/RAG/tool/activity 120s
docker stats vaeloom-temporal-worker --no-stream  # CPU/mem per worker×2
redis-cli --latency-history  # Redis p99
psql "SELECT … FROM pg_stat_statements"  # Postgres p99
```

Compare breakdown `serialization 20KB + rag 5s + vector 3× + tool HTTP 10s`. Do
not raise thresholds without proving bounded overhead; then `NON-BLOCKING` with
evidence only.

### PHASE 18 — Full E2E (LG-20) — 8 Journeys

Each records
`workflow_id, run_id, workflowType, taskQueue, status, worker, result`:

| Journey               | Path                                                                         | Proven via                       |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| A Simple memory-aware | User→API→Temporal→graph memory retrieve→agent→memory update→frontend concise | `test_memory_closed_loop` + psql |
| B RAG                 | doc→embedding pgvector→question→graph `ok`→answer+provenance `42`            | `test_rag_real`                  |
| C Multi-agent         | `supervisor 3 agents parallel→merge→eval→result`                             | `test_multi_agent` + `Send`      |
| D Tool+approval       | `tool→waiting_approval→ApprovalWorkflow signal→tool→result`                  | `test_approval_workflow`         |
| E Failure recovery    | `worker killed→Temporal retry→remaining worker→completed`                    | `docker kill + test_chaos`       |
| F Workspace attack    | `User A→B 404→no graph`                                                      | `tenant_isolation`               |
| G Prompt injection    | `malicious doc→RAG provenance→ignored`                                       | `redteam`                        |
| H Personalization     | `Req1 concise→Req2 uses preference`                                          | `closed-loop`                    |

### PHASE 19 — Regression (§32)

```bash
git status --short; git rev-parse HEAD
grep -R "from langgraph\|import langgraph\|StateGraph\|MemorySaver\|ainvoke" apps/api/src/api/temporal/workflows.py → 0
uv run --project apps/api python -m pytest apps/api/tests/graph -q          # 43 + new (~60)
uv run --project apps/api python -m pytest apps/api/tests/temporal -q       # 40 + new
uv run --project apps/api python -m pytest apps/api/tests -q -o addopts=""  # 2731 serial ~8-10min (xdist hang known)
uv run --project apps/api python -m api.temporal.worker --dry-run            # 11 activities
pnpm --filter web typecheck   # 0
pnpm --filter web test        # 34 jest + new
mprow --filter web lint; uvx ruff check apps/api/src/api/graph; uvx mypy apps/api/src/api/graph
docker compose --profile temporal ps
docker exec vaeloom-redis redis-cli ping          # PONG
docker exec vaeloom-postgres psql -c "select extname from pg_extension where extname='vector'"
kubectl kustomize infra/kubernetes/overlays/staging | grep LANGGRAPH
```

Never delete tests — obsolete replaced with stronger coverage note.

### PHASE 20 — Documentation + Mermaid (§35-37)

Update `docs/temporal/langgraph/`,
`docs/architecture/{System-Design,High-Level-Design,C4,Event-Flow,Data-Flow,03-adrs}`,
`docs/agents/`, `docs/memory/`, `docs/rag/`, `docs/tools/`, `docs/connectors/`
to match code (no planned-as-implemented).

13 Mermaid diagrams (verified `fix_mermaid.py` + `fix_encoding.py`):

1. System `API→Temporal→graph 10→Policy→Tools→DB`
2. Temporal↔LangGraph boundary
3. Topology `stateDiagram-v2 10 nodes`
4. Supervisor DAG layers
5. Memory `extract→validate→dedupe→resolve→persist→retrieve`
6. RAG `document→chunk→embedding→pgvector→filter→rerank→context`
7. Tool pipeline `decision→policy→quota→idempotency→execute→audit`
8. Approval `signal→wait_condition 3600s→execute_approved_action→resume`
9. Multi-agent `A,B,C→merge`
10. Failure `kill→retry→remaining`
11. Security boundary `workspace/secret/approval`
12. Data flow `refs not bodies`
13. Frontend `polling 3s + SSE + stepper states`

Audit ADR-039 + audit report so `LG NOT READY` history preserved not deleted.

### PHASE 21 — Enterprise Closure Gate (§39-46)

**LG-01..20** table per §39 + scorecard §42:

| Gate  | Name            | Pass condition                                                   |
| ----- | --------------- | ---------------------------------------------------------------- |
| LG-01 | Architecture    | seam 0 imports + `LANGGRAPH_ENABLED=false` safe                  |
| LG-02 | Agent Execution | 22 agents executable (10 MVP live), `RoutingDecision` valid      |
| LG-03 | Supervisor      | bounded `Send` multi-agent proven                                |
| LG-04 | Routing         | 9 cases, no invalid/unauth/unavailable agent                     |
| LG-05 | Memory          | Req1→Req2 concise proof + isolation                              |
| LG-06 | KG              | traverse/bounds/provenance                                       |
| LG-07 | RAG             | pgvector `42` proof + 7 statuses                                 |
| LG-08 | Tools           | 40 pipeline quota/idempotency/audit                              |
| LG-09 | Connectors      | boundary per-connector, `STATIC` marking where cred absent       |
| LG-10 | Approval        | 10 paths, no bypass, durable wait 3600s                          |
| LG-11 | Security        | 14 attacks fail-closed                                           |
| LG-12 | Durability      | Temporal authority, no graph durability move                     |
| LG-13 | Recovery        | worker/temporal/redis/pg chaos no loss/no dup                    |
| LG-14 | Idempotency     | no duplicate `WRITE` across retries                              |
| LG-15 | Evaluation      | `EvaluationResult` bounded replan proven                         |
| LG-16 | Observability   | bounded metrics + `PARTIAL` trace gap documented if not feasible |
| LG-17 | Performance     | 5-100VU breakdown, overhead understood bounded                   |
| LG-18 | Frontend        | stepper live, polling+SSE, cancel, a11y                          |
| LG-19 | Rollback        | `false` toggle no corruption                                     |
| LG-20 | Enterprise E2E  | 8 journeys all green                                             |

**Reality classification** per §38
(`IMPLEMENTED|TEST VERIFIED|WorkflowEnvironment VERIFIED|REAL RUNTIME VERIFIED|…`)
never upgrading `code→runtime` without `workflow_id/run_id/worker`.

Evidence per gate `Command/Input/Expected/Actual/Status/Evidence/Runtime` +
workflow `workflow_id/run_id/type/queue/status/worker/result` (no secrets).

---

## 5. No Mock Hiding Policy (§34 Gate)

`grep -R "mock\|stub\|fake\|fallback\|TODO\|FIXME\|pass$" apps/api/src/api/graph apps/api/src/api/temporal`
— every hit classified:

| Pattern                                                                                  | Current hits | Classification → Action                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `PYTEST_CURRENT_TEST → mock stub` `nodes.py:230,342`                                     | 2            | legitimate local fallback — keep but exclude from `production` claims + label closure `LOCAL ONLY`                     |
| `_mock_extract react→Skill` `extraction.py:58`                                           | 1            | legitimate test fallback — keep, add `BYOK` proof for `LOCAL→PROD`                                                     |
| `vec_fallback` `retrieval.py:164`                                                        | 1            | legitimate SQLite — keep, add `pgvector` proof for `REAL RUNTIME`                                                      |
| `mock_*` `executor.py 40`                                                                | 40           | production fallback — each `executor` path already guarded `if connector is None→mock` + `STATIC NOT VERIFIED` marking |
| `return {"mock":True,"note":"PYTEST mock — tool not executed (offline)"}` `nodes.py:348` | 1            | legitimate offline — after `unknown tool` check already fails closed                                                   |

**Critical rejects (must never appear):** `tool fail→pretend success`,
`RAG fail→fabricated context`, `LLM fail→fabricated answer`,
`connector fail→completed`, `approval fail→execute anyway` — all fail closed to
`waiting_approval|failed`.

---

## 6. Required Tradeoff Decisions (USER INPUT NEEDED — does not block PHASE 0-1)

| ID   | Decision                                  | Option A (recommended)                                                                 | Option B                                                       | Default if no answer                       |
| ---- | ----------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| D-01 | ReAct `AGENT_REACT_ENABLED`               | `true` in `temporal` profile only (deterministic fallback still safe when key missing) | keep `false` globally + prove stub only                        | **A** after `test_agent_dispatch` green    |
| D-02 | Supervisor LLM `SUPERVISOR_LLM_PLANNER`   | `true` only when `llm_api_key` present (1 LLM call per multi-agent, validated)         | heuristic only                                                 | **A** (heuristic fallback automatic)       |
| D-03 | Checkpoint `langgraph_checkpoint_backend` | keep `memory` v1 (disclosed `F-LG-03`) + Temporal retry-from-beginning                 | add `AsyncPostgresSaver` migration + `interrupt_before`        | **memory v1**, postgres in follow-up issue |
| D-04 | Vector proof                              | seed 3 docs + real embedding when `postgres+vector` available else `CONDITIONAL PASS`  | require postgres in CI (adds `services: postgres:16-pgvector`) | **seed + conditional**                     |
| D-05 | Frontend trigger                          | retrofit `ChatWindow.tsx` to `temporalApi.startDurableAgent` transparently             | new `POST /temporal/workflows/durable-agent` button            | **retrofit**                               |
| D-06 | k6 `100 VUs`                              | cap `50 VUs` (4-5GB, local safe) document limit                                        | require 32GB runner                                            | **50 VUs**                                 |

---

## 7. Risks & Mitigations

| Risk                                                                                   | Impact                           | Mitigation                                                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `graph_retry=0` + `MemorySaver` lose interrupt state on crash while `waiting_approval` | pending tool never resumes       | `ApprovalWorkflow` is truth — graph finalizes with `pending` + workflow `expired` after 3600s, not lost |
| `PYTEST_CURRENT_TEST` mocks hide LLM latency overhead                                  | `F-LG-02` understated            | measure `k6` with real `mock_llm` disabled + label `LOCAL ONLY` vs `PRODUCTION`                         |
| `quota.py:104` fallback `INCRBY` race overshoots 1                                     | burst 20 concurrent exceeds 1000 | document `−1` tolerance, migrate to Lua-only path next quarter                                          |
| `StateGraph` serialization blowup 20KB across 10 nodes                                 | `finalize` trunc loop thrash     | keep 8KB task + 4KB per tool + 8KB rag already bounded; monitor `graph_state bytes` metric              |
| Frontend `setInterval 3s` per doc `syncMap` identity                                   | interval leak                    | stabilize `syncMap` via `useRef` + `useDeepCompare`                                                     |

---

## 8. Verification Commands (§40 — run at gate)

```bash
git status --short
git rev-parse HEAD
grep -R "from langgraph\|import langgraph\|StateGraph\|MemorySaver\|ainvoke" apps/api/src/api/temporal/workflows.py  # expect 0
uv run --project apps/api python -m pytest apps/api/tests/graph -q
uv run --project apps/api python -m pytest apps/api/tests/temporal -q
uv run --project apps/api python -m pytest apps/api/tests -q -o addopts=""  # serial 8-10min if xdist hang
uv run --project apps/api python -m api.temporal.worker --dry-run
pnpm --filter web typecheck
pnpm --filter web test
docker compose --profile temporal ps
docker exec vaeloom-temporal docker exec vaeloom-temporal tctl namespace list 2>/dev/null || docker exec vaeloom-temporal temporal operator namespace list
docker exec vaeloom-temporal-worker-1 ps aux 2>/dev/null; docker exec vaeloom-temporal-worker-2 ps aux 2>/dev/null 2>&1 | head
docker exec vaeloom-redis redis-cli ping
docker exec vaeloom-postgres psql -U postgres -c "select extname from pg_extension where extname='vector'"
kubectl kustomize infra/kubernetes/overlays/staging 2>/dev/null | grep -n LANGGRAPH || echo "no k8s overlay"
k6 run --vus 10 --duration 30s testing/k6-langgraph.js  # if k6 available
k6 run --vus 50 --duration 30s testing/k6-langgraph.js
```

Plus real-journey `workflow_id/run_id` captures via `temporalApi.getStatus`.

---

## 9. Final Report Skeleton (§45 — 40 sections)

`docs/temporal/langgraph-deep-implementation-closure-2026-08-29.md` (or
`docs/temporal/langgraph-deep-implementation-closure-YYYY-MM-DD.md`):

1 Executive Summary 2 Baseline 3 Repository Forensics 4 Actual Architecture 5
Agent Registry 6 Routing 7 Supervisor 8 Multi-Agent 9 Handoff 10 State 11 Memory
12 Knowledge Graph 13 RAG 14 Tools 15 Connectors 16 Approval 17 Prompt Injection
18 Security 19 Quota 20 Idempotency 21 Retry 22 Timeout 23 Checkpointing 24
Evaluation 25 Observability 26 Tracing 27 Frontend 28 Chaos 29 Performance 30
Test Matrix 31 Real Runtime Evidence 32 Findings 33 Rollback 34 Documentation 35
Mermaid Architecture 36 Enterprise Gates 37 Final Scorecard 38 Remaining Work 39
Risk Classification 40 Final Decision

**Final Decision** per §46 one of
`LANGGRAPH DEEP IMPLEMENTATION CLOSED | LANGGRAPH PRODUCTION READY — NON-BLOCKING FINDINGS | LANGGRAPH CONDITIONAL PASS | LANGGRAPH NOT READY`.

**Q1-14** (§44) answered honestly with evidence — today: Q1 NO (12/22 not
graph-executed) / Q2 NO (dag stored not Send) / Q3 NO (ingest only) / Q4 NO
(fallback) / Q5 PARTIAL / Q6 NO / Q7 YES / Q8 NO / Q9 NO / Q10 PARTIAL (no tool
key) / Q11 NO (stub when key empty) / Q12 YES / Q13 NO / Q14
mocked/local/partial list above.

---

## 10. Execution Order & Ownership (§48)

```
PHASE 0 Forensic (this plan) → PHASE 1 Matrix → PHASE 2 Registry → PHASE 3 Routing → PHASE 4 Supervisor DAG → PHASE 5 Multi-agent+handoff → PHASE 6 Memory loop → PHASE 7 KG → PHASE 8 RAG → PHASE 9 Tools+connectors → PHASE 10 Approval → PHASE 11 LLM → PHASE 12 Eval → PHASE 13 Red-team → PHASE 14 Chaos → PHASE 15 Frontend → PHASE 16 Observability → PHASE 17 Performance → PHASE 18 E2E → PHASE 19 Regression → PHASE 20 Docs+Mermaid → PHASE 21 Gate
[AUDIT→IMPLEMENT→TEST→REAL RUNTIME VERIFY→REGRESSION→DOCUMENT] per phase, never accumulate unverified changes
```

**MOST IMPORTANT (§49):** Protect Temporal closure — do not rewrite
`workflows.py`, move durability into graph, replace `ApprovalWorkflow`, remove
`validate_no_secrets`/`workspace binding`/`quota`/`idempotency`, hide mocks,
raise thresholds, delete failing tests, or claim `runtime` without
`workflow_id/run_id` evidence. Build missing autonomous depth **on top of** the
verified `78c2d71` foundation.

---

## 11. Next Steps (on USER approval)

1. Approve plan (or adjust D-01..D-06 above).
2. Create `docs/phases/langgraph-deep/` scaffold +
   `scripts/audit/langgraph_matrix.py`.
3. Begin PHASE 2 `agent_definitions.py` + `graph/nodes.py agent_node` real
   dispatch + `tests/graph/test_agent_registry.py` (first implementable slice).
4. Iterate phases 3-21 with per-phase evidence PR.

_Prepared 2026-08-29 — forensics at `apps/api/src/api/graph/__init__.py:55`,
`temporal/worker.py:72`, `orchestrator/router.py:58`, `tools/executor.py:98`,
`docs/adr/ADR-039`,
`docs/temporal/langgraph-production-hardening-2026-08-28.md`,
`apps/web/src/components/chat/ChatWindow.tsx:341`._
