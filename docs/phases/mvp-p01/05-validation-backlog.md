# MVP-P01 — 05. Validation Backlog (WS-01.5)

> Every experiment below carries: problem/evidence it tests, target users,
> dependencies, security/privacy/data implications, cost, validation trigger,
> owner, and rejection condition. Backlog items are hypotheses — not
> commitments.

## Backlog

| ID    | Experiment                      | Tests (JTBD/problem)                 | Method                                                                          | Dependencies                                  | Security/privacy/data                                                 | Adoption trigger                     | Owner      | Reject if                             |
| ----- | ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ | ---------- | ------------------------------------- |
| VB-01 | Deadline-miss reduction trial   | PS-01 (missed deadlines)             | Cohort: N weeks with Gmail draft-only deadline extraction + scheduler reminders | P12+ implementation; Gmail connector approved | Draft-only; no email content stored without consent; retention policy | Cohort ≥ design-partner N (D-P01-01) | Product/UX | Deadline-miss rate not below baseline |
| VB-02 | Repeat-input reduction trial    | PS-02 (memory value)                 | Telemetry: duplicate-entry events/user/week; user-verified                      | Memory/Organization agents; eval set          | Workspace-scoped; deletion exercised                                  | Memory quality metrics pass (P12)    | Product    | No decline after adoption             |
| VB-03 | Trust/approval UX study         | PS-03 (trust blocks adoption)        | Moderated study of approval + deletion flows; drop-off analysis                 | P13 approval UX; draft-only enforced          | Consent-first; payload-bound approval                                 | Approval contract verified (P05/13)  | Privacy/UX | Trust events correlate with churn     |
| VB-04 | Application-status completeness | JTBD "apply only where worth it"     | Cohort self-reports vs. ATS records                                             | ATS agent; official integrations only         | No unsupported automation                                             | ATS value metrics                    | Product    | Records incomplete/buggy              |
| VB-05 | Delete-completeness exercise    | "Know my data is safe and deletable" | User requests deletion; verify purge across system-of-record + projections      | Deletion lifecycle (P13)                      | Core privacy control                                                  | Legal review date                    | Privacy    | Purge incomplete                      |
| VB-06 | Resume value check              | JTBD "career docs current"           | Before/after resume-quality + prep-time measure                                 | Resume agent                                  | User-owned docs only                                                  | Organization agent stable            | Product    | No prep-time saving                   |

## Deferred enterprise ideas (governed backlog — not MVP scope)

| Idea                         | Adoption trigger                   | Owner         | Sunset/rejection                                   |
| ---------------------------- | ---------------------------------- | ------------- | -------------------------------------------------- |
| Institution admin + SSO/SCIM | Post-MVP enterprise track decision | Enterprise    | Not in MVP; reject if scope pressure (RISK-P00-10) |
| Billing/marketplace          | Separate enterprise decision       | Enterprise    | Not in MVP                                         |
| Multi-region tenant cells    | Post-launch scale evidence         | Platform      | Not in MVP                                         |
| Cross-user memory            | Explicit privacy review + legal    | Privacy/Legal | Not in MVP — isolation-tested single-user          |

## Leading indicators & stop/pivot (feed BQ-06 once user decides)

Draft candidates for BQ-06 (user to approve/reject):

- **Stop:** cohort churn > X% driven by trust events (unclear approvals, hard
  deletion) with no fix in N releases.
- **Pivot:** no repeat-input reduction after adoption (memory value absent) →
  reconsider memory-first wedge.
- **Pivot:** deadline extraction accuracy below threshold → narrow to
  document-focused wedge.
