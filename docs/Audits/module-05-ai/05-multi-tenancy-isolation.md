# Module 05: Multi-Tenancy Isolation & Database RLS
**Audit Identifier**: `AUD-M05-AI-05`
**Scope**: PostgreSQL Row-Level Security (RLS), tenant session context, and data partitioning.

---

## 1. Multi-Tenancy Enforcement Mechanism

Vaeloom implements defense-in-depth multi-tenancy:
1. **Application Middleware Level**: `TenantMiddleware` (`api/middleware/tenant.py`) resolves `tenant_id` and `workspace_id` from the JWT token and route path.
2. **Database Session Level**: `set_rls_session_vars()` (`api/database.py`) executes:
   ```sql
   SET LOCAL app.current_tenant_id = '<tenant_uuid>';
   SET LOCAL app.current_workspace_id = '<workspace_uuid>';
   SET LOCAL app.current_user_id = '<user_uuid>';
   ```
3. **Database Engine Level**: 42 tables enforce PostgreSQL Row-Level Security policies with `FORCE ROW LEVEL SECURITY`. Even direct queries by the application connection pool cannot bypass row isolation when GUCs are set.

---

## 2. Verification Evidence

- `test_module05_multitenancy.py`: Verifies that a user belonging to `Workspace A` receives `403/404` when attempting to list or access documents in `Workspace B`.
- `test_module05_multitenancy.py`: Verifies cross-tenant isolation where tenant session mismatch aborts execution before database queries are issued.
