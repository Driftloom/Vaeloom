# Finding 03 — Frontend Pages: Mock Data vs Real API

**Verified:** Read every `page.tsx` file under `apps/web/src/app/` **Date:**
2026-08-16

## Summary

| Category                       | Count |
| ------------------------------ | ----- |
| Pages with hardcoded mock data | 7     |
| Pages with real API calls      | 12    |
| Pages mixing both              | 1     |
| Pages using dynamic components | 3     |

## Pages with HARDCODED Mock Data (7)

### 1. `admin/page.tsx`

- **Lines 36-50:** `mockUsers` (5 users: Alice Chen, Bob Martinez, etc.)
- **Lines 44-50:** `mockServices` (6 services: API Server, Database Cluster,
  etc.)
- **Lines 51+:** `mockAuditEvents` array
- No API imports, no `useSWR`, no `fetch`

### 2. `billing/page.tsx`

- **Lines 16-20:** Hardcoded plans: Starter ($29/mo), Professional ($99/mo),
  Enterprise ($299/mo)
- **Lines 22-28:** 5 hardcoded invoices with fixed dates and amounts
- **Lines 76-79:** Hardcoded usage values (4200/10000 API calls, 3.2/10 GB,
  etc.)
- **Lines 91-95:** Fake VISA card ending in 4242
- **Line 140:**
  `"Payment method integration would open here (Stripe Elements, etc.)"` —
  explicit placeholder

### 3. `feature-flags/page.tsx`

- **Lines 25-32:** 6 hardcoded feature flags (new-agent-ui, advanced-search,
  etc.)
- **Lines 34-39:** 4 hardcoded audit log entries

### 4. `marketplace/page.tsx`

- **Lines 22-32:** 9 hardcoded plugins (Slack Connector, Analytics Dashboard,
  GPT-4 Vision, etc.)
- Fake install counts (1240, 890, 3200, etc.)
- No API integration

### 5. `organizations/page.tsx`

- **Lines 30-49:** Hardcoded "Acme Corp" organization tree
- **Lines 51+:** Hardcoded members, roles
- No API integration

### 6. `applications/page.tsx`

- **Lines 14-17:** 2 hardcoded applications (Senior Frontend Engineer at
  TechCorp, React Developer at WebSolutions)
- No API integration

### 7. `developer/page.tsx`

- **Lines 27-31:** 3 hardcoded API keys (vlm_prod_8a7d, vlm_dev_c4e1,
  vlm_ci_5b2f)
- **Lines 33-38:** Hardcoded rate limits (REST 1000/hr, GraphQL 500/hr, etc.)
- **Lines 40-45:** Hardcoded SDK versions (TypeScript 2.4.1, Python 1.8.0, Go
  0.9.2)
- No API integration

## Pages with REAL API Calls (12)

### 1. `settings/page.tsx`

- `useSWR<PaginatedResponse<Agent>>` → `api.agents.list()`
- `useSWR<PaginatedResponse<IntegrationData>>` → `api.integrations.list()`

### 2. `notifications/page.tsx`

- `useSWR<NotificationResponse[]>` → `notificationApi.list()`

### 3. `jobs/page.tsx`

- `schedulerApi.listJobs()` via `useState` + `useCallback`

### 4. `history/page.tsx`

- `useSWR<NotificationResponse[]>` → `notificationApi.list()`

### 5. `files/page.tsx`

- `documentApi.list({ workspace_id })` via `useState` + `useCallback`

### 6. `connectors/page.tsx`

- `useWorkspaceConnectors(workspaceId)` custom hook
- Note: has hardcoded `DEFAULT_CONNECTORS` for display names, but actual data
  from API

### 7. `schedule/page.tsx`

- `eventApi.list()` via `useState` + `useCallback`

### 8. `chat/page.tsx`

- `<DynamicChatWindow workspaceId={workspaceId} />` — lazy-loaded real component

### 9. `memory/page.tsx`

- `<DynamicGraphViewer workspaceId={workspaceId} />` — lazy-loaded real
  component

### 10. `resume/page.tsx`

- `<DynamicResumeBuilder workspaceId={workspaceId} />` — lazy-loaded real
  component

### 11. `status/page.tsx`

- `fetch(\`${apiBase}/health\`)` + `fetch(\`${apiBase}/health/ready\`)` — real
  health checks

### 12. `developer/webhooks/page.tsx`

- Uses `api` module for CRUD operations on webhooks

## Pages with MIXED (1)

### `connectors/page.tsx`

- Hardcoded `DEFAULT_CONNECTORS` array for display names (Google Drive, GitHub)
- But actual connector data comes from `useWorkspaceConnectors()` hook

## Dynamic Component Pages (3)

| Page              | Component              | Source                  |
| ----------------- | ---------------------- | ----------------------- |
| `chat/page.tsx`   | `DynamicChatWindow`    | `@/lib/dynamic-imports` |
| `memory/page.tsx` | `DynamicGraphViewer`   | `@/lib/dynamic-imports` |
| `resume/page.tsx` | `DynamicResumeBuilder` | `@/lib/dynamic-imports` |

These are real components loaded via `next/dynamic`. Whether they use real APIs
depends on the component implementation.

## Root Cause

The 7 mock pages appear to be **early UI prototypes** built before the API layer
was complete. They were never connected to the real backend. The
developer/admin/billing/organizations pages are enterprise features that were
scaffolded but not wired up.
