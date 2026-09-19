# CONT-P01 — 04 Success Metrics — Outcome / Trust / Quality / Safety / Ops / Business

**Deliverable:** `DEL-CONT-P01-04` | **Owner:** Product Manager + SRE |
**Date:** 2026-08-28

## 1. Metric Formulas + Owners + Measurable Gate

| Metric                                       | Formula                                                                       | Target                                                                           | Owner                                 | Measured Now?                                                      | Validation                            |
| -------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| **Activation** Time-to-first-value           | `signup → first `completed`via`POST /agents/chat`                             | `<5 min first entity` `User-Journey` vs `PRD <15 min signup` `NFR <2 min upload` | `PRD vs vaeloom-mvp-e2e PHASE1 SM-07` | `test_A 7.78s`                                                     | `E2E A`                               |
| **Business** Cohort applied ≥1 internship    | `count(tenant consented cohort with ≥1 application)/cohort size`              | `62%` hypothesized `06 900+`                                                     | Product                               | `NOT_YET` pilot (deferred CONT-P19)                                | `CONT-P19 pilot`                      |
| **Trust** Cross-ws leak rate                 | `0` architecturally impossible                                                | `0`                                                                              | SecArch                               | **YES** `test_J 404` 7.5s `42/42 RLS`                              | `security 316`                        |
| **Safety** Forged approval success           | `0`                                                                           | `0`                                                                              | SecArch                               | **YES** `policy_check forged→pending` `test_F`                     | `hardening 1210`                      |
| **Quality** RAG not fabricated               | `rag_status ∈ {ok,empty,unavailable,timeout,error}` never `ok` with fake refs | `0 fabricated`                                                                   | QA                                    | **YES** `test_C rag_status` `never_fabricates`                     | `23 hardening`                        |
| **Quality** Eval pass                        | `orchestrator eval 12 cases`                                                  | `88.4→95+`                                                                       | AI                                    | `mvp-p12 88.4 CONDITIONAL`                                         | `CONT-P12 re-eval`                    |
| **Safety** Prompt injection blocked          | `detect_adversarial critical→ValidationError`                                 | `critical 0 bypass`                                                              | SecArch                               | **YES** `nodes:61`                                                 | `hardening`                           |
| **Ops** SLO `99.9% 43.2m` / p95 `120ms <200` | `(sli / SLO)` `prometheus 15s 4 jobs`                                         | `99.9% 43.2m RTO 15m`                                                            | SRE                                   | **YES** `mvp-p17 93.2` `k6 p50 45ms p95 120ms 20 RPS headroom 60%` | `mvp-p20 93.8 synthetic 3 probes 30s` |
| **Ops** Rollback proven                      | `LANGGRAPH_ENABLED false → legacy`                                            | `<30s`                                                                           | SRE                                   | **YES** `shadow parity` `mvp-p21`                                  | `hardening §37`                       |
| **Cost** Unit cost                           | `inference + embedding $`                                                     | `$0.02/1k`                                                                       | FinOps                                | `mvp-p15 93.1`                                                     | reuse                                 |

**Owner per metric in table; contradiction resolved below.**

## 2. Contradiction Resolution: Time-to-first-value

| Source                         | Says                                           | Resolution                                                                                                                                                                                                                | Owner                   |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `PRD:141`                      | `<15 min signup`                               | **Canonical for gate:** `User-Journey <5 min aha` (first proposal `9/10` satisfaction `First Proposal`) but measure both `signup` and `aha` as separate SLIs — `PRD 15` is outer bound, `User-Journey 5` is design target | Product + UX Researcher |
| `vaeloom-mvp-e2e PHASE1 SM-07` | `<5 min first entity visible`                  | Same as aha                                                                                                                                                                                                               | UX                      |
| `NFR-USE-001`                  | `<2 min upload first doc`                      | Sub-SLI                                                                                                                                                                                                                   | SRE                     |
| `User-Journey Goals`           | `reduce aha to <5 min, drop-off >80% Stage1→5` | Track separately; gate 95 requires `aha <5` not just `signup <15`                                                                                                                                                         | Product                 |

## 3. Leading vs Lagging

- Leading: `cross-ws 404` `rag_status` `forged pending` `42/42` (per-regression)
- Lagging: `62% applied` cohort (pilot `CONT-P19`)

---

_Trace: `User-Journey 231` + `mvp-p17 93.2 SLI` + `hardening 27 p95` +
`test_A-J 10` → `CONT-P01-R05/R06`._
