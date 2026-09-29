# ENT-P15 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** Performance Engineer + SRE  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk                                             | Severity | Mitigation                                                      | Owner          | Status           | Target    |
| --------------- | ------------------------------------------------ | -------- | --------------------------------------------------------------- | -------------- | ---------------- | --------- |
| RISK-ENT-P15-01 | pgvector p95 14.2ms — only 0.8ms headroom to SLO | HIGH     | Read replicas + ef_search tuning; monitor in ENT-P17            | Data Architect | OPEN — TRACKED   | ENT-P17   |
| RISK-ENT-P15-02 | Gemma 4 GPU-bound; 8 concurrent limit            | MEDIUM   | Additional API quota; queue-backed S2                           | AI Lead        | OPEN — TRACKED   | ENT-P19   |
| RISK-ENT-P15-03 | LME Gemma 4 latency at Tier 3 scale (50K users)  | HIGH     | Autoscaler + queue; fallback S1-only mode                       | AI Lead + SRE  | OPEN — TRACKED   | ENT-P19   |
| RISK-ENT-P15-04 | Production WAL streaming RPO not yet validated   | MEDIUM   | Dev simulation validated; production requires cloud PG WAL test | SRE            | OPEN — ENT-P19   | ENT-P19   |
| RISK-ENT-P15-05 | Cost model assumes provider pricing stability    | LOW      | Version-pinned pricing recorded; re-evaluate quarterly          | FinOps Lead    | OPEN — MONITORED | Quarterly |

---

## Decision Register

| ID             | Decision                                                           | Rationale                                                          | Alternatives                                 | Owner          | Date       |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- | -------------- | ---------- |
| DEC-ENT-P15-01 | pgvector HNSW ef_search=40 (vs default 50)                         | 15% faster; same accuracy at test scale                            | ef_search=50 (rejected: slower)              | Data Architect | 2026-09-29 |
| DEC-ENT-P15-02 | Jev S1 timeout 10s; Gemma 4 timeout 30s                            | Industry baseline for cognitive APIs; graceful fallback on timeout | Infinite wait (rejected: loop hang)          | AI Lead        | 2026-09-29 |
| DEC-ENT-P15-03 | Error budget policy: freeze deploys at >20min outage in 7 days     | SRE best practice; prevents compounding risk                       | 43.8min trigger (rejected: too late)         | SRE            | 2026-09-29 |
| DEC-ENT-P15-04 | Cost attribution via OTel spans (not DB triggers)                  | Lower overhead; available in dev; compatible with cloud billing    | DB triggers (rejected: performance overhead) | FinOps Lead    | 2026-09-29 |
| DEC-ENT-P15-05 | Graceful degradation (S1-only if S2 down) rather than hard failure | Enterprise reliability > perfect AI response quality               | Hard fail (rejected: user experience)        | SRE            | 2026-09-29 |

---

## Assumption Register

| ID             | Assumption                                                          | Basis                                                   | Risk if wrong                                | Owner   | Review date |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- | ------- | ----------- |
| ASM-ENT-P15-01 | Jev S1 API has 200 calls/min capacity                               | TypeSafe AI Jev quota; 32ms p95 dev measurement         | S1 rate limit under enterprise load          | AI Lead | ENT-P19     |
| ASM-ENT-P15-02 | Gemma 4 Ollama Cloud maintains 3.2s p95 under 8 concurrent          | Dev measurement; provider SLA not yet in place          | Synthesis backlog; user experience           | AI Lead | ENT-P19     |
| ASM-ENT-P15-03 | pgBouncer reduces PG connection overhead by 40% (production target) | Industry standard; not yet deployed                     | Connection pool exhaustion under Tier 2 load | SRE     | ENT-P16     |
| ASM-ENT-P15-04 | Production WAL streaming RPO ≤30 min achievable with managed PG     | Dev RPO 14.8s measured; production adds network latency | RPO miss; data loss if PG fails without WAL  | SRE     | ENT-P19     |

---

## Traceability Register

| Req ID      | Requirement                             | Design                           | Test                | Evidence     | Risk        | Handoff            |
| ----------- | --------------------------------------- | -------------------------------- | ------------------- | ------------ | ----------- | ------------------ |
| ENT-P15-R01 | Capacity model and workload profiles    | 3 tiers; bottleneck analysis     | Load benchmarks     | EVD-001..003 | RISK-01..02 | ENT-P16 entry      |
| ENT-P15-R02 | Performance invariants and architecture | INV-PERF-01..05; stateless scale | Architecture review | EVD-020      | RISK-03     | ENT-P16 entry      |
| ENT-P15-R03 | SLO/DR validation                       | 7 SLOs; 7 DR scenarios           | Chaos + soak tests  | EVD-009..014 | RISK-04     | ENT-P16 entry      |
| ENT-P15-R04 | Load and resilience results             | 8 chaos; 15-min soak             | Benchmark logs      | EVD-004..008 | RISK-01     | ENT-P16 entry      |
| ENT-P15-R05 | Scaling runbook                         | Horizontal triggers; degradation | SRE review          | EVD-018..019 | RISK-05     | ENT-P16 entry      |
| ENT-P15-R06 | Cost model and guardrails               | 3-tier cost; 6 guardrails        | FinOps review       | EVD-015..017 | RISK-05     | ENT-P16 entry      |
| ENT-P15-R07 | Gate score ≥95; zero blockers           | §28 gate                         | 97.4/100            | EVD-009      | —           | ENT-P16 authorized |

---

_Registers v1.0.0 — Performance Engineer — 2026-09-29_
