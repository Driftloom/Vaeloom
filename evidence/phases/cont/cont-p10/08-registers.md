# CONT-P10 — 08 Registers

## Risk

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|----|------|----------|--------|------------|-------|--------|
| RISK-CONT-P10-01 | Frontend fork diverges | Critical | Drift | Additive flag `isEnterpriseEnabled()` `admin/page.tsx:134` single shell | Frontend Arch | CLOSED |
| RISK-CONT-P10-02 | WebGL context explosion | High | OOM 16 cap | Single `StageProvider` per tree `SceneShell.tsx:225` + `DustField` 2 total | Frontend | CLOSED |
| RISK-CONT-P10-03 | `mockUsers` masks live RLS bug | High | False pass | Live `useSWR` `iamApi/auditApi` overrides mock when reachable `admin/page.tsx:88` | QA | MITIGATED |
| RISK-CONT-P10-04 | CSP blocks `localhost:8000` | Medium | Dev 403 | `middleware.ts:44` `next.config.js:6` dev `connect-src localhost` | SRE | CLOSED |
| RISK-CONT-P10-05 | `snake↔camel` drift | Medium | Type bug | `transformKeys` `api.ts:27` + `openapi.yaml` single truth | Frontend Arch | CLOSED |

## Decisions

| ID | Decision | Rationale | Alt | Owner | Status |
|----|----------|-----------|-----|-------|--------|
| DEC-CONT-P10-01 | No frontend fork — additive `isEnterpriseEnabled()` + `mock fallback` | `CONT-P09` trust UX additive | Fork (rejected) | Frontend Arch | APPROVED |
| DEC-CONT-P10-02 | Keep `StageProvider` single-context per tree, not per section | Browser 16 context cap per plan `:126` | Per-section canvas (rejected) | Frontend | APPROVED |
| DEC-CONT-P10-03 | Promote landing plan `C→A→B→D` to `completed/` | Audit approved `139 lines` 4WS | Keep draft (rejected) | Frontend | APPROVED |
| DEC-CONT-P10-04 | No new Alembic/token this phase — frontend-only additive | Risk low, reversible via flag | New migration (not needed) | SRE | APPROVED |

## Assumptions

| ID | Assumption | Validation | Owner | Expiry |
|----|------------|------------|-------|--------|
| ASM-CONT-P10-01 | `next build` typecheck 0 assumed from `mvp-p10` 96 | Re-run `pnpm build:web` before `CONT-P11` | Frontend Arch | 2026-09-15 |

## Exceptions

| ID | Exception | Controls | Approver | Expiry |
|----|-----------|----------|----------|--------|
| EXC-CONT-P10-01 | `landing 3D B flythrough` not yet implemented — `aaf7c5b revert` kept per-section scroll; continuous spline deferred `CONT-P11+` | `single context` still `GO` `StageShell.tsx:225` but teleport `stageScene.ts:283` remains until B | Frontend Arch | 2026-09-30 |

## Traceability

`CONT-P10-R01..R08` → `01..05 DELs` → `apps/web/src/app/*` `lib/api*` `components/shared` `SceneShell.tsx` → `jest-axe 60e2e 51api` `ApprovalCard.spec` → `07` 10 rows → `06 gate` → `09 handoff`.

## Changes

| Change | Type | Impact | Owner | Status |
|--------|------|--------|-------|--------|
| `01..05` DELs v1.0 + `00` audit + landing plan promotion | Minor | additive docs+plan, no schema/DB | Frontend Arch | DONE |
