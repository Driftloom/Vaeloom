# Finding: Zero RLS Integration Tests

| Metadata     | Value                                      |
| ------------ | ------------------------------------------ |
| **ID**       | FIND-RLS-004                               |
| **Severity** | P2-MEDIUM                                  |
| **Status**   | OPEN                                       |
| **Source**   | RLS Audit                                  |
| **File**     | `apps/api/tests/middleware/test_tenant.py` |

## Description

The test file covers `TenantContext` get/set/clear and `TenantMiddleware` header
parsing. NOT tested:

- `set_rls_session_vars()` — not imported, not tested
- Actual RLS enforcement against PostgreSQL
- Cross-tenant data isolation at the database level
- Whether the GUC is actually set and read by policies
- Behavior when GUC is NULL (should deny all rows)

## Impact

- No verification that tenant isolation works
- RLS bugs could go undetected

## Remediation

Write integration tests against a real PostgreSQL instance with RLS enabled:

1. Set GUC to tenant A, query tenant B's data → should return empty
2. Set GUC to NULL, query any data → should return empty
3. Verify `FORCE ROW LEVEL SECURITY` is set
