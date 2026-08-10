# MVP-P07 — 04. Migration & Rollback Plan (DEL-MVP-P07-02)

> Owner: Database Engineer · Alembic (exists). Forward/backward, observable,
> idempotent. Executed at P11 (this phase = design). Never destructive without
> backup + rollback (P03 §7).

## 1. Migration series

| Migration                        | Content                                                                                                                                                                                                  | Forward                      | Backward (downgrade)                                     | Risk                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `0003_approval`                  | create `approval_request`, `approval_decision`; indexes; `idempotency_key` on `applications`, `agent_actions` + partial unique indexes                                                                   | additive                     | drop tables/columns (no data loss — new)                 | LOW                                                                                    |
| `0004_memory_taxonomy`           | CHECK constraint on `memories.type`/`memory_records.type` domains; `supersedes_id` FK; `deleted_at`; backfill: map existing free-form types → 6 domains (document→document, schedule_events→episodic, …) | additive + data backfill     | drop constraints/columns; backfill is idempotent mapping | MED — backfill mapping must be reviewed (unmapped types → `document` default, flagged) |
| `0005_isolation`                 | enable RLS on scoped tables; create policies per `05`; composite NOT NULL (tenant_id, workspace_id) where missing; app-role grants                                                                       | additive policy              | disable RLS; drop policies                               | MED — verify app patterns (SQLite tests use mocking; prod Postgres only)               |
| `0006_provenance`                | `embeddings.model_version/dimensions/source_table/source_id`; documents retention/deleted_at; users/workspaces consent fields; connectors oauth fields                                                   | additive                     | drop columns                                             | LOW                                                                                    |
| `0007_vector_dim` (guarded, P12) | ALTER embedding vector dimension + full re-embed rebuild if provider changes (BQ-P06-02, CF-P07-02)                                                                                                      | rebuild projection (ADR-024) | re-embed old dim                                         | HIGH — only when provider changes; gated by eval                                       |

## 2. Migration discipline

1. One migration per concern; each has `upgrade` + `downgrade`; idempotent
   (re-runnable on partial failure via alembic version tracking).
2. Backfill mapping table reviewed + tested (memory type map) before apply.
3. Every migration runs against: dev (docker-compose Postgres) → staging → prod;
   CI integration job applies + rolls back + re-applies (observable).
4. **No destructive step** without: backup taken, runbook, named approver
   (user), rollback rehearsed.
5. Schema changes never shipped as silent CREATE TABLE in app startup —
   `Base.metadata.create_all` in main.py lifespan is dev-only; prod uses alembic
   only (flag to P11: gate create_all behind `ENV != prod`).

## 3. Rollback plan

| Scenario                            | Rollback                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Migration fails mid-apply           | alembic downgrade to last-good version; fix; re-apply; no data written                                     |
| Data corruption detected post-apply | restore daily backup (RPO 24h, BQ-P07-02) + replay queue (DLQ)                                             |
| Bad backfill                        | downgrade 0004 + re-run corrected mapping                                                                  |
| RLS breaks queries                  | downgrade 0005 (policies additive, app filters still enforce) — isolation invariant tests gate before prod |
| Provider/embedding regression       | 0007 guarded; projections rebuilt (ADR-024)                                                                |

## 4. Verification (P11 executes; tests at P13/P14)

- Migration test suite: apply all → assert schema invariants (constraints, RLS
  policies present) → downgrade all → re-apply (idempotent).
- Data-preservation test: fixture data survives forward+backward cycles.
- Isolation invariant tests: cross-workspace access blocked with and without
  app-level filter (defense-in-depth, NFR-15/h15).
