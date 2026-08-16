# Zero-Trust Findings — Phantom Features & Dead Code

**Date:** 2026-08-16 **Audit:** Full codebase re-audit (MVP-P00 intake)
**Status:** Active findings that affect system behavior

---

## 1. NOT_MOUNTED — Code Exists, Never Loaded

These middleware/services have working implementations but are never registered
in `apps/backend/src/backend/main.py`. The running server does not include them.

### 1.1 Prometheus `/metrics` Endpoint

- **File:** `apps/backend/src/backend/main.py:135-136`
- **What exists:** Full OpenTelemetry + Prometheus setup in
  `infrastructure/opentelemetry.py` and `infrastructure/metrics.py`
- **What's broken:** The entire setup block is **commented out**:
  ```python
  # setup_opentelemetry()
  # instrumement_fastapi(app)
  ```
- **Impact:** `/metrics` endpoint returns 404. No observability data is
  exported. Prometheus scraping gets nothing.
- **Fix:** Uncomment lines 135-136 in `main.py`, ensure
  `OTEL_SDK_DISABLED=false` in env.

### 1.2 IP Allowlist Middleware

- **File:** `apps/backend/src/backend/middleware/ip_allowlist.py`
- **What exists:** Full middleware class with CIDR matching, block/allow lists,
  configurable per-endpoint
- **What's broken:** Never called via `app.add_middleware()` in main.py
- **Impact:** Any IP can access all endpoints. No network-level access control.
- **Fix:** Add
  `app.add_middleware(IPAllowlistMiddleware, allowed_ranges=settings.ip_allowlist_ranges)`
  in main.py middleware stack.

### 1.3 TenantMiddleware (Multi-Tenancy)

- **File:** `apps/backend/src/backend/middleware/tenant.py`
- **What exists:** Extracts `X-Tenant-ID` header, sets tenant context, includes
  `set_rls_session_vars()` for PostgreSQL RLS
- **What's broken:** Never mounted in main.py. `app.tenant_id` GUC is never set.
  RLS policies on 4/36 tables have nothing to filter against.
- **Impact:** All users see all data. Workspace isolation is broken. The 4
  tables with RLS policies (users, workspaces, documents, memory_records) still
  return cross-tenant data because the session variable is never set.
- **Fix:** Mount middleware, ensure `SET app.tenant_id` runs on every request
  before DB queries.

### 1.4 SCIM Provisioning

- **File:** `apps/backend/...` (enterprise identity sync module)
- **What exists:** SCIM 2.0 protocol handler for automatic user provisioning
  from identity providers
- **What's broken:** Never wired into the app. No routes exposed.
- **Impact:** Enterprise customers must manually create accounts. No
  auto-provisioning from Azure AD / Okta.
- **Fix:** Mount SCIM routes, configure IdP integration.

---

## 2. STUB — Methods Exist But Return Dummy Values

These have function signatures and some logic, but the core behavior returns
`None` or hardcoded values. Calling code gets no real result.

### 2.1 SAML SSO

- **File:** `apps/backend/.../sso.py`
- **What exists:** `saml_authenticate()` method signature, docstring describing
  SAML flow
- **What's broken:** Method body returns `None`. Only Google OAuth and Microsoft
  OAuth are actually implemented.
- **Impact:** Enterprise customers using SAML (Okta, OneLogin, etc.) cannot
  authenticate. Login page shows SAML option but it silently fails.
- **Fix:** Implement SAML response parsing, XML signature validation, attribute
  extraction. Or remove SAML option from UI until ready.

### 2.2 Approval Gate (CRITICAL)

- **File:** `apps/backend/src/backend/orchestrator/loop.py:83`
- **What exists:** `ApprovalRequest` and `ApprovalDecision` models in schema.py,
  approval gate logic in orchestrator loop
- **What's broken:** `has_approval=False` is **hardcoded** in the main agent
  loop. The gate never triggers.
- **Impact:** Agents can take destructive actions without user confirmation:
  - Apply to jobs on behalf of user
  - Send messages to recruiters
  - Modify resume/cover letter
  - Delete documents All happen automatically with no approval step.
- **Fix:** Wire approval check to actually query `ApprovalRequest` table. Gate
  high-risk actions (writes, sends, deletes) behind user confirmation via
  API/UI.

---

## 3. INERT — Infrastructure Exists, Nothing Uses It

These have config files, dependencies installed, and sometimes even connection
code — but nothing in the system actually calls them.

### 3.1 BullMQ Queues

- **File:** `apps/backend/infra/queue/`
- **What exists:** Redis queue configuration, BullMQ import, job type
  definitions
- **What's broken:** Zero consumers registered. No job processors. No worker
  processes spawned.
- **Impact:** Background job processing is completely dead. Things that should
  be async (email sending, document processing, sync operations) either block
  the request or don't happen at all.
- **Fix:** Create consumer workers, register job processors, add `worker.ts` /
  `worker.py` process to deployment.

### 3.2 Apache AGE (Graph Database)

- **File:** `apps/backend/.../graph/` module
- **What exists:** AGE extension import, graph query functions, Cypher query
  builder
- **What's broken:** AGE extension is never loaded into PostgreSQL. Graph
  queries silently fall back to pgvector or return empty.
- **Impact:** Knowledge graph traversal (finding relationships between entities,
  career path analysis) uses naive vector similarity instead of proper graph
  algorithms. Results are less accurate.
- **Fix:** Install AGE extension in PostgreSQL, wire graph module to use it, or
  remove the dead code.

### 3.3 Meilisearch (Full-Text Search)

- **File:** `apps/backend/...` (search module)
- **What exists:** Meilisearch client import, search index config, relevance
  tuning
- **What's broken:** Meilisearch is never installed (not in
  `docker-compose.yml`), never connected, search queries fall back to PostgreSQL
  `LIKE` or pgvector.
- **Impact:** Full-text search is slow and inaccurate. No typo tolerance, no
  faceted search, no ranking. Users searching their memory/knowledge base get
  poor results.
- **Fix:** Add Meilisearch to docker-compose, create search index pipeline, wire
  search queries to use it.

---

## 4. HARDCODED MOCK DATA — Frontend Pages Not Connected to API

These 7 Next.js pages render **static fake data** instead of calling the real
backend API. They look functional but show the same data every time regardless
of database state.

| #   | Page             | File                                 | What It Shows Instead          |
| --- | ---------------- | ------------------------------------ | ------------------------------ |
| 1   | Applications     | `app/(app)/applications/page.tsx`    | Hardcoded job application list |
| 2   | Billing          | `app/(app)/billing/page.tsx`         | Fake invoice/plan data         |
| 3   | Organizations    | `app/(app)/organizations/page.tsx`   | Mock org members               |
| 4   | Admin Dashboard  | `app/(app)/admin/dashboard/page.tsx` | Static system stats            |
| 5   | Developer Portal | `app/(app)/developer/page.tsx`       | Fake API keys/docs             |
| 6   | Feature Flags    | `app/(app)/feature-flags/page.tsx`   | Mock flag toggles              |
| 7   | Marketplace      | `app/(app)/marketplace/page.tsx`     | Fake integrations list         |

**Impact:** Users see realistic-looking pages but none of the data is real.
Creating an application, uploading a document, or changing settings on these
pages does nothing.

**Fix:** Replace hardcoded data with `fetch()` calls to the existing backend
endpoints. The backend already has the APIs — the frontend just doesn't use them
yet.

---

## 5. Summary — Risk Matrix

| #       | Feature                      | Severity     | Effort to Fix | Risk If Not Fixed                   |
| ------- | ---------------------------- | ------------ | ------------- | ----------------------------------- |
| 2.2     | Approval gate hardcoded OFF  | **CRITICAL** | Medium        | Agents take actions without consent |
| 1.3     | TenantMiddleware not mounted | **HIGH**     | Low           | Cross-tenant data leakage           |
| 1.1     | Prometheus commented out     | **HIGH**     | Low           | Zero observability in production    |
| 1.2     | IP Allowlist not mounted     | **MEDIUM**   | Low           | No network access control           |
| 3.1     | BullMQ no consumers          | **MEDIUM**   | High          | Background jobs never execute       |
| 2.1     | SAML stub                    | **MEDIUM**   | High          | Enterprise auth broken              |
| 4.1-4.7 | Mock data pages (x7)         | **LOW**      | Medium        | UX shows fake data                  |
| 3.2     | Apache AGE unused            | **LOW**      | Medium        | Degraded graph queries              |
| 3.3     | Meilisearch not installed    | **LOW**      | Medium        | Poor search quality                 |
| 1.4     | SCIM not wired               | **LOW**      | High          | No auto user provisioning           |

---

_This document is the source of truth for phantom features. Update it when
features are mounted, implemented, or removed._
