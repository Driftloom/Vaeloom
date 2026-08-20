# MVP-P12 — 10. Handoff to P13

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation
> **Date:** 2026-08-20 · **Gate:** 94/100 (CONDITIONAL GO) **Next phase:**
> MVP-P13 — Security, Privacy, and Compliance

## What P13 receives

### Infrastructure (new in P12)

- **Circuit breaker** (`infrastructure/circuit_breaker.py`) — wired into
  orchestrator loop; per-agent with 3-failure threshold, 30s recovery
- **Rate limiter** (`infrastructure/agent_limits.py`) — token bucket +
  concurrency slots per agent; wired into act_phase
- **Runtime kill switches** (`infrastructure/agent_observability.py`) —
  per-agent enable/disable, global kill, status endpoint
- **Agent metrics** (`infrastructure/agent_observability.py`) — success rate,
  latency, cost, error tracking per agent
- **Model router** (`services/model_router.py`) — task-complexity-based model
  selection + cost tracking
- **Eval framework** (`infrastructure/agent_eval.py`) — 13 golden eval cases,
  adversarial prompt detection, scoring
- **Chunking** (`ingestion/chunking.py`) — paragraph/sentence/character chunking
  with overlap + context window fitting

### Modified systems

- **Orchestrator loop** — circuit breaker + rate limiter + timeout enforcement;
  approval dispatch refactored
- **Orchestrator router** — kill switch check + adversarial detection + metrics
  recording
- **LLM service** — cost tracking via model router; token usage recorded per
  call
- **LLM validator** — enhanced with adversarial prompt detection
- **Retrieval** — context window management; results truncated to fit LLM
  context
- **Ingestion pipeline** — document chunking step added

### What P13 must verify

1. **SAML signxml in pyproject.toml** — deferred from P11
2. **Connector permissions UI persistence** — deferred from P11
3. **Memory versioning durability** — in-memory only, needs DB backing
4. **Eval framework execution** — cases defined but not run against live agents

### Restrictions carried from P12

- No new dependencies without change control
- Enterprise surfaces stay gated
- Gmail stays draft-only
- Circuit breaker thresholds are hardcoded (not per-agent configurable)
- Eval framework is defined but not executed

## Test Results

| Subset              | Tests   | Result          |
| ------------------- | ------- | --------------- |
| SAML + connector    | 45      | ✅ ALL PASS     |
| Orchestrator + loop | 54      | ✅ ALL PASS     |
| Memory service      | 28      | ✅ ALL PASS     |
| LLM service         | 10      | ✅ ALL PASS     |
| LLM validator       | 19      | ✅ ALL PASS     |
| **Total verified**  | **160** | **✅ ALL PASS** |

## Code Changes Summary

| #   | File                                    | Change                                                              |
| --- | --------------------------------------- | ------------------------------------------------------------------- |
| 1   | `orchestrator/loop.py`                  | Circuit breaker + rate limiter + timeout wired; dispatch refactored |
| 2   | `orchestrator/router.py`                | Kill switch + adversarial detection + metrics recording             |
| 3   | `ingestion/chunking.py`                 | NEW: Document chunking module                                       |
| 4   | `ingestion/pipeline.py`                 | Chunking step added                                                 |
| 5   | `services/model_router.py`              | NEW: Model routing + cost tracking                                  |
| 6   | `infrastructure/agent_observability.py` | NEW: Metrics + kill switches                                        |
| 7   | `infrastructure/agent_eval.py`          | NEW: Eval framework + adversarial detection                         |
| 8   | `agents/memory_agent/retrieval.py`      | Context window management                                           |
| 9   | `services/llm_service.py`               | Cost tracking integration                                           |
| 10  | `services/llm_validator.py`             | Adversarial detection integration                                   |

## P13 Entry Criteria

- [ ] P12 gate approved (this handoff)
- [ ] SAML signxml dependency resolved
- [ ] Connector permissions persistence decided
- [ ] Memory versioning durability decision made
- [ ] Eval framework execution plan defined
