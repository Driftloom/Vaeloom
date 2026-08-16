# MVP-P04 — 05. RACI & Approval Matrix (DEL-MVP-P04-03) — V2

> **Version:** 2.0 (supersedes `05-raci-approvals.md` dated 2026-08-15)
> **Owner:** Program Manager · **Baseline:** master @ `dac2630` (P03 CLOSED
> 2026-08-14) · R = Responsible, A = Accountable, C = Consulted, I = Informed.

**V2 improvements:** Added escalation matrices, decision log templates, specific
approval workflows per gate, and operational procedures.

## 1. Roles (activated)

Roles per prompt §2 (Program Manager, Product Manager, Engineering Manager,
Release Manager, FinOps Specialist, Risk Owner), plus the USER as sole approver
and reviewers with veto on mandatory blockers.

| Role                                   | Who                                                                            | Authority                                                                   | Escalation Path                         |
| -------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------- |
| Program Manager                        | AI agent (phase executor)                                                      | Runs phase execution; gate reporting; RACI ownership                        | Escalates to USER on blockers           |
| Product Manager                        | AI agent                                                                       | Requirements integrity; scope gate; change control (A)                      | Escalates to USER on scope conflicts    |
| Engineering Manager                    | AI agent                                                                       | Implementation; architecture/design decisions                               | Escalates to USER on technical blockers |
| Release Manager                        | AI agent                                                                       | Release/go-live authority; release evidence                                 | Escalates to USER on release blockers   |
| FinOps Specialist                      | AI agent                                                                       | Budget/cost guardrail (A); $0 spend enforcement                             | Escalates to USER on budget overruns    |
| Risk Owner                             | AI agent                                                                       | Risk burndown; exception registry; security/privacy review (A w/ veto)      | Escalates to USER on risk acceptance    |
| **Sole approver**                      | **User**                                                                       | All gates, changes, exceptions, enablement, waivers (BQ-01, gate authority) | N/A (final authority)                   |
| Reviewers (veto on mandatory blockers) | Security/Privacy/Data/A11y/Reliability/Operations reviewers (AI agents + user) | Veto on mandatory blockers per INT-02 §1                                    | Escalates to USER on veto disputes      |

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

## 4. Approval workflows per gate

### 4.1 Phase gate approval workflow

```text
1. Executor prepares gate report (09-gate-*.md)
   ├─ Scores all categories per prompt §28
   ├─ Identifies mandatory blockers
   └─ Recommends GO / CONDITIONAL GO / NO-GO

2. Reviewers validate
   ├─ Security/Privacy reviewer: check security/privacy category
   ├─ QA reviewer: check testing/validation category
   ├─ Engineering reviewer: check technical correctness
   └─ Program reviewer: check scope/acceptance

3. USER ratifies
   ├─ Review gate report
   ├─ Review reviewer findings
   ├─ Issue verdict: GO / CONDITIONAL GO / NO-GO
   └─ Record in change log

4. Handoff prepared
   ├─ Only after USER ratification
   ├─ References gate report and verdict
   └─ Lists restrictions and prohibited work
```

### 4.2 Change control workflow

```text
1. Change request submitted
   ├─ RFC document with rationale, impact, migration, tests, rollout, rollback
   ├─ Owner identified
   └─ Reviewers assigned

2. Reviewers assess
   ├─ Security/Privacy: data/privacy impact
   ├─ Engineering: technical impact
   ├─ Product: scope impact
   └─ FinOps: cost impact

3. USER approves/rejects
   ├─ Review RFC and reviewer findings
   ├─ Issue decision: APPROVE / REJECT / DEFER
   └─ Record in change log

4. Implementation (if approved)
   ├─ Execute per RFC
   ├─ Capture evidence
   └─ Update registers
```

### 4.3 Exception/waiver workflow

```text
1. Exception request submitted
   ├─ Risk Owner proposes exception
   ├─ Includes: risk, impact, controls, expiry, monitoring
   └─ Prohibited downstream work listed

2. Reviewers assess
   ├─ Security/Privacy: security/privacy impact
   ├─ QA: testing impact
   └─ Engineering: technical impact

3. USER approves/rejects
   ├─ Review exception request and reviewer findings
   ├─ Issue decision: APPROVE / REJECT
   └─ Record in exception register

4. Monitoring (if approved)
   ├─ Track expiry date
   ├─ Monitor controls
   └─ Re-review at expiry
```

## 5. Cadence

| Forum                        | Cadence       | Participants               | Output                      | Time-box |
| ---------------------------- | ------------- | -------------------------- | --------------------------- | -------- |
| Phase gate review            | per phase end | Executor + user            | Gate decision, restrictions | 1 hour   |
| Risk burndown                | per phase     | Risk Owner + user          | Updated register            | 30 min   |
| Exception review             | on expiry     | User                       | Renew/extend/close          | 15 min   |
| Decision/assumption calendar | per phase     | Program                    | Register updates            | 15 min   |
| Change-control board         | on change     | Product + reviewers + user | Change record (RFC)         | 30 min   |
| Weekly status                | weekly        | Program + user             | Status update               | 15 min   |

## 6. Escalation

- An unresolved blocker (mandatory-blocker veto, unratified gate, or
  scope/permission/data/DPA/provider conflict) escalates to the USER — sole
  approver — within the phase.
- No work proceeds on a mandatory blocker without a USER decision. Executors
  record the escalation, the request, and the USER decision in the change
  record; prohibited actions remain prohibited while escalation is pending.

### Escalation matrix

| Issue Type             | First Escalation   | Time Limit  | Final Escalation      |
| ---------------------- | ------------------ | ----------- | --------------------- |
| Mandatory blocker veto | Phase owner → USER | 24 hours    | USER decision (final) |
| Scope conflict         | Product → USER     | 24 hours    | USER decision (final) |
| Technical blocker      | Engineering → USER | 24 hours    | USER decision (final) |
| Budget overrun         | FinOps → USER      | Immediately | USER decision (final) |
| Risk acceptance        | Risk Owner → USER  | 24 hours    | USER decision (final) |
| Release blocker        | Release → USER     | 24 hours    | USER decision (final) |

## 7. Decision log template

| Field                   | Description                                   |
| ----------------------- | --------------------------------------------- |
| Decision ID             | Unique identifier (e.g., DEC-P04-XX)          |
| Decision                | Clear statement of the decision               |
| Rationale               | Why this decision was made                    |
| Alternatives considered | Other options evaluated                       |
| Impact                  | What this decision affects                    |
| Owner                   | Who is responsible for implementing           |
| Reviewers               | Who reviewed the decision                     |
| Approver                | Who approved the decision (USER for critical) |
| Date                    | When the decision was made                    |
| Expiry                  | When the decision needs re-review             |
| Status                  | ACTIVE / EXPIRED / SUPERSEDED                 |

## 8. Evidence

| Evidence ID     | Claim                                                         | Requirement | Type                 | Location     | Result                         | Date       | Verified by     |
| --------------- | ------------------------------------------------------------- | ----------- | -------------------- | ------------ | ------------------------------ | ---------- | --------------- |
| EVD-MVP-P04-031 | RACI & approval matrix defined for all activated roles        | MVP-P04-R01 | SOURCE_DERIVED       | this file    | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-032 | Reviewers hold veto on mandatory blockers; user sole approver | MVP-P04-R01 | STAKEHOLDER_DECISION | this file    | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-033 | Security/privacy risk ownership defined w/ veto               | MVP-P04-R03 | SOURCE_DERIVED       | this file    | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-034 | Release/go-live and kill-switch governance owned              | MVP-P04-R05 | SOURCE_DERIVED       | this file    | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-035 | Escalation matrix defined with time limits and paths          | MVP-P04-R05 | NEW_DESIGN           | this file §6 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-036 | Approval workflows documented per gate type                   | MVP-P04-R01 | NEW_DESIGN           | this file §4 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-037 | Decision log template defined with required fields            | MVP-P04-R02 | NEW_DESIGN           | this file §7 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
