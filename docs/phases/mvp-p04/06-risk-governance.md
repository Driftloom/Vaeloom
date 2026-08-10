# MVP-P04 — 06. Risk & Governance Model (DEL-MVP-P04-04)

> Owner: Risk Owner · Prompt §4. Risk burndown, not a static register. Live
> register: `08-registers.md` (per-phase snapshots).

## 1. Governance structure

- **Gate chain:** P00 ✅ → P01 ✅ 88/100 → P02 ✅ 88/100 → P03 ✅ 88/100
  (ratified) → P04 (this) → P05…P21. Each gate = entry audit + weighted score +
  user ratification + restrictions + expiry.
- **Change control:** P03 §7 rules govern scope/permission/retention/provider/
  deployment changes. Prohibited: weakening constraints/tests for a pass,
  unapproved T2/T3 enablement, unproven compliance claims.
- **Risk burndown:** every phase gate re-scores OPEN risks; items closed only
  with evidence; new risks added with owner + mitigation + review date.
- **Decision/assumption calendar:** decisions (DEC-_) and assumptions (ASP-_)
  reviewed at each gate; expired/voided entries marked, never silently dropped.

## 2. Top risks (carried + phase-specific)

| ID          | Risk                                                 | Sev  | Mitigation                                                               | Owner            | Review    |
| ----------- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------ | ---------------- | --------- |
| RISK-P03-01 | Docs mistaken for runtime completion                 | CRIT | Runtime evidence at every impl gate; status labels                       | Phase owner      | Each gate |
| RISK-P03-02 | Scope/permission/data assumed                        | HIGH | BQ records; change control; no silent scope growth                       | Product/Security | Each gate |
| RISK-P03-03 | External API/model/standard drift                    | HIGH | Pins, versions, owners, kill switches                                    | Integration/AI   | Each gate |
| RISK-P03-04 | Evidence incomplete                                  | HIGH | Immutable reports + baseline commits                                     | QA/Release       | Each gate |
| RISK-P03-05 | MVP scope expansion                                  | HIGH | MoSCoW baseline; enterprise out of critical path                         | Product          | Each gate |
| RISK-P04-01 | Repo maturity misread → rework or false-ready claims | HIGH | P05 reconciliation with runtime inventory; treat repo as source of truth | Engineering      | P05       |
| RISK-P04-02 | $0 budget breach via paid APIs (LLM/vector/search)   | MED  | FinOps guardrail; free tiers; spend log (DEC-P01-07)                     | FinOps           | Each gate |
| RISK-P04-03 | Single-approver bottleneck (user)                    | MED  | Batch gates; decision tooling; clear restrictions                        | Program          | Each gate |
| RISK-P04-04 | Cohort unavailable for validation                    | MED  | Proxy evidence; early signup push (VB-07)                                | UX               | P20       |

## 3. Kill switches & flags

| Flag                            | Owner            | Default | Audit                                  | Enables                               |
| ------------------------------- | ---------------- | ------- | -------------------------------------- | ------------------------------------- |
| AUTO-01 (T1 lawful automation)  | Product          | ON      | Each gate                              | Polling watch, extract, draft, remind |
| AUTO-02 (T2 discovery scraping) | Platform         | OFF     | Pre-enablement legal review            | Public listing discovery (P13 gate)   |
| AUTO-03 (T3 auto-apply)         | Product/Security | OFF     | Pre-enablement legal + platform review | Review-first (P1) → autopilot (P3)    |

## 4. Exception/waiver rules (prompt §28)

Exception = owner, controls, approvers, expiry, monitoring, prohibited
downstream work. Waivers auto-expire at next gate; renewal needs re-approval. No
expired waiver may silently continue (entry audit checks this — PASS confirmed
2026-08-07).
