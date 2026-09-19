# MVP-P12 — 10. Handoff to P13

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation
> **Date:** 2026-08-20 (corrected) · **Gate:** 88.4/100 (CONDITIONAL —
> RESTRICTIONS APPLY) **Next phase:** MVP-P13 — Security, Privacy, and
> Compliance

## What P13 receives

### Infrastructure (new in P12)

- **Circuit breaker** (`infrastructure/circuit_breaker.py`) — wired into
 orchestrator loop; per-agent with 3-failure threshold, 30s recovery
- **Rate limiter** (`infrastructure/agent_limits.py`) — token bucket +
 concurrency slots per agent; wired into act_phase (30 rpm default,
 capacity 30)
- **Runtime kill switches** (`infrastructure/agent_observability.py`) —
 per-agent enable/disable, global kill, status endpoint
- **Agent metrics** (`infrastructure/agent_observability.py`) — success rate,
 latency, cost, error tracking per agent
- **Model router** (`services/model_router.py`) — task-complexity-based model
 selection + cost tracking; 8-model catalog priced against live provider pages
- **Eval framework** (`infrastructure/agent_eval.py`) — 12 golden eval cases,
 adversarial prompt detection (4 categories, 14 patterns), scoring —
 **executed** through the orchestrator against the mock LLM (9 tests)
- **Chunking** (`ingestion/chunking.py`) — paragraph/sentence/character chunking
 with overlap + context window fitting
- **BYOK provider keys** (`services/provider_key_service.py`,
 `routers/provider_keys.py`, `schemas/provider_key.py`,
 `alembic/versions/0016_provider_keys_byok.py`) — Fernet-encrypted
 per-workspace/ per-user keys, CRUD/rotate/validate, priority resolution, no
 plaintext exposure
- **Agents catalog** — `GET /api/v1/agents/catalog` (8 canonical agents)
- **Memory filters** — `workspace_id`, `include_superseded`, `status=all`

### Modified systems

- **Orchestrator loop** — circuit breaker + rate limiter + timeout enforcement;
 approval dispatch refactored
- **Orchestrator router** — kill switch check + adversarial detection + metrics
 recording
- **LLM service** — cost tracking via model router; BYOK `_resolve_api_key`
 (awaited `mark_used`, groq inference, non-OpenAI embedding guard)
- **LLM validator** — enhanced with adversarial prompt detection
- **Retrieval** — context window management; results truncated to fit LLM
 context
- **Ingestion pipeline** — document chunking step added
- **OpenAPI spec** — regenerated from live app (88 paths, matches test)

### What P13 must verify

1. **SAML signxml in pyproject.toml** — deferred from P11
2. **Connector permissions UI persistence** — deferred from P11; NOT addressed
 in P12
3. **Memory versioning durability** — in-memory only, needs DB backing
 (EXC-P12-03)
4. **Live-provider eval execution** — P12 ran mock-LLM eval (EXC-P12-01)
5. **BYOK privacy consent-language review** — memory content processed under the
 user's chosen provider's policy (RISK-P12-10)
6. **BYOK custom-provider remote validation** — format-only in P12 (P14)

### Restrictions carried from P12

- No new dependencies without change control
- Enterprise surfaces stay gated
- Gmail stays draft-only
- Circuit breaker thresholds are hardcoded (not per-agent configurable)
- Eval executed with mock LLM only; live-provider execution P14
- Chunk→embedding auto-wiring not done (EXC-P12-04)

## Test Results

| Run | Tests | Result |
| -------------------------------------------------- | ------------------------------------------------------- | ----------- |
| Full suite (`pytest tests/ -q`, SQLite + mock LLM) | **2405 passed, 4 skipped, 2 xfailed, 0 failed** (1677s) | ✅ ALL PASS |
| Baseline (pre-P12) | 2333 passed, 2 xfailed | — |
| New P12 tests | 68 (BYOK, catalog, filters, eval execution, LLM-byok) | ✅ ALL PASS |

## Code Changes Summary

| # | File | Change |
| --- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1 | `orchestrator/loop.py` | Circuit breaker + rate limiter + timeout wired; dispatch refactored |
| 2 | `orchestrator/router.py` | Kill switch + adversarial detection + metrics recording |
| 3 | `ingestion/chunking.py` | NEW: Document chunking module |
| 4 | `ingestion/pipeline.py` | Chunking step added |
| 5 | `services/model_router.py` | NEW: Model routing + cost tracking |
| 6 | `infrastructure/agent_observability.py` | NEW: Metrics + kill switches |
| 7 | `infrastructure/agent_eval.py` | NEW: Eval framework + adversarial detection |
| 8 | `agents/memory_agent/retrieval.py` | Context window management |
| 9 | `services/llm_service.py` | Cost tracking + BYOK resolution + embedding guard |
| 10 | `services/llm_validator.py` | Adversarial detection integration |
| 11 | `services/provider_key_service.py` | NEW: BYOK keys (Fernet, validation, priority, mark_used) |
| 12 | `routers/provider_keys.py` | NEW: BYOK CRUD/PATCH/DELETE/validate |
| 13 | `alembic/versions/0016_provider_keys_byok.py` | NEW: provider_keys migration |
| 14 | `routers/agents.py` | Agents catalog endpoint |
| 15 | `routers/memory.py` + `schemas/memory.py` | Memory filters |
| 16 | `tests/*` | 68 new tests + conftest alignment + test_main leak fix |
| 17 | `docs/backend/openapi.yaml` | Regenerated (88 paths) |

## P13 Entry Criteria

- [ ] P12 gate approved (this handoff — 88.4/100 CONDITIONAL)
- [ ] SAML signxml dependency resolved
- [ ] Connector permissions persistence decided
- [ ] Memory versioning durability decision made
- [ ] Live-provider eval execution plan defined
