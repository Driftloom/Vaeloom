# Executive Summary — P10 Deep Audit

## What We Found

The P10 documentation claimed 88/100 CONDITIONAL, then was re-scored to 92/100.
After a zero-trust deep audit, we found **20+ issues** including 2 critical
runtime bugs, 5 high-severity contract mismatches, and 3 security
vulnerabilities that were NOT in any previous report.

## Critical Findings (P0)

### 1. Applications Page Shows Empty Board (Runtime Bug)

**File:** `apps/web/src/app/workspace/[workspaceId]/applications/page.tsx`
**Backend:** `apps/api/src/api/schemas/application.py`

Backend returns `status: "DRAFT"` (uppercase). Frontend filters by
`a.status === 'draft'` (lowercase). **Every Kanban column shows 0 cards even
when applications exist.** This is the page we wired to the real API in P10 —
and it's broken.

### 2. Applications Pagination Capped at 20

**File:** `apps/web/src/lib/api-client.ts:677` **Backend:**
`apps/api/src/api/routers/applications.py:28`

Backend defaults to `page_size=20` with no way for frontend to request more. If
a workspace has >20 applications, the rest are silently dropped.

### 3. Tenant Isolation Bypass

**File:** `apps/api/src/api/dependencies.py` **File:**
`apps/api/src/api/middleware/tenant.py`

`get_current_tenant()` reads `X-Tenant-ID` header directly, bypassing the
middleware's trust logic. An attacker can set this header to any tenant UUID and
access that tenant's data.

## High-Severity Findings

| #   | Issue                                                 | File                         | Impact                          |
| --- | ----------------------------------------------------- | ---------------------------- | ------------------------------- |
| 1   | ConnectorResponse missing `name` field                | `api-client.ts:720`          | `undefined` for connector names |
| 2   | NotificationResponse `body` vs `message` alias        | `schemas/notification.py:39` | Fragile, may 500                |
| 3   | MemoryCreateRequest missing `domain`                  | `api-client.ts:259`          | `domain` always None            |
| 4   | MemoryUpdateRequest missing `domain`, `supersedes_id` | `api-client.ts:273`          | Cannot update these fields      |
| 5   | Workspace shared type missing `description`           | `shared-types/workspace.ts`  | `undefined` for descriptions    |

## Medium-Severity Findings

| #   | Issue                                                | Impact                          |
| --- | ---------------------------------------------------- | ------------------------------- |
| 1   | Toast timer leak on unmount                          | Memory leak, React warning      |
| 2   | ExpiryTimer `onExpire` in deps causes interval churn | Performance degradation         |
| 3   | ExpiryTimer pre-expired doesn't fire immediately     | 30s delay for expired timers    |
| 4   | ProvenanceBadge no confidence clamping               | Shows 150% or -30%              |
| 5   | SkipLink.tsx is dead code                            | Unused component                |
| 6   | Connector permissions are cosmetic only              | Toggle does nothing server-side |
| 7   | `duration_ms` vs `duration` name mismatch            | Duration always undefined       |
| 8   | auditApi.export sends POST body vs query params      | Exports all data unfiltered     |
| 9   | Pagination ignored in scheduler, notifications       | >20 items silently dropped      |

## Security Findings

| #   | Issue                                                        | Severity |
| --- | ------------------------------------------------------------ | -------- |
| 1   | CSRF cookie `secure=False`, `httponly=False`                 | HIGH     |
| 2   | `get_current_tenant` trusts `X-Tenant-ID` header             | CRITICAL |
| 3   | Modal missing `inert` on background content                  | MEDIUM   |
| 4   | Missing security headers (X-XSS-Protection, Referrer-Policy) | MEDIUM   |

## What Was Actually Correct

| Component                   | Verdict                              |
| --------------------------- | ------------------------------------ |
| SkipLink CSS                | Correct (but component is dead code) |
| Toast `aria-live="polite"`  | Correct                              |
| DiffViewer LCS algorithm    | Correct                              |
| ConfidenceMeter 0-1 clamp   | Correct                              |
| Modal focus trap + restore  | Correct                              |
| ChatWindow AI disclosure    | Correct                              |
| Settings T3 toggle disabled | Correct                              |
| Settings typed-confirm      | Correct (not window.confirm)         |
| CSRF double-submit pattern  | Correct                              |
| Tenant RLS isolation        | Correct                              |
| JWT validation              | Correct                              |
| Secret handling at startup  | Correct                              |

## Recommendations

1. **Fix Applications page status case mismatch** — add `.toLowerCase()` or use
   enum constants
2. **Fix tenant isolation bypass** — `get_current_tenant` must use
   `request.state.tenant_id`
3. **Set CSRF cookie flags** — `secure=True`, `httponly=True` in non-local
4. **Fix API contract mismatches** — align frontend types with backend schemas
5. **Fix component bugs** — Toast timer leak, ExpiryTimer deps, ProvenanceBadge
   clamping
6. **Add missing accessibility** — auto-scroll in ChatWindow, `aria-busy`,
   `aria-keyshortcuts`
