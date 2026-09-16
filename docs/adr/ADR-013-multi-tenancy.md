# ADR-013: Multi-Tenancy with Pooled Isolation

| Metadata     | Value            |
| ------------ | ---------------- |
| **Status**   | Accepted         |
| **Date**     | 2026-07-22       |
| **Deciders** | Engineering Team |

## Context

Vaeloom serves multiple organizations (tenants) with strict data isolation
requirements. The system must prevent cross-tenant data access, support
tenant-specific configurations, and allow future migration to dedicated database
instances for high-compliance tenants.

Options considered: Pooled (shared-database with tenant_id), Bridged (dedicated
database per tenant), Hybrid (pooled by default, bridged on demand).

## Decision

Use **pooled multi-tenancy** with tenant-scoped row-level isolation and optional
bridge mode for compliance tenants.

Implementation:

- `tenant_id` UUID column on every tenant-scoped table
- `TenantContext` middleware extracts tenant from JWT or subdomain and attaches
  to request scope
- RLS policies cover 4/34 tables (users, workspaces, documents, memory_records).
  Other tables rely on application-level filtering.
- `Tenant` model in `tenants` table with isolation mode flag (`pooled` or
  `bridged`)
- `DataIsolationMiddleware` validates that cross-tenant data access is
  impossible
- Audit events include `tenant_id` for compliance reporting
- Future: dedicated database per tenant via dynamic connection string switching
  in bridge mode

## Consequences

**Positive:**

- Single PostgreSQL instance serves all tenants — minimal operational overhead
- Row-level `tenant_id` filtering is well-understood and performant with proper
  indexes
- Audit logging with tenant context provides per-tenant compliance reports
- Bridge mode path exists for high-compliance tenants without architectural
  changes
- Tenant-specific settings/limits/features in `Tenant` model enable plan-based
  feature gating

**Negative:**

- Every query must include `tenant_id = :tid` — a missing filter is a data leak
  vulnerability
- Database size grows with all tenants combined — a noisy tenant can impact
  neighbors (noisy neighbor problem)
- Schema migrations affect all tenants simultaneously — no phased rollout per
  tenant
- Bridge mode migration requires per-tenant data export/import and connection
  routing logic

## Addendum — 2026-09-15 (WS-D)

The Decision above states "RLS policies cover 4/34 tables … Other tables rely on
application-level filtering." That count is **STALE**.

- **Current state (2026-08-22): RLS 42/42** — 34 via Alembic 0010 + 3 via 0019
  - 5 via 0020 (`apps/api/alembic/versions/0020_rls_remaining_5.py:1-18`
    completes coverage from 37/42; `0023_resume_artifacts.py:8` notes new tables
    follow the same workspace-RLS pattern).
- **Enforcement:** `TenantContext` (`apps/api/src/api/middleware/tenant.py:12`)
  - `set_rls_session_vars` (`:38`) sets GUCs `app.tenant_id` /
    `app.workspace_id` / `app.user_id` via `set_config(..., true)`
    (transaction-scoped `SET LOCAL`, PgBouncer-safe), fail-closed (missing GUC ⇒
    zero rows). `TenantMiddleware` is mounted (`apps/api/src/api/main.py:322`);
    `database.py:136-168` re-asserts GUCs per session.
- **Caveat (preserved):** the automated test tier runs SQLite where RLS is a
  no-op (`set_rls_session_vars` returns early on non-PostgreSQL; migration 0020
  is a no-op on SQLite), so RLS enforcement is **unproven at the test tier**.
  Follow-up: live-PostgreSQL RLS test + staging GUC audit.
- Original Decision/Consequences above are retained as history; this addendum
  supersedes only the table count and the implied app-filtering gap.
