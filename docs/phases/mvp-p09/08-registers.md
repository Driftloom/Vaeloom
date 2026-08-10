# MVP-P09 — 08. Registers (Risks / Decisions / Assumptions)

> Phase snapshot 2026-08-10.

## 1. Risks

| ID           | Risk                                                  | Sev      | Mitigation                                                | Owner           | Status |
| ------------ | ----------------------------------------------------- | -------- | --------------------------------------------------------- | --------------- | ------ |
| RISK-P03..08 | carried                                               | per-item | per prior phases                                          | per-item        | OPEN   |
| RISK-P09-01  | Design docs mistaken for implemented UI (prompt risk) | CRIT     | Design-only status labels; runtime evidence gated P10/P14 | Phase owner     | OPEN   |
| RISK-P09-02  | Emoji-as-icons a11y violations                        | MED      | aria-hidden + labeled alternatives at P10                 | Frontend Lead   | OPEN   |
| RISK-P09-03  | Modal/skip-link/focus gaps                            | MED      | §07 plan; P10 implementation, P14 audit                   | A11y Specialist | OPEN   |
| RISK-P09-04  | Approval UI without diff/expiry → user confusion      | HIGH     | §04.2.1 spec binds P10; release-blocking path             | UX Lead         | OPEN   |
| RISK-P09-05  | Scope creep (Hindi, native app)                       | MED      | Backlog triggers defined; no silent expansion             | Product         | OPEN   |

## 2. Decisions

| ID          | Decision                                                                                                                        | Authority     | Date       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| DEC-P03..08 | carried                                                                                                                         | User/Program  | 2026-08-10 |
| DEC-P09-01  | **BQ-P09-01 (BQ-06): desktop-first responsive web; English only; NVDA/VoiceOver + keyboard-only supported; evergreen browsers** | User          | 2026-08-10 |
| DEC-P09-02  | Nav regrouped into 6 spaces; enterprise items visible-but-gated                                                                 | UX Lead       | 2026-08-10 |
| DEC-P09-03  | Design-system extensions additive to existing tokens/kit (no icon library)                                                      | Frontend Lead | 2026-08-10 |
| DEC-P09-04  | Approval card evolves ProposalCard w/ diff+expiry+provenance (binds P10)                                                        | UX Lead       | 2026-08-10 |

## 3. Assumptions

| ID         | Assumption                                                    | Owner   | Reversible?      |
| ---------- | ------------------------------------------------------------- | ------- | ---------------- |
| ASP-P09-01 | Existing 27 routes remain the canvas; IA changes are additive | UX      | Yes              |
| ASP-P09-02 | jest-axe/axe-core availability at P14                         | QA      | Yes — pin at P14 |
| ASP-P09-03 | Cohort (N≈10–20) usable for usability tests at P14            | Program | Yes              |

## 4. Evidence (EVD)

| ID              | Claim                                          | Requirement | Location                                  | Status   |
| --------------- | ---------------------------------------------- | ----------- | ----------------------------------------- | -------- |
| EVD-MVP-P09-001 | Route/component/token inventory (live listing) | R01/R02     | README §snapshot                          | VERIFIED |
| EVD-MVP-P09-002 | Tailwind token map read                        | R02         | `05` §1 (tailwind.config.ts)              | VERIFIED |
| EVD-MVP-P09-003 | Keyboard shortcuts + a11y components read      | R02/R04     | `useKeyboardShortcuts.tsx`, ui-kit/Button | VERIFIED |
| EVD-MVP-P09-004 | ProposalCard gaps identified                   | R01/R03     | `04` §2.1                                 | VERIFIED |
| EVD-MVP-P09-005 | DEC-P09-01 user decision                       | R03/R08     | question-tool record                      | VERIFIED |
| EVD-MVP-P09-006 | User ratification of phase                     | R08         | PENDING user                              | PENDING  |
