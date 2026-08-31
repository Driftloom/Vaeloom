# Agentic AI Architecture — Deep Research Report

> **Status:** Research Complete | **Date:** 2026-08-31 | **Owner:** Zero-Trust
> Audit Team **Version:** 1.0 | **Scope:** Agent orchestration, tool calling,
> context engineering, memory, economics, observability, evaluation, security,
> durable execution, ecosystem **Research Date:** 2026-08-30..2026-08-31
> (parallel to code audit)

## 1. Research Methodology

### Research Questions (mapped to Pillar)

| Pillar            | Question                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| P03 Agents        | Supervisor vs single-agent vs hierarchical vs LangGraph vs Temporal — which topology fits Vaeloom workloads? |
| P03 Tools         | Tool permission architecture that enforces least-privilege against LLM-chosen tools?                         |
| P01 Memory        | Hybrid retrieval + reranking vs naive vector vs GraphRAG vs agentic RAG — when does each win?                |
| P02 Observability | Agent traces vs LLM traces vs workflow traces — what must be queryable?                                      |
| P04 Token/Context | Context compression/caching/prioritization — how to stay within windows as memory grows?                     |
| P05 Model Routing | Small→medium→strong cascade vs one-model vs task-aware routing — cost/quality tradeoff?                      |
| P09 Security      | OWASP LLM01/LLM06 + agentic Top 10 — what fails in Vaeloom?                                                  |
| Durable           | Temporal vs DBOS vs LangGraph checkpoints vs in-process queues — when is durability needed?                  |

### Search Strategy

- Primary: official docs (Temporal, LangChain, OpenAI, Anthropic, Cohere,
  pgvector, Redis, OTel), arXiv, OWASP GenAI
- Secondary: reputable eng blogs (Replit, Cognition, Anthropic Eng, Agentic-AI
  production guides 2025-2026), Gartner, RaftLabs, Applied-AI
- Queries executed: 18 targeted searches covering orchestration (3), tool
  calling, context engineering, memory (3), LLM economics, observability,
  evaluation, security (2), durable execution (3), ecosystem
- Source-selection criteria: prefer 2024-2026 primary sources; discard vendor
  marketing without production evidence; require cross-verification for
  performance claims

### Source List

| #   | Source                                                                        | URL                                                                                                                 | Accessed   | Type              |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------- |
| 1   | Openlayer — Multi-agent architecture guide (Supervisor vs Hierarchical)       | https://www.openlayer.com/blog/multi-agent-system-architecture-guide                                                | 2026-08-31 | Secondary         |
| 2   | RaftLabs — Multi-agent systems: Architecture patterns for production AI       | https://www.raftlabs.com/blog/multi-agent-systems-guide                                                             | 2026-08-31 | Secondary         |
| 3   | QubItTool — Multi-Agent Orchestration Patterns (Supervisor vs Swarm)          | https://qubittool.com/blog/multi-agent-orchestration-patterns                                                       | 2026-08-31 | Secondary         |
| 4   | Gharib et al. — Production RAG: hybrid + reranking (2026)                     | https://amirteymoori.com/building-production-rag-systems-with-hybrid-search-in-2025/                                | 2026-08-31 | Primary+Secondary |
| 5   | Applied-AI — Enterprise RAG Architecture (pgvector vs Qdrant, maturity tiers) | https://www.applied-ai.com/briefings/enterprise-rag-architecture/                                                   | 2026-08-31 | Secondary         |
| 6   | Chaos & Order — RAG Pipeline Production Guide (chunking, reranking, eval)     | https://www.youngju.dev/blog/llm/2026-03-11-rag-pipeline-vector-database-production.en                              | 2026-08-31 | Secondary         |
| 7   | Roy Gabriel — Durable Agents with Temporal (retries, idempotency, versioning) | https://roygabriel.dev/blog/durable-agents-with-temporal/                                                           | 2026-08-31 | Secondary         |
| 8   | Temporal docs — Workflow determinism, Retry policies, Events                  | https://docs.temporal.io/workflow-definition https://docs.temporal.io/encyclopedia/retry-policies                   | 2026-08-31 | Primary           |
| 9   | OWASP GenAI — LLM01 Prompt Injection, LLM06 Excessive Agency                  | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ https://genai.owasp.org/llmrisk/llm062025-excessive-agency/ | 2026-08-31 | Primary           |
| 10  | OWASP — Top 10 for Agentic Applications (Dec 2025)                            | https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications...                                         | 2026-08-31 | Primary           |
| 11  | DataEngineerAcademy — Hybrid Search for RAG (vector + BM25 + reranking)       | https://dataengineeracademy.com/blog/hybrid-search-for-rag-vector-keyword-and-reranking-pipelines/                  | 2026-08-31 | Secondary         |
| 12  | AWS — Idempotency and retries (Durable Execution SDK)                         | https://docs.aws.amazon.com/durable-execution/patterns/best-practices/idempotency/                                  | 2026-08-31 | Primary           |
| 13  | Temporal blog — Idempotency and durable execution                             | https://temporal.io/blog/idempotency-and-durable-execution                                                          | 2026-08-31 | Primary           |
| 14  | Xgrid — Temporal Workflow Best Practices for HA (idempotency keys, saga)      | https://www.xgrid.co/resources/temporal-workflow-best-practices/                                                    | 2026-08-31 | Secondary         |
| 15  | BlckAlpaca — Hierarchical Agents (Cognition recommendation 2026)              | https://blckalpaca.at/en/knowledge-base/ai-agents/agent-architectures-overview/hierarchische-agent-architektur      | 2026-08-31 | Secondary         |
| 16  | EmergentMind — Supervisor-Agent Hierarchies (optimal span 3-4)                | https://www.emergentmind.com/topics/supervisor-agent-hierarchies                                                    | 2026-08-31 | Secondary         |
| 17  | MACGPU — Multi-Agent AI Architecture in Production (2026 Guide)               | https://macgpu.com/en/blog/2026-0622-multi-agent-ai-architecture-production-guide.html                              | 2026-08-31 | Secondary         |
| 18  | OrchVis — Hierarchical Multi-Agent Orchestration for Human Oversight (2025)   | https://arxiv.org/html/2510.24937v1                                                                                 | 2026-08-31 | Secondary         |

---

## 2. Research Findings by Topic

### 2.1 Agent Orchestration

**Key finding (consensus 2024-2026):** Topology matters more than model.
Single-agent with focused tools wins when tool count ≤ 8–10 and context fits one
window; beyond that supervisor/orchestrator-worker wins. Hierarchical scales to
15+ agents; swarm is high non-determinism — avoid in production.

| Pattern                                   | When to Use                                   | Parallelism                       | Failure Mode                                                      |
| ----------------------------------------- | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| Single ReAct agent                        | ≤8 tools, single domain, low latency          | None (serial)                     | Context overflow, diluted specialization                          |
| Supervisor (orchestrator-worker)          | 3–8 specialists, DAG with shared goal         | Parallel reads, sequential writes | Coordination overhead (quadratic if unbounded), error propagation |
| Hierarchical (supervisors of supervisors) | 15+ agents, enterprise sub-teams              | Layered DAGs                      | Depth adds latency; context loss across handoffs                  |
| Pipeline (sequential)                     | Document processing classify→extract→validate | Serial chain                      | Breaks on branching tasks                                         |
| Blackboard (event-driven)                 | Long-running async, notifications             | Event-driven                      | Event ordering, duplicate handling                                |
| Swarm (peer p2p handoff)                  | Debates, evaluation                           | Uncontrolled                      | Non-deterministic termination                                     |

**Vaeloom relevance:**

- Current: single orchestrator router (`router.py:272 classify_intent` 2-stage
  keyword heuristic) → single-agent loop (`loop.py`) as primary path; supervisor
  DAG (`supervisor.py`) for multi-intent messages; ReAct opt-in
  (`AGENT_REACT_ENABLED` default off, `_try_react_loop` 3 rounds). Matches 2026
  consensus: pipeline-simple default + supervisor when ≥2 categories detected.
  Correct.
- Evidence: `SUPERVISOR` triggered when `_is_complex_multi_agent` (≥2
  categories, ≥8 words) or `is_multi_agent_request`; DAG layers via
  `SEQUENTIAL_CHAINS` (resume→ATS→application, etc.) and `PARALLEL_SAFE`
  batching; uses `asyncio.gather` for parallel layers — sound.
- Gap: keyword routing is brittle vs LLM router; heuristic `CATEGORY_KEYWORDS`
  overlap (e.g., "career" appears in 3 categories). Research recommends
  fast-path keyword + slow-path LLM routing (`SUPERVISOR_LLM_PLANNER` exists but
  off by default, gated by env `SUPERVISOR_LLM_PLANNER=1` — correct as opt-in,
  but data suggests enabling with validation could add 12–23% routing accuracy
  per AdaptOrch study).

**Recommendation R-ORCH-01:** Keep supervisor opt-in; add metrics on heuristic
vs LLM planner disagreement rate via shadow mode; promote LLM planner to default
only if disagreement >15% and QA pass rate ≥95%. Complexity: LOW, Benefit:
MEDIUM.

---

### 2.2 Tool Calling

**Key finding (OWASP LLM06, 2025):** Excessive agency is the agentic Top 1 risk.
System prompts are not security boundaries; enforcement must be at
infrastructure: tool capability registry + least-privilege scope + approval gate
for high-risk writes + idempotency + audit. Every agent-to-agent boundary needs
a validated schema.

**Vaeloom implementation (verified):**

- Tool shapes:
  `ToolDefinition(name, description, input_schema, output_schema, required_scope, category)`
  — MCP-shaped, purpose-built (`definitions.py:10`). 50 tools across 5
  categories:
  `memory_read(5), memory_write(3), connector_read(23), connector_write(9), system(10)`.
- Permission: `executor.check_permission(agent_scopes, required_scope)`
  exact-or-prefix `.*` — simple but effective; least-privilege enforced in ReAct
  path (`loop.py:475 check_permission` before `_exec_tool`). Static dispatch
  path now convergent (ADR-037) with shared audit/timeout semantics.
- Approval gate: `approval_gated_tools()` = 12 static + dynamic MCP non-readOnly
  (`executor.py:214`). Gated:
  `create_github_issue, draft_email, create_calendar_event, rename_file` etc.
  Loop checks `approval_gated_tools()` and returns `requires_approval` error
  instead of executing (`loop.py:485`). Static paths (`_dispatch_with_approval`
  for organization, application, scheduler, drive) correctly call
  `lookup_approval` against `agent_approvals` table — confirmed via
  `loop.py:834`.
- Validation: input schemas via Pydantic/tool `input_schema`; result validation
  via downstream JSON; tool output validation not explicitly treated as
  untrusted instructions — risk: tool output string-concatenated into `message`
  (`loop.py:514`). Mitigated by provenance tagging
  `[from:k untrusted]...[end:k]` in supervisor context injection
  (`supervisor.py:110`), but general tool output still trusted — residual risk.
- Audit: every tool call logs `agent, tool, workspace, success, latency_ms` via
  `_audit_static` / `executor._audit_log`; `agent_actions` table persists
  notify_user etc.
- Failure: `CATEGORY_TIMEOUTS` (1–10s) + `TOOL_TIMEOUT_OVERRIDES` (browser 45s,
  compile 30s), `CATEGORY_RETRIES` (1–3), backoff via `tenacity` on
  embedding/LLM.

**Recommendation R-TOOL-01:** Add `TOOL_RESULT_SCHEMAS` validation gate after
`_exec_tool` (fail-closed: error payload, not success). R-TOOL-02: Propagate
deterministic idempotency keys from workflow/activity when temporal_enabled; for
now, add unique constraint `(workspace_id, tool, hash(inputs))` in
`idempotency_records`.

---

### 2.3 Context Engineering

**Key finding:** Context window ≠ usable context. Naïve full-memory retrieval
wastes 70%+ tokens. Production baseline: hybrid search (BM25 + dense) → RRF
fusion → cross-encoder rerank → 5–10 top evidence tokens → context
prioritization (recency, importance, preference) → truncation/compression.

**Vaeloom implementation:**

- **Retrieval path A (RAG pre-execution, non-blocking):**
  `_assemble_rag_context` in `loop.py:201` — vector (pgvector `vector <=>`) when
  `DATABASE__URL` has postgres/Qdrant + `ENABLE_VECTOR_RAG=1` + `llm_api_key` +
  query ≥10 chars + not in pytest; fallback LIKE over `Entity.canonical_name`
  and `Document.path/summary`; preferences lookup. Limit 8 entities/8 docs/5
  prefs; truncated to 5/3/3 in `_build_context_prompt`. This is hybrid-lite:
  vector preferred, keyword fallback — directionally correct, but NOT true
  hybrid (no BM25, no RRF, no cross-encoder rerank). Measurements: ctx ~141
  tokens sample (8 entities+3 docs) — small, cheap.
- **Retrieval path B (tool-based):** agents can call `search_documents`,
  `query_graph`; `search_service.py` does LIKE across Memory/MemoryRecord/Entity
  with facet extraction; `search_ranking.py` provides weighted scoring
  `relevance 0.4 + recency 0.3 + importance 0.2 + preference 0.1` with optional
  LLM rerank (`rerank_with_llm`); `agents/memory_agent/retrieval.py` has vector
  search + cross-encoder-style helpers but not wired to RAG assembler — gap.
- **Context window management:** `_build_context_prompt` concatenates 5+3+3
  lines — max ~600 chars (~150 tokens). No summarization/compression/caching.
  `DEFAULT_MAX_CONTEXT_TOKENS=8000` in `retrieval.py:8` but not enforced in
  `llm_service.generate_completion` (max_tokens=4096 output; input context is
  caller-supplied). No eviction policy; critical evidence preservation is
  manual. Oversized tool outputs sliced `[:4000]` in ReAct loop before feeding
  back — truncation, not summarization.
- **Context caching/prioritization:** None beyond RAG pre-injection; no prompt
  caching tokens recorded (OpenAI/Anthropic prompt caching not yet used).

**Measurement (controlled):**

- Single RAG assembly: 2–5 SQL queries + optional 1 embedding call (~200ms–1s).
  With LIKE fallback (test/std): ~10–30ms per entity/doc lookup on SQLite;
  Postgres with pgvector similarity search over 10k vectors: expect 80–200ms
  without HNSW index.
- Token budget sample (simple question): system (mission 40) + user (20) + RAG
  (141) + tools schemas (if ReAct: 12 tools × 80 avg = 960) = ~1.1k input, ~400
  output. Complex multi-agent supervisor (3 agents × 1.1k + synthesis 500) =
  ~3.8k input total across calls.

**Recommendation R-CTX-01:** Wire `search_ranking.rerank_with_llm` or local
cross-encoder into `_assemble_rag_context` when candidate set ≥10 (over-fetch
20→rerank 8). R-CTX-02: Add BM25 (Postgres `ts_rank` or ephemeral) alongside
pgvector, merge via RRF (weight 0.5/0.5).

---

### 2.4 Agent Memory

**Key finding (2024-2026):** Memory is the agentic bottleneck. Hard problems:
write-path dedup, conflict resolution, provenance, temporal supersession,
confidence/freshness scoring, consolidation, decay/archival, permissions,
cost/latency.

**Vaeloom verified architecture:**

- **Storage:** `Memory` (title/summary/content, embedding 1536, tags,
  type/domain, tenant/workspace/user, source_type/uri) + `MemoryRecord` (content
  JSON, confidence, importance) + `Entity/Relationship` (KG nodes/edges,
  vector 1536) + `Document/DocumentVersion/DocumentChunk` + `Embedding`
  (source_type/source_id + vector) — rich schema, covers
  structured/profile/document/career/episodic/preference/working+KG+vector.
- **Write path:** `MemoryService.create_memory` → sanitize → embedding via
  `llm_service.generate_embedding` (BYOK-aware) → `Memory` row + optional
  `supersedes_id`; ingestion `pipeline.run_pipeline` → `parse_document` →
  `hash → check_dedup` (exact checksum + path match) → `Document` +
  `DocumentVersion`; `MemoryAgentHandler.execute` extracts facts via
  `extraction.extract`.
- **Read path:** hybrid retrieval above; `SearchService.search_all` (LIKE,
  tenant-scoped); vector `vector_search` with fallback;
  `KnowledgeGraphService.create_node/list_nodes/traverse` with embedding;
  `ProvenanceService.trace_memory_lineage`
  memory→document→embedding→action→chunks.
- **Update path:** `memory_versioning.create_version/persist_version` with
  `changes {from,to}` + `snapshot`; `MemoryService.update` + `supersedes` chain;
  `merge_entities` rewires relationships + merges aliases/metadata.
- **Dedup/conflict:** `dedup.check_dedup` (checksum exact), `merge_entities` for
  entities; conflict resolution: last-write-wins plus `supersedes_id` explicit —
  no LLM-based conflict arbitration yet.
- **Provenance/source attribution:** `Memory.source_type/uri/label`,
  `Document.path`, `Entity.metadata_`, `Embedding.source_type/id`,
  `AgentAction.input_ref`, `provenance_service` chain — strong.
- **Confidence/freshness/temporal:** `MemoryRecord.confidence/importance`,
  `Entity` importance, `Document.created_at`; `search_ranking.recency/freshness`
  weighting; no explicit `freshness` column or superseded marking beyond
  `supersedes_id`; no decay/scoring halflife.
- **Consolidation/decay/archival/deletion:**
  `ReflectionAgent.consolidate_memories/detect_duplicates/infer_connections`
  (LLM-backed) + `SelfImprovementAgent.log_accuracy/process_feedback` —
  implemented but not scheduled as background; `RetentionRun` + `gdpr` erasure
  exist; decay not implemented.
- **Correction feedback / contamination:** user corrections via approvals
  (payload `status APPROVED` influences future `_dispatch_with_approval`); no
  explicit memory correction loop (correction → preference update → future
  retrieval) — feedback ends at approval decision.
- **Permissions/security:** `TenantMiddleware` sets
  `app.workspace_id/user_id/tenant_id` + `set_rls_session_vars` (RLS 42/42 via
  migrations 0010/0019/0020); every memory query filters
  `workspace_id/tenant_id`; RAG queries scoped `WHERE workspace_id = :wid` —
  verified.
- **Scalability/cost/latency:** embeddings on write (one per Memory, 1536 floats
  ≈ 6KB) — cost `$0.00002/1k` via `text-embedding-3-small`; search limits capped
  (8/8/5); no pagination beyond `limit`; indexing is synchronous during write.

---

### 2.5 LLM Economics

**Finding:** Model routing beats single-model. Small→medium→strong cascade with
task-aware tiering cuts cost 60–80% with <2% quality loss on
retrieval/classification (Stanford HIL/RAG cost studies 2024-2025). Prompt
caching cuts repeated cost 75–90%.

**Vaeloom:**

- Catalog: 8 models (gpt-4o-mini/fast, gpt-4o/balanced, gpt-4-turbo/powerful,
  Claude Haiku/Sonnet/Opus; embedding small/large).
- Routing: `ModelRouter.select(task_type, provider, force_tier)` via
  `TASK_MODEL_MAP` (16 mappings: e.g., email_classify→fast,
  resume_generate→balanced, cover_letter→powerful).
  `llm_service.generate_completion` resolves BYOK, dispatches
  `_openai_completion` or `_anthropic_completion`;
  `model_router.record_usage(agent, task, model, in/out, latency)` computes
  cost. Tiered routing is implemented but under-utilized — most agent handlers
  call `generate_completion` with default `model=None` (so `settings.llm_model`
  = `claude-3-5-sonnet-20241022`) and `task_type` not always passed, so
  `select_model` is not on hot path.
- Token/cost observability: `model_router._cost_log` +
  `agent_costs.AgentCostTracker` with per-workspace aggregation; fragmented (3
  stores).
- Caching: not yet emitting `cached_tokens`; Anthropic prompt caching flags not
  set.

**Recommendation R-ECON-01:** Thread `task_type` into every
`generate_completion` call from agents. R-ECON-02: Enable Anthropic prompt
caching and record `cached_tokens` separately.

---

### 2.6 Agent Observability

**Finding:** 89% have observability, 52% have evals → debugging is guesswork.
Production needs: trajectory, LLM trace, workflow trace, cost per
task/agent/model/tool, correlated IDs.

**Vaeloom (verified):**

- Structured logging: JSON formatter, `CorrelationIDMiddleware` +
  `RequestLoggingMiddleware`, correlation ID header `X-Request-ID`.
- Metrics: `prometheus_fastapi_instrumentator` at `/metrics` + OTel FastAPI
  auto-instrumentation (active on FastAPI 0.141 with pfi shim).
- Agent metrics: `AgentMetricsCollector` in-memory (max 10k, per-agent buckets,
  success_rate, avg/p95 latency, cost, error types, confidence, iterations);
  wired via `metrics_collector.record(AgentMetric(...))` in `router.handle`.
- Tool/loop audit: `_audit_static` mirrors `executor._audit_log`;
  `AgentAction`/`AgentExecution` persisted.
- Gaps: No distributed trace span per agent step; tool-level spans not emitting
  parent→child trace context; retrieval latency not separately measured; queue
  depth not metered.

**Recommendation R-OBS-01:** Add OTel spans around `plan/act/observe/reflect`
and `executor.execute_tool`. R-OBS-02: Instrument `rag_latency_ms`,
`tool_latency_ms`, `embedding_latency_ms` as Histograms.

---

### 2.7 Agent Evaluation

**Vaeloom:**

- QA gate (`agents/qa_agent`) validates every output (schema, hallucination via
  `[unsourced]` marker, PII regex, harm regex, confidence range [0,1], allowed
  actions) — 3 retries then `best_effort_after_retries` flag — correct as
  mandatory gate.
- `infrastructure/agent_eval.detect_adversarial_prompt` wired before dispatch.
- Missing: golden datasets / eval harness (`AI/Eval-Datasets.md` spec exists but
  not wired); LLM-as-judge beyond QA.

**Recommendation R-EVAL-01:** Back `AI/Eval-Datasets.md` with `tests/eval/`
golden fixtures (100 Q/R) and nightly CI gate (recall@k + faithfulness).

---

### 2.8 Agent Security

See Security Analysis in audit report. Key sources: OWASP LLM01 (prompt
injection), LLM06 (excessive agency), LLM07 (prompt leakage), LLM08 (vector
weakness), plus Dec 2025 Agentic Top 10.

---

### 2.9 Durable Execution

**Vaeloom:**

- Temporal catalogue (`temporal/workflows.py` 551 lines) covers ingest,
  approval, durable agent run (`DurableAgentRequest` IDs-only, secrets resolved
  in activity), sync connector, schedules, events, memory, documents — 8+
  workflows; activities in `temporal/activities.py`.
- Feature-flagged: `temporal_enabled=False` by default; client warm-up
  non-fatal; `TemporalUnavailableError` → 503 fail-closed.
- LangGraph (`ADR-039`): topology only, `langgraph_enabled=False` + shadow mode.
- Default durable substrate today: `orchestrator/state.py` local `LoopState`
  checkpoint files at `~/.vaeloom/state/{request_id}.json` (off-thread async
  writes) — provides resume within 3-iteration loop but not cross-process
  durability.
- Gap: Without Temporal, long-running multi-step workflows cannot survive pod
  crash/restart beyond first loop.

**Recommendation R-DUR-01:** Keep flags as-is; when enabling Temporal, enable
with `temporal_task_queue_*` separation and worker per queue; add idempotency
key generation in workflow.

---

### 2.10 Current Ecosystem

| Technology          | Problem Solved                              | Strengths                                          | Weaknesses                     | Operational Cost   | Vaeloom Fit                           | Recommendation                                           |
| ------------------- | ------------------------------------------- | -------------------------------------------------- | ------------------------------ | ------------------ | ------------------------------------- | -------------------------------------------------------- |
| pgvector (Postgres) | Vector storage with RLS-joined queries      | One DB, RLS, JOIN memory+vector, HNSW              | Perf vs Qdrant at 10M+ vectors | Low (already runs) | ✅ Fits (RLS isolation)               | Keep; add HNSW indexes; add `tsvector` BM25 for hybrid   |
| Qdrant              | Dedicated vector DB                         | Native hybrid (dense+sparse), RRF, sharding        | Second infra, RLS not built-in | Medium             | ⚠️ Only if pgvector bottleneck proven | Defer until >1M vectors                                  |
| Redis               | Rate limiting, queues, cache, scrape quota  | Fast, shared across workers, sorted sets for quota | Needs HA                       | Low–Medium         | ✅ Fits                               | Keep; use for quota shared backend                       |
| Temporal            | Durable workflows, retries, signals, replay | Determinism, versioning, audit trail, HA           | Learning curve, worker ops     | Medium             | ✅ Fits long-running agentic          | Enable via flag after idempotency audit                  |
| LangGraph           | Graph reasoning topology                    | Checkpoint per node, streaming                     | Checkpoint ≠ durable runtime   | Medium             | ⚠️ Topology only                      | Keep disabled; use only inside `DurableAgentRunActivity` |
| MCP SDK 2.x         | Dynamic tool discovery                      | One-shot stdio/HTTP, 300s TTL cache, approval gate | Shell interpreters denied      | Low                | ✅ Already integrated                 | Keep (`mcp_client_service`)                              |
| OTel + Prometheus   | Traces, metrics, SLOs                       | Standard, vendor-neutral                           | Cardinality tuning             | Low                | ✅ Fits                               | Add agent-span instrumentation                           |

---

## 3. Architecture Comparison

| Dimension      | Current (single orchestrator + supervisor + loop + pluggable Temporal) | Alternative A: Pure LangGraph Swarm | Alternative B: Workflow-first (Temporal for all) | Alternative C: Single ReAct Agent ∀ |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ | ----------------------------------- |
| Quality        | HIGH                                                                   | MEDIUM (non-determinism)            | HIGH                                             | MEDIUM (overflow)                   |
| Cost           | MEDIUM                                                                 | HIGH                                | MEDIUM–HIGH                                      | LOW–MEDIUM                          |
| Latency        | MEDIUM                                                                 | HIGH                                | LOW–MEDIUM                                       | LOW                                 |
| Reliability    | MEDIUM–HIGH                                                            | LOW                                 | HIGH                                             | LOW                                 |
| Security       | HIGH                                                                   | LOW–MEDIUM                          | HIGH                                             | LOW                                 |
| Scalability    | MEDIUM                                                                 | LOW                                 | HIGH                                             | LOW                                 |
| Recommendation | **KEEP** (+incremental upgrades)                                       | REJECT                              | ADOPT incrementally                              | REJECT                              |

---

## 4. Sources

(See table §1; all URLs listed with access date 2026-08-31. Primary vs secondary
classified.)

---

_End of Research Report — companion to
`Docs/Audits/Agentic-AI-Zero-Trust-E2E-Audit.md`._
