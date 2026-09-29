# ENT-P15 Source Register

**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** Performance Engineer + SRE  
**Date:** 2026-09-29

---

## Internal Sources (INT)

| ID     | Source                                                              | Use                                                      | Verified |
| ------ | ------------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| INT-01 | ENT-P14 handoff                                                     | Authorization baseline; test baseline; SLI/SLO baselines | ✅       |
| INT-02 | `evidence/phases/ent/ent-p12/` — pgvector HNSW 14.2ms measurement   | Performance baseline for semantic retrieval              | ✅       |
| INT-03 | `apps/api/src/api/middleware/` — rate limiting implementation       | Load test target; backpressure design                    | ✅       |
| INT-04 | `apps/api/src/api/services/loop.py` — agent step budget             | Resilience; circuit breaker; max_steps enforcement       | ✅       |
| INT-05 | `apps/api/pyproject.toml` — pytest config                           | Test execution baseline                                  | ✅       |
| INT-06 | `evidence/phases/ent/ent-p04/` — FinOps \$0.0787/doc unit cost      | Cost model baseline                                      | ✅       |
| INT-07 | `evidence/phases/ent/ent-p07/` — RPO 14.8s / RTO 8m42s measurements | DR validation baseline                                   | ✅       |
| INT-08 | `apps/api/src/api/database.py` — `set_rls_session_vars()`           | Resilience: GUC fail-closed pattern                      | ✅       |
| INT-09 | AGENTS.md — backend test commands                                   | Test runner guidance                                     | ✅       |
| INT-10 | `specs/api/openapi.yaml` v0.2.0                                     | API endpoint load test catalog                           | ✅       |

## External Sources (EXT)

| ID     | Standard                               | Use                                 |
| ------ | -------------------------------------- | ----------------------------------- |
| EXT-01 | Google SRE Book — SLI/SLO/Error Budget | Availability and latency SLO design |
| EXT-02 | PostgreSQL 16 EXPLAIN ANALYZE          | pgvector index tuning               |
| EXT-03 | pgvector HNSW documentation            | `ef_search` tuning; index rebuild   |
| EXT-04 | OpenTelemetry semantic conventions     | Cost attribution span tags          |
| EXT-05 | SLSA v1.2                              | Performance artifact provenance     |

---

_Register v1.0.0 — Performance Engineer — 2026-09-29_
