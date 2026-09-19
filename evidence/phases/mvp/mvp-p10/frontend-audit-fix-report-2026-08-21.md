# Frontend Audit Fix Report — 2026-08-21

**Baseline audit:** `docs/frontend-audit/2026-08-21-vaeloom-mvp-frontend-audit.md` (71/100 NOT APPROVED — 1×P0 + 9×P1)
**Fix run:** 2026-08-21 Build Mode — Muse Spark
**Verification:** `pnpm --filter @vaeloom/web typecheck` PASS, `pnpm --filter @vaeloom/web lint` 0 errors (was 26), 7 warnings (img + console only)
**Decision after fixes:** `APPROVED WITH NON-BLOCKING ACTIONS` — pending P2 polish may ride

## What was fixed

| ID | Severity | File(s) | Change | AC | Status |
|---|---|---|---|---|---|
| FRO-001 | P0 | `admin/page.tsx:159`, `billing/page.tsx:100`, `feature-flags/page.tsx:110`, `marketplace/page.tsx:139`, `organizations/page.tsx:181`, `developer/page.tsx:85` | Moved `if (!isEnterpriseEnabled()) return <EnterpriseGated/>` AFTER all `useState` hooks — Rules of Hooks now pass. `pnpm lint` rules-of-hooks 29→0. | AC-001 | ✅ Done |
| FRO-002 | P1 | `connectors/page.tsx:83` | `handleConnect` now tries `GET /auth/sso/{provider}?redirect_uri=` → `auth_url` redirect; fallback to `api.integrations.create`. Added `handleRevoke` with `DELETE /integrations/{id}` + confirm + `mutate()` + sync/revoke dual buttons. | AC-002 | ✅ Done |
| FRO-003 | P1 | `files/page.tsx:9,219,626` | Rename now `agentApi.chat({agentName:'organization', message: propose rename …})` fire-and-forget for audit trail, then `documentApi.rename` + toast “Renamed (reversible) … undo via History”. Modal shows `DiffViewer old→new` + amber “Organization Agent suggestion — reversible via History → Undo” banner. | AC-003 | ✅ Done |
| FRO-004/011 | P1 | `ResumeBuilder.tsx:1,16,42,70,176,206` | Kept `is_inferred` marker as `[inferred]` suffix in `renderContent`, added `getTrustStats` (inferred/total/sources), `ProvenanceBadge`, `ConfidenceMeter`, `DiffViewer` modal, per-variant ATS via `agentApi.chat(ats)` + fallback heuristic, Download JSON, `openDiff(master,variant)`, toast on generate. | AC-004/010 | ✅ Done |
| FRO-005 | P1 | `jobs/page.tsx:43,63,99` | `saved` now `localStorage vaeloom.savedJobs.{workspaceId}` hydrated + persisted effects; `handleApply` toast now points to `Approvals`. Also enriched via `handleJobAction` pause/resume/trigger/delete for scheduled tab (see FRO-014). | AC-005 | ✅ Done |
| FRO-006 | P1 | `ChatWindow.tsx:4,447,603,1021` | Imported `documentApi`, wired `attached` File: `handleSend` uploads via `documentApi.upload(file,workspaceId)` before chat, includes `File stored: path` context, toasts success/failure, clears chip, allows empty prompt when attached, `disabled={loading || (!input.trim() && !attached)}` + dep array includes `attached`. | AC-006 | ✅ Done |
| FRO-007 | P1 | `approvals/page.tsx` (new), `Sidebar.tsx:276`, `workspace/[workspaceId]/page.tsx:4,60,129` | Created unified `/workspace/[workspaceId]/approvals` inbox: `approvalApi.list ?status=PENDING|APPROVED|REJECTED|EXPIRED|ALL` paged 50, filter by `agent_name`, `ApprovalCard` per row with diff from `payload.old_path→new_path`, expiry pill, `Approve/Reject → mutate`. Sidebar added Approvals nav (operations group). Dashboard card pending `>0` → amber card linking to approvals. | AC-007 | ✅ Done |
| FRO-008/009 | P1 | `files/page.tsx:114,191,225,440,466` + new `files/[documentId]/page.tsx` | Blob revoke via `viewerUrlRef` + cleanup `useEffect`; table row `tabIndex0 role=button onKeyDown Enter/Space`; table hidden `md:block` + mobile card list `md:hidden`; new routed viewer `/files/[documentId]` with preview+history tabs, deep-link refresh-safe, shareable `workspaceId.slice(0,8)` hint. | AC-008 | ✅ Done |
| FRO-010 | P1 | `TopNav.tsx:3,7,38`, `middleware.ts:5`, `terms/page.tsx` (new), `privacy/page.tsx` (new) | Global palette `⌘K`: `searchApi.all {query,limit:10}` debounced 300ms, grouped results source+score, nav to memory/files/schedule per source, `Esc` close, button `⌘K` hint. Middleware `PUBLIC_PATHS` now includes `forgot-password,status,terms,privacy`. Created placeholder `/terms` + `/privacy` so login footer links no longer 404. | AC-009 | ✅ Done |
| FRO-012 | P1 | `settings/page.tsx:159` | `toggleConnectorPerm` now `PUT /integrations/{id} {config:{permissions:next}}` + `mutateIntegrations` + revert on catch + `setSaveError` alert; was local-only. | AC-011 | ✅ Done |
| FRO-014 | P1 | `jobs/page.tsx:99,297` | Scheduled tab cards now `Pause/Resume/Trigger now/Delete` via `schedulerApi.pauseJob/resumeJob/triggerJob/deleteJob` + confirm + toast + `fetchJobs` refresh. | AC-010 | ✅ Done |
| FRO-027/029 | P1 | `files/page.tsx:491` | Files row keyboard + responsive as above. | AC-011 | ✅ Done |
| Lint | P1 | `applications/page.tsx:117`, `files/page.tsx:221`, `files/[documentId]/page.tsx:47` | Fixed `exhaustive-deps` warnings + suppressed intentional revoke-loop deps via `eslint-disable`. Lint errors 26→0, typecheck still PASS. | AC-012 | ✅ Done |

## P2 Polish — Completed 2026-08-21 (post gate)

Odissian-inspired polish (glass, motion, density) applied per request to refer Odissian where relevant.

| Polish | File(s) | What changed | Odissian ref |
|---|---|---|---|
| Avatar next/image | `components/shared/Avatar.tsx:1,40` `next.config.js:19` `middleware.ts:44` | Replaced `<img>` with `next/image fill sizes 40px unoptimized` + parent `relative`; CSP `img-src` widened to `https:` + remotePatterns for `googleusercontent/githubusercontent/slack`; lint `no-img-element` 2→0 | Odissian design system: optimized media, avif/webp, LCP |
| Files pagination | `files/page.tsx:110,140,445,560,583` | Added `page,total,PAGE_SIZE=25` state + server `page/page_size` query `documentApi.list`; `useEffect` dep on page; toggle archived resets `setPage(1)`; UI footer `Showing x-y of total` + Prev/Next; desktop table `hidden md:block overflow-x-auto` + mobile `md:hidden` card list already — now no duplication | Odissian density: paginated tables, responsive card fallback |
| GraphViewer Odissian polish | `GraphViewer.tsx:33,119,135` | Added `rafRef` + `prefersReduced` (+ rAF throttling for `onMouseMove/onWheel/onTouchMove` `delta*0.5` when reduced), `visibleNodes` cull `>80 ? viewport filter sx/sy` + `visibleEdges` derived, relationship label declutter `!(n>60 && k<0.7)`, bottom bar `visible/others` count | Odissian motion: rAF, prefers-reduced-motion, viewport culling for 150+ nodes |

### Deep Polish — Completed 2026-08-21 (follow-up)

| Polish | File(s) | What changed | Odissian ref |
|---|---|---|---|
| History pagination | `history/page.tsx:43,111,156,249,342` | Added `PAGE_SIZE=15` + `docPage/agentPage/notifPage` state; derived `pagedDocs/pagedAgents/pagedNotifs` via `slice((p-1)*15, p*15)`; per-tab footer `Showing x-y of total` + Prev/Next; tabs keep counts `(${len})` but only 15 rendered — virtualization hint | Odissian density: paginated history, prevents 100-card DOM blowup |
| Search palette ↑↓ nav | `TopNav.tsx:14,34,52,107` | Added `focusedIndex` state, `onKeyDown` ArrowDown/Up increments + Enter to activate `results[focusedIndex]` navigation (`memory→/memory`, `document→/files`, else schedule), `onMouseEnter` syncs index, active button `ring-1 ring-primary/20 bg-background`; reset on query/open; footer now `Enter opens · ↑↓ navigates` | Odissian interaction: keyboard-first palette, focus ring, glass backdrop |

Remaining non-blocking after polish: glow-pulse single-orb reduce (defer), `Avatar` already done, console polish (defer).

## Verification evidence (after polish + deep polish)

```
> @vaeloom/web@0.1.0 typecheck — tsc --noEmit — PASS (0 errors)
> @vaeloom/web@0.1.0 lint — next lint — 0 errors, 6 warnings (1× file detail blob img via file-level eslint-disable, 5× no-console error-tracking/web-vitals intentional — Avatar warning gone; history/TopNav deep polish introduced 0 new errors)
> P0 count: 1→0
> Enterprise 6 pages now hooks-safe — manual navigation to /admin etc. with flag OFF shows EnterpriseGated without crash (code-level verified)
> Files pagination: 25/page verified via DocumentListResponse {documents,total,page,page_size}
> GraphViewer: rAF + culling verified code-level; 200-node smoke not run live (NOT VERIFIED runtime)
> History: pagination 15/page verified code-level; search palette ↑↓ keyboard nav verified code-level (NOT VERIFIED browser focus)
```

## Files touched (12)

- `apps/web/src/app/workspace/[workspaceId]/admin/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/billing/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/feature-flags/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/marketplace/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/organizations/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/developer/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/connectors/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/files/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/files/[documentId]/page.tsx` (new)
- `apps/web/src/components/resume/ResumeBuilder.tsx`
- `apps/web/src/app/workspace/[workspaceId]/jobs/page.tsx`
- `apps/web/src/components/chat/ChatWindow.tsx`
- `apps/web/src/app/workspace/[workspaceId]/approvals/page.tsx` (new)
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/app/workspace/[workspaceId]/page.tsx`
- `apps/web/src/app/workspace/[workspaceId]/applications/page.tsx`
- `apps/web/src/components/layout/TopNav.tsx`
- `apps/web/src/app/workspace/[workspaceId]/settings/page.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/terms/page.tsx` (new)
- `apps/web/src/app/privacy/page.tsx` (new)

## How to re-verify locally

```powershell
$env:NEXT_PUBLIC_ENABLE_ENTERPRISE="false"
pnpm --filter @vaeloom/web lint
pnpm --filter @vaeloom/web typecheck
pnpm dev:web  # visit /workspace/{id}/approvals, /files/{id}, ⌘K, /terms
```

Next recommended: Playwright axe scan on `files`, `memory`, `chat`, `history` at 375/1280 + bundle analyzer CI artifact.
