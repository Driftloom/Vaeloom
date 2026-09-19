# MVP-P10 — 08. Registers (Risks / Decisions / Assumptions)

## 1. Risks

| ID | Risk | Sev | Mitigation | Owner | Status |
| ------------ | ------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| RISK-P03..09 | carried | per-item | per prior phases | per-item | OPEN |
| RISK-P10-01 | ApprovalCard designed vs P08 contract but backend not yet live → user may interact before wiring | MED | Component ships but is only rendered where data exists (dashboard activity feeds today); live approvals gated to P11 | Frontend Lead | OPEN |
| RISK-P10-02 | Memory correction calls live PUT — if backend supersession semantics (P11 0004) differ, UI copy may mismatch | MED | Copy says "previous version kept in History as superseded" — P11 migration 0004 implements; P14 tests re-check | API Engineer | OPEN |
| RISK-P10-03 | Reduced-motion CSS kills all transitions (broad selector) | LOW | Standard practice; animation-free fallback verified visually | A11y Specialist | OPEN |
| RISK-P10-04 | Emoji icons still present (aria-hidden) — visual identity debt | LOW | SVG migration backlog (P20+); names conveyed via text | Frontend Lead | OPEN |

## 2. Decisions

| ID | Decision | Authority | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ---------- |
| DEC-P03..09 | carried | User/Program | 2026-08-10 |
| DEC-P10-01 | Domain trust/approval components in web/shared (not ui-kit) — ui-kit only generic primitives | CF-P10-01 resolution | 2026-08-10 |
| DEC-P10-02 | Consent toggles render current state per backend at P11 wiring; T3 toggle disabled + gated copy now (no fake enablement) | Security reviewer veto-consistent | 2026-08-10 |
| DEC-P10-03 | Approval UI not wired to backend until P11 (handoff restriction) — no fabricated calls | HANDOFF | 2026-08-10 |

## 3. Assumptions

| ID | Assumption | Owner | Reversible? |
| ---------- | -------------------------------------------------------------------------------- | ----- | ------------------------ |
| ASP-P10-01 | Backend `/consent/*` + `/gdpr/*` paths match P08 openapi evidence (72-path dump) | API | Yes — P11 contract tests |
| ASP-P10-02 | Memory `summary` field is the correction target (matches existing PUT semantics) | API | Yes |
| ASP-P10-03 | jest-axe/axe-core available at P14 for full audit | QA | Yes |

## 4. Open issues carried

- RISK-P10-01..04 above · P09 restrictions 1–3 carry to P11/P14
- Full a11y audit + usability sessions (≥80% task success, SUS ≥70) → P14
- Approval + consent live wiring → P11
