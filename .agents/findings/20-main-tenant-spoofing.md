# Finding: TenantMiddleware Trusts Client-Supplied Headers

| Metadata     | Value                                         |
| ------------ | --------------------------------------------- |
| **ID**       | FIND-MAIN-001                                 |
| **Severity** | P0-CRITICAL                                   |
| **Status**   | OPEN (partially mitigated)                    |
| **Source**   | main.py Audit                                 |
| **File**     | `apps/api/src/api/middleware/tenant.py:63-78` |

## Description

`TenantMiddleware.dispatch()` reads `X-Tenant-ID` and `X-Workspace-ID` directly
from request headers WITHOUT validating against the authenticated user's JWT
claims. A malicious client can set `X-Tenant-ID: <any-uuid>` and access any
tenant's data.

## Evidence

```python
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        tenant_id = request.headers.get("X-Tenant-ID", "")  # trusts client
        workspace_id = request.headers.get("X-Workspace-ID", "")  # trusts client
        TenantContext.set(tenant_id or None, workspace_id or None)
```

The downstream `get_current_tenant()` does query the DB to verify the tenant
exists, but the middleware itself performs zero authorization.

## Impact

- Tenant spoofing possible via crafted headers
- Cross-tenant data access if application-level filtering is bypassed

## Remediation

1. Validate `X-Tenant-ID` against JWT's `tenant_id` claim in the middleware
2. Or remove the middleware entirely and rely solely on the FastAPI dependency
3. Add audit logging for tenant ID mismatches

## Related

- FIND-RLS-001: RLS Coverage Gap
- ADR-013: Multi-Tenancy
