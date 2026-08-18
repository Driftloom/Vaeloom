# MVP-P09 — 08. Registers (Risks / Decisions / Assumptions)

> Phase snapshot 2026-08-10. **Re-audited 2026-08-18.**

## 1. Risks

| ID              | Risk                                                  | Sev      | Mitigation                                                | Owner           | Status |
| --------------- | ----------------------------------------------------- | -------- | --------------------------------------------------------- | --------------- | ------ |
| RISK-P03..08    | carried                                               | per-item | per prior phases                                          | per-item        | OPEN   |
| RISK-P09-01     | Design docs mistaken for implemented UI (prompt risk) | CRIT     | Design-only status labels; runtime evidence gated P10/P14 | Phase owner     | OPEN   |
| RISK-P09-02     | Emoji-as-icons a11y violations                        | MED      | aria-hidden + labeled alternatives at P10                 | Frontend Lead   | OPEN   |
| RISK-P09-03     | Modal/skip-link/focus gaps                            | MED      | §07 plan; P10 implementation, P14 audit                   | A11y Specialist | OPEN   |
| RISK-P09-04     | Approval UI without diff/expiry → user confusion      | HIGH     | §04.2.1 spec binds P10; release-blocking path             | UX Lead         | OPEN   |
| RISK-P09-05     | Scope creep (Hindi, native app)                       | MED      | Backlog triggers defined; no silent expansion             | Product         | OPEN   |
| RISK-P09-RA-001 | Route count discrepancy in docs (27 vs 23 actual)     | LOW      | Corrected in reaudit 2026-08-18                           | Phase owner     | CLOSED |

## 1a. Threat Model Summary (§16)

> Design-only phase; threat model is qualitative, not a formal STRIDE document.

| Threat Category                   | Applicable Risk                     | Design Mitigation                                                           |
| --------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Agent goal hijack (OWASP Agentic) | RISK-P09-04 (approval UI confusion) | ApprovalCard with diff + expiry + provenance; user must explicitly approve  |
| Tool misuse (OWASP Agentic)       | Scope creep (RISK-P09-05)           | Enterprise items visible-but-gated; no silent scope expansion               |
| Identity/privilege abuse          | Workspace isolation (P08 G5)        | All artifacts workspace-scoped; approval service filters by user_workspaces |
| Memory/context poisoning          | Memory correction spec (§04.2.2)    | Diff + supersession + undo; previous version kept in history                |
| Prompt injection (OWASP LLM)      | Chat AI disclosure (§04.2.4)        | AI-generated content labeled; provenance links; correction affordance       |
| Unsafe output handling            | Error copy (§06)                    | RFC 9457 pattern; no raw exceptions; correlation ID for support             |
| Sensitive disclosure              | Data rights (§04.2.3)               | Export/delete as core journeys; typed confirmation for deletion             |
| Excessive agency                  | Approval gate (P08 G4)              | Gmail draft-only; no send; approval required for all consequential actions  |
| Supply chain                      | Token/component governance (§05.4)  | No new deps; additive tokens only; deprecation requires review              |
| Cross-scope access                | Workspace isolation (P08 G5)        | RLS on 34 tables; tenant_id on all queries                                  |

**No critical/high unmitigated threats identified for design-only phase.** Full
threat model deferred to P13 (Security, Privacy, Compliance).

## 2. Decisions

| ID             | Decision                                                                                                                        | Authority     | Date       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| DEC-P03..08    | carried                                                                                                                         | User/Program  | 2026-08-10 |
| DEC-P09-01     | **BQ-P09-01 (BQ-06): desktop-first responsive web; English only; NVDA/VoiceOver + keyboard-only supported; evergreen browsers** | User          | 2026-08-10 |
| DEC-P09-02     | Nav regrouped into 6 spaces; enterprise items visible-but-gated                                                                 | UX Lead       | 2026-08-10 |
| DEC-P09-03     | Design-system extensions additive to existing tokens/kit (no icon library)                                                      | Frontend Lead | 2026-08-10 |
| DEC-P09-04     | Approval card evolves ApprovalCard w/ diff+expiry+provenance (binds P10)                                                        | UX Lead       | 2026-08-10 |
| DEC-P09-RA-001 | Route count corrected to 23; ProposalCard renamed to ApprovalCard in all docs                                                   | Re-audit      | 2026-08-18 |

## 3. Assumptions

| ID         | Assumption                                                    | Owner   | Reversible?             |
| ---------- | ------------------------------------------------------------- | ------- | ----------------------- |
| ASP-P09-01 | Existing 23 routes remain the canvas; IA changes are additive | UX      | Yes                     |
| ASP-P09-02 | jest-axe/axe-core availability at P14                         | QA      | Yes — pin at P14        |
| ASP-P09-03 | Cohort (N≈10–20) usable for usability tests at P14            | Program | Yes                     |
| ASP-P09-04 | Budget/ship window TBD — no explicit authorization yet        | Program | Yes — BLOCKING for P19+ |

## 4. Evidence (EVD)

| ID                 | Claim                                                           | Requirement | Location                                  | Status   |
| ------------------ | --------------------------------------------------------------- | ----------- | ----------------------------------------- | -------- |
| EVD-MVP-P09-001    | Route/component/token inventory (live listing)                  | R01/R02     | README §snapshot                          | VERIFIED |
| EVD-MVP-P09-002    | Tailwind token map read                                         | R02         | `05` §1 (tailwind.config.ts)              | VERIFIED |
| EVD-MVP-P09-003    | Keyboard shortcuts + a11y components read                       | R02/R04     | `useKeyboardShortcuts.tsx`, ui-kit/Button | VERIFIED |
| EVD-MVP-P09-004    | ApprovalCard gaps identified                                    | R01/R03     | `04` §2.1                                 | VERIFIED |
| EVD-MVP-P09-005    | DEC-P09-01 user decision                                        | R03/R08     | question-tool record                      | VERIFIED |
| EVD-MVP-P09-006    | User ratification of phase                                      | R08         | Re-audit 2026-08-18                       | VERIFIED |
| EVD-MVP-P09-RA-001 | Re-audit verification: 23 routes, 25/26 components, 32/32 tests | R01-R08     | `reaudit-2026-08-18.md`                   | VERIFIED |
