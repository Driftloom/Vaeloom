# CONT-P08 — API, Event, Connector, and Contract Compatibility — Plan (2026-08-29)

> **Status:** DRAFT FOR USER APPROVAL | **Phase:** `CONT-P08` API_DESIGN |
> **Predecessor:** `CONT-P07 96.16 APPROVED` `e255d63` | **Baseline:** `e255d63`
> | **Owners:** API Architect + Integration/Security/Contract-Test

## 1 Entry — GO

- **Predecessor:** `CONT-P07 96.16 APPROVED — PROCEED` (`06-gate-report.md:30`
  96.16, 0 blocker) re-audited at `e255d63` — 5 DELs
  `01 models 6 entities +02 isolation 42/42 +03 provenance +04 migration +05 backup`
  all `v1.0`, `64 graph +40 temporal` pass — **Score 97/100 GO**.
- **Baseline:** `0dc782d`+`e255d63` additive `cont-p07` + `110 OpenAPI`
  `42/42 RLS` `64+40`.
- **Phase rule:**
  `Use additive contracts, tolerant readers, schema registry, consumer inventory and shadow traffic`
  (§11).

## 2 Scope

**In:** API/resource contracts, events/webhooks/jobs,
identity/authorization/idempotency, SDK/tool/MCP contracts,
compatibility/versioning.

**Out:** big-bang rewrite, silent permission expansion, unverified dual writes,
all-tenant cutover.

## 3 Workstreams

| WS      | Title                              | Inputs                                                            | Acceptance                                                                         | Tests                            | Evidence                         | File |
| ------- | ---------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- | -------------------------------- | ---- |
| WS-08.1 | API/resource contracts             | `openapi.yaml 110` `api/routers 27`                               | resources/ops schemas, errors, pagination, concurrency                             | `contract` + `typecheck 0`       | `01-openapi.md` DEL-01           |
| WS-08.2 | Events/webhooks/jobs               | `Temporal 8 queues` `webhooks` `mcp`                              | async job `progress/cancel/result/retry` + webhook `verify/dedup/order/replay/DLQ` | `temporal 40` + `webhook` tests  | `02-event-webhook-job.md` DEL-02 |
| WS-08.3 | Identity/authorization/idempotency | `TenantContext` `RLS 42/42` `approval 13+dynamic`                 | scope from verified identity, not client IDs, payload-bound `idempotency`          | `security 63` + `tool_closure` 6 | `03-auth-idempotency.md` DEL-04  |
| WS-08.4 | SDK/tool/MCP contracts             | `graph/contracts` `tools/definitions 40+dynamic` `mcp 2026-07-28` | SDK generation, `readOnlyHint`                                                     | `mcp discovery 300s`             | `04-sdk-mcp.md` DEL-03           |
| WS-08.5 | Compatibility/versioning           | `110→115` additive                                                | schema registry, consumer inventory, shadow traffic, deprecation telemetry         | `compat`                         | `05-compatibility.md` DEL-05     |

## 4 Tasks (8)

1. Define resources/ops with schemas, errors, pagination, concurrency, examples.
2. Derive scope from verified identity, not client-only IDs.
3. Use payload-bound approvals/idempotency for consequential writes.
4. Use async job resources with progress/cancel/result/retry.
5. Define webhook verification/dedup/order/replay/reconciliation/DLQ.
6. Publish compatibility/deprecation and contract tests.
7. Use additive contracts, tolerant readers, schema registry, consumer
   inventory, shadow traffic.
8. For every changed artifact capture compatibility, owner, evidence, rollback,
   retirement.

## 5 Next Steps

1. Approve plan.
2. Scaffold `docs/phases/cont-p08/` `00-audit` `01..05` + `06-gate` +
   `09-handoff`.
3. Execute small commits: `01` + `02` + `03` + `04` + `05`.
4. Validate `64+40 + typecheck 0 + contract` → gate 95+.

_Prepared 2026-08-29 — predecessor 96.16 GO, baseline e255d63, no invented
consumer._
