# ADR-013: Multi-Tenancy with Pooled Isolation

| Metadata | Value |
| ------------ | ---------------- |
| **Status** | Accepted |
| **Date** | 2026-07-22 |
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
