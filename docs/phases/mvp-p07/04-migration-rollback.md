# MVP-P07 — 04. Migration & Rollback Plan (DEL-MVP-P07-02)

> Owner: Database Engineer · Dual migration system (Alembic + custom runner).
> Forward/backward, observable, idempotent. Executed at P11 (this phase =
> design). Never destructive without backup + rollback (P03 §7).

## 1. Dual Migration System — The Problem

Two parallel migration systems exist and **must not be used together**:

| System            | Location                  | Versions  | Tracking Table      | State                             |
| ----------------- | ------------------------- | --------- | ------------------- | --------------------------------- |
| **Alembic**       | `alembic/versions/`       | 0001–0006 | `alembic_version`   | Canonical for prod                |
| **Custom Runner** | `src/backend/migrations/` | 0002–0007 | `schema_migrations` | Used by `create_all` startup path |

**Conflict:** Custom runner 0002 duplicates Alembic 0002 (both create
microservice tables). Running both systems against the same database will fail
on duplicate table creation.

**Recommendation:** Consolidate onto Alembic for prod. Custom runner is retained
for dev/test convenience (`create_all` + runner bootstraps a fresh DB without
Alembic). Gate the custom runner behind `ENV != prod` or deprecate it entirely.

## 2. Current Migration Inventory

### 2.1 Alembic Migrations

| Migration                  | What P07 Design Claimed                                                                                         | What It Actually Does                                                                                                                                    | Gap                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `0001_initial_schema`      | Creates core tables                                                                                             | Creates 25 core tables (memories, events, documents, etc.)                                                                                               | ✅ Matches                                             |
| `0002_microservice_tables` | Extends notifications, creates plugin/iam/knowledge tables                                                      | Same as claimed                                                                                                                                          | ✅ Matches                                             |
| `0003_approval_tables`     | Creates `approval_request` + `approval_decision` + idempotency cols                                             | Creates `approval_request`, `approval_decision`, adds `idempotency_key` to `applications`/`agent_actions`, adds `approval_request_id` to `agent_actions` | ✅ Matches (this is the ONLY system with these tables) |
| `0004_memory_taxonomy`     | Adds `domain`/`supersedes_id`/`deleted_at` + CHECK constraint + backfill                                        | Adds `domain`, `supersedes_id`, `deleted_at` to `memories` and `memory_records`; indexes. **NO CHECK constraint, NO backfill.**                          | ⚠️ Missing CHECK + backfill                            |
| `0005_rls_expanded`        | Enables RLS on ~30 tables                                                                                       | Enables RLS on 31 tables with `p_{table}_workspace` policies using `app.workspace_id` + `app.tenant_id`; creates `vaeloom_app` role                      | ✅ Matches scope                                       |
| `0006_provenance`          | Adds provenance columns to embeddings, lifecycle to documents, consent to users/workspaces, OAuth to connectors | Same as claimed                                                                                                                                          | ✅ Matches                                             |

### 2.2 Custom Runner Migrations

| Migration                  | What P07 Design Claimed                          | What It Actually Does                                                                                                        | Gap                              |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `0002_microservice_tables` | (same as Alembic 0002)                           | DUPLICATE of Alembic 0002 — creates identical tables                                                                         | ❌ Conflict                      |
| `0003_approvals`           | Creates `approval_request` + `approval_decision` | Creates `agent_approvals` table (different table — post-action confirmation, not pre-action approval flow)                   | ❌ Wrong table entirely          |
| `0004_memory_taxonomy`     | Adds columns + CHECK + backfill                  | Adds `domain`/`supersedes_id`/`deleted_at` to `memories` only (not `memory_records`); index only. **NO CHECK, NO backfill.** | ⚠️ Partial + missing CHECK       |
| `0005_rls`                 | RLS on ~30 tables                                | RLS on **4 tables only** (`memories`, `events`, `usage_records`, `api_keys`) with `tenant_id`-only filter                    | ❌ 4 vs 30 tables, weaker filter |
| `0006_idempotency`         | Provenance columns                               | Creates `idempotency_records` table (HTTP replay protection, not provenance)                                                 | ❌ Wrong thing entirely          |
| `0007_gmail_watch`         | Vector dim guard                                 | Creates `gmail_watches` table (push notification lifecycle)                                                                  | ❌ Wrong thing entirely          |

### 2.3 ORM Models With No Migration

These exist in `models/schema.py` but have **no Alembic migration** (only custom
runner covers some):

| ORM Model / Column                  | Alembic Migrated? | Custom Runner Migrated?                | Status         |
| ----------------------------------- | ----------------- | -------------------------------------- | -------------- |
| `approval_request` table            | ✅ Alembic 0003   | ❌ (creates `agent_approvals` instead) | OK via Alembic |
| `approval_decision` table           | ✅ Alembic 0003   | ❌                                     | OK via Alembic |
| `applications.idempotency_key`      | ✅ Alembic 0003   | ❌                                     | OK via Alembic |
| `agent_actions.idempotency_key`     | ✅ Alembic 0003   | ❌                                     | OK via Alembic |
| `agent_actions.approval_request_id` | ✅ Alembic 0003   | ❌                                     | OK via Alembic |
| `Memory.domain` CHECK constraint    | ❌ Neither system | ❌                                     | **Missing**    |

## 3. Missing Migrations — What Must Be Created

All new migrations should be Alembic-only (custom runner is dev convenience).

### 3.1 `0007_memory_domain_check` — CHECK Constraint on Memory.domain

**Why:** ORM defines domain as a plain `String(100)`. The P07 design requires a
CHECK constraint limiting domain values to a controlled set (e.g., `document`,
`episodic`, `procedural`, `semantic`, `relational`, `temporal`). Without it, any
arbitrary string can be inserted.

**What it does (expand):**

```sql
ALTER TABLE memories
  ADD CONSTRAINT chk_memories_domain
  CHECK (domain IN ('document', 'episodic', 'procedural', 'semantic', 'relational', 'temporal'));
```

**Rollback (contract):**

```sql
ALTER TABLE memories DROP CONSTRAINT IF EXISTS chk_memories_domain;
```

**Risk:** LOW — additive constraint on nullable column. Existing rows with
`NULL` domain pass (CHECK only fires on non-NULL values). Rows with non-matching
domain values must be backfilled first.

**Dependencies:** `0004_memory_taxonomy` (column must exist). Requires backfill
migration to set `domain` on existing rows before applying constraint.

**Pre-flight:** `SELECT DISTINCT domain FROM memories WHERE domain IS NOT NULL;`
— verify all values are in the allowed set.

### 3.2 `0008_rls_expansion` — Expand RLS From 4 → 31 Tables (Custom Runner Only)

**Why:** Custom runner `0005_rls` enables RLS on only 4 tables. Alembic
`0005_rls_expanded` covers 31 tables. If only the custom runner was used
(dev/test), production isolation is broken on 27 tables.

**What it does (expand):**

```sql
-- For each table in SCOPED_TABLES not already covered:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_{table}_workspace ON {table}
  USING (workspace_id = current_setting('app.workspace_id')::uuid
         AND tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (workspace_id = current_setting('app.workspace_id')::uuid
              AND tenant_id = current_setting('app.tenant_id')::uuid);
```

**Rollback (contract):**

```sql
DROP POLICY IF EXISTS p_{table}_workspace ON {table};
ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
```

**Risk:** MED — RLS policies can break queries if
`app.workspace_id`/`app.tenant_id` session vars are not set. Must verify all DB
connections set these vars. Mitigated by defense-in-depth: app-level tenant
filter still applies.

**Dependencies:** `0005_rls_expanded` (Alembic) or `0005_rls` (custom runner) —
whichever ran first.

**Pre-flight:**

1. Verify all application connections set `app.workspace_id` and
   `app.tenant_id`.
2. Run integration tests with RLS enabled.
3. Confirm no queries bypass session variable setup.

### 3.3 `0009_composite_not_null` — Composite NOT NULL Guard

**Why:** `tenant_id` and `workspace_id` are used in RLS policies but some tables
allow NULL. A composite constraint ensures both are always set together,
preventing isolation bypass.

**What it does (expand):**

```sql
-- Example for tables where both columns are nullable or one is nullable:
ALTER TABLE memories
  ADD CONSTRAINT chk_memories_tenant_workspace_nn
  CHECK (tenant_id IS NOT NULL AND workspace_id IS NOT NULL);
```

**Rollback (contract):**

```sql
ALTER TABLE memories DROP CONSTRAINT IF EXISTS chk_memories_tenant_workspace_nn;
```

**Risk:** LOW — additive CHECK. Pre-flight must verify no existing rows have
NULL in either column.

**Dependencies:** RLS expansion (0005 or 0008).

### 3.4 `0010_memory_domain_backfill` — Backfill Existing Domains

**Why:** Alembic 0004 adds `domain` column but doesn't backfill. Existing
memories have `domain = NULL`. The CHECK constraint (0007) will reject non-NULL
invalid values but NULLs pass through, breaking domain-based queries.

**What it does (expand):**

```sql
-- Map existing memory types to domains (idempotent):
UPDATE memories SET domain = 'document' WHERE domain IS NULL AND type IN ('document', 'note', 'file');
UPDATE memories SET domain = 'episodic' WHERE domain IS NULL AND type IN ('schedule_events', 'event', 'calendar');
UPDATE memories SET domain = 'procedural' WHERE domain IS NULL AND type IN ('how_to', 'workflow', 'process');
UPDATE memories SET domain = 'semantic' WHERE domain IS NULL AND type IN ('fact', 'entity', 'definition');
UPDATE memories SET domain = 'relational' WHERE domain IS NULL AND type IN ('relationship', 'connection');
UPDATE memories SET domain = 'temporal' WHERE domain IS NULL AND type IN ('timeline', 'history');
-- Default unmapped types to 'document' (flag for review):
UPDATE memories SET domain = 'document' WHERE domain IS NULL;
```

**Rollback (contract):**

```sql
UPDATE memories SET domain = NULL WHERE domain IS NOT NULL;
```

**Risk:** MED — backfill mapping must be reviewed. Unmapped types silently
default to `document`. Requires manual review of
`SELECT DISTINCT type FROM memories WHERE domain IS NULL;` before apply.

**Dependencies:** `0004_memory_taxonomy` (column must exist). Must run BEFORE
`0007_memory_domain_check`.

## 4. Consolidated Migration Order

```
Alembic chain (canonical):
  0001_initial_schema
  0002_microservice_tables
  0003_approval_tables        ← approval_request, approval_decision, idempotency_key cols
  0004_memory_taxonomy        ← domain, supersedes_id, deleted_at columns
  0005_rls_expanded           ← RLS on 31 tables
  0006_provenance             ← embeddings, documents, users, workspaces, connectors cols
  0007_memory_domain_backfill ← NEW: backfill domain values
  0008_memory_domain_check    ← NEW: CHECK constraint on domain
  0009_rls_completeness       ← NEW: fill gaps if custom runner was used instead
  0010_composite_not_null     ← NEW: tenant_id + workspace_id NOT NULL guard

Custom runner (dev/test only):
  0002_microservice_tables    ← DUPLICATE of Alembic 0002 — skip in prod
  0003_approvals              ← agent_approvals (different from approval_request)
  0004_memory_taxonomy        ← partial: memories only, no memory_records
  0005_rls                    ← 4 tables only — expand via 0009 in prod
  0006_idempotency            ← idempotency_records table
  0007_gmail_watch            ← gmail_watches table
```

## 5. Migration Discipline

### 5.1 Expand-Contract Pattern

Every migration follows two phases:

1. **Expand** (forward): Add new columns/tables/constraints without breaking
   existing code. Old code continues to work.
2. **Contract** (subsequent migration): Remove old columns/tables/constraints
   after all code has migrated to the new schema.

Example:

- Expand: Add `domain` column (nullable) → 0004
- Expand: Backfill `domain` values → 0010
- Expand: Add CHECK constraint → 0008
- Contract (later phase): Drop `type` column if `domain` fully replaces it

### 5.2 Rules

1. **One migration per concern.** Each has `upgrade()` + `downgrade()`.
   Idempotent (re-runnable on partial failure via version tracking).
2. **Backfill mapping reviewed + tested** before apply. Memory type → domain map
   must be signed off.
3. **Every migration runs against:** dev (docker-compose Postgres) → staging →
   prod. CI job applies + rolls back + re-applies.
4. **No destructive step** without: backup taken, runbook written, named
   approver, rollback rehearsed.
5. **Schema changes never shipped as silent `CREATE TABLE` in app startup.**
   `Base.metadata.create_all` in `main.py` lifespan is dev-only; prod uses
   Alembic only.
6. **Lock timeouts:** For large tables, set `lock_timeout = '5s'` before DDL.
   Never hold locks across transactions.
7. **No FK constraints in backfill migrations** — use application-level FK
   validation instead to avoid lock escalation.

### 5.3 CI Integration

```yaml
# .github/workflows/migration-test.yml (conceptual)
- name: Test migrations
  run: |
    alembic upgrade head
    alembic downgrade base
    alembic upgrade head  # re-apply — idempotency check
    python -m pytest tests/migrations/ -q
```

## 6. Rollback Scenarios

| Scenario                                       | Immediate Action                                                                                                                   | Root Cause Fix                                                                      | Prevention                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Migration fails mid-apply**                  | `alembic downgrade <last-good-version>`. Fix migration SQL. Re-apply. No data written (DDL is atomic in Postgres).                 | Fix syntax/constraint error in migration file.                                      | Test migrations against fresh DB in CI before prod.                         |
| **Data corruption detected post-apply**        | Restore from daily backup (RPO 24h, BQ-P07-02). Replay DLQ if queue-backed writes were affected.                                   | Identify which rows were mutated. Write corrective backfill.                        | Data-preservation test: fixture data survives forward+backward cycles.      |
| **Bad backfill (wrong mapping)**               | Downgrade 0010 (set domains to NULL), fix mapping SQL, re-run. If CHECK constraint already applied, downgrade 0008 first.          | Review `SELECT DISTINCT type FROM memories` and update mapping.                     | Pre-flight query + manual review before backfill migration.                 |
| **RLS breaks queries**                         | Downgrade 0005/0009 (drop policies). App-level tenant filter still provides isolation (defense-in-depth). Debug which query fails. | Verify session variable setup (`SET app.workspace_id`). Fix connection pool config. | Integration tests with RLS enabled. Load test with RLS.                     |
| **CHECK constraint rejects valid data**        | Downgrade 0008 (drop constraint). Fix allowed values list. Re-apply.                                                               | Expand CHECK constraint to include missing valid values.                            | Pre-flight: `SELECT DISTINCT domain FROM memories` to enumerate all values. |
| **Provider/embedding regression (0007 guard)** | Re-embed with old dimensions (ADR-024).                                                                                            | Rebuild projection.                                                                 | Gated by eval; only triggered when provider changes.                        |

## 7. Verification (P11 Executes; Tests at P13/P14)

- **Migration test suite:** Apply all → assert schema invariants (constraints
  present, RLS policies exist, CHECK constraints active) → downgrade all →
  re-apply (idempotent).
- **Data preservation test:** Fixture data survives forward + backward cycles.
  No silent data loss.
- **Isolation invariant tests:** Cross-workspace access blocked with and without
  app-level filter (defense-in-depth, NFR-15/h15).
- **RLS integration test:** Set session vars, query as tenant A, verify tenant B
  data invisible.
- **Backfill review:** Manual sign-off on memory type → domain mapping before
  production apply.
