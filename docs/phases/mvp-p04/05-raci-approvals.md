# MVP-P04 — 05. RACI & Approval Matrix (DEL-MVP-P04-03)

> Owner: Program Manager · Baseline: master @ dac2630 (P03 CLOSED 2026-08-14) ·
> Prompt §4. R = Responsible, A = Accountable, C = Consulted, I = Informed.

## 1. Roles (activated)

Roles per prompt §2 (Program Manager, Product Manager, Engineering Manager,
Release Manager, FinOps Specialist, Risk Owner), plus the USER as sole approver
and reviewers with veto on mandatory blockers.

| Role                                   | Who                                                                            | Authority                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Program Manager                        | AI agent (phase executor)                                                      | Runs phase execution; gate reporting; RACI ownership                        |
| Product Manager                        | AI agent                                                                       | Requirements integrity; scope gate; change control (A)                      |
| Engineering Manager                    | AI agent                                                                       | Implementation; architecture/design decisions                               |
| Release Manager                        | AI agent                                                                       | Release/go-live authority; release evidence                                 |
| FinOps Specialist                      | AI agent                                                                       | Budget/cost guardrail (A); $0 spend enforcement                             |
| Risk Owner                             | AI agent                                                                       | Risk burndown; exception registry; security/privacy review (A w/ veto)      |
| **Sole approver**                      | **User**                                                                       | All gates, changes, exceptions, enablement, waivers (BQ-01, gate authority) |
| Reviewers (veto on mandatory blockers) | Security/Privacy/Data/A11y/Reliability/Operations reviewers (AI agents + user) | Veto on mandatory blockers per INT-02 §1                                    |

## 2. RACI matrix

| Activity                            | Program        | Product | Engineering | Release | FinOps | Risk         | User          |
| ----------------------------------- | -------------- | ------- | ----------- | ------- | ------ | ------------ | ------------- |
| Phase entry audit                   | A              | C       | C           | I       | I      | C            | A             |
| Scope/requirements baseline         | C              | A       | C           | I       | I      | C            | A             |
| Architecture/design decisions       | I              | C       | A           | I       | I      | C            | A             |
| Implementation                      | I              | C       | A           | I       | I      | I            | I             |
| Test/QA evidence                    | C              | C       | R           | C       | I      | I            | A             |
| Security/privacy review             | I              | C       | C           | I       | I      | **A (veto)** | A             |
| Risk register/burndown              | C              | C       | C           | C       | C      | A            | A             |
| Budget/cost guardrail               | C              | C       | C           | C       | **A**  | C            | A             |
| Change control                      | C              | **A**   | C           | C       | I      | C            | **A (final)** |
| Gate decision                       | **R (report)** | C       | C           | C       | I      | C            | **A**         |
| Exception/waiver                    | C              | C       | C           | C       | I      | R (propose)  | **A**         |
| Release/go-live                     | C              | C       | R           | **A**   | C      | C            | **A**         |
| Kill-switch/feature-flag governance | C              | C       | R           | C       | I      | C            | **A (T2/T3)** |

## 3. Approval rules

- **User approves** (sole approver, per P03 change control §7): phase gates,
  scope changes, permissions/connectors, retention/DPA, provider/model swaps,
  deployment, exceptions, T2/T3 enablement. No such action proceeds without USER
  ratification.
- **Reviewer veto:** Security/Privacy/Data/A11y/Reliability/Operations reviewers
  block on mandatory blockers (INT-02 §1) — no override without an explicit USER
  decision. An open mandatory blocker halts phase work.
- **Approval contract (FR-50/51):** consequential actions = immutable,
  payload-bound, expiring, replay-safe approvals. Applies to product actions AND
  to this delivery itself: a documented approval is the gate record; approvals
  cannot be mutated, rebound to a different payload, or replayed.
- **No single agent self-approves** — gates require USER ratification (BQ-01). A
  or R agents may prepare and propose, never finalize.
- **Baseline:** master @ dac2630 (P03 CLOSED 2026-08-14, gate 89.7/100). This
  document is DEL-MVP-P04-03; refresh supersedes the 2026-08-07 working version.

## 4. Cadence

| Forum                        | Cadence       | Participants               | Output                      |
| ---------------------------- | ------------- | -------------------------- | --------------------------- |
| Phase gate review            | per phase end | Executor + user            | Gate decision, restrictions |
| Risk burndown                | per phase     | Risk Owner + user          | Updated register            |
| Exception review             | on expiry     | User                       | Renew/extend/close          |
| Decision/assumption calendar | per phase     | Program                    | Register updates            |
| Change-control board         | on change     | Product + reviewers + user | Change record (RFC)         |

## 5. Escalation

- An unresolved blocker (mandatory-blocker veto, unratified gate, or
  scope/permission/data/DPA/provider conflict) escalates to the USER — sole
  approver — within the phase.
- No work proceeds on a mandatory blocker without a USER decision. Executors
  record the escalation, the request, and the USER decision in the change
  record; prohibited actions remain prohibited while escalation is pending.

## 6. Evidence (EVD) — DEL-MVP-P04-03

| Evidence ID     | Claim                                                         | Requirement | Type                 | Location  | Result                         | Date       | Verified by     |
| --------------- | ------------------------------------------------------------- | ----------- | -------------------- | --------- | ------------------------------ | ---------- | --------------- |
| EVD-MVP-P04-031 | RACI & approval matrix defined for all activated roles        | MVP-P04-R01 | SOURCE_DERIVED       | this file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-032 | Reviewers hold veto on mandatory blockers; user sole approver | MVP-P04-R01 | STAKEHOLDER_DECISION | this file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-033 | Security/privacy risk ownership defined w/ veto               | MVP-P04-R03 | SOURCE_DERIVED       | this file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-034 | Release/go-live and kill-switch governance owned              | MVP-P04-R05 | SOURCE_DERIVED       | this file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
