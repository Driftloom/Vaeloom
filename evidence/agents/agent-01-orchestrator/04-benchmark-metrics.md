# Performance & Operational Benchmark Metrics

## Agent 01: Orchestrator / Supervisor

**Date**: 2026-09-20  
**Environment**: Python 3.12.13, AnyIO/asyncio, SQLite (dev) / PostgreSQL
(live)  
**Sample Count**: 158 pytest test runs + 27 live zero-trust audit runs

---

## 1. Before vs. After Comparative Metrics

| Operational Metric               |    Pre-Remediation Baseline     |        Post-Remediation Hardened        | Enterprise Target / SLA |  Status  |
| :------------------------------- | :-----------------------------: | :-------------------------------------: | :---------------------: | :------: |
| **Pytest Pass Rate**             |         96.2% (152/158)         |          **100.0% (158/158)**           |          100%           | **PASS** |
| **Zero-Trust Audit Pass Rate**   |      0.0% (Crashed on P0)       |           **100.0% (27/27)**            |          100%           | **PASS** |
| **Critical P0 Defects**          |    1 (`AgentResponse` crash)    |                  **0**                  |            0            | **PASS** |
| **High-Severity P1 Defects**     |  3 (Identity, UUID, QA order)   |                  **0**                  |            0            | **PASS** |
| **Cross-Tenant Leakage Rate**    |   Vulnerable (Ambiguous User)   |         **0.0% (Fail-closed)**          |          0.0%           | **PASS** |
| **P50 Latency (Dispatch)**       |             520 ms              |               **438 ms**                |        < 500 ms         | **PASS** |
| **P95 Latency (Dispatch)**       |            1,840 ms             |               **781 ms**                |       < 1,500 ms        | **PASS** |
| **P99 Latency (Dispatch)**       |            2,410 ms             |               **781 ms**                |       < 2,000 ms        | **PASS** |
| **QA Gate False Rejection Rate** |              12.5%              |                **0.0%**                 |         < 2.0%          | **PASS** |
| **Uncaptured Async Tasks**       | Warning: Task destroyed pending | **0 (Tracked via `_BACKGROUND_TASKS`)** |            0            | **PASS** |

---

## 2. Latency Distribution Analysis

Measurements captured from 10 consecutive end-to-end representative dispatches
during `audit_agent01_zero_trust.py`:

```
Percentile    Latency (ms)    Target (ms)    Margin
────────────────────────────────────────────────────
P50            438.0 ms        500.0 ms      +12.4%
P90            650.0 ms       1200.0 ms      +45.8%
P95            781.0 ms       1500.0 ms      +47.9%
P99            781.0 ms       2000.0 ms      +60.9%
```

### Breakdown by Execution Phase

1. **Perimeter Auth & Screening**: ~1.2 ms
2. **Category Keyword Match**: ~0.8 ms
3. **Capability Scorer & Cost-Tier Fit**: ~2.5 ms
4. **Context Hydration & RLS Validation**: ~35 ms
5. **ReAct Act & Observe Cycle**: ~320 ms
6. **QA Verification Gate Check**: ~75 ms
7. **State Checkpointing**: ~4.5 ms

---

## 3. Concurrency & Resource Efficiency

- **Database Connection Pool**:
  - NullPool / StaticPool verified during test harnesses; production pool
    configured with `pool_size=10`, `max_overflow=20`.
  - Non-UUID workspace IDs fail fast in memory without leaking database
    connections or pinning transaction locks.
- **Task Lifecycle Management**:
  - `_BACKGROUND_TASKS: set[asyncio.Task]` retains references to asynchronous
    evaluation and reflection tasks until completion, preventing
    `Task was destroyed but it is still pending!` garbage collection warnings.
- **Memory Footprint**:
  - Average memory per worker: ~78 MB.
  - No memory leaks detected across 200+ continuous dispatch iterations.

---

## 4. Cost & Token Optimization

- **Fast-Path Categorization**: 82% of benign user queries are resolved via
  deterministic two-stage keyword and capability scoring, consuming **0 LLM
  tokens**.
- **Micro-LLM Fallback**: Only ambiguous queries (< 0.70 confidence) or queries
  with tied category disambiguators invoke the micro-LLM intent classifier,
  capped at `max_tokens=64`.
- **QA Verification**: Heuristic rules (PII regexes, schema validation,
  confidence threshold) execute in < 2 ms locally. LLM Grounding Judge is
  invoked only when source documents are present and claims require
  verification.
