# Temporal Index (WS-E)

> **Verified:** 2026-09-15 · 14 files: catalog + runbook + dated
> audits/closures.

| Doc                                                                        | Role                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog.md`                                                               | Task queues (8), workflows (Ingest/DurableAgent/Connector/Approval/Event/Hello), activities + retry/idempotency/versioning (ADR-038) |
| `runbook.md`                                                               | Ops: what is durable, tctl queries, safe ops, recovery drills, `TEMPORAL_ENABLED=false` rollback                                     |
| `local-dev.md`, `migration.md`, `idempotency.md`, `langgraph-readiness.md` | Dev/migration/idempotency/readiness guides                                                                                           |
| `closure-report-langgraph-2026-08-28.md`                                   | Closure 2026-08-28                                                                                                                   |
| `enterprise-zero-trust-audit-2026-08-28.md`                                | Zero-trust audit 2026-08-28                                                                                                          |
| `langgraph-production-hardening-2026-08-28.md`                             | Hardening 2026-08-28                                                                                                                 |
| `langgraph-gap-closure-2026-08-29.md`                                      | Gap closure 2026-08-29                                                                                                               |
| `langgraph-deep-implementation-closure-2026-08-29.md`                      | Deep closure 2026-08-29                                                                                                              |
| `langgraph-deep-zero-trust-audit-2026-08-29.md`                            | Deep audit 2026-08-29                                                                                                                |
| `langgraph-zero-trust-e2e-reverification-2026-08-29.md`                    | E2E re-verification 2026-08-29                                                                                                       |
| `temporal-p1c-enablement-2026-08-31.md`                                    | P1C enablement 2026-08-31 (most current)                                                                                             |

> Most-current dated audit: `temporal-p1c-enablement-2026-08-31.md`; runbook for
> ops, catalog for contract. Most-current dated audits index ends here — new
> audits append rows, never rewrite history.
