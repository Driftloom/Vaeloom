# CONT-P10 — 07 Evidence Bundle

| EVD | Claim | Requirement | Type | Location | Result | Date | Verified |
|-----|-------|-------------|------|----------|--------|------|----------|
| EVD-CONT-P10-001 | Shell routing `workspace/[id]` + `middleware.ts:7` + single Stage context | CONT-P10-R01 | code | `01-frontend-code.md` + `SceneShell.tsx:225` | PASS | 2026-08-31 | Frontend Arch |
| EVD-CONT-P10-002 | Typed `api.ts transformKeys` + `api-client` `consent/approval/gdpr` + `shared-types` | CONT-P10-R02 | code | `02-typed-client.md` + `api.ts:27` `api-client.ts:1152` | PASS | 2026-08-31 | Frontend Arch |
| EVD-CONT-P10-003 | Kit `Button Table StatusBadge ApprovalCard A/R + sr-only` | CONT-P10-R02 | code | `03-component-library.md` + `ApprovalCard.tsx:48,74` | PASS | 2026-08-31 | Design |
| EVD-CONT-P10-004 | `admin live iam/audit/health` + mock fallback + `EnterpriseGated` | CONT-P10-R04 | code | `admin/page.tsx:84,134` `01` | PASS | 2026-08-31 | Frontend Arch |
| EVD-CONT-P10-005 | Security `CSRF` `Tenant RLS 42/42` `CSP` | CONT-P10-R03 | log | `04-accessibility-tests.md` + `middleware/csrf.py` | PASS | 2026-08-31 | Sec |
| EVD-CONT-P10-006 | `jest-axe 0 crit` `34 jest +60 e2e` `51/51 api` | CONT-P10-R04 | log | `04-accessibility-tests.md` | PASS | 2026-08-31 | QA |
| EVD-CONT-P10-007 | `p95 120ms <200` `Stage dpr 1.75 + IO pause` | CONT-P10-R05 | file | `05-performance-deploy.md` + `k6-script` | PASS | 2026-08-31 | SRE |
| EVD-CONT-P10-008 | Landing plan 4WS `C→A→B→D` promoted | CONT-P10-R01 | file | `.agents/plans/completed/landing-3d...md:74` | PASS | 2026-08-31 | Frontend |
| EVD-CONT-P10-009 | `openapi 110 + parsers 17 + 42/42 RLS` re-verified | CONT-P10-R07 | log | `00-audit 97` | PASS | 2026-08-31 | QA |
| EVD-CONT-P10-010 | Trace source→req→code→test→evid→risk→gate→handoff | CONT-P10-R07 | file | this + `08-registers` | PASS | 2026-08-31 | Program |
