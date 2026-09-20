# PostgreSQL Row Level Security (RLS) & GUC Safety Verification

**Engine**: PostgreSQL 16 (Live Supabase & Test Instances)  
**RLS Table Count**: 44/44 Tables (100% Coverage)  
**Policies Audited**: `0010`, `0014`, `0019`, `0020`, `0045`

---

## 1. RLS Mechanism Proof

In PostgreSQL, Row Level Security is enabled and forced across all multi-tenant
and workspace-scoped tables:

- `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE <name> FORCE ROW LEVEL SECURITY;` (Enforces RLS even for table
  owners)

### Tested Invariants (Live PostgreSQL Test Suite: `tests/test_rls_live_pg.py`)

| Invariant                     | Test Scenario                                                      | Expected Result                   | Live PG Result        |
| :---------------------------- | :----------------------------------------------------------------- | :-------------------------------- | :-------------------- |
| **Unset GUCs Fail Closed**    | Fresh connection with NULL `app.tenant_id`, `app.workspace_id`     | 0 rows returned on SELECT         | **5/5 PASS (0 Rows)** |
| **Cross-Tenant Isolation**    | Caller with Tenant B GUC queries Tenant A rows                     | 0 rows returned                   | **PASS (0 Rows)**     |
| **Cross-Workspace Isolation** | Caller with Workspace B GUC queries Workspace A rows (same tenant) | 0 rows returned                   | **PASS (0 Rows)**     |
| **Own Scope Visibility**      | Caller with Workspace A GUC queries Workspace A rows               | Exactly own rows returned         | **PASS (1 Row)**      |
| **WITH CHECK Enforcement**    | Attempt to insert row where `workspace_id` != session GUC          | Transaction rejected by DB engine | **PASS (Rejected)**   |

---

## 2. PgBouncer Transaction Pooling Safety

- All GUC assignments in `TenantMiddleware` use:
  `SELECT set_config('app.tenant_id', :tid, true)`
- The third argument (`is_local = true`) ensures GUCs are transaction-scoped
  (equivalent to `SET LOCAL`).
- Upon transaction commit or rollback, GUCs are automatically cleared by the
  PostgreSQL engine, completely preventing context leakage when connections are
  recycled by PgBouncer or connection pools.
- In addition, `TenantContext.clear()` executes unconditionally in Python
  `finally` blocks to clear async context variables.
