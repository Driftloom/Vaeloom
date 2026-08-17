# Finding: ADR-013 Claims All Queries Filter by tenant_id

| Metadata     | Value                               |
| ------------ | ----------------------------------- |
| **ID**       | FIND-DOC-013                        |
| **Severity** | P1-HIGH                             |
| **Status**   | OPEN                                |
| **Source**   | Documentation Audit                 |
| **File**     | `docs/adr/ADR-013-multi-tenancy.md` |

## Description

ADR-013 claims "All queries filter by `tenant_id` — enforced at
repository/service layer". In reality, most routes and services do NOT filter by
tenant_id. The `get_tenant_id` dependency is used by some routers but not all.

## Impact

- False confidence in tenant isolation
- Cross-tenant data access possible in routes without filtering

## Remediation

Update ADR to accurately reflect which routes filter by tenant_id.
