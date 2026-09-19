# MVP-P04 — 05. RACI & Approval Matrix (DEL-MVP-P04-03)

> Owner: Program Manager · Prompt §4. R = Responsible, A = Accountable, C =
> Consulted, I = Informed.

## 1. Roles (activated)

| Role | Who | Authority |
| -------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| Program Manager | AI agent (phase executor) | Runs phase execution; gate reporting |
| Product Manager | AI agent | Requirements integrity; scope gate |
| Engineering Manager | AI agent | Implementation; dependency control |
| Release Manager | AI agent | Release evidence; P19 gate |
| FinOps Specialist | AI agent | $0 budget guardrails; cost scenarios |
| Risk Owner | AI agent | Risk burndown; exception registry |
| **Sole approver** | **User** | All gates, changes, exceptions, enablement (BQ-01) |
| Reviewers (veto on mandatory blockers) | Security/Privacy/Data/A11y/Ops (AI agents + user) | Veto on blockers per INT-02 |

## 2. RACI matrix

| Activity | Program | Product | Engineering | Release | FinOps | Risk | User |
| ----------------------------- | ---------- | ------- | ----------- | ------- | ------ | ----------- | ----- |
| Phase entry audit | A | C | C | I | I | C | A |
| Scope/requirements baseline | C | A | C | I | I | C | A |
| Architecture/design decisions | I | C | A | I | I | C | A |
| Implementation | I | C | A | I | I | I | I |
| Test/QA evidence | C | C | R | C | I | I | A |
| Security/privacy review | I | C | C | I | I | A (veto) | A |
| Risk register/burndown | C | C | C | C | C | A | A |
| Budget/cost guardrail | C | C | C | C | A | C | A |
| Change control | C | A | C | C | I | C | **A** |
| Gate decision | R (report) | C | C | C | I | C | **A** |
| Exception/waiver | C | C | C | C | I | A (propose) | **A** |
| Release/go-live | C | C | R | A | C | C | **A** |

## 3. Approval rules

- **User approves:** phase gates, scope changes, permissions/connectors,
 retention/ DPA, provider/model swaps, deployment, exceptions, T2/T3 enablement
 (change control §7 of P03).
- **Reviewer veto:** Security/Privacy/Data/A11y/Operations block on mandatory
 blockers (INT-02 §1) — no override without user decision.
- **Approval contract (FR-50/51):** consequential actions = immutable,
 payload-bound, expiring, replay-safe approvals — applies to product actions
 AND to this delivery itself (documented approval = gate record).
- **No single agent self-approves** — gates require user ratification.

## 4. Cadence

| Forum | Cadence | Participants | Output |
| ---------------------------- | ------------- | ----------------- | --------------------------- |
| Phase gate review | per phase end | Executor + user | Gate decision, restrictions |
| Risk burndown | per phase | Risk Owner + user | Updated register |
| Exception review | on expiry | User | Renew/extend/close |
| Decision/assumption calendar | per phase | Program | Register updates |
