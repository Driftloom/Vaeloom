# MVP-P07 — 05. Isolation Rules (DEL-MVP-P07-03)

> Owner: Security Architect · Invariant: **a missing scope key can never leak
> data** (prompt §12.3). Defense-in-depth: app-level filters (existing) + RLS
> (target, ADR-023).

---

## 1. Scope-Key Model

Every artifact row carries `tenant_id` + `workspace_id`. These two UUIDs form
the **composite isolation key** — both must be present and match the caller's
identity for any row to be visible.

**Invariant:** A missing scope key can never leak data. If either key is NULL,
the row is invisible to all queries (fail-closed by design).

| Component      | Role                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `tenant_id`    | Identifies the organizational tenant. Every scoped table carries this column.                                    |
| `workspace_id` | Identifies the workspace within a tenant. Provides the second axis of isolation.                                 |
| Session GUCs   | `SET app.tenant_id`, `SET app.workspace_id` — set per-request from verified JWT claims, never from client input. |

**Key design decisions:**

- Both keys are **UUID NOT NULL** on new/affected tables. Migration 0005
  enforces composite NOT NULL constraints where they exist.
- Some legacy tables (Memory, Connector, Agent, Event) have **nullable**
  `tenant_id`. RLS policies on these tables return zero rows for NULL values
  (correct fail-closed behavior), but this must be documented and eventually
  remediated.
- The composite key is **tenant-scoped first**: `tenant_id` narrows to the
  organizational boundary, then `workspace_id` narrows within that boundary.

---

## 2. Current State — IMPLEMENTED 2026-08-17

### What actually exists today

| Layer                 | Mechanism                                                                                         | Status                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Application-level** | `TenantContext` middleware (reads `X-Tenant-ID` / `X-Workspace-ID` headers, stores in ContextVar) | ✅ Implemented                                                 |
| **Application-level** | `TenantAwareRepository` base class (adds `tenant_id` filter to queries)                           | ✅ Implemented but **unused by most agents/services**          |
| **Database-level**    | RLS on **34 tables** (31 from 0005 + 3 from 0007)                                                 | ✅ Implemented                                                 |
| **RLS policy**        | Composite `workspace_id` + `tenant_id` filter (not just tenant_id)                                | ✅ Implemented                                                 |
| **Session GUCs**      | `SET LOCAL app.tenant_id` / `SET LOCAL app.workspace_id` (transaction-scoped)                     | ✅ **Implemented** in `middleware/tenant.py` and `database.py` |
| **PgBouncer safety**  | Uses `SET LOCAL` (not `SET`) — safe with transaction pooling                                      | ✅ **Implemented** — no cross-tenant leak via connection reuse |
| **FORCE RLS**         | `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on all 34 RLS tables                                   | ✅ **Implemented** via migration 0010                          |
| **PostgreSQL roles**  | `vaeloom_app` (app), `vaeloom_migrator` (BYPASSRLS), `vaeloom_readonly` (analytics)               | ✅ **Implemented** via migration 0010                          |
| **CI isolation test** | `tests/test_rls_isolation.py` — 4 tests verifying cross-tenant isolation                          | ✅ **Implemented**                                             |

### Remaining gaps

1. **TenantAwareRepository not widely adopted.** Most agents and services query
   tables directly without going through the repository layer, bypassing the
   application-level tenant filter. RLS provides DB-level safety net.

2. **Nullable tenant_id on legacy tables.** `Memory`, `Connector`, `Agent`, and
   `Event` have nullable `tenant_id`. RLS USING clause returns no rows for NULL
   (correct fail-closed), but existing data in those tables may be invisible
   once RLS is enforced. if RLS is actually enabled on the table. For the 4
   tables with RLS, queries return zero rows unless the session variables are
   set. For the other ~26 tables, no RLS exists at all.

3. **tenant_id-only filter in RLS (custom runner only).** The custom runner
   (`migrations/0005_rls.py`) uses tenant_id-only policies on 4 tables.
   The Alembic system (`alembic/versions/0005_rls_expanded.py`) uses composite
   `workspace_id` + `tenant_id` policies on 31 tables. Two workspaces within
   the same tenant can see each other's rows via the custom runner path.

4. **TenantAwareRepository is not widely adopted.** Most agents and services
   query tables directly without going through the repository layer, bypassing
   the application-level tenant filter.

5. **Nullable tenant_id on legacy tables.** `Memory`, `Connector`, `Agent`, and
   `Event` have nullable `tenant_id`. RLS USING clause returns no rows for NULL
   (correct fail-closed), but this means existing data in those tables may be
   invisible once RLS is enforced.

---

## 3. Target State (Design)

### 3.1 RLS Coverage

RLS must be enabled on **all tenant-scoped tables** — approximately 30 tables.
Each gets a composite policy matching both `workspace_id` and `tenant_id`.

**Full table list (target):**

| Table                 | Notes                                                   |
| --------------------- | ------------------------------------------------------- |
| `workspaces`          | Workspace boundary table                                |
| `workspace_users`     | Membership — scoped to workspace                        |
| `documents`           | User documents                                          |
| `document_versions`   | Version history                                         |
| `memories`            | Memory entries (nullable tenant_id — remediate)         |
| `memory_records`      | Memory sub-records                                      |
| `resumes`             | Resume data                                             |
| `applications`        | Job applications                                        |
| `approval_request`    | Approval workflows                                      |
| `approval_decision`   | Approval decisions                                      |
| `schedule_events`     | Calendar/schedule                                       |
| `connectors`          | Integration connectors (nullable tenant_id — remediate) |
| `events`              | System events (nullable tenant_id — remediate)          |
| `event_subscriptions` | Event subscriptions                                     |
| `dead_letter_events`  | Failed event processing                                 |
| `notifications`       | User notifications                                      |
| `agent_executions`    | Agent run history                                       |
| `agent_actions`       | Agent action log                                        |
| `api_keys`            | API key storage                                         |
| `auth_sessions`       | Authentication sessions                                 |
| `usage_records`       | Usage/metering                                          |
| `webhooks`            | Webhook definitions                                     |
| `webhook_deliveries`  | Webhook delivery log                                    |
| `subscriptions`       | Subscription records                                    |
| `integrations`        | Integration configs                                     |
| `plugins`             | Plugin registry                                         |
| `plugin_executions`   | Plugin run history                                      |
| `agent_schedules`     | Scheduled agent runs                                    |
| `embeddings`          | Vector embeddings                                       |
| `entities`            | Knowledge graph entities                                |
| `relationships`       | Knowledge graph relationships                           |

**Tables excluded from RLS:**

| Table                       | Reason                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `users`                     | Global identity — access via authz only, not tenant-scoped    |
| `tenants`                   | Global identity — tenant registry itself is not tenant-scoped |
| `audit_events`              | Operator-only — separate role, enterprise-gated router        |
| `telemetry_*` / `metrics_*` | No personal data — dashboard role, not tenant-scoped          |

### 3.2 Session Variable Setup

Per-request, the middleware or a dependency must set PostgreSQL session
variables before any scoped query executes:

```sql
SET app.tenant_id = '<uuid-from-jwt>';
SET app.workspace_id = '<uuid-from-jwt>';
```

**PgBouncer compatibility:** In transaction-mode pooling
(`pool_mode = transaction`), GUCs set via `SET` are local to the transaction and
automatically cleared when the transaction ends. With
`default_transaction_isolation` and PgBouncer's
`server_reset_query = DISCARD ALL`, session state is properly cleaned between
pool checkouts. Alternatively, use `local = true` in the connection string to
ensure GUCs are client-side only.

**Fail-closed behavior:** If `SET app.tenant_id` or `SET app.workspace_id` is
never called, `current_setting('app.tenant_id', true)` returns NULL. The RLS
policy's `USING` clause evaluates to NULL (unknown), which is treated as FALSE.
Result: **zero rows returned**, not an error. This is the correct fail-closed
behavior — no data leaks, no information disclosure via error messages.

### 3.3 PostgreSQL Roles

| Role       | Purpose                          | Grants                                                             |
| ---------- | -------------------------------- | ------------------------------------------------------------------ |
| `app`      | Runtime application queries      | SELECT/INSERT/UPDATE/DELETE on scoped tables. RLS active. No DDL.  |
| `migrator` | Schema migrations (Alembic)      | DDL (CREATE/ALTER/DROP). No app connections in production.         |
| `reporter` | Read-only analytics (enterprise) | SELECT only. RLS applies — sees only data within the role's scope. |

Role creation and grant statements belong in the migration that enables RLS
(0005_rls.py or a follow-up migration).

---

## 4. RLS Policy Pattern

### 4.1 Standard Composite Policy (most tables)

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_<table_name>_workspace ON <table_name>
  USING (
    workspace_id = current_setting('app.workspace_id', true)::uuid
    AND tenant_id = current_setting('app.tenant_id', true)::uuid
  );
```

This policy is applied to every table in the "Full table list" above.

### 4.2 Global Identity Tables (users, tenants)

**No RLS.** These tables are not tenant-scoped. Access is controlled at the
application layer via authorization checks (`require_workspace_access`,
`require_tenant_admin`, etc.).

```sql
-- No RLS on users or tenants
-- Access controlled by application-level authz
```

### 4.3 Operator-Only Tables (audit_events)

RLS on workspace scope, but access requires a separate PostgreSQL role with
elevated privileges. The enterprise-gated operator review router uses this role.

```sql
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_audit_events_operator ON audit_events
  USING (
    workspace_id = current_setting('app.workspace_id', true)::uuid
  )
  TO operator;  -- Only the operator role sees rows
```

### 4.4 Telemetry Tables (no personal data)

**No RLS.** Telemetry and metrics tables contain no personally identifiable
information. Access is controlled by the `reporter` role (SELECT only) and
application-level dashboard authorization.

```sql
-- No RLS on telemetry/metrics tables
-- Access controlled by reporter role + application authz
```

---

## 5. Session Context Setup

### 5.1 Middleware Implementation

The `TenantMiddleware` (or a new `RLSSessionMiddleware`) must set GUCs on the
database connection before any scoped query executes:

```python
# Pseudocode for session setup
async def set_rls_context(connection, tenant_id: UUID, workspace_id: UUID):
    await connection.execute(
        f"SET app.tenant_id = '{tenant_id}'"
    )
    await connection.execute(
        f"SET app.workspace_id = '{workspace_id}'"
    )
```

This must happen:

- After JWT validation (tenant_id and workspace_id are verified claims)
- Before any database query on scoped tables
- On every request (GUCs are connection-scoped, not transaction-scoped by
  default)

### 5.2 PgBouncer Transaction Mode

In transaction-mode pooling, `SET` commands affect only the current transaction.
When the transaction ends and the connection returns to the pool, PgBouncer runs
`server_reset_query` (typically `DISCARD ALL`), which clears all GUCs. This is
safe — the next checkout gets a clean connection.

If using `pool_mode = session`, GUCs persist across requests on the same
connection. This is **unsafe** for multi-tenant deployments. Always use
`pool_mode = transaction` or ensure `server_reset_query = DISCARD ALL`.

### 5.3 Fail-Closed Behavior

| Scenario                | `current_setting('app.tenant_id', true)` | RLS result                       |
| ----------------------- | ---------------------------------------- | -------------------------------- |
| GUC set correctly       | `<uuid>`                                 | Rows matching tenant + workspace |
| GUC never set           | `NULL`                                   | Zero rows (fail-closed)          |
| GUC set to invalid UUID | Error at `::uuid` cast                   | Query fails (no data leak)       |
| GUC set to empty string | Error at `::uuid` cast                   | Query fails (no data leak)       |

**Never** use `current_setting('app.tenant_id', false)` (the `false` variant
raises an exception if the setting is missing). Always use `true` (return NULL)
to get fail-closed zero-row behavior instead of an error that could leak
information.

---

## 6. Grants Model (Least Privilege)

### 6.1 Role Hierarchy

```
reporter (read-only)
    └── app (DML on scoped tables)
        └── migrator (DDL, migration-time only)
```

### 6.2 Grant Statements

```sql
-- App role (runtime)
CREATE ROLE app WITH LOGIN PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;

-- Migrator role (DDL)
CREATE ROLE migrator WITH LOGIN PASSWORD '...';
GRANT ALL PRIVILEGES ON SCHEMA public TO migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO migrator;

-- Reporter role (read-only, enterprise)
CREATE ROLE reporter WITH LOGIN PASSWORD '...';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporter;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO reporter;
```

### 6.3 Production Constraints

- The `migrator` role must **never** be used by the application at runtime. Its
  credentials should exist only in the migration CI pipeline.
- The `app` role must not have DDL privileges. Schema changes go through the
  `migrator` role via Alembic.
- The `reporter` role is enterprise-only. RLS applies to it — it sees only data
  within the scope set by its session GUCs.

---

## 7. Defense-in-Depth Layers

Isolation is enforced at four layers. Each layer independently blocks cross-
tenant/cross-workspace access. A breach of one layer does not compromise the
others.

| Layer       | Mechanism                   | Scope   | Failure Mode                                                                               |
| ----------- | --------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| **Layer 1** | JWT authentication          | Request | Invalid/expired JWT → 401. No query executed.                                              |
| **Layer 2** | `require_workspace_access`  | Request | Workspace not in JWT → 403. No query executed.                                             |
| **Layer 3** | Service-level tenant filter | Query   | `TenantAwareRepository` adds WHERE clause. Missing filter → app-level leak (not DB-level). |
| **Layer 4** | RLS (database)              | Row     | Session GUCs not set → zero rows. Composite mismatch → zero rows.                          |

**How they work together:**

1. JWT provides `tenant_id` and `workspace_id` as verified claims.
2. `require_workspace_access` verifies the caller has access to the requested
   workspace (prevents JWT replay across workspaces).
3. Service layer adds `tenant_id` / `workspace_id` filters to queries (defense
   against RLS misconfiguration).
4. RLS enforces the same filters at the database level (defense against
   application bugs).

**Important:** Layer 3 (service-level) is currently incomplete — most agents do
not use `TenantAwareRepository`. This means Layer 4 (RLS) is the **only**
enforcement for those code paths. RLS implementation is therefore critical, not
optional.

---

## 8. Invariant Tests (P14 Isolation Suite)

These tests must pass to close NFR-15/h15, FR-h60..66, and RISK-P05-03.

### 8.1 Cross-Workspace Read Blocked (RLS Alone)

```sql
-- Setup: Set session to workspace A
SET app.tenant_id = 'tenant-1';
SET app.workspace_id = 'workspace-A';

-- Insert a row
INSERT INTO memories (id, tenant_id, workspace_id, content)
  VALUES (gen_random_uuid(), 'tenant-1', 'workspace-A', 'secret A');

-- Switch to workspace B (same tenant)
SET app.workspace_id = 'workspace-B';

-- Query: must return zero rows
SELECT * FROM memories;
-- Expected: 0 rows (RLS blocks cross-workspace read)
```

### 8.2 Unset Session Vars = Zero Rows (Fail-Closed)

```sql
-- Do NOT set app.tenant_id or app.workspace_id
SELECT * FROM memories;
-- Expected: 0 rows (fail-closed, not an error)
```

### 8.3 Composite NOT NULL Enforced

```sql
-- Attempt to insert without tenant_id
INSERT INTO memories (id, workspace_id, content)
  VALUES (gen_random_uuid(), 'workspace-A', 'test');
-- Expected: NOT NULL constraint violation

-- Attempt to insert without workspace_id
INSERT INTO memories (id, tenant_id, content)
  VALUES (gen_random_uuid(), 'tenant-1', 'test');
-- Expected: NOT NULL constraint violation
```

### 8.4 App Filter + RLS Both On

```sql
-- Both layers active — allowed only for own workspace
SET app.tenant_id = 'tenant-1';
SET app.workspace_id = 'workspace-A';

-- Application also adds WHERE workspace_id = 'workspace-A'
SELECT * FROM memories WHERE workspace_id = 'workspace-A';
-- Expected: rows for workspace-A only
```

### 8.5 SQLite Test Harness

SQLite does not support RLS. Tests in the SQLite harness mock the RLS layer and
validate only application-level filtering (Layer 3). Production Postgres
assertions run in CI integration jobs against a real Postgres instance
(docker-compose).

### 8.6 Erasure + Projection Rebuild Respect Isolation

```sql
-- After data erasure, verify no cross-workspace ghost rows appear
SET app.tenant_id = 'tenant-1';
SET app.workspace_id = 'workspace-A';
SELECT * FROM memories WHERE id = '<erased-id>';
-- Expected: 0 rows
```

---

## 9. Risk Register

| Risk                                                                                                                                                                                                  | Severity | Mitigation                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| **RLS breaks existing queries.** SQLite tests do not exercise RLS. Queries that work in SQLite may fail or return unexpected results in Postgres with RLS enabled.                                    | High     | Run Postgres integration tests in CI (docker-compose). Add RLS-specific test suite in P14.           |
| **No `SET app.*` mechanism exists.** RLS is currently inert — policies exist but session variables are never set, so queries on RLS-enabled tables return zero rows or errors.                        | Critical | Implement session GUC middleware in P07. Block P07 completion until middleware is verified.          |
| **Nullable tenant_id on legacy tables.** `Memory`, `Connector`, `Agent`, `Event` have nullable `tenant_id`. RLS returns zero rows for NULL (correct fail-closed), but existing data may be invisible. | Medium   | Add data migration to backfill `tenant_id` on existing rows. Add NOT NULL constraint after backfill. |
| **TenantAwareRepository not widely adopted.** Most agents query tables directly, bypassing application-level tenant filtering.                                                                        | High     | Audit all query paths. Wrap or migrate direct queries to use `TenantAwareRepository` or equivalent.  |
| **PgBouncer session-mode leak.** If PgBouncer runs in session mode without `DISCARD ALL`, GUCs persist across requests, potentially leaking tenant context.                                           | High     | Enforce `pool_mode = transaction` in production config. Verify `server_reset_query = DISCARD ALL`.   |
| **Operator role bypass.** If the `operator` role is granted to the `app` role (or vice versa), isolation boundaries collapse.                                                                         | Medium   | Document role hierarchy. Add CI check: `app` must not be a member of `operator`.                     |

---

## 10. Acceptance Mapping

| Requirement                     | How Closed                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| NFR-15/h15 (isolation)          | Passing P14 isolation suite + RLS evidence                                 |
| FR-h60..66 (authz)              | Layers 1-4 enforced, invariant tests pass                                  |
| RISK-P05-03 (cross-tenant leak) | RLS composite policy + session GUC middleware + Postgres integration tests |
