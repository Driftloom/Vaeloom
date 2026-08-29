# Finding: RLS Only Covers 4/36 Tables

| Metadata           | Value        |
| ------------------ | ------------ |
| **ID**             | FINDING-001  |
| **Severity**       | P0-CRITICAL  |
| **Status**         | OPEN         |
| **Date**           | 2026-08-16   |
| **Assigned Phase** | P07          |
| **Owner**          | Backend Team |

## Description

Row-Level Security (RLS) policies exist on only 4 out of 36+ tables in the
PostgreSQL database. While the GUC `app.tenant_id` is now SET (fixed in this
session), the policies don't exist on most tables.

## Evidence

- `alembic/versions/0005_rls_expanded.py` references 31 tables but many have
  missing columns
- `src/api/migrations/0005_rls.py` (custom runner) only covers 4 tables:
  `memories`, `events`, `usage_records`, `api_keys`
- Tables with `tenant_id` but NO RLS: `users`, `agents`, `workspaces`,
  `documents`, `embeddings`, `knowledge_nodes`, `knowledge_edges`

## Impact

Cross-tenant data isolation is not enforced at the database level. If
application-level filtering is bypassed (e.g., via SQL injection or a missing
filter in a new route), an attacker could access data from other tenants.

## Remediation

1. Create a comprehensive RLS migration that covers ALL tenant-scoped tables
2. Use `FORCE ROW LEVEL SECURITY` to ensure table owners are also subject to RLS
3. Write integration tests that verify cross-tenant isolation
4. Consider using a single RLS policy factory function to avoid policy sprawl

## Related

- ADR-013: Multi-Tenancy
- `docs/compliance/nist-ai-rfm-mapping.md` — MEASURE 5: Privacy
