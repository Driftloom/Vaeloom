# MVP-P03 — 07. Change Control (DEL-MVP-P03-05)

> **MVP-P03 re-run 2026-08-14.** Baseline: repo `master` @ `23cc0b4` (pushed
> 0/0). Rules per prompt §24 + gate policy. Applies to: approved scope,
> contracts, permissions, retention, DPA, provider/model, deployment, gates.
> Approver: user (sole approver, BQ-01/BQ-06).

## 1. Change types

| Type | Example | Authority | Process |
| --------------------- | -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| Scope change | Add/remove requirement, persona, feature | User (sole approver) | RFC with rationale, impact, reviewers, migration, tests, rollout, rollback |
| Baseline change | Repo revision, env, dependency versions | Engineering + user sign-off | Record new baseline; re-run affected validation |
| Permission change | New connector, scope broadening (e.g., send scope, T2/T3 enablement) | User + Security/Privacy reviewer | Threat review; consent; kill switch; audit |
| Retention change | Retention window, purpose-based retention policy | User + Privacy reviewer | Data lifecycle review |
| DPA change | Provider data-processing config, raw-content egress | User + Privacy reviewer | Data lifecycle review; egress minimization check |
| Provider/model change | LLM provider or model swap | User + AI reviewer | Version pin; eval re-run (NFR-18); regression |
| Gate/waiver | Conditional approval, exception | User | Owner, controls, approvers, expiry, monitoring, prohibited downstream work |

## 2. Required fields for any change

Rationale · impact (scope/cost/schedule/risk) · reviewers · migration plan ·
tests · rollout · rollback · owner · date · status.

## 3. Prohibited without approval

- Weakening constraints or tests to create a pass (prompt §13)
- Enabling T2/T3 automation defaults (AUTO-02/03) without legal review (P13),
 user re-confirmation, and operable kill switches
- Claiming compliance/security/scale without evidence
- Production changes without authority, backup, rollback, monitoring, approver
