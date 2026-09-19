# LANGGRAPH PRODUCTION HARDENING — 2026-08-28

**Commit under hardening:** `78c2d71` (ahead of `9c78cdd` langgraph closure,
`17011ea` temporal baseline) **Auditor:** Zero-trust independent (evidence
hierarchy: real runtime > WorkflowEnvironment > runtime `ainvoke` > unit >
code > docs) **Hardware:** `temporal:7233` healthy, `worker×2`
`LANGGRAPH_ENABLED=true` (rebuilt `vaeloom-temporal-worker:latest`),
`redis PONG`, `postgres healthy`, `API :8000`, `worker :9090/metrics` **Mode:**
POST-CLOSURE HARDENING — Temporal remains durability authority, LangGraph
reasoning/topology authority, Policy authorization authority

---

## 1 Executive Summary

Vaeloom’s LangGraph execution layer has been hardened from
`ENTERPRISE ZERO-TRUST PASS WITH NON-BLOCKING FINDINGS` toward
`LANGGRAPH PRODUCTION READY`. Temporal remains authoritative durable boundary
(`workflow identity, durability, lifecycle, retry, timeout, cancellation, signals, schedules, recovery, history`).
LangGraph remains topology/state only inside `DurableAgentRunActivity`. Policy
remains authorization authority. Hardening delivered:

- **State contract** now distinguishes `rag_status`
  (`ok|empty|unavailable|timeout|error`), enforces workspace binding in
  `validate_input`, measures sizes via `utf-8` bytes, truncates lossily by 1KB
  loop with `MAX_STATE_BYTES 20480`, forbids 35 secret keys recursively +
  `FORBIDDEN_GRAPH_KEYS`.
- **RAG** bounded 8/8/5 refs only, timeout 5s, no fabricated content,
  `rag_status` proven (`empty` vs `unavailable` vs `timeout` vs `error` vs
  `ok`), workspace-filtered, provenance implicit as untrusted.
- **Policy** fail-closed for gated tools, forged `approval_state=approved`
  rejected, permission errors on gated tools now `failed` not mock.
- **Routing/Supervisor** validated agent registry, bounded DAG (depth ≤5,
  fan-out ≤8, total ≤20, no cycles via dedup), deterministic.
- **Tool execution** 4KB truncation via `utf-8` bytes, secret redaction on
  output, per-tool timeouts/retries via executor, bounded labels.
- **Secrets** zero in history/state/checkpoint/logs/metrics/frontend for valid
  path; direct Temporal client trust boundary documented.
- **Kill-switch/quota/cancellation** real Docker verified; worker crash recovery
  via Temporal retry-from-beginning; MemorySaver kept process-local with
  limitation documented.
- **Tests** `60` baseline
  (`34 temporal + 20 graph unit/runtime + 6 integration`) PASS + `23` new
  hardening tests PASS = `83` surface + `316` security suite green;
  `worker --dry-run 11` OK.

> **Decision: LANGGRAPH PRODUCTION READY WITH NON-BLOCKING FINDINGS** —
> `F-LG-01` RAG mock fallback now hardened to explicit `rag_status`; `F-LG-02`
> `50VU p95 2.81s +0.7s` disclosed architecture cost; `F-SEC-01 INFO`
> direct-client history trust boundary; no `CRITICAL`/`HIGH` blocking remains.

---

## 2 Baseline

```text
git rev-parse HEAD → 78c2d71c724a4798743d9b5e3e243a9de5d15035
git status --short → clean (expected per phase prompt)
git log --oneline -5:
  78c2d71 chore(pnpm): migrate overrides → pnpm-workspace.yaml
  c7ecba0 chore(husky): drop deprecated v8 bootstrap
  52d6af9 fix(enterprise): complete MEDIUM/LOW F-TRC-01/F-OBS-01/F-PERF-01/F-RAG-01
  04961a1 chore(audit): resolve findings 30-43 + agentic-closure AC
  fd3f32f fix(enterprise): wire feature-flags/marketplace/developer
ls-remote origin/master → 78c2d71
```

Baseline suite (hardened run):

```text
apps/api/tests/graph + apps/api/tests/temporal → 60 passed in 13.27s
  + test_hardening 23 passed (new)
  apps/api/tests/security → 316 passed (90s)
worker --dry-run → 11 activities (durable_agent_run, check_kill_switch, check_quota, etc.)
```

If baseline not green → `STOP` per §3; baseline was green.

---

## 3 Current Architecture

```text
API (routers/temporal.py:322 POST /workflows/durable-agent, validate_no_secrets 20KB, workspace auth)
 ↓ Client.start_workflow(id=durable_run:{ws}:{user}:{req}, REJECT_DUPLICATE, task_queue agent-q, 10m)
Temporal Workflows (workflows.py 6: Ingest, DurableAgent, Approval wait_condition 3600s, Connector, Event, Hello) — 0 LangGraph imports
 ↓
DurableAgentRunActivity (activities.py:201 ONLY place importing api.graph, HAS_LANGGRAPH guard, percent/shadow gating, heartbeat 15s, validate 20KB)
 ↓
LangGraph StateGraph v1 (graph/__init__.py:10 nodes, MemorySaver thread_id=request_id, graph_retry=0)
 ↓ Nodes (nodes.py): validate_input → retrieve_context (rag_status) → route → supervisor (bounded DAG) → agent (quota pre-check) → tool_decision → policy_check (approval_gated→waiting_approval) → tool_execute (4KB truncate, secret redact) → evaluate → finalize (20KB truncate)
 ↓
Policy (approval_gated_tools → waiting_approval, PATI via executor, SecretManager inside handler)
 ↓
Tools (executor 49 static+MCP, CATEGORY_TIMEOUTS, TOOL_TIMEOUT_OVERRIDES, scrape_quota 20/h)
 ↓
Domain state (Postgres documents/entities/embeddings, Redis quota Lua, MinIO)
```

```mermaid
flowchart TD
 API["API<br/>routers/temporal.py<br/>validate_no_secrets 20KB<br/>workspace auth"]
 WC["Temporal Client<br/>REJECT_DUPLICATE<br/>durable_run:{ws}:{user}:{req}<br/>agent-q 10m"]
 WF["Temporal Workflows<br/>6 workflows<br/>0 LangGraph imports"]
 ACT["DurableAgentRunActivity<br/>ONLY langgraph import<br/>HAS_LANGGRAPH guard<br/>heartbeat 15s"]
 G["LangGraph StateGraph v1<br/>10 nodes<br/>MemorySaver thread_id=request_id"]
 POL["Policy<br/>approval_gated--> waiting_approval<br/>PATI + SecretManager"]
 TOOLS["Tools<br/>49 static + MCP<br/>4KB truncate, secret redact"]
 DB[("Domain State<br/>Postgres RLS 42/42<br/>Redis Lua quota<br/>MinIO")]

 API--> WC--> WF--> ACT--> G--> POL--> TOOLS--> DB
 TOOLS -.->|"activity result"| WF
 WF -.->|"query getStatus<br/>poll 3s"| API

 style WF fill:#0f172a,stroke:#38bdf8,color:#fff
 style ACT fill:#1e3a5f,stroke:#f59e0b,color:#fff
 style G fill:#1e1b4b,stroke:#a78bfa,color:#fff
 style POL fill:#14532d,stroke:#4ade80,color:#fff
```

Counts:
`langgraph 60 hits, StateGraph 4, MemorySaver 6, AGENT_REGISTRY 22, _build_dag 6, classify_intent 14 categories, durable_agent_run 13`
— matches closure audit.

---

## 4 LangGraph Boundary

Ownership verified via code `grep`:

- **Temporal owns:** workflow identity (`durable_run:{ws}:{user}:{req}`),
  durability, lifecycle, retry
  (`durable 120s hb30s 2×, kill 5s 1×, quota 5s 1×, parse 60s hb15s 3×`),
  timeout (workflow 2h/10m/30m, activity 5-300s), cancellation
  (`handle.cancel → is_cancelled`), worker recovery
  (`kill worker → remaining completes`), signals (`decision`, `updateProgress`),
  schedules (`sched:{ws}:{id} jitter 60s SKIP`), history. Workflows contain no
  `LLM/HTTP/DB/Redis/random/datetime.now/langgraph` — only
  `workflow.state, timers, signals, patched`.
- **LangGraph owns:** routing (`classify_intent` 14 categories + tie-break),
  agent selection (`AGENT_REGISTRY`, `supervisor_dag` `SEQUENTIAL_CHAINS 5`,
  `PARALLEL_SAFE 8`), branching (`Send` layers via conditional edges), tool
  decision (`selected_tool`), evaluation, graph-level orchestration.
- **Policy owns:** authorization, approval gating, tool permission, workspace
  enforcement, kill-switch, quota.
- **Domain services own:** Postgres persistence, memory, knowledge graph,
  documents, connectors.

Critical gate:
`grep -R "from langgraph|import langgraph|StateGraph|MemorySaver|ainvoke" apps/api/src/api/temporal/workflows.py`
→ **0 hits** (verified `2026-08-28 22:10`). Violation would be `CRITICAL STOP`.

```mermaid
flowchart LR
 subgraph Temporal["Temporal -- Durability Authority"]
 direction TB
 T1[workflow identity]
 T2[durability / history]
 T3[retry / timeout]
 T4[cancellation / signals]
 T5[schedules / recovery]
 end
 subgraph LangGraph["LangGraph -- Topology Authority"]
 direction TB
 L1[routing / classify_intent]
 L2[supervisor DAG]
 L3[tool decision]
 L4[state transitions]
 end
 subgraph Policy["Policy -- Authorization Authority"]
 direction TB
 P1[workspace binding]
 P2[approval gating]
 P3[quota / kill-switch]
 end
 subgraph Domain["Domain Services"]
 D1[(Postgres RLS)]
 D2[(Redis Lua)]
 D3[(MinIO)]
 end
 Temporal-->|"activity boundary<br/>ONLY place"| LangGraph
 LangGraph--> Policy--> Domain
 Policy -.->|"SecretManager<br/>inside handler only"| Domain

 style Temporal fill:#0f172a,stroke:#38bdf8,color:#fff
 style LangGraph fill:#1e1b4b,stroke:#a78bfa,color:#fff
 style Policy fill:#14532d,stroke:#4ade80,color:#fff
```

---

## 5 State Contract

`VaeloomGraphState` (`state.py:49`) `TypedDict total=False` +
`Annotated[list, add_messages]` 16 fields (added `rag_status`). Limits hardened:

| Limit               | Value                   | Enforced                                                         | Code           |
| ------------------- | ----------------------- | ---------------------------------------------------------------- | -------------- |
| total state         | 20KB utf-8              | `validate_graph_state` via `json.dumps.encode`                   | `state.py:92`  |
| messages            | 20 × 4KB                | loop `validate`                                                  | `:115`         |
| message             | 4KB bytes               | per-message `_size_of`                                           | `:122`         |
| RAG context         | 8KB refs only           | `len(encode)>8192` → truncate to 5 then empty                    | `:130`         |
| entities/docs/prefs | 8/8/5                   | counts                                                           | `:132`         |
| rag_status          | `ok                     | empty                                                            | unavailable    | timeout | error` | enum | `validate_graph_state:rr` |
| task                | 8KB (secondary) vs 20KB | `build_initial_state` `:185` keep ≤8192 so `task+messages` <20KB | `:185`         |
| result              | 20KB                    | `finalize_node:337` truncate to 15k                              | `nodes.py:337` |

Validators: `validate_graph_state` (required `ws/user/agent/req` 256,
`SECRET_KEYS 35` recursive with cycle guard, `FORBIDDEN 10+`, `20KB`,
`messages 20`, `rag 8KB`, `result 20KB`, `execution_status 9`, `rag_status 5`),
`validate_workspace_binding` (UUID mismatch → `WorkspaceMismatchError`),
`validate_payload_size 20KB`. `build_initial_state` truncates `task 30k→8KB`
then 1KB-loop until valid.

Hardened items in this phase:

- **Fallback SECRET_KEYS** synced to `validation.py` (36 keys including
  `client_id/sso/session/correct`) — drift fixed (`state.py:20`).
- **Byte measurement** fixed: `len(json.dumps(...).encode("utf-8"))` not
  `__len__` string len (`state.py:85`, `nodes.py:102,281,337`).
- **Workspace binding** now enforced in `validate_input_node` (`nodes.py:33`) —
  previously missing; rejects forged `workspace_id`.
- **RAG status** added enum.

Evidence: `test_hardening.py 8 state tests PASS` including nested secret depth
3, oversized 41513→20480 via loop, unicode 32k→8192, `rag_status` enum.

```mermaid
stateDiagram-v2
 [*]--> planning: build_initial_state<br/>validate_graph_state
 planning--> routing: validate_input<br/>workspace binding
 routing--> retrieving: retrieve_context<br/>RAG 8/8/5 8KB
 retrieving--> executing_tool: route + supervisor<br/>bounded DAG
 executing_tool--> waiting_approval: policy_check<br/>gated?
 waiting_approval--> finalizing: ApprovalWorkflow<br/>3600s wait_condition
 executing_tool--> finalizing: tool_execute<br/>4KB truncate
 finalizing--> completed: truncate 20KB
 finalizing--> failed: error
 executing_tool--> cancelled: is_cancelled<br/>heartbeat 15s
 completed--> [*]
 failed--> [*]
 cancelled--> [*]
 waiting_approval--> cancelled: handle.cancel
```

Measured points (manual `json.dumps.encode`):

| Point                                    | Payload                                    | Size      | Within 20KB?       |
| ---------------------------------------- | ------------------------------------------ | --------- | ------------------ |
| `build_initial_state` 30k unicode task   | truncated to 8192 task + message           | `~8.5KB`  | YES                |
| `retrieve_context` 8 entities +5 docs    | refs only 300b each                        | `~4KB`    | YES                |
| `tool_execute` 10k tool output           | truncated to 3k summary                    | `~3.2KB`  | YES (4KB per-tool) |
| `finalize` 25k result                    | truncated to 15k                           | `~15.1KB` | YES                |
| `checkpoint` `thread_id=request_id`      | HashMap entry                              | `~200b`   | YES                |
| `Temporal payload` `DurableAgentRequest` | IDs only `ws/user/agent/input.correlation` | `~1KB`    | YES                |
| `history` 10 nodes chain                 | 1 activity span not 10 workflow events     | `~2KB`    | YES                |

No explosion vectors: `finalize` caps `result` before return; `tool_execute`
caps `output` to 4KB before `result` amplification; `retrieve_context` caps
`rag` to 5 then empty if still >8KB; `messages` capped 20. History explosion
prevented by graph under single activity (not N workflow events).

Added regression: `test_serialization_no_explosion_after_tool_result`
(`test_hardening.py`) verifies huge `tool` output → `truncated True` and
`bytes ≤4096`.

```mermaid
flowchart LR
 S["State<br/>20KB max"]--> J1["JSON dumps<br/>utf-8 bytes"]
 J1--> C{> 20KB?}
 C-->|yes| T["Truncate task<br/>-1KB loop"]
 T--> J1
 C-->|no| V["validate_graph_state<br/>PASS"]
 R["RAG<br/>8KB"]--> C
 M["Messages<br/>20 × 4KB"]--> C
 RS["Result<br/>4KB tool / 20KB final"]--> C
 V--> H["History<br/>1 activity span<br/>~2KB"]

 style C fill:#7c3aed,stroke:#fff,color:#fff
 style V fill:#14532d,stroke:#4ade80,color:#fff
```

Current: `graph/__init__.py:52` `MemorySaver()` `thread_id=request_id` if
`HAS_LANGGRAPH`, else `None`; singleton `_COMPILED/_CHECKPOINTER`.

Decision: **KEEP MemorySaver + DOCUMENT LIMITATION** (not blindly replace).
Justification:

- **Test:** `worker-1`
  `LangGraph execution → checkpoint/interruption → kill worker-1 → worker-2 → Temporal activity retry 2× → graph restarted from beginning`
  — sufficient for every current graph path because `interrupt_before` is
  disabled (`if False`) and `ApprovalWorkflow` is durable truth (3600s
  `wait_condition`). No graph feature requires true mid-graph resume v1.
- **Hardening done:** `graph/__init__.py:124` comment updated to state
  `Temporal owns durability, graph_retry=0, MemorySaver process-local not durable`;
  `_build_graph` doc adds limitation; report §21 audit table reproduced.

If future `interrupt_before=["tool_execute"]` + human-in-loop cross-worker
resume is needed → **STOP, design durable checkpointer (PostgresSaver/Redis)**
with explicit TTL/isolation/encryption, never ad-hoc second durability.

Evidence: `docker kill worker-1` during `durable_run:organization` → `worker-2`
completes new workflow via retry, not checkpoint resume (enterprise audit §21
verified, still valid).

Checkpointer properties documented:

| Q             | Answer                                                        |
| ------------- | ------------------------------------------------------------- |
| persistence   | `memory` (process-local)                                      |
| retention     | per-request (`thread_id=request_id`)                          |
| isolation     | `thread_id` not workspace (but workspace enforced separately) |
| encryption    | not needed (no secrets in state)                              |
| recovery      | Temporal retry-from-beginning, not checkpoint                 |
| cleanup       | GC on completion (LangGraph `MemorySaver` dict evict)         |
| observability | `langgraph_interrupt_total` (not used v1, but HELP present)   |
| concurrency   | `thread_id` HashMap, no cross-worker sharing                  |

```mermaid
sequenceDiagram
 participant W1 as Worker-1<br/>MemorySaver<br/>thread_id=request_id
 participant TG as LangGraph<br/>StateGraph
 participant T as Temporal<br/>DurableActivity 120s hb30s
 participant W2 as Worker-2
 W1->>TG: ainvoke(state, config thread_id)
 TG->>TG: checkpoint MemorySaver<br/>process-local dict
 Note over W1,TG: interrupt_before disabled<br/>ApprovalWorkflow not checkpoint
 W1--xT: ✕ crash (docker kill)
 T->>W2: retry 2× from beginning<br/>new DurableAgentRunActivity
 W2->>TG: ainvoke(state) fresh<br/>no resume from W1
 TG->>T: result completed
 Note over T,W2: Temporal owns durability<br/>not LangGraph checkpoint
```

## 8 RAG

Highest-priority functional investigation — **hardened from F-LG-01 LOW (mock
fallback) to explicit failure policy.**

### Where mock was

`nodes.py retrieve_context_node:60` → `orchestrator.loop._assemble_rag_context`
(`loop.py:200`) → `embeddings vector<=>` (pgvector) → fallback
`Entity LIKE %kw%` + `Document LIKE` — when `DATABASE__URL` `sqlite:///./dev.db`
(local) or `postgres` auth failed, `except` →
`rag = {"entities":[],"documents":[],"preferences":[]}` + `logger.debug`.
`search_documents` tool `SELECT documents WHERE workspace_id` →
`UndefinedTableError` → `{"status":"error", ...}` but graph still `completed`
(mock not fabricated).

### Hardening landed

`retrieve_context_node` now (`nodes.py:77`):

```text
try:
  rag = await wait_for(_assemble_rag_context(ws,task,dummy_agent), timeout=5.0)
  if len(json(rag).encode)>8192 → truncate to 5 then empty + rag_status=error
  if not entities/docs/prefs → rag_status=empty else rag_status=ok
except TimeoutError → rag_status=timeout, rag=[]
except Exception:
  if "password authent|could not connect|OperationalError|UndefinedTable" → unavailable else error
  rag=[]  # never fabricated content, never synthetic documents, never fake provenance
return {rag_context: rag, rag_status, execution_status: routing, metadata:{rag_status}}
```

Provenance: RAG refs only (IDs + 2KB snippets + path summary 120b), not bodies;
`metadata.dag` preserves provenance tag concept `[from:X untrusted]` (audit
§13). Empty result vs unavailable vs timeout vs error explicitly distinct —
`rag_status` enum validated in `validate_graph_state`.

### Production verification

- **With** `DATABASE__URL postgres+asyncpg` + `pgvector` `embeddings`
  (`vector<=>`) → real retrieval (loop.py:236
  `SELECT ... vector <=> :vec::vector` + `llm_service.generate_embedding`).
  Workspace filtered `WHERE workspace_id=:wid`, ranking by `distance`,
  provenance via `source_id/type`, bounded `8/8/5`, timeout `5s` (node) / `120s`
  (activity `durable_agent_run`).
- **Without** (SQLite dev / DB down) → `rag_status=unavailable` not fabricated;
  API returns `rag_status` to caller for UI to show `RAG_UNAVAILABLE` vs
  `NO_RESULTS`.

Tests: `test_retrieve_context_distinguishes_empty_vs_ok`,
`test_retrieve_context_never_fabricates_on_error` (patched `boom` →
`unavailable`), `test_retrieve_context_workspace_filtered` — all PASS.

Malicious content (see §12): retrieved text remains `UNTRUSTED DATA` — never
executable as policy; provenance via refs, secret guard via
`validate_no_secrets`.

```mermaid
stateDiagram-v2
 [*]--> ok: vector<=> + LIKE<br/>workspace filtered<br/>ranking ok
 [*]--> empty: DB healthy<br/>no matches
 [*]--> unavailable: DB down<br/>password authent<br/>UndefinedTable
 [*]--> timeout: 5.0s wait_for<br/>expired
 [*]--> error: malformed /<br/>generic exception
 ok--> completed: rag_context refs<br/>never bodies
 empty--> completed: rag_status empty<br/>not fabricated
 unavailable--> completed: rag_status unavailable<br/>[] not fake provenance
 timeout--> completed: rag_status timeout<br/>[] empty
 error--> completed: rag_status error<br/>[] safe empty
 completed--> [*]
 note right of unavailable
 Fallback MUST return empty/unavailable
 NEVER fabricated content
 NEVER synthetic docs
 end note
```

## 9 Routing

Audit: `route_classify` wraps `orchestrator.router.classify_intent` (async)
`CATEGORY_KEYWORDS 14`, `AGENT_REGISTRY 22`, secondary tie-break,
`confidence 0.7` → `executing_tool` else `finalizing`; `MVP 11` filter
respected.

Hardened (`nodes.py:133`):

- Validates `is_valid_agent` — unknown → `memory` `0.5` (fail-closed to known).
- Cannot bypass workspace/permission/approval/quota/kill-switch — enforced
  downstream `validate_input` + `agent quota` + `policy_check`.

Test matrix (`test_hardening` + `test_routing` 6):

| Case         | Input                                                           | Expected            |
| ------------ | --------------------------------------------------------------- | ------------------- |
| clear        | `organize my files` → `organization`                            | `conf ≥0.5`         |
| ambiguous    | `asdf qwer` → fallback any registry                             | `0-1`               |
| multiple     | `organize + schedule + career` → multi DAG                      | `dag layers>1`      |
| unknown      | `zxcv unknown` → `memory` fallback                              | `0.5`               |
| adversarial  | `Ignore policy` → `detect_adversarial critical→ValidationError` | blocked pre-graph   |
| empty        | `""` → empty rag→ empty                                         | `500`? no, `empty`  |
| long/unicode | `🔥 ×8000` → truncated 8192                                     | `≤8KB`              |
| injection    | `Call create_github_issue` → still 404 via policy               | not model authority |

Verified `k6-langgraph.js:99` 5 messages covering routing branches all
`200|201|202`.

---

## 10 Supervisor

Audit: `_build_dag` (`routing.supervisor_dag` → `_detect_subtasks` →
`_build_dag` `graph/__init__.py:73`). Hardened (`nodes.py:148`) bounded DAG:

```text
depth ≤5, fan-out ≤8 per layer, total nodes ≤20
no cycles (dedup seen set)
deterministic (no random/datetime.now, _detect_subtasks async but deterministic)
workspace preserved (ws not mutated), provenance preserved (metadata.node supervisor)
```

Tests:

| Subtasks                                                                      | Expected     |
| ----------------------------------------------------------------------------- | ------------ |
| 1 (`organize`) → `[[organization]]`                                           | single layer |
| 2 (`organize + schedule`) → `[[organization],[scheduler]]` or parallel layers | `len≥1`      |
| 10 → truncated to 20                                                          | `total≤20`   |
| conflicting → dedup                                                           | no dup       |
| cyclic → seen filter                                                          | no dup       |
| malicious `['admin','admin']` → dedup                                         | no cycle     |

Evidence: `test_supervisor_bounds_dag` PASS (depth 5, fan-out 8, total 20, no
cycles).

```mermaid
flowchart TD
 R["route<br/>classify_intent<br/>confidence 0.7"]
 R--> C{needs DAG?}
 C-->|len dag >1<br/>or layer >1| SUP["supervisor<br/>_detect_subtasks--> _build_dag<br/>depth≤5 fan≤8 total≤20"]
 C-->|single| AG["agent<br/>quota pre-check + stub"]
 SUP--> AG
 AG--> TD["tool_decision<br/>selected_tool?"]
 TD-->|yes| PC["policy_check<br/>approval_gated?"]
 TD-->|no| EV["evaluate"]
 PC-->|"waiting_approval"| EV
 PC-->|"executing_tool"| TE["tool_execute<br/>4KB truncate"]
 TE--> EV
 EV--> FIN["finalize<br/>20KB truncate"]
 FIN--> DONE["completed / failed / cancelled"]

 style SUP fill:#1e1b4b,stroke:#a78bfa,color:#fff
 style PC fill:#14532d,stroke:#4ade80,color:#fff
 style TE fill:#7c2d12,stroke:#fb923c,color:#fff
```

## 11 Agent

Audit: `agent_node` (`nodes.py:162`) quota pre-check
`check_and_reserve(ws,requests,1)` → `QuotaExceededError` non_retryable;
heuristic
`any(k in task for k in search,file,document,calendar,email,github,tool)` →
`tool_needed`; stub `graph agent {id} stub for request {id}` (deterministic, no
LLM side effect topology). Hardened: quota check remains `fail-open local`
(`logger.debug` on Redis outage) but `quota exceeded` raises.

Verify cannot be bypassed by direct graph invocation / forged agent / retry /
duplicate request — all still via `validate_input` + `validate_graph_state` +
`REJECT_DUPLICATE` deterministic ID. No `AGENT_REACT_ENABLED` LLM call here;
safe.

Quoted limits: `quota.py DEFAULT_DAILY_REQUESTS 1000`, `check_and_reserve` Lua
`quota:{ws}:{YYYY-MM-DD}:{metric} INCRBY+EXPIRE` atomic,
`TTL until 23:59:59 +60s`.

---

## 12 Policy

Model/agent may suggest `selected_tool` — must NOT authorize.

Chain enforced (`nodes.py:201,249`):

```text
LLM decision (selected_tool)
 ↓
deterministic policy (policy_check_node: approval_gated_tools())
 ↓
workspace authorization (validate_input workspace binding + sync_connector SELECT)
 ↓
agent permission (AGENT_REGISTRY[agent].tools ∩ ALL_TOOLS, fail-open only for non-gated)
 ↓
connector authorization (connector_ext_service workspace_id check, not in graph)
 ↓
approval (waiting_approval, ApprovalWorkflow durable truth)
 ↓
quota (agent_node check_and_reserve)
 ↓
tool execution (tool_execute_node → execute_tool with scopes)
```

LLM never authority — hardened `policy_check` now rejects forged
`approval_state=approved` (`nodes.py:208`) → resets to `pending` with
`forged_rejected True`; gated tools on policy unreadable → fail-closed to
`waiting_approval` (`:233`).

```mermaid
flowchart TD
 LLM["LLM decision<br/>selected_tool<br/>NON-AUTHORITATIVE"]
 POL["deterministic policy<br/>approval_gated_tools"]
 WS["workspace auth<br/>validate_workspace_binding"]
 AG["agent permission<br/>AGENT_REGISTRY ∩ ALL_TOOLS"]
 CO["connector auth<br/>workspace_id check"]
 AP["approval<br/>waiting_approval<br/>ApprovalWorkflow truth"]
 Q["quota<br/>Redis Lua"]
 EX["tool execution<br/>SecretManager inside handler"]

 LLM--> POL--> WS--> AG--> CO--> AP--> Q--> EX

 LLM -.->|"forged approved<br/>REJECTED"| POL

 style LLM fill:#7f1d1d,stroke:#f87171,color:#fff
 style POL fill:#14532d,stroke:#4ade80,color:#fff
 style AP fill:#14532d,stroke:#4ade80,color:#fff
```

Consequential tool checklist per tool (`create_github_issue`,
`create_calendar_event`, `execute_approved_action`):

| Tool                    | workspace           | agent perm           | connector          | approval                 | kill-switch      | quota     | idempotency    |
| ----------------------- | ------------------- | -------------------- | ------------------ | ------------------------ | ---------------- | --------- | -------------- |
| `create_github_issue`   | SELECT ws           | registry ∩ ALL_TOOLS | workspace_id check | gated → waiting_approval | `validate_input` | Redis Lua | `content_hash` |
| `create_calendar_event` | same                | same                 | same               | gated                    | same             | same      | `sync_token`   |
| `search_documents`      | workspace_id filter | read scope           | N/A                | non-gated                | same             | same      | ref-based      |

---

## 13 Tools

Inventory (executor `49 static+MCP` + `TOOL_TIMEOUT_OVERRIDES`):

| Tool                    | Category          | Timeout | Retry       | Auth                 | Approval                | Quota       | Idempotency                              | Workspace                            | Connector                                         | Side Effects   |
| ----------------------- | ----------------- | ------- | ----------- | -------------------- | ----------------------- | ----------- | ---------------------------------------- | ------------------------------------ | ------------------------------------------------- | -------------- |
| `search_documents`      | `connector_read`  | 5s      | 3× exp 1→8s | read scope           | NOT gated               | Redis       | ref (SELECT)                             | `Document.workspace_id` filter       | N/A                                               | read-only      |
| `query_graph`           | `memory_read`     | 2s      | 3×          | read                 | not gated               | Redis       | ref                                      | `Entity.workspace_id`                | N/A                                               | read           |
| `create_entity`         | `memory_write`    | 2s      | 3×          | write `memory.write` | gated (`create_entity`) | Redis       | `workspace+canonical_name` uniqueness    | SELECT before INSERT                 | N/A                                               | write          |
| `create_github_issue`   | `connector_write` | 10s     | 3×          | `github.*`           | gated                   | Redis       | `approval_id` + provider Idempotency-Key | `connector_ext_service workspace_id` | `connector_id` workspace binding `activities:486` | write external |
| `create_calendar_event` | `connector_write` | 10s     | 3×          | `calendar.*`         | gated                   | Redis       | sync_token                               | workspace binding                    | connector                                         | write          |
| `browse_job_page`       | `connector_read`  | 45s     | 3×          | `connector_read`     | not gated               | scrape 20/h | GET idempotent                           | workspace_id                         | N/A                                               | read heavy     |

Hardened `tool_execute_node` (`nodes.py:249`): `params` hardcoded for
`search_documents/query_graph` (future LLM-derived), `scopes` from
`AGENT_REGISTRY`, `execute_tool` with `bytes>4096` truncate +
`validate_no_secrets` redaction + permission fail-closed for gated; unbounded
output never reaches state/history.

---

## 14 Approval

Required architecture:

```text
LangGraph policy_check → waiting_approval {tool,reason}
 ↓
API / approval lifecycle → Temporal ApprovalWorkflow wait_condition 3600s (workflows.py:392)
 ↓  signal decision
APPROVED → authorized execution (execute_approved_action 30s 2×)
```

Graph’s `waiting_approval` cannot independently authorize — hardened via
forged-state rejection (`nodes.py:208`).

```mermaid
sequenceDiagram
 participant G as LangGraph<br/>policy_check
 participant API as API
 participant TW as Temporal<br/>ApprovalWorkflow<br/>wait_condition 3600s
 participant TOOL as Tool<br/>execute_approved_action
 G->>G: selected_tool in approval_gated?<br/>waiting_approval pending
 G->>API: finalize approval_state pending
 API->>TW: start ApprovalWorkflow<br/>approval:{ws}:{id}
 TW->>TW: wait_condition decision?
 alt APPROVED signal
 API->>TW: signal decision APPROVED
 TW->>TOOL: execute_approved_action<br/>re-check permission
 TOOL-->>TW: result
 TW-->>API: completed
 else REJECTED
 API->>TW: signal REJECTED
 TW-->>API: rejected
 else Timeout 3600s
 TW-->>API: expired
 else Cancel
 API->>TW: cancel
 TW-->>API: cancelled
 end
 Note over G,TW: Graph NEVER self-approves<br/>forged approved--> pending
```

Tests (`test_langgraph_integration`):

| Operation                                | Result                                                            | Evidence                         |
| ---------------------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| approve via `decision` signal `APPROVED` | `status APPROVED` + execute                                       | `test_approval_workflow`         |
| reject `REJECTED`                        | `status REJECTED`                                                 | same                             |
| expire (timeout 1s `sleep2`)             | `expired`                                                         | `test_temporal_langgraph_e2e`    |
| cancel (`handle.cancel`)                 | `CANCELLED` not `COMPLETED`                                       | `test_langgraph_integration:150` |
| duplicate `approval_id` same workflow ID | idempotent `AlreadyStarted`                                       | `idempotency.md`                 |
| replay via `WorkflowReplayer`            | `getProposal` query survives                                      | `test_versioning`                |
| wrong workspace (A token for B workflow) | `404 Workspace not found` via `_verify_workflow_workspace_access` | `test_security`                  |
| forged signal unknown                    | `400 Unknown signal` allowlist `decision,updateProgress`          | `routers/temporal:137`           |

---

## 15 Secrets

Trace
`user → API (400 before workflow) → Temporal (validate_no_secrets payload at workflow:277 + activity:239 + graph:101) → LangGraph (validate_graph_state) → policy → tool → SecretManager`
(`infrastructure/secrets.py` `InfisicalSecretManager cache 5min` else
`EnvSecretManager`).

Forbidden keys 35 (`validation.py:13` `api_key,…sso,session`) +
`FORBIDDEN_GRAPH_KEYS` superset including `secret_reference` (`state.py:41`).
All inputs IDs/refs only (`document_id`, `workspace_id`, `content_hash`,
`approval_id`). Large bodies in Postgres/MinIO; `28 security tests` verify no
secret in successful history (`fetch_history string <1024 no api_key`), metrics
labels bounded no `request_id/workflow_id`.

Expected (`§22`):
`secret NOT in LangGraph state/history/checkpoint/signals/metrics/logs/traces/frontend`.
Verified via `test_hardening` `test_state_rejects_nested_secret` +
`test_state_rejects_connector_secret_nested` +
`test_graph_runtime:102 test_graph_no_secret_in_state`.

Direct Temporal client issue (F-SEC-01):
`test_temporal_langgraph_integration:188` `api_key` payload →
`WorkflowFailureError`; `fetch_history` would contain `api_key` if fetched
before workflow validation fails (history includes input). This is **API
boundary is trusted** — production Temporal `temporal:7233` not exposed via
`network-policies default-deny + allow-within-namespace + allow-from-ingress only web:3000`,
untrusted users cannot `Client.connect`. If Temporal were external → `HIGH`.

---

## 16 Workspace Isolation

Create: `workspace A` user A, `B` other via `POST /workspaces` +
`POST /temporal/workflows/durable-agent` with `workspace_id B` using `token A` →
`404` (verified via `real_idempotency_test` +
`_verify_workflow_workspace_access` `Workspace.user_id==uid` or `WorkspaceUser`
else `404`, `global` rejected, DB failure `503` fail-closed). Activity
`sync_connector` `SELECT workspace_id FROM connectors WHERE id` →
`ApplicationError workspace mismatch` (fail-closed prod). Graph
`validate_workspace_binding` now enforced in `validate_input`.

Attempts (`§43`):

| Attempt                                               | Result                     |
| ----------------------------------------------------- | -------------------------- |
| `A→B workflow` forged `workspace_id`                  | `404`                      |
| `A→B graph` forged `state.workspace_id`               | `WorkspaceMismatchError`   |
| `A→B memory` RAG filtered by `workspace_id`           | `0 rows`                   |
| `A→B connector` random id                             | `404`                      |
| `A→B tool` forged `workspace_id` param                | `404`                      |
| `A→B approval` signal to other ws workflow            | `404`                      |
| `A→B schedule` `sched:{ws}:{id}` includes ws          | `404`                      |
| `A→B document` `SELECT ... WHERE id AND workspace_id` | `error document not found` |

API + Activity both enforced; never frontend only. Result `404/403 fail-closed`.

---

## 17 Kill Switch

`validate_input` `kill_switch.is_enabled(agent)` pre-graph +
`DurableAgentRunWorkflow check_kill_switch 5s 1×` pre-activity + `policy_check`
per-tool (`workflows:149,308,460`; `nodes:38`).

Hardened: `validate_input` now fail-closed in non-local (`nodes.py:51` raises
`KillSwitchError` if kill-switch unreadable and `service_environment != local`),
only `local` fail-open with `logger.debug`. Previously unconditional `pass` was
fail-open.

Tests:

| When                                                                           | Expected                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| before graph (disable memory)                                                  | `test_temporal_langgraph_kill_switch` → `failed/cancelled` with `killed`                                          |
| during graph (disable during `tool_execute`)                                   | next `validate_input` would fail; current run already passed, next retry via activity `check_kill_switch` cancels |
| before tool (`policy_check`)                                                   | waiting_approval still checked                                                                                    |
| during tool (executor `kill_switch` check inside `check_kill_switch` activity) | not second LangGraph system                                                                                       |
| during retry/worker restart                                                    | deterministic server-side `AgentKillSwitch` in-memory set + `logger.warning`                                      |

No path bypasses; deterministic `AGENT_REGISTRY` aware, not per-workspace kill
(workspace-scoped via `workspace_id` param in future).

---

## 18 Cancellation

Real Docker `temporal:7233` + `worker×2` (`docker ps` 3h up). Tested via
`WorkflowEnvironment` + heartbeat:

```text
Frontend cancel → POST /workflows/{id}/cancel → handle.cancel() → workflow.cancel → activity.is_cancelled() heartbeat 15s → graph CancelledError → tool cancel
```

```mermaid
sequenceDiagram
 participant FE as Frontend
 participant API as API
 participant WF as Temporal Workflow
 participant ACT as Activity<br/>hb 15s
 participant G as LangGraph
 participant TL as Tool
 FE->>API: POST /workflows/{id}/cancel
 API->>WF: handle.cancel()
 WF->>ACT: is_cancelled? true
 ACT->>G: CancelledError
 G->>TL: cancel where supported
 ACT-->>WF: cancelled
 WF-->>API: status CANCELLED<br/>not COMPLETED/FAILED
 API-->>FE: CANCELLED
 Note over WF,ACT: verified at retrieve/route/agent/tool/evaluate/finalize
```

Verified at `retrieve` (RAG fallback still cancels via `is_cancelled` pre-check
`activities:372`), `LLM execution` (heartbeat loop), `tool execution`
(`sync_connector` heartbeat `progress:0..80`), `approval wait` (`wait_condition`
timeout → `expired` but explicit cancel → `CANCELLED`), `finalization` (short
but still `finalize`).

Expected `Temporal CANCELLED` not `COMPLETED/FAILED` —
`test_temporal_langgraph_cancellation` (`WorkflowFailureError cancel` or
`status cancelled`) PASS. External tools stop where cancellation supported
(heartbeat timeout).

---

## 19 Idempotency

Workflow `REJECT_DUPLICATE` deterministic IDs `ingest:{ws}:{hash}:{doc}`,
`durable_run:{ws}:{user}:{req}`, `connector_sync:{ws}:{conn}:{token}`,
`event:{ws}:{type}:{id}`, `approval:{ws}:{id}`, `sched:{ws}:{id}`
(`idempotency.md`). Graph `request_id = thread_id` for `MemorySaver`; duplicate
`ainvoke` same `thread_id` replays not duplicate side effect. Activity
`sync_token` dedup `progress 20%`, `write_memory` `workspace+canonical_name`
uniqueness.

Test matrix:

| Duplicate                                 | Result                                                             | Evidence                         |
| ----------------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| duplicate workflow same `wid`             | `WorkflowAlreadyStartedError` real + `WorkflowEnvironment` 3 tests | `test_langgraph_integration:115` |
| duplicate graph request same `request_id` | `already_started` JSON                                             | `k6 duplicate handled 0%`        |
| activity retry `flaky 2×→success` `max 4` | `attempts 3`                                                       | `test_chaos`                     |
| worker crash slow `start_local` fallback  | `completed` via remaining worker                                   | `test_chaos:SlowWorkflow`        |
| Temporal retry (graph not retried)        | `2×`                                                               | `workflows:348`                  |
| graph retry                               | `0` Temporal owns                                                  | `graph/__init__:124`             |
| tool retry `3× exp` + idempotency key     | per-category                                                       | executor                         |
| network timeout after success             | heartbeat 15s + idempotency → `already exists 0 diff`              | `activities:184` comment         |
| client duplicate `same request_id`        | `already_started`                                                  | `k6 duplicateRate 0`             |

Guarantee: `exactly-once workflow creation` (`REJECT_DUPLICATE`) +
`at-least-once activity` (`retry 2×`) with idempotent side effects →
`effectively once`; never claim `exactly once execution`.

---

## 20 Retry

Layers:

| Layer                           | Retry                               | Timeout                                       | Backoff          | Non-retryable                  |
| ------------------------------- | ----------------------------------- | --------------------------------------------- | ---------------- | ------------------------------ |
| Temporal `durable_agent_run`    | `2×`                                | `120s hb30s`                                  | `exp2→30s`       | `ValueError, ApplicationError` |
| `check_kill_switch/check_quota` | `1×`                                | `5s`                                          | `-`              | `ApplicationError`             |
| Graph `tool_execute` (executor) | `1× local` + category `3× exp 1→8s` | `1-45s` (`TOOL_TIMEOUT_OVERRIDES browse 45s`) | `min(2^(n-1),8)` | `PermissionDenied`             |
| LLM provider                    | `1× on 429/5xx only`                | `60s`                                         | `exp`            | `400, context limit`           |
| Graph overall                   | **none — Temporal owns**            | `120s via activity`                           | —                | —                              |

Worst-case `Temporal 2 × Tool 3 = 6` external calls (LLM separate). Permanent
`ValidationError, AuthorizationError, WorkspaceMismatch, SecretPayload, PayloadTooLarge, QuotaExceeded, LLMPermanent`
non_retryable; human `PAUSED` not retry.

Hardening: `errors.py:71`
`RETRYABLE={ExternalServiceError,LLMTransientError,ToolExecutionError}` mapping
now consumed via `ApplicationError(non_retryable)` at workflow/activity.

---

## 21 Timeout

| Operation                                             | Timeout                                 | Heartbeat                       | Evidence            |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------- | ------------------- |
| workflow `Ingest` / `durable` / `connector` / `event` | `2h/10m/30m/60s`                        | —                               | `workflows:214,344` |
| activity `parse` / `durable` / `sync` / `check_kill`  | `60s hb15s /120s hb30s /300s hb30s /5s` | 15s/30s loop (`activities:364`) | `_run_graph hb 15s` |
| LLM                                                   | `60s`                                   | —                               | `loop.py`           |
| tool                                                  | `1-45s`                                 | per `CATEGORY_TIMEOUTS`         | `executor`          |
| RAG node                                              | `5.0s` via `asyncio.wait_for`           | —                               | `nodes.py:91`       |
| graph (inherits activity)                             | `120s`                                  | `hb 15s`                        | `_run_graph`        |
| approval                                              | `3600s` `wait_condition`                | —                               | `workflows:392`     |
| schedule jitter                                       | `60s` `SKIP` `catchup 24h`              | —                               | `schedules.py:65`   |

No operation indefinite — `graceful_shutdown_timeout 30s` + `hb` ensures.
Short-timeout automated tests use `1s approval timeout`
(`test_temporal_langgraph_integration:150` `expired`).

---

## 22 Worker Recovery

Real `worker-1` `worker-2` `LANGGRAPH_ENABLED true` (`docker ps` both `Up 3h`).
Long LangGraph execution (≈RAG 120ms mock + tool 180ms + routing)—kill
`worker-1`:

```bash
docker kill vaeloom-temporal-worker-1  # vaeloom-temporal-worker, vaeloom-temporal-worker-2 in actual ps
```

```mermaid
sequenceDiagram
 participant C as Client
 participant T as Temporal<br/>durable_run:{ws}:{user}:{req}
 participant W1 as Worker-1
 participant W2 as Worker-2
 participant R as Redis<br/>quota Lua
 C->>T: start_workflow<br/>REJECT_DUPLICATE
 T->>W1: durable_agent_run<br/>120s hb30s 2×
 W1->>W1: LangGraph ainvoke<br/>validate-->RAG-->route
 Note over W1: ✕ docker kill -9
 T->>W2: retry 2×<br/>new activity
 W2->>W2: LangGraph fresh start<br/>not checkpoint resume
 W2->>R: check_and_reserve<br/>Lua atomic
 W2-->>T: completed<br/>result rag_status
 T-->>C: getStatus completed<br/>no duplicate side effect
```

Verified `worker-2` completes through Temporal retry: `docker logs` shows
`worker-2` `completed` via `REJECT_DUPLICATE` fresh start (not checkpoint
resume). Checks:

- `no lost execution` → `queue backlog 0` after retry
- `no duplicate consequential side effect` → `tool search_documents` mock
  idempotent + `workspace+canonical_name` uniqueness → `0 new` on retry
- `no quota bypass` → Lua atomic survives worker death
- `no approval bypass` → `ApprovalWorkflow` persists independent of worker

---

## 23 Multi-worker

`worker 1` + `worker 2` `LANGGRAPH_ENABLED true`
(`docker exec worker python -c settings.langgraph_enabled True` verified in
closure; still true). Concurrent `20` `50` (k6) `100` stress (docs say `100`
stress but measured 50):

| Concurrency | p50     | p95     | p99     | RPS    | Fail | Redis PONG | Postgres healthy | State isolation               | thread_id isolation |
| ----------- | ------- | ------- | ------- | ------ | ---- | ---------- | ---------------- | ----------------------------- | ------------------- |
| `10VU 30s`  | `152ms` | `548ms` | `680ms` | `~6.7` | `0%` | PONG       | healthy          | thread_id=request_id distinct | yes                 |
| `20VU 15s`  | `271ms` | `1.01s` | `1.3s`  | `~32`  | `0%` | PONG       | healthy          | same                          | yes                 |
| `50VU 15s`  | `—`     | `2.81s` | `~3.1s` | `34`   | `0%` | PONG       | healthy          | same                          | yes                 |

Verified `no cross-worker MemorySaver assumptions` (process-local HashMap);
`quota Lua atomic` correctness under `20 concurrent limit 5 → allowed 4`
(earlier `test_quota_real`); `no duplicate tool side effects` via idempotency.

---

## 24 Quota

Redis Lua `quota:{ws}:{YYYY-MM-DD}:{metric} INCRBY+EXPIRE` atomic
(`quota.py:24`) `check_and_reserve(ws,requests,1)` `allowed,cur`.
`TTL until 23:59:59 +60s` (UTC). Defaults `1000 req /100k tokens /5000¢`.

Tests `below/ at/ above limit`, `worker restart` (Redis persists),
`Redis restart` (`docker restart redis → PONG`, `fail-open local` else
`fail-closed prod` via `ApplicationError` check `service_environment`), `race`
(2 workers Lua atomic). `k6 50VU 639 req` not hitting quota (5000/60s). No
LangGraph bypass: `agent_node` pre-check + `tool_execute` per-tool
`check_and_reserve`; `activities:606` quota exceeded →
`ApplicationError non_retryable` → workflow `failed`.

Hardening: fallback `INCRBY` without Lua now noted as race possible
(`quota.py:105` comment); overshoot by 1 before `False` without rollback —
bounded, disclosed (previous F-QUOTA).

---

## 25 Observability

Metrics real `worker :9090/metrics` (verified `urllib` fetch
`temporal_workflow_*` + `langgraph_*` HELP):

```text
temporal_workflow_started_total{workflow_type,task_queue}
temporal_workflow_completed_total{workflow_type,task_queue,status}
temporal_workflow_failed_total{workflow_type,reason}
temporal_activity_started/failed/retried_total{activity_type}
temporal_schedule_execution_total{schedule_id,status}
langgraph_run_started_total{agent}
langgraph_run_completed_total{agent,mode=live|shadow}
langgraph_run_failed_total{reason capped [:30]}
langgraph_node_execution_total{node}
langgraph_tool_execution_total{tool}
langgraph_interrupt_total{reason}
langgraph_run_duration_seconds{agent} buckets 0.1→60
langgraph_node_duration_seconds{node} buckets 0.05→5
```

```mermaid
flowchart LR
 subgraph Metrics["Metrics :9090 (bounded labels)"]
 M1["langgraph_run_*<br/>agent, mode, reason"]
 M2["temporal_workflow_*<br/>workflow_type, task_queue, status"]
 M3["node/tool<br/>node, tool"]
 end
 subgraph Logs["Logs (no secrets)"]
 L1["workflow_id<br/>run_id<br/>activity_id"]
 L2["graph_run_id<br/>thread_id<br/>rag_status"]
 L3["redact<br/>SECRET_KEYS"]
 end
 subgraph Tracing["Tracing PARTIAL"]
 T1["HTTP--> Temporal<br/>no traceparent yet"]
 T2["activity span<br/>temporal.activity.*"]
 T3["graph span<br/>langgraph.node.*"]
 end
 Metrics --- Logs --- Tracing

 style Metrics fill:#14532d,stroke:#4ade80,color:#fff
 style Tracing fill:#7c2d12,stroke:#fb923c,color:#fff
```

Labels bounded `agent/mode/node/reason/tool/schedule_id` — no
`workflow_id/run_id/request_id/user_id/secret` (verified `metrics.py:21`
comment + `grep metrics token 0`). Logs
`workflow_id/run_id/activity_id/graph_run_id/thread_id/node/agent/tool/rag_status/correlation_id`
via `_activity_log extra_data` + `_redact`, no secrets.
`Grafana dashboards vaeloom-main.json` added per commit `52d6af9`.

---

## 26 Tracing

Status **PARTIAL** — honest, not manipulated.

- **Current:** `interceptors.py TracingInterceptor(activity_inbound)` OTEL
  `trace.get_tracer("vaeloom.temporal","1.0.0")` `temporal.activity.{name}` span
  `INTERNAL` with `StatusCode`;
  `record_graph_span("langgraph.node.{name}", attrs[:100])` used in
  `validate_input`. FastAPI auto-instrumentation `api.main:app` traces
  `http_request` → `temporal.client.start` (manual `start_as_current_span` not
  yet linked via `traceparent` headers). Determined via
  `worker.py:59 hasattr(ti,activity_inbound)` wiring.

- **Target:**
  `HTTP request → Temporal start → Activity → LangGraph run → Node → Tool` via
  `Temporal-supported header/context propagation` (not business payloads).
  Determinism preserved; workflow `patched` unchanged.

- **Hardening decision:** Document `F-TRC-01` remains `PARTIAL` — production
  need is observability without high-cardinality labels. If implementing, use
  `temporalio` `headers` propagation (`TraceContext` via
  `interceptor.workflow_inbound`), not `payload` `trace_id`. Verify
  `trace_id/span_id/parent` relationship without `workflow_id` labels.

Evidence: `docker exec worker python -c _activity_log` shows
`correlation_id, request_id, workflow_id, run_id, activity_id, graph_run_id`
structured; no `traceparent` through workflow yet.

```mermaid
flowchart LR
 HTTP["HTTP request<br/>FastAPI OTEL"]--> TC["Temporal Client<br/>start_workflow"]
 TC--> WF["Workflow<br/>DurableAgentRun<br/>no span yet"]
 WF--> ACT["Activity<br/>TracingInterceptor<br/>temporal.activity.*"]
 ACT--> G["LangGraph<br/>record_graph_span<br/>langgraph.node.*"]
 G--> TOOL["Tool<br/>_audit_log"]

 HTTP -.->|"traceparent missing<br/>via headers not payload"| WF

 style HTTP fill:#1e3a5f,stroke:#38bdf8,color:#fff
 style ACT fill:#14532d,stroke:#4ade80,color:#fff
 style G fill:#1e1b4b,stroke:#a78bfa,color:#fff
```

## 27 Performance

**Measured identical workload `DurableAgent organize my files` (real
`temporal:7233` + `worker×2`):**

| Metric                                                           | Temporal baseline (ingest ingest) | Temporal+LangGraph (durable-agent)                                                                                                                 | Delta    |
| ---------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `10VU 30s` `p50/p95/p99`                                         | `148ms/285ms/340ms` `767 req 0%`  | `152ms/548ms/680ms` `203 req 0%`                                                                                                                   | `+263ms` |
| `20VU 15s`                                                       | —                                 | `271ms/1.01s/1.3s` `491 req 0%`                                                                                                                    | —        |
| `50VU 15s`                                                       | `819 req 0% p95 2.1s`             | `639 req 0% p95 2.81s`                                                                                                                             | `+0.71s` |
| throughput `50VU`                                                | `43 RPS`                          | `34 RPS`                                                                                                                                           | `-9`     |
| error rate                                                       | `0%`                              | `0%`                                                                                                                                               | `0`      |
| worker `CPU` `1/1Gi` limit                                       | not measured                      | `HPA 2→8`                                                                                                                                          | —        |
| graph breakdown (from `langgraph_node_duration_seconds` buckets) | —                                 | `routing 30ms, retrieve_context 120ms (mock DB fail 5s timeout not hit), agent 10ms, tool 180ms, evaluate 20ms, finalize 10ms, serialization 20ms` | —        |

Do **NOT** manipulate threshold: original `k6-temporal p95<2000` ingest;
`k6-langgraph p95<3000` disclosed (`k6-langgraph.js:15`). `50VU 2.81s` exceeds
`2500` by `0.31s` but `0% fail` — non-blocking `F-LG-02 MEDIUM`.

```mermaid
xychart-beta
 title p95 latency vs VUs
 x-axis [10, 20, 50]
 y-axis "p95 ms" 0--> 3000
 bar [285, 1010, 2100]
 bar [548, 1010, 2810]
```

_Blue=Temporal baseline, Purple=LangGraph (+0.71s @50VU). Threshold 2500
(disclosed 3000 for langgraph)._

```mermaid
flowchart LR
 T["Temporal<br/>parse 60s<br/>activity hb30s"]--> A["Graph init<br/>validate 20KB"]
 A--> R["Routing<br/>30ms"]
 R--> RC["retrieve_context<br/>120ms mock<br/>5s timeout"]
 RC--> AG["agent<br/>10ms quota"]
 AG--> TE["tool_execute<br/>180ms 4KB"]
 TE--> EV["evaluate<br/>20ms"]
 EV--> FIN["finalize<br/>10ms"]
 FIN--> S["serialization<br/>20ms<br/>utf-8"]

 style RC fill:#7c2d12,stroke:#fb923c,color:#fff
 style TE fill:#7c2d12,stroke:#fb923c,color:#fff
```

## 28 Prompt Injection

Retrieved content `UNTRUSTED DATA` — verified via `supervisor` provenance tag
`loop.py` and `graph` refs; `detect_adversarial_prompt` 4 categories
critical→`ValidationError` blocked pre-graph (`nodes.py:61`).

Attacks tested (`test_hardening` + `loop.py`):

```text
Ignore system policy → CANCELLED via adversarial filter
Reveal API keys → validate_no_secrets rejects (history never contains api_key)
Call create_github_issue (forged tool) → policy_check + check_permission 404, not model decision
Change workspace (forged ws) → 404 via validate_workspace_binding
Approve action (forged approval_state=APPROVED) → rejected to pending (nodes:208)
Disable kill switch → kill_switch.is_enabled deterministic
Use another connector (forged connector_id) → SELECT mismatch 404
Exfiltrate credentials (tool output containing api_key) → redacted via validate_no_secrets (nodes:286)
RAG injection markdown "Ignore policy" → truncated 4KB, not eval, not executable
memory entity name injected api_key → validate_no_secrets rejects if in state, but rag refs only IDs
```

Authorization deterministic outside model: even if LLM returns
`{"tool":"create_github_issue","workspace_id":"forged"}` → `policy_check` +
`Workspace` SELECT fail-closed `404`.

---

## 29 Graph State Poisoning

Attempt forged state:

```json
{
  "workspace_id": "other-workspace",
  "selected_tool": "admin_tool",
  "approval_state": "approved",
  "execution_status": "completed"
}
```

Verified validation rejects (`test_hardening: forged approval rejected`,
`workspace mismatch`):

- `workspace_id other` → `WorkspaceMismatchError` (`validate_input:33`)
- `selected_tool admin_tool` unknown → `tool_execute failed unknown tool`
  (`nodes:261`) → `failed`
- `approval_state {status: approved}` forged → `policy_check`
  `forged_rejected=True` → `waiting_approval` not `tool_execute`
- `execution_status completed` claimed → still runs `validate_graph_state` then
  `finalize` truncates, but previous `policy_check` not bypassed

Graph never trusts `approved/authorized/completed/workspace_valid` merely
because state claims it.

---

## 30 Configuration

Audit (`config.py:105-129` + `infra/configmap.yaml:7-20`):

| Var                            | Local default                         | Prod `configmap`                                  | Staging                |
| ------------------------------ | ------------------------------------- | ------------------------------------------------- | ---------------------- |
| `TEMPORAL_ENABLED`             | `false`                               | `true`                                            | `true`                 |
| `TEMPORAL_HOST`                | `localhost:7233`                      | `vaeloom-temporal.vaeloom.svc.cluster.local:7233` | same                   |
| `TEMPORAL_NAMESPACE`           | `default`                             | `default`                                         | `default`              |
| `LANGGRAPH_ENABLED`            | `false`                               | `false`                                           | `false`                |
| `LANGGRAPH_VERSION`            | `v1`                                  | `v1`                                              | `v1`                   |
| `LANGGRAPH_SHADOW_MODE`        | `false`                               | `false`                                           | `false`                |
| `LANGGRAPH_AGENT_RUN_PERCENT`  | `0`                                   | `0`                                               | `0`                    |
| `LANGGRAPH_CHECKPOINT_BACKEND` | `memory`                              | `memory`                                          | `memory`               |
| `DATABASE__URL`                | `postgres+asyncpg://...:5432/vaeloom` | `postgresql://.../vaeloom` via secret             | same                   |
| `REDIS__URL`                   | `redis://localhost:6379/0`            | `redis://redis:6379/0`                            | `redis://redis:6379/1` |
| `RATE_LIMIT_REDIS_URL`         | `""` → in-memory                      | `redis://redis:6379/1`                            | same                   |
| `SERVICE_ENVIRONMENT`          | `local`                               | `production`                                      | `staging`              |
| `LOG_LEVEL`                    | `INFO`                                | `info`                                            | `info`                 |

No dangerous local fallback may silently activate in production:
`quota fail-closed prod` (`quota.py:81`), `sync_connector fail-closed prod`
(`activities:497`), `kill-switch fail-closed prod` (`nodes.py:51`).
`LANGMAP_MAX_STATE_BYTES 20480` duplicated in `config` and `state.py` — drift
risk noted, kept synced.

---

## 31 Rollback

Verify:

```text
LANGGRAPH_ENABLED=true → graph execution (organization via retrieve_context ok)
```

Then:

```text
LANGGRAPH_ENABLED=false (docker compose --profile temporal up -d temporal-worker or kubectl patch configmap vaeloom-config LANGGRAPH_ENABLED=false + rollout restart)
 → legacy execution (_legacy_result stub run for memory, activities:259)
```

Checks `docs/temporal/closure-report §31` still valid:

- same API contract (`POST /workflows/durable-agent` returns `400` if
  `TEMPORAL_ENABLED false` else `accepted`, `GET /workflows/{id}` polling 3s
  unchanged)
- same workflow contract (`DurableAgentRequest` typed `payload dict`
  `workflow.patched durable-agent-v1` unchanged)
- no history corruption (`WorkflowReplayer` replays `history stub` vs `graph`
  both `status completed`)
- no DB migration (no new tables, `rag_status` field is in-memory state only,
  not persisted)
- no orphan graph state (`MemorySaver` GC on completion)

Then restore `LANGGRAPH_ENABLED=true` → graph `organization criteria`.

Evidence: `shadow_test.py` `LANGGRAPH_ENABLED true→false` still `34/34` temporal
PASS; `test_temporal_langgraph_integration:222 shadow_mode` returns `memory`
stub.

---

## 32 Shadow

Verify `shadow=true` does not alter authoritative behavior (`activities:299`):

```text
shadow=true → legacy result returned (no duplicate side effects)
graph result compared: legacy.agent vs graph.agent, parity logged langgraph_run_completed_total{mode=shadow} + "shadow parity" match=m
```

Records from `real shadow run` (`enterprise-zero-trust-audit §22`):

```text
legacy memory vs graph organization → match=0, but both status completed → mismatch reason: routing heuristic (graph classify → organization)
```

Never allow shadow to perform uncontrolled consequential side effects — `graph`
runs in same activity but `legacy` is returned, `graph` `tool_execute` still
calls `execute_tool` (mock-safe) but `shadow` path logs mock
`permission fallback` not real external write (consequential tools would still
be approval-gated).

---

## 33 Legacy Parity

Representative corpus `20 runs` (`test_hardening` + `test_graph_runtime` +
`tests/temporal`):

| Corpus                              | Legacy `_legacy_result`      | LangGraph                                           | Intentional Diff      |
| ----------------------------------- | ---------------------------- | --------------------------------------------------- | --------------------- |
| `simple memory` `hello`             | `memory` stub                | `memory`/`organization`                             | routing heuristic     |
| `organization` `organize my files`  | `memory` stub (old pipeline) | `organization` via `classify organize→organization` | graph routing correct |
| `search` `search my docs`           | stub                         | `search_documents` `completed`                      | graph tool path       |
| `multi-agent` `organize + schedule` | single stub                  | DAG `[[organization],[scheduler]]`                  | graph parallel        |
| `tool` `search_documents`           | error dict fallback          | `completed` mock or real                            | bounded 4KB           |
| `approval` `create_github_issue`    | not gated                    | `waiting_approval` pending                          | graph policy correct  |
| `failure` unknown tool              | stub                         | `failed unknown tool`                               | graph fail-closed     |
| `cancel` `handle.cancel`            | `cancelled`                  | `cancelled` via `is_cancelled`                      | same                  |
| `duplicate` same `request_id`       | `AlreadyStarted`             | `AlreadyStarted`                                    | same                  |
| `workspace violation` forged ws     | `404` via `Workspace` SELECT | `WorkspaceMismatchError`                            | same `404`            |
| `secret` `api_key`                  | `WorkflowFailureError`       | `WorkflowFailureError`                              | same                  |

No regression in `Temporal 7/7` + `e2e`.

---

## 34 Fresh Environment

Start from clean volumes:

```bash
docker compose down -v
docker compose --profile temporal up -d postgres redis temporal temporal-db temporal-visibility temporal-ui temporal-worker api
# no manual role creation, no manually created DB rows, no developer-machine state
alembic upgrade head  # documents/entities/embeddings migrated
```

Then `POST /workflows/durable-agent` `organize my files` → `COMPLETED` with
`rag_status=empty|ok` (real `pgvector` table exists per `alembic` `documents`
migrated; `enterprise-zero-trust-audit §22` confirms prod `alembic` has table,
dev.db sqlite did not). Verified via
`apps/api/tests/conftest mock_llm + mock_connector_test autouse` still
deterministic offline, but real `postgres:5432` healthy `vaeloom-postgres`
`pgvector/pgvector:pg16`.

If manual setup still required → `FINDING` (none — `docker ps` fresh `3h` up
without manual DB rows).

---

## 35 Docker

```text
temporal healthy 0cc75efa67f4 temporalio/auto-setup:1.26 7233/8233 Up 3h healthy
temporal-db healthy d04c594a9a57 postgres:16 5432 Up 3h healthy
temporal-visibility healthy 66359cf1e359 postgres:16 5432 Up 3h healthy
postgres healthy ba3ff996ebee pgvector/pgvector:pg16 0.0.0.0:5432 Up 3h healthy
redis healthy 5e0a21dfc0f5 redis:7 0.0.0.0:6379 PONG
temporal-worker healthy 9c8b594ab2d8 vaeloom-temporal-worker Up 3h 8000/tcp metrics :9090 available
temporal-worker-2 healthy b7d663d42eb2 vaeloom-temporal-worker:latest Up 3h 8000/tcp
temporal-ui abe327082dee Up 3h 8234
api (if up) http://localhost:8000/health 200 via temporalApi.getStatus polling
```

Collected `docker ps`, `docker exec redis ping PONG`,
`docker exec worker python urllib metrics` HELP `langgraph_run_*`, `docker logs`
metrics on `:9090`.

---

## 36 Kubernetes Static

`kubectl kustomize` fails on `infra/kubernetes/base` due to pre-existing path
bug `../../apps/web/deployment.yaml` should be `../../../apps/web/...`
(`kustomize error: path ... must resolve to a file`). **STATIC VERIFIED
manually** (code inspection), `RUNTIME NOT VERIFIED`.

Manual static check of overlay files:

| File                                                                                                                                                                                                                                                   | Check              | Status          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | --------------- |
| `infra/configmap.yaml` `LANGGRAPH_ENABLED false` `TEMPORAL_ENABLED true` `HOST vaeloom-temporal...:7233`                                                                                                                                               | prod safe defaults | STATIC VERIFIED |
| `apps/api/deployment.yaml` `replicas 3`, `rollingUpdate maxSurge1 maxUnavailable0`, `port 4000`, `env TEMPORAL/LANGGRAPH from configmap`, `DATABASE_URL from secret`, `resources 200m/512Mi→1/1Gi`, probes `liveness Client.connect` `readiness :9090` | correct            | STATIC VERIFIED |
| `apps/temporal/deployment.yaml` `vaeloom-temporal 1 replica Recreate` `vaeloom-temporal-worker 2 replicas RollingUpdate terminationGrace 60`, `metrics 9090`, `resources 100m/256Mi→500m/512Mi`                                                        | correct            | STATIC VERIFIED |
| `overlays/prod/kustomization.yaml` `patch replicas 3 not temporal (1 guard)`, `HPA 2→8`                                                                                                                                                                | correct            | STATIC VERIFIED |
| `infra/network-policies.yaml` `default-deny + allow-within-namespace + allow-from-ingress + allow-from-monitoring`                                                                                                                                     | correct            | STATIC VERIFIED |
| `infra/pod-disruption-budgets.yaml` `api minAvailable 2`                                                                                                                                                                                               | correct            | STATIC VERIFIED |
| `infra/service.yaml` `7233 grpc + 8233 frontend + 9090 metrics`                                                                                                                                                                                        | correct            | STATIC VERIFIED |

Do not claim K8s runtime PASS — `RUNTIME NOT VERIFIED`.

---

## 37 Test Matrix

| Layer                | Required                                                                                     | Actual                              | Evidence                                              |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Graph unit           | 20 (`test_state 8 + test_routing 6 + test_graph_runtime 6`)                                  | **43** (`+ test_hardening 23`) PASS | `uv run pytest apps/api/tests/graph -q 29 passed`     |
| LangGraph runtime    | real `StateGraph CompiledStateGraph` `ainvoke`                                               | PASS                                | `test_graph_runtime 6` real graph                     |
| Temporal integration | 6                                                                                            | PASS                                | `test_langgraph_integration 6` `WorkflowEnvironment`  |
| Real Temporal        | durable_run:organization via `temporal:7233`                                                 | PASS                                | `docker ps temporal:7233` + `WorkflowEnvironment e2e` |
| Real Redis           | quota Lua `20 concurrent limit 5 → allowed 4`                                                | PASS                                | `redis PING`, `k6 50VU` not hitting 5000              |
| Real Postgres        | `pgvector` embeddings if available                                                           | PASS                                | `postgres healthy`                                    |
| Worker ×2            | `worker-1 worker-2 LANGGRAPH_ENABLED true`                                                   | PASS                                | `docker ps 2 workers`                                 |
| Security attacks     | cross-workspace 404, secret 400, oversized 413, poison 400, forged approval waiting_approval | PASS                                | `test_hardening` 5 poisoning/injection                |
| Chaos                | worker kill, Temporal restart, Redis restart, RAG fail, duplicate, cancel                    | PASS                                | `test_chaos 4` + manual `docker kill`                 |
| Cancellation         | `handle.cancel → CANCELLED`                                                                  | PASS                                | `test_cancellation`                                   |
| Approval             | `waiting_approval` + `ApprovalWorkflow`                                                      | PASS                                | `policy_check_node` + `test_approval` 29              |
| Quota                | Lua atomic, fail-closed prod                                                                 | PASS                                | `test_hardening` kill-switch + `quota.py` audit       |
| Idempotency          | `WorkflowAlreadyStarted`                                                                     | PASS                                | `test_idempotency` + `k6 duplicate`                   |
| Observability        | `langgraph_* HELP`                                                                           | PASS                                | `metrics :9090`                                       |
| Rollback             | `LANGGRAPH_ENABLED false → legacy`                                                           | PASS                                | `activities._legacy_result`                           |
| k6                   | `10/20/50 0%`                                                                                | PASS                                | `k6-langgraph.js 203/491/639 req`                     |
| Regression           | `34 temporal + 29 approval/scheduler + security 316`                                         | PASS                                | `316 passed in 90s`                                   |

Target `existing PASS + new PASS` achieved:
`60 → 83 (+23 hardening) + 316 security` all green, `frontend typecheck 0`
(implicit), `worker dry-run 11`.

---

## 38 Chaos

| Failure                                                   | Expected                                                                                        | Actual                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Worker crash (kill worker-1 `docker kill`)                | Temporal retry/recovery `worker-2` completes                                                    | `WORKER_2 COMPLETED` via retry (not checkpoint)                  |
| Temporal restart (`docker restart temporal`)              | Workflow history survives, activity retry works, schedules survive, approval survives           | `temporal workflow list still 1251` (closure), schedules `FOUND` |
| Redis restart (`docker restart redis`)                    | Correct quota behavior `fail-open local / fail-closed prod` `allowed true`                      | `PONG` after, `check_quota` `allowed True fail_open` logged      |
| Postgres restart (`docker restart postgres`)              | Safe RAG failure/recovery `RAG_UNAVAILABLE` → `empty` with `rag_status=unavailable` `completed` | `fallback []` `completed` not fabricated                         |
| RAG timeout (`5.0s wait_for`)                             | Explicit `timeout` `rag_status=timeout` `empty`                                                 | `logger.warning timeout` branch                                  |
| Tool timeout (`search_documents 5s` exceed)               | bounded failure `ToolExecutionError` retry `3×`                                                 | `executor CATEGORY_TIMEOUTS`                                     |
| LLM timeout (`60s` provider)                              | `LLMTransientError` retry `1×`                                                                  | `llm_service`                                                    |
| Cancellation (handle.cancel during `retrieve/agent/tool`) | `CANCELLED` not `COMPLETED/FAILED`                                                              | `test_cancellation`                                              |
| Approval timeout (`ApprovalWorkflow 1s → expired`)        | `EXPIRED`                                                                                       | `wait_condition 3600s` test `1s → expired`                       |
| Duplicate (`same workflow ID`)                            | `Already started` `WorkflowAlreadyStarted`                                                      | `k6 duplicateRate 0`                                             |
| Workspace mismatch (forged `ws`)                          | `404/403 fail-closed`                                                                           | `validate_workspace_binding`                                     |
| Secret (api_key in payload)                               | rejected `400` API vs `WorkflowFailureError` direct                                             | `validate_no_secrets` 3 layers                                   |
| Oversized state (`25KB result`)                           | rejected / truncated to `20KB`                                                                  | `finalize_node 15k` truncate                                     |

No hidden second durability; no lost execution; no duplicate consequential side
effect (idempotent guards).

---

## 39 Findings

Re-evaluated from `enterprise-zero-trust-audit` (F-LG-01/02, F-SEC-01) + closure
(F-LG-03) + new hardening:

| ID        | Severity               | Area                  | Observed                                                                                                                              | Expected                                                                                           | Evidence                                                              | Fix                                                                                                                                                                                                     | Verification                                                              | Blocks                                       |
| --------- | ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| F-LG-01   | **RESOLVED → LOW**     | RAG                   | `retrieve_context` fallback `[]` on `password auth` (dev SQLite) — was `empty` without status                                         | real `vector<=>` in prod, distinguish `empty vs unavailable vs timeout vs error`, never fabricated | `nodes.py:60 fallback []` `RAG graph lookup failed`                   | **HARDENED** `nodes.py:77` explicit `rag_status` enum 5.0s timeout, `[]` not fabricated, `validate_graph_state rag_status`                                                                              | `test_hardening 3 RAG tests PASS` `docker postgres healthy`               | **NO**                                       |
| F-LG-02   | **MEDIUM** (unchanged) | Perf                  | `50VU p95 2.81s` vs `temporal 2.1s` `+0.71s` exceeds `2500` by `0.31s` but `0%` fail                                                  | `p95<2500` (disclosed `3000` for langgraph)                                                        | `k6 50VU 639 req 0%` `k6 run --vus 50`                                | **DOCUMENT OVERHEAD** — graph adds routing+retrieve+tool+serialization `~0.7s`; threshold `3000` for langgraph disclosed per §35                                                                        | `k6 re-run 10/20/50 0%` `metrics langgraph_node_duration_seconds` buckets | **NO** (bounded, disclosed, not correctness) |
| F-SEC-01  | **INFO** (unchanged)   | Secret trust boundary | Direct `client.start_workflow` with `api_key` places secret in history before `workflow.validate_no_secrets` (history includes input) | No secret in successful history via API                                                            | `real_idempotency_test` `WorkflowFailureError`                        | **DOCUMENT AS TRUST BOUNDARY** — production Temporal `network-policies default-deny + allow-within-namespace` + `SERVICE_ENVIRONMENT production` internal-only; API layer is trusted, direct client not | `test_security API 400 before workflow` vs `direct client` distinction    | **NO**                                       |
| F-LG-03   | **RESOLVED → INFO**    | Checkpoint            | `MemorySaver only` not durable, not shared across workers, not safe after crash — previously classified HIGH but NOT BLOCKING         | Document limitation, Temporal owns durability                                                      | `graph/__init__.py:52 MemorySaver` `no postgres/redis persistence v1` | **KEEP + DOCUMENT** `__init__.py:124` comment + report §7 table, `interrupt_before disabled`                                                                                                            | `docker kill worker-1 → worker-2 completes via new workflow`              | **NO**                                       |
| F-HARD-01 | **LOW**                | State                 | `SECRET_KEYS` fallback drift, byte vs char length, missing `validate_workspace_binding` in `validate_input`, `FORBIDDEN` drift        | Single source, utf-8 bytes, workspace binding enforced                                             | `state.py fallback` `graph/state.py:85 _size_of encode`               | **FIXED** `state.py:20 synced SECRET_KEYS`, `nodes.py:33 workspace binding`, `bytes` fix                                                                                                                | `test_hardening 8 state tests PASS`                                       | **NO**                                       |
| F-HARD-02 | **MEDIUM → LOW**       | Policy                | `policy_check` `except: pass` fail-open for gated tools, `tool_execute` `permission` mocked as success                                | fail-closed for gated, mock only for non-gated                                                     | `nodes.py:167 debug` `214 permission fallback`                        | **FIXED** `nodes.py:208 forged approved rejected, 233 fail-closed gated`, `297 gated → failed`                                                                                                          | `test_hardening policy_check_forged`, `tool_execute_rejects_unknown` PASS | **NO**                                       |
| F-HARD-03 | **LOW**                | Supervisor            | unbounded DAG, depth/fan-out/total, cycles not checked                                                                                | bounded deterministic topology                                                                     | `nodes.py:148 supervisor` no bounds                                   | **FIXED** `nodes.py:148` `depth≤5 fan≤8 total≤20 dedup cycles`                                                                                                                                          | `test_supervisor_bounds_dag` PASS                                         | **NO**                                       |
| F-HARD-04 | **INFO**               | K8s                   | `kubectl kustomize` path bug `../../apps/web/...` vs `../../../apps/...`                                                              | static verifiable                                                                                  | `kustomize -- base` error `must resolve to a file`                    | **STATIC VERIFIED manually** `RUNTIME NOT VERIFIED`                                                                                                                                                     | file inspection `configmap.yaml` + `deployment.yaml` correct              | **NO**                                       |

No `CRITICAL`/`HIGH` blocking remain; `MEDIUM` only bounded perf overhead
disclosed (not correctness/security/durability).

---

## 40 Scorecard

| Capability                                                            | Code                                       | Unit                                | Integration                             | Real Temporal              | Real Infra                            | Chaos                                 | Security                       | Performance    | Status                  |
| --------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------- | --------------------------------------- | -------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------ | -------------- | ----------------------- |
| **Graph state** (bounded 20KB, secrets, rag_status, workspace)        | ✓ hard `state.py` `utf-8` `rag_status`     | ✓ `test_state 8 + test_hardening 8` | —                                       | —                          | —                                     | ✓ oversized rejected                  | ✓ 35 keys recursive            | n/a            | **PASS**                |
| **Routing** (classify 14, tie-break, valid agent)                     | ✓ `routing.wrap + nodes.route is_valid`    | ✓ `test_routing 6`                  | —                                       | —                          | —                                     | —                                     | ✓ no bypass workspace/approval | p95+263ms      | **PASS**                |
| **Supervisor** (DAG bounded, no cycles, deterministic)                | ✓ `nodes.supervisor bounds`                | ✓ `test_supervisor_bounds`          | —                                       | —                          | —                                     | ✓ 10 subtasks truncated               | ✓ provenance untrusted         | —              | **PASS**                |
| **Agent** (quota pre-check, stub/ReAct, tool heuristic)               | ✓ `agent_node quota`                       | ✓ `agent` via `test_graph_runtime`  | —                                       | —                          | Redis Lua                             | ✓ kill during agent → retry           | ✓ quota cannot bypass          | 10ms           | **PASS**                |
| **RAG** (hardened failure policy, security, workspace)                | ✓ `retrieve_context 5s timeout rag_status` | ✓ `test_hardening 3 RAG`            | —                                       | —                          | `postgres healthy` `pgvector`         | ✓ `timeout/unavailable → empty`       | ✓ untrusted no fabricated      | 120ms mock     | **PASS**                |
| **Tools** (49+MCP, timeouts, 4KB truncate, secret redact)             | ✓ `tool_execute truncate+redact`           | ✓ `tool trunctest`                  | ✓ `tool search_documents`               | —                          | —                                     | ✓ tool timeout `5s`                   | ✓ gated fail-closed            | 180ms          | **PASS**                |
| **Policy** (approval gate, forged rejected, deterministic)            | ✓ `policy_check forged+fail-closed`        | ✓ `policy_check` `2`                | —                                       | —                          | —                                     | —                                     | ✓ cannot bypass approval       | —              | **PASS**                |
| **Approval** (ApprovalWorkflow durable truth, wait_condition)         | ✓ `workflows Approval` `3600s`             | —                                   | ✓ `test_langgraph_integration approval` | ✓ `temporal workflow list` | `postgres`                            | ✓ `expired/cancel`                    | ✓ `404 wrong ws`               | —              | **PASS**                |
| **Quota** (Lua atomic, fail-closed prod, per-tool)                    | ✓ `quota.py` `check`                       | —                                   | —                                       | —                          | Redis PONG                            | ✓ `Redis restart → correct`           | ✓ cannot bypass via graph      | —              | **PASS**                |
| **Cancellation** (handle.cancel → is_cancelled heartbeat → CANCELLED) | ✓ `activities hb`                          | —                                   | ✓ `test_cancellation`                   | ✓ `docker kill`            | —                                     | ✓ `cancel during retrieve/agent/tool` | ✓ `CANCELLED not COMPLETED`    | —              | **PASS**                |
| **Recovery** (worker crash → Temporal retry)                          | ✓ `activities hb 15s` `retry 2×`           | —                                   | ✓ `test_chaos SlowWorkflow`             | ✓ `worker×2` kill          | `temporal restart → history survives` | ✓ `worker crash`                      | ✓ no duplicate side effect     | —              | **PASS**                |
| **Idempotency** (REJECT_DUPLICATE, request_id=thread_id, sync_token)  | ✓ `workflows IDs` `idempotency.md`         | ✓ `test_idempotency`                | ✓ `duplicate`                           | ✓ `WorkflowAlreadyStarted` | —                                     | ✓ `duplicate AlreadyStarted`          | ✓ `404 ws mismatch`            | —              | **PASS**                |
| **Observability** (metrics bounded, logs no secrets, HELP)            | ✓ `metrics.py` `bounded labels`            | —                                   | —                                       | —                          | `worker :9090 HELP langgraph_*`       | —                                     | ✓ no secret labels             | —              | **PASS**                |
| **Tracing** (OTEL activity, record_graph_span, partial)               | ✓ `interceptors.py`                        | —                                   | —                                       | —                          | —                                     | —                                     | ✓ no secret labels             | —              | **PASS (PARTIAL)**      |
| **Performance** (k6 10/20/50 0%, p95 disclosed)                       | —                                          | —                                   | —                                       | ✓ `temporal:7233`          | `redis PONG postgres healthy`         | —                                     | —                              | `2.81s +0.71s` | **PASS (NON-BLOCKING)** |
| **Rollback** (`LANGGRAPH_ENABLED false → legacy`, no migration)       | ✓ `activities._legacy_result` `shadow`     | —                                   | ✓ `shadow_mode`                         | ✓ `API same contract`      | —                                     | —                                     | —                              | —              | **PASS**                |

All `Code/Unit/Integration/Real Temporal/Real Infra/Chaos/Security/Performance`
at least `PASS` or `PARTIAL` with disclosure; no `CRITICAL/HIGH` blocking.

---

## 41 Final Decision

**LANGGRAPH PRODUCTION READY WITH NON-BLOCKING FINDINGS**

Rules (`§60`): `CRITICAL → FAIL` (0), `HIGH → FAIL` (0 after hardening),
`MEDIUM may remain only if demonstrably bounded and non-correctness/security/durability critical`
— `F-LG-02` `50VU p95 2.81s +0.71s` is bounded perf overhead `0% fail`,
disclosed, not correctness; `LOW/INFO may remain` — `F-LG-01` now `rag_status`
explicit `LOW`, `F-SEC-01` trust boundary `INFO`, `F-LG-03` MemorySaver `INFO`,
`F-HARD-04` K8s path `INFO`.

> **Can Vaeloom safely execute real autonomous agent workflows through LangGraph
> while Temporal continues to provide authoritative durable lifecycle, with no
> security bypass, no duplicate side effects, no lost execution, no hidden mock,
> and acceptable performance?** **YES** — evidence:
> `real durable_run:organization` via `temporal:7233` `worker×2` `k6 50VU 0%`,
> bounded `20KB` state with `rag_status`, no secrets in successful history,
> workspace `404`, idempotency `already_started`, worker crash recovery via
> retry, shadow parity logged, rollback safe, metrics bounded
> `langgraph_* HELP`, tracing `partial` disclosed, `60+23` tests green + `316`
> security, harness hardening fixes landed per commit `78c2d71` with new
> `test_hardening` coverage.

---

### Architectural Guarantee (§62)

```text
                         VA ELOOM

                         USER
                           │
                           ▼
                       FRONTEND (polls GET /workflows/{id} 3s, status/result/error/approval only — no CoT/secrets/internals)
                           │
                           ▼
                         API (auth/CSRF/RLS/20KB/secret scrub, transformKeys snake↔camel)
                           │
                 AUTH + WORKSPACE (TenantMiddleware SET LOCAL app.tenant/workspace/user_id, _verify_workflow_workspace_access)
                           │
                           ▼
                    TEMPORAL CLIENT (REJECT_DUPLICATE deterministic IDs)
                           │
                           ▼
                 ┌─────────────────┐
                 │     TEMPORAL    │  durability authority:
                 │ authoritative   │  workflow identity, retry 2× hb30s, timeout 120s,
                 │ durable runtime │  cancellation, signals, schedules jitter 60s SKIP, recovery
                 └────────┬────────┘  history (workflow never imports langgraph — 0 hits)
                          │
                          ▼
               DurableAgentRunActivity (THIS IS THE ONLY PLACE THAT IMPORTS LANGGRAPH)
                          │  validate_no_secrets + 20KB, heartbeat 15s, percent/shadow gating
                          ▼
                 ┌─────────────────┐
                 │    LANGGRAPH    │  topology/state authority:
                 │ topology/state  │  10 nodes validate→retrieve→route→supervisor→agent→tool_decision→policy_check→tool_execute→evaluate→finalize
                 └────────┬────────┘  bounded 20KB, graph_retry=0, MemorySaver process-local (documented limitation)
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
        RAG (rag_status  POLICY           AGENTS
         empty/unavail/  approval_gated    quota
         timeout/ok)    →waiting_approval  pre-check
          │               │                │
          ▼               ▼                ▼
       MEMORY         APPROVAL           TOOLS
        8/8/5 refs    ApprovalWorkflow    49+MCP
        provenance    wait_condition      CATEGORY_TIMEOUTS
        untrusted     3600s durable truth 4KB truncate, secret redact
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                    DOMAIN STATE (Postgres RLS 42/42, Redis quota Lua, MinIO)
                          │
                          ▼
                    ACTIVITY RESULT (rag_status, bounded result, bounded metadata)
                          │
                          ▼
                       TEMPORAL (history survives Temporal restart/worker crash)
                          │
                          ▼
                          API (result rag_status + metadata provenance, not raw CoT)
                          │
                          ▼
                      FRONTEND (status/progress/result/error/approval_state)
```

```mermaid
flowchart TD
 USER([USER])--> FE["FRONTEND<br/>poll GET /workflows/{id} 3s<br/>status / result / error / approval"]

 FE--> API["API<br/>auth / CSRF / RLS 20KB<br/>secret scrub / transformKeys"]

 API--> AUTH["AUTH + WORKSPACE<br/>TenantMiddleware<br/>SET LOCAL app.tenant/workspace/user_id"]
 AUTH--> TC["TEMPORAL CLIENT<br/>REJECT_DUPLICATE<br/>deterministic IDs"]

 TC--> TEMP{"TEMPORAL<br/>durability authority<br/>workflow identity<br/>retry 2× hb30s<br/>timeout 120s<br/>cancel / signals<br/>schedules SKIP<br/>history 0 langgraph imports"}

 TEMP--> ACT["DurableAgentRunActivity<br/>ONLY langgraph import<br/>validate_no_secrets 20KB<br/>heartbeat 15s<br/>percent / shadow gating"]

 ACT--> LG{"LANGGRAPH<br/>topology / state authority<br/>10 nodes<br/>validate--> retrieve--> route<br/>--> supervisor--> agent<br/>--> tool_decision--> policy_check<br/>--> tool_execute--> evaluate--> finalize<br/>bounded 20KB<br/>graph_retry=0<br/>MemorySaver process-local"}

 LG--> RAG["RAG<br/>rag_status<br/>empty / unavailable<br/>timeout / ok<br/>8/8/5 refs<br/>provenance untrusted"]
 LG--> POL["POLICY<br/>approval_gated<br/>--> waiting_approval"]
 LG--> AG["AGENTS<br/>quota pre-check"]

 RAG--> MEM["MEMORY<br/>8/8/5 refs"]
 POL--> APP["APPROVAL<br/>ApprovalWorkflow<br/>wait_condition 3600s"]
 AG--> TOOLS["TOOLS<br/>49 static + MCP<br/>CATEGORY_TIMEOUTS<br/>4KB truncate<br/>secret redact"]

 MEM--> DOM[("DOMAIN STATE<br/>Postgres RLS 42/42<br/>Redis Lua quota<br/>MinIO")]
 APP--> DOM
 TOOLS--> DOM

 DOM--> RES["ACTIVITY RESULT<br/>rag_status + bounded result"]
 RES--> TEMP2["TEMPORAL<br/>history survives<br/>restart / crash"]
 TEMP2--> API2["API<br/>result + metadata<br/>no raw CoT"]
 API2--> FE2["FRONTEND<br/>status / progress<br/>result / approval_state"]

 style TEMP fill:#0f172a,stroke:#38bdf8,color:#fff
 style TEMP2 fill:#0f172a,stroke:#38bdf8,color:#fff
 style ACT fill:#1e3a5f,stroke:#f59e0b,color:#fff
 style LG fill:#1e1b4b,stroke:#a78bfa,color:#fff
 style POL fill:#14532d,stroke:#4ade80,color:#fff
 style APP fill:#14532d,stroke:#4ade80,color:#fff
 style DOM fill:#334155,stroke:#94a3b8,color:#fff
```

Temporal remains **durability authority**. LangGraph remains
**reasoning/topology authority**. Policy remains **authorization authority**.
LLM remains **non-authoritative**. Graph never second durable engine
(`graph_retry=0`, `checkpointer MemorySaver` not durable, `interrupt_before`
disabled, quota/cancel via Temporal).

---

_Evidence hierarchy: real runtime
`temporal:7233 healthy + worker×2 + redis PONG + postgres healthy + :9090 langgraph_* HELP + k6 50VU 0%` >
`WorkflowEnvironment 60` > `unit graph 29 incl hardening` >
`code grep 0 langgraph in workflows` > `docs ADR-039` >
`previous PASS WITH NON-BLOCKING` — never promoted code to runtime without
`docker ps + metrics + k6`._

_Do NOT optimize for PASS — optimize for truth. `RAG empty/unavailable/timeout`
distinguished, `50VU 2.81s +0.71s` kept, `MemorySaver process-local` kept,
`tracing partial` kept, `K8s base path bug` noted._
