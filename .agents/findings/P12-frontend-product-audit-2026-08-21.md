# Vaeloom MVP — Complete Frontend End-to-End Audit (P12)

**Date:** 2026-08-21 **Audit type:** Full frontend product audit (pages, routes,
components, states, API contract, trust UX, a11y, responsive, code quality, test
coverage) **Auditor:** opencode agent **Method:** Static/code-level audit of
`apps/web` (Next.js 15, React 18, SWR, Zustand, Tailwind) + backend contract
check against `apps/api` (~171 endpoints). **Runtime verification:** NONE — no
dev server/browser was executed in this audit. CSRF/405/404 mutation findings
are CODE-LEVEL with high confidence (backend CSRF middleware verified in source)
and must be confirmed with a runtime smoke test.

---

## 0. Executive Summary

A visually strong, dark-first frontend shell with a real API client layer, but
the **product-critical interaction layer is incomplete**.

- **10 of 24 pages are real-data**; 6 are pure mock stubs (enterprise extras);
  several core MVP flows have **no UI at all**.
- **P0: the frontend has zero CSRF support while the backend enforces
  `X-CSRF-Token` on every non-auth mutation** → nearly every write action
  (memory corrections, resume generate, chat, approvals, connector connect/sync,
  webhooks CRUD, settings) would fail with **403** against a real backend.
- **P0: GDPR export/delete UI calls non-existent endpoints** → 404 (`/gdpr/*`
  endpoints exist but are unused).
- **P0: Chat proposal Approve/Reject fire toasts only** — no API call on the
  trust-critical path (MVP suggest-mode-first core).
- Backend gaps mirror frontend gaps: no job-search REST, no undo/revert REST
  (`undo_redo.py`/`memory_versioning.py` are service-only), no conversation
  persistence, no password-reset endpoints, no user-settings router.
- Tests: 31 jest tests (23/24 pages untested);
  `apps/web/e2e/basic-smoke.spec.ts` is orphaned from any Playwright config
  (active suite: `testing/e2e/tests/flows`).

| Metric                        | Value                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Pages (routes)                | 24 (+ layouts/loading/error/not-found infra)                                                |
| Required MVP pages            | 10 (all exist as routes)                                                                    |
| Missing pages (MVP-required)  | ~12                                                                                         |
| Incomplete pages              | 8 of 10 MVP pages                                                                           |
| Mock/stub pages               | 6 enterprise stubs + partial mocks in 4 MVP pages                                           |
| Fake/misleading controls      | 14 (SSO buttons, chat approve/reject, invoice download, "Create Test", admin actions, etc.) |
| Dead code                     | 17 components, 3 Zustand stores, 6 helper modules                                           |
| Tests                         | 31 jest (23/24 pages untested); e2e smoke suite not wired                                   |
| **FRONTEND_MVP_COMPLETENESS** | **50/100**                                                                                  |

**Release readiness: NOT RELEASABLE.**

---

## 1. Frontend Inventory

| Category                | Count                                                                                | Status                        | Notes                                          |
| ----------------------- | ------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------- |
| Routes                  | 24                                                                                   | Mixed                         | 10 real, 6 stub, rest partial                  |
| Pages (page.tsx)        | 24                                                                                   | —                             | —                                              |
| Layouts                 | 3 (root, workspace, auth route-group)                                                | OK                            | workspace layout does client auth check        |
| Loading/error/not-found | 9 (loading×3, error×3, not-found×2, status)                                          | OK                            | retry buttons present                          |
| Components              | 41 + 4 specs                                                                         | 17 DEAD                       | see §8                                         |
| Hooks                   | 7 (useAuth, useApi, useWorkspace, useTheme, useKeyboardShortcuts, useLocale, useSSE) | useSSE dead; useLocale unused |                                                |
| API clients             | 2 (api.ts, api-client.ts) + 27 domain modules                                        | Both live                     | duplicate transformKeys; api-client is primary |
| Stores (Zustand)        | 3 (auth, workspace, ui)                                                              | **All dead**                  | replaced by hooks/context                      |
| Forms                   | ~10                                                                                  | Partial                       | mostly real submit; several local-only         |
| Modals                  | 1 (ui-kit Modal)                                                                     | OK                            | **no portal**                                  |
| Drawers                 | 1 (Sidebar mobile)                                                                   | OK                            | focus leak bug                                 |
| Tables                  | 1 (shared/Table)                                                                     | Used on 4 pages               |                                                |
| Charts                  | 0                                                                                    | —                             |                                                |
| Editors                 | 0                                                                                    | —                             |                                                |
| File viewers            | 0                                                                                    | **MISSING**                   | no PDF/DOCX/image viewer                       |
| Graph components        | 1 (GraphViewer)                                                                      | **Not a graph**               | static list, no lib, no zoom/pan               |
| Real-time               | 0                                                                                    | **MISSING**                   | backend SSE exists, unused                     |
| Tests                   | 31 jest + 8 e2e (orphaned) + 14 e2e (active)                                         | Low                           |                                                |

---

## 2. Route Audit

| Route                                | Exists           | Accessible | Protected            | API-backed              | Complete                                      |
| ------------------------------------ | ---------------- | ---------- | -------------------- | ----------------------- | --------------------------------------------- |
| `/`                                  | ✅               | public     | —                    | partial (redirect only) | Static marketing, fake stats ("2,000+ users") |
| `/login`                             | ✅               | public     | auth redirect        | ✅ real                 | ✅ (SSO buttons dead)                         |
| `/signup`                            | ✅               | public     | auth redirect        | ✅ real                 | ✅ (SSO buttons dead)                         |
| `/forgot-password`                   | ❌ **dead link** | —          | —                    | —                       | login links it; 404                           |
| `/status`                            | ✅               | public     | —                    | ✅ health polling       | ✅                                            |
| `/workspace/[id]`                    | ✅               | ✅         | ✅ middleware+layout | ✅                      | ⚠️ counts always 0 (typing bug)               |
| `/workspace/[id]/memory`             | ✅               | ✅         | ✅                   | ✅                      | ⚠️ graph is a list; fake Export               |
| `/workspace/[id]/resume`             | ✅               | ✅         | ✅                   | ✅                      | ⚠️ no approve/versions/ATS                    |
| `/workspace/[id]/schedule`           | ✅               | ✅         | ✅                   | ⚠️ not ws-scoped        | ⚠️ read-only list, no calendar                |
| `/workspace/[id]/connectors`         | ✅               | ✅         | ✅                   | ✅+hardcoded defaults   | ⚠️ no OAuth/scopes                            |
| `/workspace/[id]/history`            | ✅               | ✅         | ✅                   | ✅ (notifications)      | ⚠️ not agent-action history                   |
| `/workspace/[id]/files`              | ✅               | ✅         | ✅                   | ✅ read-only            | ❌ no upload/viewer/actions                   |
| `/workspace/[id]/chat`               | ✅               | ✅         | ✅                   | ✅                      | ⚠️ fake approvals/streaming                   |
| `/workspace/[id]/jobs`               | ✅               | ✅         | ✅                   | ✅ scheduler            | ❌ not job search (wrong page for MVP Jobs)   |
| `/workspace/[id]/applications`       | ✅               | ✅         | ✅                   | ✅ read-only            | ❌ static kanban, no drag/status              |
| `/workspace/[id]/agents`             | ✅               | ✅         | ✅                   | ✅ catalog              | ✅ read-only by design                        |
| `/workspace/[id]/settings`           | ✅               | ✅         | ✅                   | ✅                      | ⚠️ GDPR endpoints 404; perms fake             |
| `/workspace/[id]/notifications`      | ✅               | ✅         | ✅                   | ✅                      | ✅ real approvals — best page                 |
| `/workspace/[id]/organizations`      | ✅               | ✅         | ✅                   | ❌ mock                 | ❌ STUB                                       |
| `/workspace/[id]/marketplace`        | ✅               | ✅         | ✅                   | ❌ mock                 | ❌ STUB                                       |
| `/workspace/[id]/admin`              | ✅               | ✅         | ✅                   | ❌ mock                 | ❌ STUB                                       |
| `/workspace/[id]/billing`            | ✅               | ✅         | ✅                   | ❌ mock                 | ❌ STUB                                       |
| `/workspace/[id]/developer`          | ✅               | ✅         | ✅                   | ❌ mock                 | ❌ STUB (fake API keys!)                      |
| `/workspace/[id]/developer/webhooks` | ✅               | ✅         | ✅                   | ✅ full CRUD            | ✅ (alert() errors)                           |
| `/workspace/[id]/feature-flags`      | ✅               | ✅         | ✅                   | ❌ mock                 | ❌ STUB                                       |

### Auth model

- Middleware protects only `/workspace/*` via **cookie presence** (no JWT
  signature/expiry verification). Matcher excludes
  `api|_next/static|_next/image|...`.
- Workspace layout re-checks with `useAuth()` → `me()`.
- `lib/api.ts`: 401 → single-flight refresh + queue; on failure hard redirect to
  `/login` (drops `?redirect=`).
- `lib/api-client.ts`: per-request `tryRefresh()` — **no single-flight**
  (parallel refresh race), on failure clears tokens, returns original 401, **no
  redirect**.
- Logout is client-side only — server `auth_sessions` stay ACTIVE, refresh
  tokens remain valid.
- Token in localStorage (XSS-exposed) + non-HttpOnly, non-Secure cookie
  (`max-age=86400; SameSite=Lax`) purely so middleware can see it.
- No 403 page, no session-expired page, no workspace-creation UI. New users with
  0 workspaces: unresolved path (**ambiguity recorded** — signup may or may not
  auto-create a workspace; not verified).

---

## 3. Required MVP Page Audit (scores 0–100)

| Page               | Score | Verdict                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard          | 72    | Real agents/memories/events fetches, but **agent/memory counts always render 0** (`PaginatedResponse {data,meta}` ≠ backend `{items,total,...}` → `res.data` undefined); `?workspaceId=` camelCase param ignored by backend → **unscoped tenant-wide data**; fetch errors silently become zeros; no onboarding/empty state; no real-time.                                                  |
| Workspace (Files)  | 40    | **Read-only list.** No upload UI (`documentApi.upload` exists!), no PDF/DOCX/image/code viewer (MVP "in-app file viewing" — MISSING), no rename/move/archive/restore proposals, no undo, no parsing/failed-ingestion states. Rows have `cursor-pointer` + hover but **no onClick**. Organization Agent reversible-change model has zero UI.                                                |
| Memory Graph       | 70    | Richest page: feed, lineage (supersession chain + provenance), corrections (real PUT), memory list. But GraphViewer is **not a graph** — static node/edge _lists_, no library, no zoom/pan/filter/entity detail, no mobile fallback. Feed errors silently become empty state. "Export" button fires an informational toast only.                                                           |
| Resume & Career    | 65    | Real list + generate variant. Missing: diff approve/reject (DiffViewer exists but unused here), version history, ATS scoring, missing-info questions, master-resume editing, source-of-truth/confirmed-vs-generated distinction.                                                                                                                                                           |
| Jobs & Internships | 45    | **The `/jobs` page is scheduler automation jobs, not job search.** No search, ranking, match score, fit explanation, save/reject, shortlist, cover letter, apply/approval/deep-link, status tracking. Backend has **no job-search REST endpoint** (agent tool only) — frontend and backend both lack this MVP core.                                                                        |
| Chat               | 68    | Real POST `/agents/chat` round-trip with routing visibility. But: **proposal Approve/Reject fire toasts only — no `approvalApi` call (fake approval on the trust-critical path)**; "streaming" is a simulated word-by-word timer; latency/tool metrics fabricated (`210ms/170ms/280ms`); threads in localStorage only; message textarea and attach input unlabeled; no attachment upload.  |
| Schedule           | 55    | Read-only events list; **not workspace-scoped** (shows all users' events); no calendar view, no event create/edit, no proposed-event approve/reject, no reminders, no urgency, no Gmail-extracted vs user-created vs agent-proposed distinction.                                                                                                                                           |
| Connectors         | 62    | Real connect/sync mutations (legacy `/integrations`), but **no OAuth flow** (creates a record), no scopes/least-privilege explanation, no sync progress/status, errors to `console.error` only, hardcoded Google Drive + GitHub defaults rendered as pseudo-connectors.                                                                                                                    |
| History            | 55    | It's the **notifications list** — not agent-action history. No before/after diffs, no undo/revert (backend `undo_redo.py` exists but has **no HTTP endpoints**), no agent-identity/result/approval-state filtering. "Export Log" is client-side blob.                                                                                                                                      |
| Settings           | 65    | Real: autonomy toggles (but **PATCH `/agents/{id}` → backend only defines PUT → 405**), consent grant/revoke, BYOK provider keys (full CRUD). **Broken: `POST /workspaces/{id}/export` and `DELETE /workspaces/{id}/data` do not exist → 404** (correct `/gdpr/*` endpoints exist but unused) — delete-everything is broken. Connector read/write permission toggles are local state only. |

---

## 4. Missing Pages (MVP-REQUIRED)

| Missing Page                                                                | Why Needed                                                           | User Flow  | Dependencies                                   | Priority                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- | ---------------------------------------------- | -------------------------------------------------- |
| File upload flow (+ parsing/failed states)                                  | Files are the product entry point                                    | A, B, C, F | `documentApi.upload` exists                    | P0                                                 |
| In-app file viewer (PDF/DOCX/image/code)                                    | MVP "in-app file viewing"                                            | B          | new viewer component                           | P1                                                 |
| File operation proposal/approval (rename/move)                              | Organization Agent reversible changes                                | B          | approvals API; backend org-agent tooling       | P1                                                 |
| Onboarding/first-run (workspace + connect + upload)                         | Journey A; new users currently land nowhere                          | A          | workspace API                                  | P1                                                 |
| Job search UI (search/filter/rank/save/reject)                              | Jobs & Internships core                                              | D          | **backend gap**: job search is agent-tool-only | P1                                                 |
| Apply flow (approval + tailored docs + deep-link)                           | Application path                                                     | D          | resumes, applications API                      | P1                                                 |
| Resume version history + approve/reject diff                                | Generated ≠ approved must be visible                                 | C          | versioning backend (in-memory only)            | P1                                                 |
| ATS score detail                                                            | MVP ATS agent                                                        | C, D       | backend gap (ATS tool-only)                    | P1                                                 |
| Schedule event detail/edit/approve + reminders                              | Schedule core                                                        | E          | events API                                     | P1                                                 |
| Gmail connect + permission grant + sync status                              | Least-privilege + Gmail push path                                    | E          | `/connectors` + `/gmail/watch` unused          | P1                                                 |
| Connector detail/permission review                                          | Least privilege UX                                                   | E, G       | connector API                                  | P1                                                 |
| Forgot-password / reset                                                     | **Dead link exists today**                                           | —          | **backend gap**: no reset endpoints            | P2                                                 |
| Application detail + status updates                                         | Application tracking                                                 | D          | PATCH outcome exists                           | P1                                                 |
| History event detail (before/after)                                         | Trust system                                                         | B, G       | backend gap: no undo/revert REST               | P1                                                 |
| 403 / session-expired / maintenance                                         | Edge UX                                                              | —          | —                                              | P2                                                 |
| Workspace creation UI                                                       | 0-workspace users (ambiguity: signup may auto-create — not verified) | A          | workspace API                                  | P2                                                 |
| Global search page                                                          | backend `/search` exists, `searchApi` exists, no UI                  | —          | —                                              | P2 (DEFER ok)                                      |
| Email verification, command palette, approval center page, agent run detail | —                                                                    | —          | —                                              | DEFER/OPTIONAL (fold approvals into Notifications) |

---

## 5. Missing UI States (top)

| Page               | Missing State                                                                                     | Expected                                                     | Priority |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| All mutation pages | **CSRF 403 error handling**                                                                       | fetch `/csrf-token`, retry with token; else every write 403s | P0       |
| Dashboard          | new-user empty state; agent/memory error states (shows zeros)                                     | explain next action; show error + retry                      | P1       |
| Files              | upload progress, parsing, failed ingestion, unsupported file, empty folder, selection, undo toast | per spec                                                     | P1       |
| Chat               | real streaming (spinner is fake), approval pending/success/denied states                          | SSE or poll                                                  | P1       |
| Jobs               | search loading, ranking explanation, applied/expired states                                       | —                                                            | P1       |
| Applications       | status-change saving, failure, already-applied                                                    | —                                                            | P1       |
| Schedule           | proposed/confirmed/rejected event states, reminder state                                          | —                                                            | P1       |
| Connectors         | sync progress, re-auth needed, revoked, scope detail                                              | —                                                            | P1       |
| History            | approval-state filter, before/after diff, undo/reversal                                           | —                                                            | P1       |
| Settings           | GDPR delete-in-progress, success receipt (delete path 404s today), rate-limit                     | —                                                            | P1       |
| Everything         | offline/degraded banner, retry-after-rate-limit                                                   | —                                                            | P2       |

---

## 6. Missing Interactions (top)

| Page             | Component        | Missing Interaction                                         | Priority |
| ---------------- | ---------------- | ----------------------------------------------------------- | -------- |
| Chat             | Proposal card    | Approve/Reject calls `approvalApi` (today: toast only)      | P0       |
| Files            | table rows       | onClick → open/viewer (today: hover implies, nothing)       | P1       |
| Files            | toolbar          | upload, rename/move proposal, archive, restore, bulk select | P1       |
| Applications     | kanban cards     | drag/status → PATCH outcome (API exists)                    | P1       |
| Jobs             | cards            | save/reject/apply actions (API n/a)                         | P1       |
| Schedule         | events           | create/edit/approve/reject                                  | P1       |
| Memory           | graph            | zoom/pan/select/filter (today: static lists)                | P1       |
| Resume           | variant          | approve/reject diff, view versions                          | P1       |
| Login/Signup     | SSO buttons      | onClick (today: dead)                                       | P2       |
| Settings         | connector perms  | persist toggles via API (today: local state)                | P2       |
| Jobs (scheduler) | job cards        | pause/resume/trigger (API exists)                           | P2       |
| Feature-flags    | "Create Test"    | onClick (today: none)                                       | P3       |
| Billing          | invoice Download | real download (today: `window.open('#')`)                   | P3       |

---

## 7. Backend/API/UI Gaps

| Feature                   | UI              | API                                          | Persistence | Issue                                                    |
| ------------------------- | --------------- | -------------------------------------------- | ----------- | -------------------------------------------------------- |
| All writes (non-auth)     | ✅              | ✅                                           | ❌          | **CSRF token never fetched/sent → 403**                  |
| GDPR export/delete        | ✅              | ❌                                           | ❌          | UI calls `/workspaces/{id}/export                        | data`(404);`/gdpr/*` unused |
| Agent autonomy            | ✅              | ❌                                           | ❌          | PATCH `/agents/{id}`; backend only PUT                   |
| Logout                    | ✅              | ❌                                           | ❌          | client-only; server sessions stay valid                  |
| Chat streaming            | ❌ (fake)       | ✅ SSE on `/agents/{id}/execute?stream=true` | ❌          | SSE never used                                           |
| Chat proposals            | ❌ (fake)       | ✅ `/approvals`                              | ❌          | approve/reject not wired                                 |
| Upload                    | ❌ no UI        | ✅ POST `/documents`                         | ✅          | client exists, page doesn't                              |
| File actions/undo         | ❌              | ❌                                           | ❌          | `undo_redo.py`, `memory_versioning.py` have no endpoints |
| Job search                | ❌              | ❌                                           | ❌          | agent-tool only; no REST, no UI                          |
| ATS scoring               | ❌              | ❌                                           | ❌          | agent-tool only                                          |
| Conversations persistence | ❌ localStorage | ❌ stateless                                 | ❌          | no conversation endpoints                                |
| Connector OAuth/scopes    | ❌              | ❌ partial                                   | ❌          | connect = record create                                  |
| Gmail push path           | ❌              | ✅ `/gmail/watch`, webhook                   | ✅          | unused by UI                                             |
| Workspace-scoped events   | ❌ bug          | ✅                                           | ❌          | schedule fetches all workspaces                          |
| Dashboard counts          | ❌ bug          | ✅                                           | ❌          | `PaginatedResponse` typing mismatch → always 0           |
| `feature-flags` GET       | ✅              | ❌                                           | ❌          | no backend route; silent fallback                        |
| Enterprise pages (6)      | ✅ mock         | ✅ (gated)                                   | ✅          | 404 unless `enterprise_routes_enabled`; UI pretends live |

---

## 8. Code Problems (top)

| File                                                                     | Problem                                                      | Category     | Severity     | Fix                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------ | ------------ | --------------------------------------------------- |
| `lib/api-client.ts`, `lib/api.ts`                                        | No CSRF token fetch/header                                   | API          | **BLOCKING** | fetch `/csrf-token`, send `X-CSRF-Token`, 403 retry |
| `settings/page.tsx`                                                      | `/workspaces/{id}/export`, `/data` → 404                     | API          | **BLOCKING** | use `GET /gdpr/export`, `POST /gdpr/delete`         |
| `settings/page.tsx`                                                      | PATCH `/agents/{id}` → 405                                   | API          | HIGH         | PUT + `AgentUpdate` schema                          |
| `workspace/page.tsx`                                                     | `res.data` on `{items,...}` → always undefined               | API          | HIGH         | fix PaginatedResponse typing; read `items`          |
| `api-client.ts` (all)                                                    | `?workspaceId=` vs `workspace_id`; SWR key ≠ URL             | API          | HIGH         | canonical param names; key = URL                    |
| `ChatWindow.tsx`                                                         | fake approve/reject; fabricated metrics; simulated streaming | Trust        | HIGH         | wire approvalApi; use SSE; drop fakes               |
| `GraphViewer.tsx`                                                        | not a graph; no lib; no interaction; no mobile collapse      | Product      | HIGH         | real graph lib or explicit list redesign            |
| 17 shared components                                                     | dead code                                                    | Architecture | MED          | delete or wire                                      |
| 3 Zustand stores                                                         | dead; parallel state systems                                 | Architecture | MED          | remove                                              |
| `swr-client.ts`, `prefetch.tsx`, `useSSE`, `chatApi.send`, `api.refresh` | dead code w/ broken contracts                                | Architecture | MED          | remove                                              |
| `globals.css` vs ui-kit                                                  | 3 button/input/card systems, visually different primaries    | Design sys   | MED          | unify on ui-kit                                     |
| `middleware.ts` + `next.config.js`                                       | duplicated security headers; cookie-presence-only auth       | Security     | MED          | single source; real token check                     |
| `e2e/basic-smoke.spec.ts`                                                | orphaned from any Playwright config                          | Testing      | MED          | wire config or move                                 |
| `i18n/*`, `error-tracking.ts`                                            | providers without consumers; Sentry stub                     | Architecture | LOW          | implement or remove                                 |

---

## 9. UX Problems (top)

| Page                    | Problem                                                      | Impact                                | Priority    |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------- | ----------- |
| Login/Signup            | Google/GitHub buttons dead; Forgot password → 404            | user confusion, broken trust          | P1          |
| Chat                    | Approving a proposal does nothing (toast only)               | user believes action executed         | P0          |
| Files                   | rows look clickable, nothing happens                         | dead affordance                       | P1          |
| Dashboard               | zeros presented as real data, silently                       | misleading metrics                    | P1          |
| Connectors              | connect without OAuth; sync errors invisible                 | users think connected; silent failure | P1          |
| Admin/Billing/Developer | mock data + fake actions ("Restart Services", fake API keys) | trust damage                          | P1 (gating) |
| Settings                | delete-everything errors; export produces empty blob         | data control broken                   | P0          |
| Chat                    | fake "Thinking · routing + QA" + fabricated latencies        | deceptive telemetry                   | P2          |
| Memory                  | graph promised, list delivered                               | core promise unmet                    | P1          |
| Schedule                | copy says "Manage", read-only; cross-workspace events        | wrong data shown                      | P1          |

---

## 10. Design-System Problems

| Component | Inconsistency                                                                                                    | Existing Pattern                                                                                              | Recommended Standardization          |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Buttons   | 3 systems: ui-kit `Button`, CSS `.btn-primary/.btn-secondary/.btn-ghost/.btn-accent`, inline ad-hoc              | ui-kit primary `bg-primary text-background`; CSS `.btn-primary` is `bg-white text-black` (visually different) | single ui-kit Button everywhere      |
| Inputs    | ui-kit `Input` (labeled) vs raw `<input>`/`<textarea>` + unused `.input-field/.input-label/.input-error` classes | ProviderKeysSection, ResumeBuilder, ChatWindow, MemoryCorrectionPanel                                         | ui-kit Input with label/error wiring |
| Cards     | ui-kit `Card` vs `.card` CSS vs inline `border border-border bg-surface`                                         | 3 card variants                                                                                               | ui-kit Card                          |
| Badges    | `Badge.tsx` (dead) ≈ `StatusBadge.tsx` + inline badge spans (ChatWindow, Sidebar, ProviderKeysSection)           | StatusBadge                                                                                                   | StatusBadge only                     |
| Progress  | `ProgressBar` + `ConfidenceMeter` both implement progressbar                                                     | —                                                                                                             | unify                                |
| Avatar    | `Avatar.tsx` (dead) vs inline initials (TopNav, ChatWindow)                                                      | —                                                                                                             | Avatar only                          |
| Select    | `Select.tsx` (dead) vs raw `<select>` in ProviderKeysSection                                                     | —                                                                                                             | wired Select                         |
| Toggle    | `Toggle.tsx` vs inline segmented control (ProviderKeysSection, no `role=switch`)                                 | Toggle                                                                                                        | Toggle with accessible name          |
| Spinner   | ui-kit Spinner wrapped in LoadingSpinner vs `animate-pulse` vs bouncing dots                                     | —                                                                                                             | LoadingSpinner                       |
| Colors    | mix of `bg-primary` tokens, raw Tailwind (`bg-green-900/30`, `bg-zinc-800`, `text-emerald-400`)                  | —                                                                                                             | single token vocabulary              |
| Grid      | `gap-${gap}` dynamic Tailwind classes (JIT pitfall)                                                              | —                                                                                                             | static class map                     |

---

## 11. Responsive Problems

| Page                     | Viewport | Problem                                                                                  | Impact                                  | Fix                  |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------- | --------------------------------------- | -------------------- |
| Resume                   | mobile   | `w-64`/`w-72 shrink-0` aside in `flex gap-6` no breakpoint → ~288px aside on 375px phone | squished/overflow                       | stack on mobile      |
| Memory Graph             | mobile   | two `flex-1` columns, no collapse                                                        | ~150px columns                          | stack; list fallback |
| Sidebar                  | all      | closed drawer links still tabbable off-screen (no `inert`/`aria-hidden`)                 | keyboard users tab into invisible links | inert/visibility     |
| GraphViewer/Chat threads | mobile   | handled via drawer/overlay (OK) but overlay lacks dialog semantics                       | —                                       | role=dialog          |
| Tables                   | mobile   | `overflow-x-auto` present (OK)                                                           | —                                       | —                    |

---

## 12. Accessibility Problems

| Page/Component        | Issue                                                                                                                                                                                         | WCAG Area          | Priority   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| Tabs                  | arrow keys don't move focus (tabRefs unused)                                                                                                                                                  | 2.4.3 Focus Order  | HIGH       |
| Toggle                | button nested inside label; no accessible name ("switch" only)                                                                                                                                | 4.1.2 Name/Role    | HIGH       |
| ui-kit Modal          | no portal (fixed positioning can break under transforms); no `aria-describedby`                                                                                                               | 1.4.10/4.1.2       | MED        |
| ChatWindow            | textarea unlabeled; attach input unlabeled; `/`-command popover no listbox semantics, no aria-expanded/activedescendant, no arrow nav; threads overlay no dialog role; generic "close" labels | 4.1.2/2.4.3        | HIGH       |
| Sidebar               | off-screen focusable nav when drawer closed                                                                                                                                                   | 2.4.3              | HIGH       |
| DiffViewer            | added text is color-only (no "+" marker)                                                                                                                                                      | 1.4.1 Use of Color | MED        |
| LoadingSpinner        | text not announced (no role=status/aria-live)                                                                                                                                                 | 4.1.3              | MED        |
| ExpiryTimer           | `aria-live=polite` on 30s-ticking timer → repeated noise                                                                                                                                      | 4.1.3              | LOW        |
| ProviderKeysSection   | labels no htmlFor; input no id; show/hide button inside label; scope control no radiogroup; `confirm()`                                                                                       | 4.1.2              | MED        |
| Form.tsx (dead)       | label has no htmlFor; aria-describedby/invalid reference missing ids                                                                                                                          | 1.3.1/4.1.2        | LOW (dead) |
| ErrorBoundary         | fallback no role=alert                                                                                                                                                                        | 4.1.3              | MED        |
| EmptyState/ErrorState | emoji not aria-hidden (announced)                                                                                                                                                             | 4.1.2              | LOW        |
| ApprovalCard          | `aria-keyshortcuts` missing; autoFocus on Approve with multiple cards; "A" key bubbling double-trigger                                                                                        | 4.1.2/2.4.3        | MED        |
| TopNav                | avatar bare text (title only, no role=img/aria-label)                                                                                                                                         | 1.1.1              | LOW        |
| SearchInput           | aria-label=placeholder (disappears if empty); not type=search; svg not aria-hidden                                                                                                            | 4.1.2              | LOW        |

Positives: Modal focus trap + Escape + aria-modal; Tabs roving tabindex; Toast
live region; SkipLink; Alert role=alert/status; Table th scope; Breadcrumb
nav/aria-current; StatusBadge role=status; global `prefers-reduced-motion` rule.

---

## 13. Agent UX Audit (MVP agents)

| Agent              | UI Representation                                    | Status                                          |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------- |
| Orchestrator       | Chat "Thinking · routing + QA" indicator (simulated) | FAKE timing; no real streaming                  |
| Organization Agent | No propose/approve/undo file-actions UI              | MISSING                                         |
| Memory Agent       | Feed + lineage + corrections (real)                  | PARTIAL — silent errors; no memory-write status |
| Resume Agent       | generate variant (real)                              | PARTIAL — no approve/diff/versions              |
| ATS Agent          | none                                                 | MISSING                                         |
| Job Search Agent   | none (tool-only, via chat)                           | MISSING                                         |
| Gmail Agent        | none (hardcoded Drive/GitHub defaults only)          | MISSING                                         |
| Scheduler Agent    | jobs list read-only                                  | PARTIAL — no pause/resume/trigger               |

Trust rule violation: chat fabricates latencyMs and tool-call metrics; proposals
hardcode `requiresApproval: true`; approve/reject are cosmetic.

---

## 14. Memory UX Audit

- Sources/provenance: lineage modal shows supersession chain + provenance
  (good).
- Confidence: `ConfidenceMeter` exists but used only inside ApprovalCard.
- Corrections: real PUT with diff preview.
- Graph: list view, not a graph; no source-evidence drill-down from nodes.
- Memory-write status / consolidation status: absent.
- No UI to make users understand uncertainty vs confirmed facts (memory-derived
  vs inferred vs confirmed not distinguished anywhere except resume context).

---

## 15. End-to-End Journeys

| Journey             | Status  | Broken At                                           | Root Cause                                                                          |
| ------------------- | ------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A New User          | FAIL    | onboarding, upload, connect, proposals              | no first-run flow; no upload UI; non-OAuth connect; approvals only in notifications |
| B File Organization | FAIL    | upload; propose; approve; **undo**                  | no UI; undo has no backend endpoint                                                 |
| C Resume            | PARTIAL | upload source; approve/reject; versions; ATS        | no versioning UI; ATS tool-only                                                     |
| D Job Search        | FAIL    | search; apply flow; tracking                        | no search endpoint; kanban static                                                   |
| E Gmail             | FAIL    | connect; classification; schedule proposals         | no Gmail UI flow; `/gmail/watch` unused                                             |
| F Memory            | PARTIAL | graph visualization; source inspection depth        | viewer is a list; works via feed/lineage/corrections                                |
| G Trust & Privacy   | FAIL    | perms; autonomy (405); history; export/delete (404) | broken endpoints; fake toggles                                                      |

---

## 16. Global Scores

| Dimension                     | Score      |
| ----------------------------- | ---------- |
| Product Surface Completeness  | 50         |
| Page Completeness             | 55         |
| Functional Completeness       | 45         |
| Dynamic Data Completeness     | 50         |
| State Completeness            | 40         |
| Accessibility                 | 55         |
| Responsiveness                | 60         |
| Trust/Permission UX           | 30         |
| Code Quality                  | 50         |
| Performance                   | 70         |
| Test Coverage                 | 30         |
| End-to-End Flow Completion    | 30         |
| **FRONTEND_MVP_COMPLETENESS** | **50/100** |

Sub-scores: UI 75 · UX 50 · Frontend Code 55 · Dynamic Behavior 45 ·
Accessibility 55 · Responsive 60 · Trust/Safety 35 · Testing 30 · Product
Coverage 50.

Page scores: Landing 65 · Login 87 · Signup 87 · Status 93 · Dashboard 72 ·
Memory 70 · Resume 65 · Schedule 55 · Connectors 62 · History 55 · Files 40 ·
Chat 68 · Jobs 45 · Applications 50 · Agents 80 · Settings 65 · Notifications 85
· Organizations 20 · Marketplace 15 · Admin 15 · Billing 15 · Developer 20 ·
Webhooks 80 · Feature-flags 15.

---

## 17. Prioritized Backlog (P0/P1)

| ID     | Issue                                                                                                                     | Severity |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| FW-001 | CSRF support: fetch `/csrf-token`, send `X-CSRF-Token` on mutations, 403 retry                                            | P0       |
| FW-002 | Wire GDPR to `GET /gdpr/export` + `POST /gdpr/delete` with confirm/receipt                                                | P0       |
| FW-003 | Chat approval cards → real `approvalApi` approve/reject; remove toast-only path                                           | P0       |
| FW-004 | File upload flow (progress/parsing/failed states)                                                                         | P0       |
| FW-005 | In-app file viewer + file open action; remove dead row affordance                                                         | P1       |
| FW-006 | File proposal UI (rename/move/archive) via approvals + undo (backend undo endpoints needed)                               | P1       |
| FW-007 | Job search UI + backend `search_jobs` endpoint; apply approval flow + deep-link                                           | P1       |
| FW-008 | Memory Graph: real visualization (zoom/pan/filter/detail/mobile)                                                          | P1       |
| FW-009 | Schedule: workspace-scope, calendar, event detail, proposed-event approve/reject, reminders, source badges                | P1       |
| FW-010 | History: agent-action feed with before/after diff + undo; approval-state filter                                           | P1       |
| FW-011 | Applications: status transitions (PATCH outcome), detail, apply flow                                                      | P1       |
| FW-012 | Dashboard: fix pagination typing + workspace scoping; error states; onboarding state                                      | P1       |
| FW-013 | Connectors: OAuth flow, scope/least-privilege UI, sync status, error toasts                                               | P1       |
| FW-014 | Onboarding first-run flow (workspace → connect → upload)                                                                  | P1       |
| FW-015 | Autonomy save → PUT `/agents/{id}` (fix 405)                                                                              | P1       |
| FW-016 | SSO buttons wired or removed; forgot-password page + backend reset endpoints                                              | P2       |
| FW-017 | Gate/hide mock enterprise shells (admin/billing/marketplace/developer/feature-flags/organizations) or back with real APIs | P2       |
| FW-018 | A11y: Tabs focus, Toggle name, Modal portal, Chat labels, Sidebar inert, DiffViewer markers                               | P2       |
| FW-019 | Responsive: ResumeBuilder/GraphViewer collapse                                                                            | P2       |
| FW-020 | Tests for critical pages (files, chat approvals, settings GDPR, jobs)                                                     | P2       |
| FW-021 | Dead-code cleanup; unify design system on ui-kit                                                                          | P3       |
| FW-022 | i18n + Sentry: implement or remove                                                                                        | P3       |

---

## 18. Acceptance Criteria (P0/P1)

```text
AC-001 (FW-001)
Given an authenticated user
When they perform any mutation (approve, sync, generate, correct memory, chat)
Then the request includes a valid X-CSRF-Token (fetched from /csrf-token)
And returns 200/2xx — never 403 "CSRF token missing"

AC-002 (FW-002)
Given an authenticated user on Settings → Delete data
When they confirm deletion
Then POST /gdpr/delete succeeds
And a completion receipt is shown
And no /workspaces/{id}/data call is made

AC-003 (FW-003)
Given a chat proposal card
When the user clicks Approve
Then approvalApi.approve is called
And the card shows "Approved"
And the action appears in Notifications
And no toast-only path remains

AC-004 (FW-004)
Given the Files page
When the user uploads a PDF
Then upload progress is shown
And the row appears after success
And parsing and failed-ingestion states render on error

AC-005 (FW-007)
Given the Jobs page
When the user searches
Then ranked roles with match explanation render
And save/reject persist
And applying requires approval and offers a deep link

AC-006 (FW-008)
Given a workspace with memory
When the user opens Memory Graph
Then nodes render in a zoomable/pannable view with filters and entity detail
And on mobile it collapses to a usable list

AC-007 (FW-009)
Given events from different sources
Then the Schedule page filters by workspace
And labels user-created vs Gmail-extracted vs agent-proposed
And proposed events support approve/reject

AC-008 (FW-010)
Given an agent file rename
Then History shows before/after
And an Undo button restores the previous state via API

AC-009 (FW-012)
Given a workspace with 3 agents and 5 memories
Then Dashboard shows 3 and 5 (not 0)
And counts are scoped to this workspace only

AC-010 (FW-013)
Given the Connectors page
Then connecting launches an OAuth flow with an explicit scope list
And sync shows progress
And failures surface a toast with retry
```

---

## 19. Final Release Gate

❌ NOT PASSED:

- P0 issues exist (CSRF breaks all writes; broken GDPR endpoints; fake approvals
  on trust path)
- Critical journeys fail (A New User, B File Organization, D Job Search, E
  Gmail, G Trust & Privacy)
- Critical pages missing (upload, job search, graph visualization, file viewer)
- Backend gaps remain (job search REST, undo/revert REST, ATS, password reset,
  conversation persistence)
- 23/24 pages untested; e2e smoke suite not wired
- 6 mock shells presented as real features

---

## FRONTEND AUDIT FINAL DECISION

### NOT APPROVED — IMPLEMENTATION REQUIRED

Backend contract fixes (FW-001/002/015) must land before any UI polish — without
CSRF support and correct endpoints, most of the existing real-API UI cannot
actually write. Runtime verification was NOT performed; CSRF/405/404 findings
are code-level with high confidence and should be confirmed with one runtime
smoke test of a mutation after FW-001 lands.
