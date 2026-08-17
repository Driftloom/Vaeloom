# MVP-P08 → MVP-P09 Handoff

> **Phase:** MVP-P08 → MVP-P09 · **Date:** 2026-08-17 · **Baseline:** `master` @
> `7a5434a` · **Gate state:** 🟡 **PHASE CONDITIONALLY APPROVED — RESTRICTIONS
> APPLY** (87.3/100, `09-gate-report.md`); **USER verdict pending** (sole gate
> authority, BQ-01). **P09 starts ONLY on user command.**

## Phase Summary

MVP-P08 re-run designed the API/integration/contract layer over the **live**
79-path OpenAPI surface (verified against codebase), with gap analysis:

- **Approval API: IMPLEMENTED** (5 endpoints, was design-only in prior run)
- **Gmail API: IMPLEMENTED** (6 endpoints including watch/draft/webhook)
- Error format gap: NOT RFC 9457 — migration designed for P11
- General async job queue: NOT IMPLEMENTED — design for P11
- DLQ management: NOT IMPLEMENTED — design for P12
- Webhook signature verification: NOT IMPLEMENTED — design for P12
- SDK coverage: 10% — expansion designed for P10-P12
- Workload identity (ADR-025) + input sanitization (ADR-031): NOT IMPLEMENTED

## Evidence

| ID                   | Requirement | Artifact                                                |
| -------------------- | ----------- | ------------------------------------------------------- |
| EVD-MVP-P08-001      | R01/R02     | `01` §3 — 79-path OpenAPI verified against code         |
| EVD-MVP-P08-002..006 | R01..R07    | `03`–`07` — 5 DELs with gap analysis                    |
| EVD-MVP-P08-007      | R03         | BQ-P08-01 question-tool record                          |
| EVD-MVP-P08-008      | R08         | `02` — P07 predecessor audit (98/100 GO)                |
| EVD-MVP-P08-009..012 | R01/R03     | Code verification: approval, gmail, idempotency, errors |

## Gate: CONDITIONAL APPROVED — RESTRICTIONS APPLY (87.3/100)

| Restriction                                                               | Target phase |
| ------------------------------------------------------------------------- | ------------ |
| 1. RFC 9457 error format migration before new consumer-facing endpoints   | P11          |
| 2. No breaking change w/o 1-cycle notice + user approval; openapi-diff CI | P11+         |
| 3. CSRF skip-list stays auth-only; widen only with security review        | every phase  |
| 4. Gmail draft-only; no send without per-user T3 enablement               | P11/P13      |
| 5. General async job queue design before export/erase/embed wiring        | P11          |
| 6. Workload identity + input sanitization before elevated privileges      | P11/P12      |

## Open issues carried

- RISK-P08-01..10 (register §1) — owners assigned
- UNK-02 creds → P19 · UNK-P03-01 legal → P13 · VB-07 cohort → user
- RFC 9457 migration → P11 · Async job queue → P11 · DLQ mgmt → P12
- Webhook verify → P12 · Input sanitization → P12 · Session logout → P11

## Scope for MVP-P09

- UI/UX & Design System for the web app:
  - Information architecture for P1+P2 personas & user flows (onboarding,
    agents, memory, approvals, Gmail, notifications, settings, rights)
  - Design system/tokens from `packages/ui-kit` + existing components
  - Accessibility (WCAG), theming (existing light/dark), keyboard nav
  - Use real existing web routes/pages as the canvas; no runtime code changes
- Carry restrictions: no code, no breaking changes, design-only phase.
- Evidence at P09 gate = source-grounded design artifacts (route inventory,
  component inventory, IA diagram, token map), not screenshots.

## Constraints for successor

- Repo truth: web app is Next.js 15 + existing routes (16+ pages) — inventory
  them; do not invent new routes beyond IA proposal.
- ui-kit/design tokens exist — map, don't recreate.
- A11y + theming + keyboard shortcuts (P12 polish features) — consider in IA.
- Restriction 3 applies: no touching middleware/CSP lists.
- Approval API is implemented — UI should integrate with existing endpoints.
