# CONT-P10 — 01 Frontend Code — Shell & Routing

**Deliverable:** `DEL-CONT-P10-01` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Frontend Architect

## Shell (existing — no fork)

| Layer | File | Evidence |
|-------|------|----------|
| App shell | `apps/web/src/app/layout.tsx` + `apps/web/src/app/workspace/[workspaceId]/layout.tsx` | `Sidebar.tsx` + `TopNav.tsx` WS context via `TenantMiddleware` `X-Workspace-ID` |
| Routing | `apps/web/src/app/page.tsx` landing + `workspace/[workspaceId]/*` 18 pages | `apps/web/src/middleware.ts:7` protects `/workspace` → `/login?redirect=` |
| Landing 3D | `components/landing/3d/SceneShell.tsx` `StageProvider/StageSlot` single WebGL context `SceneShell.tsx:225` | landing plan `.agents/plans/completed/landing-3d...md` 4 WS (A coverage B flythrough C cleanup D interior) — **additive** not fork |
| Interior 3D hook | `GraphViewer.tsx` + `ExecutionTimeline.tsx` | `StageSlot` reuse planned per plan D — no duplicate context |

**Contract:** No second `createStage` tree; one `StageProvider` per mount (`landing` + `workspace` separate trees, not nested). `DustField` ambient `page.tsx:90` stays.

## Progressive Migration

- `admin/page.tsx:42` `mockUsers/mockServices` → live `iamApi/auditApi/adminApi` via `useSWR` `admin/page.tsx:84` — feature-flag additive `isEnterpriseEnabled()` `admin/page.tsx:134` (flag `NEXT_PUBLIC_ENTERPRISE_ENABLED` or `enterprise_routes_enabled=false` backend). No route fork.

## Handoff

- Next: `02-typed-client` covers `shared-types` + `api-client.ts` drift guard.
