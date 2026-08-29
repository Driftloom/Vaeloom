# CONT-P07 — Tenant, Data, Memory, and Knowledge Migration — Plan (2026-08-29)

> **Status:** DRAFT FOR USER APPROVAL | **Phase:** `CONT-P07` DATA_DESIGN |
> **Predecessor:** `CONT-P06 96.08 APPROVED` | **Baseline:** `0dc782d`+`3f61cfa`
> | **Owners:** Data Architect + Privacy + Security + SRE

## 1 Entry — GO

- **Predecessor:** `CONT-P06 96.08 APPROVED — PROCEED` (`06-gate-report.md:30`
  96.08, 0 blocker) re-audited at `0dc782d` — 5 DELs
  `01 matrix +02 version frozen +03 standards +04 supply SLSA +05 cost` all
  `v1.0`, `64 graph +40 temporal` pass — **Score 97/100 GO**.
- **Baseline:** `apps/api` `3.12` `42/42 RLS` `pgvector` `Vector 1536`,
  `graph 10`, `temporal 8 queues`, `110 OpenAPI`, `terraform 12`,
  `k6 p95 120ms`.
- **Track rule:**
  `Record source/target IDs, mapping version, checksum/count, result and rollback; never infer`
  (§12.7).

## 2 Scope

**In:** conceptual/logical/physical model, isolation/authorization invariants,
provenance/lifecycle/rights, migration/backup/recovery, indexes/query/capacity —
per §5.

**Out:** big-bang rewrite, silent permission expansion, unverified dual writes,
all-tenant cutover, production changes without authority/backup/rollback.

## 3 Workstreams & Evidence Plan

| WS      | Title                              | Inputs                                                  | Acceptance                                                       | Tests                                                   | Evidence                             | File |
| ------- | ---------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------ | ---- |
| WS-07.1 | Conceptual/logical/physical model  | `models/schema.py` 34 tables, `migrations 0010→0021`    | Entities, IDs, ownership, sensitivity, provenance, lifecycle     | schema review + `alembic`                               | `01-data-models.md` DEL-01           |
| WS-07.2 | Isolation/authorization invariants | `TenantContext` `RLS 42/42` `workspace_id` FK           | Scope keys via constraints/policies, missing filters cannot leak | `security/test_tenant_isolation` 63 + `graph handoff` 8 | `02-isolation-rules.md` DEL-03       |
| WS-07.3 | Provenance/lifecycle/rights        | `Entity canonical_name` dedup 0.85, `Memory` provenance | Correction/supersession/export/deletion/legal hold               | `test_memory_closure` 3                                 | `03-provenance-lifecycle.md` DEL-04  |
| WS-07.4 | Migration/backup/recovery          | `alembic` `expand–contract` `cell_id` nullable          | Idempotent observable forward/backward, `add_cell_id` demo       | `migration` dry-run + `pg_basebackup`                   | `04-migration-rollback.md` DEL-02    |
| WS-07.5 | Indexes/query/capacity             | `pgvector Vector 1536` `indexes`                        | Benchmark queries/writes, indexes/partition/capacity triggers    | `k6` + `EXPLAIN`                                        | `05-backup-query-evidence.md` DEL-05 |

## 4 Tasks (8)

1. Define entities, identifiers, ownership, sensitivity, provenance, lifecycle.
2. Select authoritative stores and label projections.
3. Enforce scope keys through constraints/policies so missing filters cannot
   leak.
4. Design safe idempotent observable forward/backward migrations.
5. Design correction, supersession, export, deletion, backup expiry, legal hold.
6. Benchmark queries/writes and define indexes/partition/capacity triggers.
7. Record source/target IDs, mapping version, checksum/count, result and
   rollback; never infer.
8. For every changed artifact capture compatibility, owner, evidence, rollback,
   retirement.

## 5 Next Steps

1. Approve plan.
2. Scaffold `docs/phases/cont-p07/` `00-audit` `01..05` + `06-gate` +
   `09-handoff`.
3. Execute small commits: `01 models` + `02 isolation` + `03 provenance` +
   `04 migration` + `05 backup/query`.
4. Validate `64+40 + typecheck 0 + tenant isolation + backup drill` → gate 95+.

_Prepared 2026-08-29 — predecessor 96.08 GO, baseline 0dc782d, no invented
tenant names._
