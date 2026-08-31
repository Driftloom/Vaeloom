# CONT-P09 — 08 Registers

## Risk

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|----|------|----------|--------|------------|-------|--------|
| RISK-CONT-P09-01 | Docs mistaken for runtime completion | Critical | False readiness | `07-evidence-bundle` + `jest-axe` + `51/51` + `rg` proofs | UX Architect | CLOSED |
| RISK-CONT-P09-02 | Consent scope invented | High | Leak | `consentApi` real scopes `data_processing/agent_access` `api-client.ts:1114` + `gmail.send` T3 disabled | Privacy | CLOSED |
| RISK-CONT-P09-03 | Admin mock drift vs live | High | False counts | Shadow live via `useSWR` `iamApi/auditApi/adminApi` `admin/page.tsx:84` fallback only when unreachable | Solution Arch | MITIGATED |
| RISK-CONT-P09-04 | `gmail.send` auto-execute | Critical | Spam/phish | `t3Warning` gate `ApprovalCard.tsx:140` + `agent_access` consent + `ENTERPRISE_ROUTES_ENABLED` | Security | CLOSED |
| RISK-CONT-P09-05 | Old/new divergence (UX flags) | Critical | Harm | No divergent write path; UX is additive `isEnterpriseEnabled()` gated `admin/page.tsx:134` | Migration | CLOSED |

## Decisions

| ID | Decision | Rationale | Alternatives | Owner | Status |
|----|----------|-----------|--------------|-------|--------|
| DEC-CONT-P09-01 | Keep `ApprovalCard` `proposed≠executed` badge | Trust boundary per prompt §12.2 | Silent execute (rejected) | UX Architect | APPROVED |
| DEC-CONT-P09-02 | Admin uses live `iam/audit/health` + `mockUsers/mockServices` fallback | No backend hard fail in MVP `ENTERPRISE_ROUTES_ENABLED=false` `config.py:92` | Block page (rejected) | Solution Arch | APPROVED |
| DEC-CONT-P09-03 | Consent scopes frozen `data_processing/agent_access` + `gmail.send` T3 disabled | DPDP `privacy/page.tsx` + staged rollout | Free-form scopes (rejected) | Privacy | APPROVED |
| DEC-CONT-P09-04 | Design tokens frozen v1.0 | Stability per `next.config.js:13` | New tokens this phase (deferred) | Design Systems | APPROVED |

## Assumptions

| ID | Assumption | Validation | Owner | Expiry |
|----|------------|------------|-------|--------|
| ASM-CONT-P09-01 | `jest-axe 0 critical` assumed from `mvp-p15` baseline — re-ran `npx jest` not `npx playwright a11y` this phase | Re-run before `CONT-P10` | A11y | 2026-09-30 |
| ASM-CONT-P09-02 | `admin/page.tsx` `isEnterpriseEnabled()` = feature-flag not tenant cell — true | Flag maps to `NEXT_PUBLIC_ENTERPRISE_ENABLED` or backend `enterprise_routes_enabled` | Solution Arch | none |

## Exceptions

| ID | Exception | Controls | Approver | Expiry | Monitoring |
|----|-----------|----------|----------|--------|------------|
| EXC-CONT-P09-01 | `apps/web/src/app/privacy/page.tsx` placeholder 2026-08-21 — counsel review pending | `LAST_UPDATED` banner + no launch claim | Privacy/legal | 2026-11-22 | launch checklist |

## Traceability

`CONT-P09-R01..R08` → `01..05 DELs` → `ApprovalCard.tsx` `admin/page.tsx` `api-client.ts` `privacy/page.tsx` → `ApprovalCard.spec.tsx` `51/51` `jest-axe` → `07-evidence-bundle` 10 rows → `06-gate-report` → `09-handoff`.

## Changes

| Change | Type | Impact | Owner | Status |
|--------|------|--------|-------|--------|
| `01..05` DELs v1.0 + `00` audit | Minor | additive docs, no code/schema change | UX Architect | DONE |
