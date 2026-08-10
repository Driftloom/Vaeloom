# MVP-P08 — 09. Gate Report

> **Phase:** MVP-P08 — API, Integration & Contract Design · **Date:** 2026-08-07
> **Baseline:** `master` @ `7a21a28` · **Gate authority:** USER

## Scoring (prompt §28)

| Category                 |  Weight | Score |      Weighted | Basis                                                                         |
| ------------------------ | ------: | ----: | ------------: | ----------------------------------------------------------------------------- |
| Scope and acceptance     |      12 |    11 |          13.2 | 5 DELs; BQ-P08-01 user-confirmed; deltas over live 72-path snapshot           |
| Technical correctness    |      12 |    11 |          13.2 | Live openapi dump executed (not assumed); deltas additive                     |
| Architecture/integration |       8 |     8 |           6.4 | Approval/events/jobs/SDK/MCP mapped to ADR-021 + existing services            |
| Data quality/lifecycle   |       8 |     8 |           6.4 | Rights endpoints hardened; provenance in retrieval contract                   |
| Security/privacy         |      12 |    11 |          13.2 | RFC 9700 deltas; RLS-binding; CSRF list verified; approval = release-blocking |
| Testing/validation       |      12 |     9 |          10.8 | Contract-test + drift-check designed; execution P11+ (honest)                 |
| Reliability/resilience   |       8 |     8 |           6.4 | Idempotency, async jobs, DLQ, watcher lock, degraded 503                      |
| Performance/capacity     |       6 |     6 |           3.6 | Pagination/limits; quota pacing                                               |
| Evidence/traceability    |       8 |     8 |           6.4 | EVD-P08-001..007 mapped                                                       |
| Documentation/handoff    |       6 |     6 |           4.8 | 10 docs; handoff drafted                                                      |
| Operations/support       |       5 |     4 |           2.0 | Job/queue contracts; ops execution P17                                        |
| Maintainability/cost     |       3 |     3 |           0.9 | No new deps; static contract cheap                                            |
| **TOTAL**                | **100** |     — | **87.3 → 88** |                                                                               |

## Mandatory blockers

| Blocker                  | Status                                                        |
| ------------------------ | ------------------------------------------------------------- |
| BQ-01..06                | ✅ resolved (carried + BQ-P08-01)                             |
| Entry audit of P07       | ✅ GO (100/100)                                               |
| Live contract evidence   | ✅ openapi dump executed                                      |
| Approval API implemented | 🔶 P11 (design approved here) — release-blocking rule carried |
| Production/cohort        | 🔶 gated P19/P20                                              |

## Gate decision

**PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY (88/100)**

- Scope: **contract design only**; implementation at P10–P12.
- Restriction 1: approval API (propose/decide/execute/revoke) must ship before
  any send-capable path (P05 restriction 2 — release-blocking).
- Restriction 2: no breaking API change without 1-cycle notice + user approval
  (BQ-P08-01); CI openapi-diff gates P11+.
- Restriction 3: CSRF skip-list must remain auth-only; any widening requires
  security review (AGENTS.md item 4).
- Restriction 4: Gmail stays draft-only; no send endpoint without per-user T3
  enablement (DEC-P02-05).
- Expiry: at P09 gate review.
