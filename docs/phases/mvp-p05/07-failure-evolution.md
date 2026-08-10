# MVP-P05 — 07. Failure & Evolution Model (DEL-MVP-P05-05)

> Owner: SRE + AI Architect · Targets: BQ-P05-01 (99% best-effort, no SLA,
> degraded modes OK). Behavior specs for P08/P11/P15.

## 1. Failure domains & degradation

| Domain                    | Failure modes                    | Behavior spec (timeout/retry/backpressure)                                                                         | Degraded mode                                                                 |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Gmail connector           | down, quota, 401 (scope revoked) | Poll timeout; exponential backoff + jitter; max attempts → status degraded; never synchronized retries (INT-02 §5) | Deadline extraction + reminders paused; UI notice; retry on next poll cycle   |
| LLM provider              | down, rate limit, latency        | llm_service tenacity retries (exists); circuit_breaker; per-agent budget                                           | Assist-only: retrieval/facts serve; generation returns error; proposals queue |
| Redis/queue               | down, backlog                    | BullMQ polling (exists); concurrency semaphore; DLQ (DeadLetterEvent exists)                                       | Jobs dead-lettered; reconciliation replays; no unbounded work                 |
| Postgres                  | down, pool exhaustion            | pgbouncer (exists); connection pool limits; health 503                                                             | No partial reads; 503s; DR runbook                                            |
| Object storage            | down                             | retries w/ backoff                                                                                                 | uploads queued; reads degrade                                                 |
| Search/vector projections | stale/rebuilding                 | provenance timestamps; rebuild jobs                                                                                | fall back to relational retrieval; label freshness                            |
| Provider model change     | version drift                    | version pins recorded (model/prompt/tool/retrieval/chunking/embedding/policy — INT-02 §4)                          | eval re-run before promotion                                                  |

## 2. Failure-path behaviors (prompt §13)

| Behavior                     | Spec                                                                                   | Where         |
| ---------------------------- | -------------------------------------------------------------------------------------- | ------------- |
| Timeout                      | per-call budgets defined P08 (connector 10s, LLM 30s gen/10s embed, DB pool 5s)        | P08 contracts |
| Retry                        | exponential + jitter; capped; no sync retry storms; Gmail quota pacing                 | P08/P11       |
| Cancel                       | user-cancelable jobs; queue job cancel path                                            | P11           |
| Backpressure                 | worker semaphore; queue lag alert                                                      | P15/P17       |
| Partial failure              | ingest pipeline per-document transaction; failures isolated per item, not batch        | P07/P12       |
| Stale/duplicate/out-of-order | idempotency keys (ADR-021); dedup (ingestion dedup exists); event ordering via job ids | P07/P11       |
| Provider outage              | circuit breaker open → degraded mode; alerts                                           | P11/P17       |
| Rollback                     | reversible migrations (alembic), feature flags, git revert discipline per gate         | every phase   |

## 3. SLOs (BQ-P05-01 — best-effort, no SLA)

| SLI                            | SLO                                                               | Notes                           |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------- |
| Core API availability (health) | 99% monthly best-effort                                           | no penalty commitment           |
| Ingest end-to-end p95          | < 60s for typical resume/email                                    | measured P15                    |
| Retrieval hit-rate             | >= 80% (BQ-P02-03)                                                | eval harness P12/P14            |
| Extraction accuracy            | >= 90% (BQ-P02-03)                                                | eval harness P12/P14            |
| Data loss                      | 0 (BQ-P02-03)                                                     | erasure + restore tests P13/P14 |
| Deletion                       | 100% (BQ-P02-03)                                                  | erasure matrix P13              |
| Load                           | 100 concurrent target; 1,000 upper bound verified P15 (BQ-P02-04) | P15 load tests                  |

## 4. Evolution & future readiness

| Item                                                                       | Problem/evidence                                  | Trigger                                   | Owner       | Sunset condition                     |
| -------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- | ----------- | ------------------------------------ |
| Gmail push (watch)                                                         | Polling MVP adequate (DEC-P02-01); push = latency | >100 users or p95 deadline-latency breach | Integration | auto-superseded by push when enabled |
| RLS at scale                                                               | app-level scoping now; RLS defense-in-depth       | ADR-023 P07 (already scheduled)           | Security    | verified by isolation suite          |
| k8s/terraform (existing infra/)                                            | PaaS-first MVP; enterprise future                 | enterprise track start                    | Cloud       | MVP PaaS decommissioned              |
| T2 discovery / T3 autopilot                                                | DEC-P02-05 tiers                                  | legal review + kill switches + approval   | Product     | never default-ON                     |
| Enterprise SSO/SCIM, billing, marketplace, multi-region, cross-user memory | INT-02 future boundary                            | MVP evidence gates                        | Product     | never imported into MVP              |

All deferred items carry: problem/evidence, target users, deps,
security/privacy/data cost, migration impact, validation experiment, adoption
trigger, owner, sunset/rejection — kept in `08-registers.md` §4 and reviewed
each gate (no silent scope growth, INT-02 future boundary).
