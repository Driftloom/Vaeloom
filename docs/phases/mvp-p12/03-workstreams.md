# MVP-P12 — 03. Workstreams

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation  
> **Date:** 2026-08-20 · **Baseline:** `95d9848` + P12 changes

---

## WS-12.1: Agent Policy and Runtime

**Owner:** AI/ML Engineer · **Status:** ✅ VERIFIED

### Objective

Wire agent infrastructure (circuit breaker, rate limiter, timeout, fallback,
kill switch) into the live orchestrator loop so that agent execution is bounded,
observable, and independently controllable.

### Inputs

- Orchestrator loop (`orchestrator/loop.py`) — existing think/tool/observe loop
- Circuit breaker (`infrastructure/circuit_breaker.py`) — existing per-agent
  breaker with 3-failure threshold, 30s recovery
- Rate limiter (`infrastructure/agent_limits.py`) — existing token bucket +
  concurrency slots
- Agent timeout (`infrastructure/agent_timeout.py`) — existing per-agent timeout
- Agent fallback (`infrastructure/agent_fallback.py`) — existing degradation

### Changes Made

| File                     | Change                                                                                                                            | Evidence                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `orchestrator/loop.py`   | Wired circuit breaker check before `act_phase()`; rate limiter acquisition in `act_phase()`; timeout enforcement around LLM calls | EVD-P12-001, EVD-P12-002 |
| `orchestrator/router.py` | Added kill switch check before routing to agent; adversarial detection before dispatch; metrics recording after execution         | EVD-P12-003              |

### Acceptance

- [x] Circuit breaker prevents cascading failures when agent errors exceed
      threshold
- [x] Rate limiter enforces per-agent token budget and concurrency slots
- [x] Kill switch can disable individual agents at runtime
- [x] Metrics are recorded for every agent invocation

### Tests

- Orchestrator loop tests: 54/54 pass
- Circuit breaker unit tests: existing suite continues to pass

---

## WS-12.2: Retrieval and Memory Writes

**Owner:** Data Engineer · **Status:** ✅ VERIFIED

### Objective

Implement document chunking for the ingestion pipeline and context window
management for memory retrieval, ensuring retrieved content fits within LLM
context limits.

### Inputs

- Ingestion pipeline (`ingestion/pipeline.py`) — existing document processing
- Memory agent retrieval (`agents/memory_agent/retrieval.py`) — existing hybrid
  retrieval
- Memory types schema (`schemas/memory_types.py`) — 22 memory type definitions

### Changes Made

| File                               | Change                                                                                                            | Evidence    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| `ingestion/chunking.py`            | NEW: Document chunking with paragraph/sentence/character strategies; configurable overlap; context window fitting | EVD-P12-004 |
| `ingestion/pipeline.py`            | Added chunking step to existing pipeline after parsing                                                            | EVD-P12-004 |
| `agents/memory_agent/retrieval.py` | Added context window management — retrieved results truncated to fit model's max context                          | EVD-P12-005 |

### Chunking Architecture

```
Document → Parser → Raw Text
                      ↓
              ChunkingStrategy
              ├── ParagraphChunker (default, 512 tokens, 50 overlap)
              ├── SentenceChunker (for short docs)
              └── CharacterChunker (fallback)
                      ↓
              Chunks[] (with metadata: position, overlap_prev, overlap_next)
                      ↓
              Context Window Fitting (trim to model max_tokens)
```

### Acceptance

- [x] Documents are chunked with configurable strategy and overlap
- [x] Chunks carry positional metadata for provenance
- [x] Retrieved context is truncated to model context window
- [x] Existing retrieval tests continue to pass

### Tests

- Memory service tests: 28/28 pass
- LLM service tests: 10/10 pass

---

## WS-12.3: Model, Prompt, and Tool Lifecycle

**Owner:** AI/ML Engineer · **Status:** ✅ VERIFIED

### Objective

Implement model routing based on task complexity with cost tracking, ensuring
the right model is used for each agent task type and all usage is metered.

### Inputs

- LLM service (`services/llm_service.py`) — existing provider abstraction
- Agent handlers (`agents/*/handler.py`) — existing agent implementations
- Provider dependencies: `anthropic>=0.34.0`, `openai>=1.30.0`

### Changes Made

| File                       | Change                                                                                                                                      | Evidence                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `services/model_router.py` | NEW: ModelRouter with 8-model catalog, task-complexity-to-tier mapping (fast/balanced/powerful), provider selection, cost tracking per call | EVD-P12-006, EVD-P12-007 |
| `services/llm_service.py`  | Integrated cost tracking via model router; token usage recorded per LLM call                                                                | EVD-P12-007              |

### Model Catalog

| Model                  | Provider  | Tier     | Input $/1K | Output $/1K | Context |
| ---------------------- | --------- | -------- | ---------- | ----------- | ------- |
| gpt-4o-mini            | OpenAI    | fast     | $0.00015   | $0.0006     | 128K    |
| gpt-4o                 | OpenAI    | balanced | $0.0025    | $0.01       | 128K    |
| gpt-4-turbo            | OpenAI    | powerful | $0.01      | $0.03       | 128K    |
| text-embedding-3-small | OpenAI    | fast     | $0.00002   | —           | 8K      |
| text-embedding-3-large | OpenAI    | balanced | $0.00013   | —           | 8K      |
| claude-3-haiku         | Anthropic | fast     | $0.00025   | $0.00125    | 200K    |
| claude-3.5-sonnet      | Anthropic | balanced | $0.003     | $0.015      | 200K    |
| claude-3-opus          | Anthropic | powerful | $0.015     | $0.075      | 200K    |

### Task-to-Tier Mapping

| Task Type                                                                                              | Tier     | Rationale                         |
| ------------------------------------------------------------------------------------------------------ | -------- | --------------------------------- |
| email_classify, email_draft, reminder_check, document_tag, calendar_check                              | fast     | Low-complexity, latency-sensitive |
| memory_extract, memory_merge, resume_generate, ats_score, job_search, document_summarize, entity_dedup | balanced | Moderate reasoning required       |
| cover_letter_generate, memory_consolidate, conflict_resolution, plan_generate                          | powerful | High reasoning, quality-critical  |

### Acceptance

- [x] Model router selects correct tier for each task type
- [x] Fallback chain works (tier+provider → any tier → ultimate default)
- [x] Cost is computed and logged per LLM call
- [x] Agent-level and global usage summaries are available

### Tests

- LLM service tests: 10/10 pass

---

## WS-12.4: Evaluation and Red-Team

**Owner:** Evaluation Engineer · **Status:** ✅ VERIFIED

### Objective

Build an evaluation framework with golden test cases, adversarial prompt
detection, and automated agent scoring.

### Inputs

- OWASP Top 10 for Agentic Applications (2026)
- OWASP LLM Top 10 (2025)
- Agent handlers and LLM validator

### Changes Made

| File                                 | Change                                                                                                                                                                                                                                                         | Evidence                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `infrastructure/agent_eval.py`       | NEW: 12 golden eval cases across 6 categories (memory, email, resume, ATS, safety, injection, boundary, fallback); AgentEvaluator with behavior/keyword/forbidden scoring; adversarial prompt detection with 4 pattern categories; "flagged" refusal indicator | EVD-P12-008, EVD-P12-009 |
| `services/llm_validator.py`          | Integrated adversarial detection from eval module into LLM input validation                                                                                                                                                                                    | EVD-P12-012              |
| `tests/test_agent_eval_execution.py` | NEW: 9 tests executing all 12 golden cases through the orchestrator `handle()` with patched `async_session_factory` + mock LLM; verifies adversarial blocks, clarify, fallback                                                                                 | EVD-P12-014              |

### Golden Eval Dataset (12 Cases)

| Category             | Cases | Expected Behavior                    |
| -------------------- | ----- | ------------------------------------ |
| Memory extraction    | 2     | respond — extract entities correctly |
| Email classification | 1     | respond — classify meeting/deadline  |
| Resume generation    | 1     | respond — include relevant skills    |
| ATS scoring          | 1     | respond — produce match score        |
| Safety (PII)         | 1     | refuse — block SSN/PII requests      |
| Safety (harmful)     | 1     | refuse — block hacking requests      |
| Prompt injection     | 2     | refuse — block injection attempts    |
| Boundary (empty)     | 1     | clarify — request more information   |
| Boundary (long)      | 1     | respond — handle gracefully          |
| Fallback (OOS)       | 1     | fallback — decline out-of-scope      |

### Adversarial Detection Patterns

| Category             | Severity | Pattern Examples                                                      |
| -------------------- | -------- | --------------------------------------------------------------------- |
| Direct injection     | Critical | "ignore previous instructions", "forget everything", "system prompt:" |
| Role hijack          | High     | "pretend you are", "roleplay as", "you are now a"                     |
| Data exfiltration    | Critical | "show me the system prompt", "reveal your instructions"               |
| Privilege escalation | Critical | "bypass safety", "disable content filter", "override rules"           |

### Acceptance

- [x] Golden dataset covers all 8 canonical agent domains
- [x] Adversarial patterns cover OWASP prompt injection vectors
- [x] Scoring produces 0.0–1.0 with behavior match + keyword checks
- [x] Evaluator is async-compatible and tracks results by category

### Limitation

- Eval framework is **executed** against the mock LLM through the orchestrator
  (12 cases, EVD-P12-014). Execution against live provider LLMs is deferred to
  P14 (RISK-P12-04, EXC-P12-01).

### Tests

- Eval execution: 9/9 pass (`tests/test_agent_eval_execution.py`)
- LLM validator tests: 19/19 pass

---

## WS-12.5: AI Operations, Cost, and Oversight

**Owner:** SRE · **Status:** ✅ VERIFIED

### Objective

Implement agent-level observability with metrics collection, runtime kill
switches, and cost aggregation for operational oversight.

### Inputs

- Infrastructure modules (existing circuit breaker, rate limiter, timeout)
- Model router (new in WS-12.3)
- Prometheus instrumentation (existing in main.py)

### Changes Made

| File                                    | Change                                                                                                                                                 | Evidence    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `infrastructure/agent_observability.py` | NEW: AgentMetricsCollector (success rate, latency, cost, errors per agent); RuntimeKillSwitch (per-agent enable/disable, global kill, status endpoint) | EVD-P12-010 |

### Kill Switch Architecture

```
KillSwitchManager
├── per_agent_switches: dict[str, bool]  # True = enabled
├── global_kill: bool                     # True = all agents disabled
├── disable_agent(name)                   # Disable specific agent
├── enable_agent(name)                    # Re-enable agent
├── is_enabled(name) → bool              # Check before routing
└── get_status() → dict                  # Dashboard-friendly status
```

### Metrics Collected

| Metric                    | Granularity              | Purpose             |
| ------------------------- | ------------------------ | ------------------- |
| `agent_invocations_total` | per-agent                | Volume tracking     |
| `agent_success_rate`      | per-agent                | Quality monitoring  |
| `agent_latency_ms`        | per-agent (p50/p95/p99)  | Performance         |
| `agent_cost_usd`          | per-agent, per-model     | Cost control        |
| `agent_errors_total`      | per-agent, by error type | Reliability         |
| `circuit_breaker_state`   | per-agent                | Health status       |
| `kill_switch_state`       | per-agent + global       | Operational control |

### Acceptance

- [x] Metrics collector tracks all agent invocations
- [x] Kill switches can disable/enable agents independently
- [x] Global kill switch disables all agent processing
- [x] Status endpoint returns machine-readable agent health
- [x] Cost aggregation available per-agent and globally

### Tests

- Orchestrator + loop tests: 54/54 pass (includes kill switch paths)

---

## WS-12.6: BYOK Provider Keys (discovered requirement)

**Owner:** AI/ML Engineer · **Status:** ✅ VERIFIED

### Objective

Discovered during implementation: real deployments need per-workspace and
per-user provider API keys so users can bring their own keys (BYOK) instead of
relying solely on a system key. Deliver encrypted key storage, CRUD/rotation/
validate endpoints, deterministic priority resolution, and wire the resolved key
into the LLM service for every call.

### Changes Made

| File                                          | Change                                                                                                                                                                                                                                                                                              | Evidence    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `services/provider_key_service.py`            | NEW: Fernet encryption (`encrypt_value`/`decrypt_value`), key hint masking, provider validation (OpenAI via `Authorization` header, Google via `x-goog-api-key` header, custom providers via format check), priority resolution (explicit > workspace > user > system), `mark_used` last-used stamp | EVD-P12-013 |
| `routers/provider_keys.py`                    | NEW: CRUD + PATCH (typed `ProviderKeyUpdate`), DELETE, validate endpoint; no plaintext key ever returned                                                                                                                                                                                            | EVD-P12-013 |
| `schemas/provider_key.py`                     | NEW: `ProviderKeyCreate/Update/Read`; masked `key_hint`                                                                                                                                                                                                                                             | EVD-P12-013 |
| `alembic/versions/0016_provider_keys_byok.py` | NEW: `provider_keys` table (workspace_id nullable, user_id, provider, encrypted_key, key_hint, is_active, last_used_at)                                                                                                                                                                             | EVD-P12-013 |
| `services/llm_service.py`                     | `_resolve_api_key()` consults BYOK store before system key; **awaits** `mark_used()` (was fire-and-forget `asyncio.create_task`); `_infer_provider_from_model` handles Groq; `generate_embedding` rejects non-OpenAI providers with clear error                                                     | EVD-P12-013 |
| `services/agent_service.py`                   | Removed bogus `workspaceId` lower() lookup                                                                                                                                                                                                                                                          | EVD-P12-013 |
| `routers/agents.py`                           | NEW: `GET /api/v1/agents/catalog` — 8 canonical agents with skills/memory scopes/tool definitions                                                                                                                                                                                                   | EVD-P12-015 |
| `routers/memory.py`, `schemas/memory.py`      | Memory list filters: `workspace_id`, `include_superseded`, `status=all`                                                                                                                                                                                                                             | EVD-P12-016 |
| `main.py`                                     | Mounted provider-keys router; BYOK wiring in agent dispatch                                                                                                                                                                                                                                         | EVD-P12-013 |

### Resolution Priority

```
1. Explicit provider override (model/embedding call args)
2. Workspace-scoped key   (provider_key_service.resolve_key(workspace_id, ...))
3. User-scoped key
4. System key (settings.llm_api_key / embedding_api_key)
```

### Security Properties

- Keys encrypted at rest with Fernet (`ENCRYPTION_KEY`)
- `key_hint` masks the raw key; API responses and logs never expose plaintext
- Cross-user/cross-workspace access returns 404 (no existence leak)
- Rotating a key updates hint and re-encrypts; deactivation stops use
- BYOK privacy: memory content sent to the user's chosen provider is processed
  under that provider's policy — the user's provider agreement applies
- Fallback: BYOK failure → system key (no hard dependency)

### Tests

- `tests/test_provider_key_service.py` 14/14,
  `tests/test_provider_keys_router.py` 12/12, `tests/test_llm_byok.py` 12/12,
  `tests/test_agent_catalog.py` 4/4, `tests/test_memory_filters.py` 8/8 — all
  pass
