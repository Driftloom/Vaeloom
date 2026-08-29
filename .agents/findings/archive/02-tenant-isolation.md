# Finding 02 — Tenant Isolation Deep Dive

**Status:** RESOLVED (verified 2026-08-29) **Verified:** `middleware/tenant.py`,
`migrations/0005_rls.py`, `models/schema.py` **Date:** 2026-08-16

## TenantMiddleware Bug (`tenant.py:62-78`)

The middleware exists and has real logic, but has a critical bug:

```python
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        tenant_id = request.headers.get("X-Tenant-ID", "")
        workspace_id = request.headers.get("X-Workspace-ID", "")
        TenantContext.set(tenant_id or None, workspace_id or None)
        try:
            response = await call_next(request)  # processes entire request
            return response
        finally:
            TenantContext.clear()
```

**Problem:** Sets `TenantContext` but never calls `set_rls_session_vars()`.

The function `set_rls_session_vars()` exists at line 40-59:

```python
async def set_rls_session_vars(db: AsyncSession) -> None:
    ctx = TenantContext.get()
    tenant_id = ctx.get("tenant_id")
    if not tenant_id:
        return
    await db.execute(text("SET app.tenant_id = :tid"), {"tid": tenant_id})
```

This function is designed to be called on each DB session, but the middleware
dispatch never invokes it. RLS policies in PostgreSQL check
`current_setting('app.tenant_id', true)` — they would always get empty string.

## Three-Layer Isolation Gap

| Layer                       | Status      | Detail                                                        |
| --------------------------- | ----------- | ------------------------------------------------------------- |
| 1. Middleware mounted       | **MISSING** | `TenantMiddleware` not in `main.py` stack                     |
| 2. RLS session variable set | **MISSING** | Middleware doesn't call `set_rls_session_vars()`              |
| 3. Frontend sends headers   | **MISSING** | `api-client.ts` never sends `X-Tenant-ID` or `X-Workspace-ID` |

## RLS Coverage Analysis

**Migration:** `0005_rls.py:16`

```python
RLS_TABLES = ("memories", "events", "usage_records", "api_keys")
```

**Tables with RLS (4):** memories, events, usage_records, api_keys

**Tables with `tenant_id` column but NO RLS (8):**

| Table            | Line in schema.py | tenant_id type                |
| ---------------- | ----------------- | ----------------------------- |
| users            | 27                | UUID FK→tenants.id            |
| connectors       | 148               | UUID                          |
| agents           | 432               | UUID                          |
| agent_executions | 449               | String(36)                    |
| approval_request | 541               | UUID (NOT NULL)               |
| subscriptions    | 645               | UUID (unique)                 |
| webhooks         | 662               | UUID FK→tenants.id (NOT NULL) |
| integrations     | 740               | UUID                          |
| plugins          | 764               | String(255)                   |

**Tables WITHOUT `tenant_id` that may need it:**

| Table               | Current isolation                             |
| ------------------- | --------------------------------------------- |
| workspaces          | user_id only (ownership via user, not tenant) |
| documents           | workspace_id only                             |
| resumes             | workspace_id only                             |
| applications        | workspace_id only                             |
| notifications       | workspace_id + user_id                        |
| entities            | workspace_id only                             |
| relationships       | workspace_id only                             |
| memory_records      | workspace_id only                             |
| memory_taxonomy     | workspace_id only                             |
| document_versions   | document_id only                              |
| idempotency_records | none                                          |

## Isolation Model

The project uses a **workspace-based isolation model**, not pure tenant
isolation:

- Most tables are scoped by `workspace_id` (owned by a user)
- Only a few tables use `tenant_id` directly (memories, events, api_keys,
  webhooks)
- The `tenants` table is minimal (58 lines) — mostly for enterprise SSO
- `workspaces` has NO `tenant_id` — isolation is through `user_id` →
  `User.tenant_id`

This means:

- **User isolation:** All workspace data is scoped to `user_id` (via FK
  relationships)
- **Tenant isolation:** Only enforced on tables that have both `tenant_id` AND
  RLS policies (4 tables)
- **Cross-tenant risk:** If tenant_id is wrong on
  memories/events/usage_records/api_keys, data leaks

## Impact

For an **MVP** (single user / small team):

- Workspace-level isolation via `user_id` FK is sufficient
- The `tenant_id` + RLS layer is enterprise hardening
- Gap is real but not release-blocking for MVP

For **enterprise** (multi-tenant):

- Critical gap — RLS would not work even if middleware were mounted
- All 8 tenant_id tables need RLS policies
- Frontend must send tenant headers
- `set_rls_session_vars()` must be called from middleware or as a dependency

## Resolution (2026-08-29)

All three layers from the original finding are now in place:

1. **Middleware mounted** — `TenantMiddleware` is added in `main.py:253`
   (comment: "fixes RLS never-set bug (audit CRITICAL 2026-08-21)").
2. **RLS session variable set** — `set_rls_session_vars()`
   (middleware/tenant.py) sets `app.tenant_id`, `app.workspace_id`,
   `app.user_id` via `SET LOCAL` (PgBouncer-safe, fail-closed); also invoked
   from `database.get_db()`.
3. **Frontend/request context** — `tenant_id` is derived ONLY from the JWT
   (user-supplied `X-Tenant-ID` header is never trusted); `workspace_id` is
   resolved from JWT → path param (`/workspaces/{workspace_id}/...`) → header,
   so workspace scoping works without the frontend sending explicit headers.

- RLS coverage is 42/42 (FORCE RLS) per migrations 0010/0019/0020/0023/0024.
- Original 2026-08-16 snapshot predates the 2026-08-22/23 hardening and is
  obsolete.
