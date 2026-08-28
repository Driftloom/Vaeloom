# Finding: get_current_tenant / require_workspace_access Never Imported

| Metadata     | Value                                                   |
| ------------ | ------------------------------------------------------- |
| **ID**       | FIND-RLS-006                                            |
| **Severity** | P2-MEDIUM                                               |
| **Status**   | RESOLVED (verified 2026-08-28 — dead functions removed) |
| **Source**   | RLS Audit                                               |
| **File**     | `apps/api/src/api/middleware/tenant.py:81-139`          |

## Description

`get_current_tenant()` and `require_workspace_access()` are defined in
`tenant.py` but never imported by any router. They are dead code. Routers use
`get_tenant_id` from `dependencies.py` instead, which only reads the header
value without database validation.

## Impact

- Database-level tenant validation is available but unused
- Routers trust the middleware-set value without verification

## Remediation

Either:

1. Wire `get_current_tenant()` into routes that need tenant validation
2. Or remove the dead code to avoid confusion
