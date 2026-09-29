# ENT-P03 — 05 Change-Control Rules — Requirements Governance

> **Phase:** `ENT-P03` (Requirements Engineering)  
> **Deliverable:** `DEL-ENT-P03-05` (v1.0)  
> **Owner:** Program Governance Lead & Enterprise Architect  
> **Reviewed By:** CISO, VP Engineering, Product Director  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Requirements Change-Control Mandate

To maintain enterprise integrity and prevent silent scope drift, all
requirements established in `DEL-ENT-P03-01` are subject to strict
change-control governance. No requirement may be modified, deprecated, or added
without executing this protocol.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   REQUIREMENTS CHANGE-CONTROL PROTOCOL                 │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Formal Change Request (RFC) with Business & Technical Rationale     │
│ 2. Dual Review: Security/Privacy Impact + Architectural Feasibility    │
│ 3. Automated Regression Impact Analysis (Traceability Matrix Check)    │
│ 4. Executive Approval: Program Director & Enterprise Architect Signoff │
│ 5. Versioned Baseline Bump (v1.0 -> v1.1) & Immutable Git Commit       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Change Evaluation & Classification Criteria

| Change Severity                        | Description & Threshold                                                                                 | Required Reviewers                             | Approval Authority                                        |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------ | :--------------------------------------------- | :-------------------------------------------------------- |
| **Class 1: Architectural / Security**  | Modifies multi-tenant isolation, RLS policies, candidate consent models, or regional data residency.    | CISO, Data Protection Officer, Chief Architect | Unanimous approval required; Veto power retained by CISO. |
| **Class 2: Scope / Contractual**       | Adds or removes functional requirements, modifies OpenAPI schemas, or alters external connector scopes. | Product Lead, Lead Domain Specialist, API Lead | Program Director & Enterprise Architect sign-off.         |
| **Class 3: Non-Functional / NFR**      | Modifies response latency SLOs, availability targets, or unit cost ceilings.                            | SRE Lead, Platform Lead, FinOps Lead           | VP Engineering approval.                                  |
| **Class 4: Editorial / Clarification** | Fixes typographic errors, clarifies acceptance wording without altering behavior.                       | Business Analyst                               | Lead Product Manager sign-off.                            |

---

## 3. Strict Traceability Enforcement Rules

1. **Pull Request Gate:** Every GitHub Pull Request impacting platform behavior
   must cite the exact Requirement ID (e.g. `Implements: REQ-FR-03`) in its PR
   title and commit description.
2. **Automated Linter:** CI/CD workflows enforce that no test suite is modified
   without an associated requirement citation in `test_*.py` docstrings.
3. **No Phantom Requirements:** Requirements cannot be declared "done" via
   documentation alone; real reproducible test evidence must be committed to the
   evidence repository.

---

## 4. Emergency Hotfix & Break-Glass Protocol

In the event of a Critical Security Vulnerability (SEV-1) or active data breach:

1. **Emergency Waiver:** The CISO may authorize a temporary code fix bypassing
   the standard requirements review cycle for a maximum duration of **72
   hours**.
2. **Post-Incident Reconciliation:** Within 72 hours of hotfix deployment, a
   formal post-mortem, ADR, and retroactive requirement amendment must be
   committed to the repository.

---

## 5. Deliverable Sign-Off & Traceability

- **Contract Reference:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P03-requirements-engineering.md` §11
  (WS-03.5) and §22 (`DEL-ENT-P03-05`).
- **Predecessor Chain:** Enforces governance over `DEL-ENT-P03-01` through
  `DEL-ENT-P03-04`.
- **Handoff Target:** Establishes the governing change rules for Phase `ENT-P04`
  through `ENT-P21`.
