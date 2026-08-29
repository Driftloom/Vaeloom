# CONT-P05 — 05 Failure / Resilience / Evolution Model

**Deliverable:** `DEL-CONT-P05-05` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** SRE + Enterprise Architect

## 1 Failure Domains & Resilience

| Domain                                 | Failure                                | Blast Radius | Degradation                                              | Recovery                                       | Evidence                         |
| -------------------------------------- | -------------------------------------- | ------------ | -------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| API `api 200m/512Mi→1000m/1Gi HPA 2→8` | pod OOM / 500                          | cell         | `503 Retry-After` + `shrink` queue                       | `HPA` + `kubectl rollout`                      | `hpa.yaml min2 max8`             |
| Temporal `temporal:7233`               | worker crash                           | queue        | `RetryPolicy 2×/3×` `hb30s`                              | remaining worker `COMPLETED`                   | `test_chaos worker crash→second` |
| Postgres cell                          | `pgvector` unavailable                 | tenant cell  | `rag_status unavailable` never fabricated `empty`        | `reindex` from `Entity` truth, `pg_basebackup` | `test_rag_closure`               |
| Redis                                  | outage                                 | quota        | `fail-open local / fail-closed prod` `check_and_reserve` | `fallback _SCRAPE 20/h`                        | `quota.py`                       |
| Connector `MCP`                        | `readOnlyHint==false` without approval | workload     | `waiting_approval forged→pending`                        | `ApprovalWorkflow 3600s`                       | `test_tool_closure`              |
| LLM provider                           | `429/5xx`                              | agent turn   | `retry 1× only on 429/5xx`, `LLMTransient`               | `mock_llm` `PYTEST` fallback                   | `llm_service`                    |

**Protections:** `circuit_breaker 3/30s` per agent, `Retry-After` headers,
`idempotency sha256`, `bounded DAG 20` `20KB` `4KB`, `eval replan ≤2`,
`infinite loop` never.

## 2 Evolution (expand–contract)

| Wave   | Change                                         | Expand                    | Contract                  | Reconciliation        | Cutover                   | Rollback     |
| ------ | ---------------------------------------------- | ------------------------- | ------------------------- | --------------------- | ------------------------- | ------------ |
| W2     | `add_cell_id` nullable → control plane routing | dual-read shadow `lag`    | remove `monolith` reads   | `cell lag <5m`        | `flag 1%→100% per tenant` | `lag>15m`    |
| W2     | `projection rebuild` (`reindex`)               | keep `Entity` truth       | delete legacy `embedding` | `checksum per cell`   | `0 divergence`            | `mismatch`   |
| W2→P10 | `Adapter strangler`                            | `feature_flag` per-tenant | direct `100%`             | `latency delta <20ms` | `adapter 100%`            | `delta>50ms` |

**No unbounded dual-run estate** — each wave has horizon `W2→P19`, owner,
metric, cutover/rollback, retirement
`0 traffic + drill + archived + owner approval` per `RISK-CONT-P05-05`.

## 3 SLO / Capacity (carry from MVP)

- `RTO 15m RPO 1h`, `99.9% 43.2m`, `p95 120ms <200` `20 RPS headroom 60%` (MVP
  `787053a`); enterprise cells preserve same SLO per cell, `cost $0.02/1k` via
  `s3+DDB` 12 modules.
- Resilience drills quarterly `2026-11-22` (`MAINTAINERS 91`).

---

_Version 1.0 2026-08-29 — reviewers: SRE/Enterprise, `k6` 20 RPS, `chaos 4`._
