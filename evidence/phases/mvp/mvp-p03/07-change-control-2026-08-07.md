# MVP-P03 — 07. Change Control (DEL-MVP-P03-05)

> Rules per prompt §24 + gate policy. Applies to: approved scope, contracts,
> permissions, retention, provider/model, deployment, gates.

## 1. Change types

| Type | Example | Authority | Process |
| --------------------- | -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| Scope change | Add/remove requirement, persona, feature | User (sole approver) | RFC with rationale, impact, reviewers, migration, tests, rollout, rollback |
| Baseline change | Repo revision, env, dependency versions | Engineering + user sign-off | Record new baseline; re-run affected validation |
| Permission change | New connector, scope broadening (e.g., send scope, T2/T3 enablement) | User + Security/Privacy reviewer | Threat review; consent; kill switch; audit |
| Retention/DPA change | Retention window, provider config | User + Privacy reviewer | Data lifecycle review |
| Provider/model change | LLM provider or model swap | User + AI reviewer | Version pin; eval re-run (NFR-18); regression |
| Gate/waiver | Conditional approval, exception | User | Owner, controls, approvers, expiry, monitoring, prohibited downstream work |

## 2. Required fields for any change

Rationale · impact (scope/cost/schedule/risk) · reviewers · migration plan ·
tests · rollout · rollback · owner · date · status.

## 3. Prohibited without approval

- Weakening constraints or tests to create a pass (prompt §13)
- Enabling T2/T3 automation defaults without legal review + kill switches
- Claiming compliance/security/scale without evidence
- Production changes without authority, backup, rollback, monitoring, approver
