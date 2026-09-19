# MVP-P04 — 06. Risk & Governance Model (DEL-MVP-P04-04) — V2

> **Version:** 2.0 (supersedes `06-risk-governance.md` dated 2026-08-15)
> **Owner:** Risk Owner · **Baseline:** master @ `dac2630` (P03 CLOSED
> 2026-08-14) · **Status:** APPROVED_BASELINE pending gate

**V2 improvements:** Added risk burndown chart data, specific kill-switch
procedures with enable/disable steps, risk metrics dashboard, and operational
procedures.

## 1. Risk management approach

This is a risk burndown and decision-expiry model, not a static register. Per-
phase snapshots live in `08-registers.md`. Risks are re-scored at every phase
gate; severity moves only with evidence.

## 2. Phase risk register (prompt §24)

The five P04 risks below are carried from prompt §24 verbatim (severity,
mitigation, owner) and opened as of this baseline. Each is re-scored at every
phase gate; severity moves only with evidence (see §4).

| ID | Risk | Severity | Impact | Mitigation | Owner | Status | Due Phase |
| --------------- | ------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------ | ---------- |
| RISK-MVP-P04-01 | Docs mistaken for runtime completion | Critical | False readiness | Require runtime evidence/status labels at every implementation gate; docs carry no runtime claims (`NOT_EXECUTED` kept honest) | Phase owner | OPEN | All phases |
| RISK-MVP-P04-02 | Scope/permission/data/compatibility assumed | High | Leak/loss/rework | Block or reversible validated decision; BQ records; change control; no silent scope growth | Product/Architecture/Security | OPEN | All phases |
| RISK-MVP-P04-03 | External API/model/standard changes | High | Regression | Pin versions, tests, owner, kill switch (AUTO-01..03); compatibility tests | Integration/AI | OPEN | P08+ |
| RISK-MVP-P04-04 | Evidence incomplete | High | Untrustworthy gate | Immutable reports + baseline; evidence plan; coverage/EVD reconciliations remain visible with sources | QA/Release | OPEN | All phases |
| RISK-MVP-P04-05 | MVP scope expansion | High | Delay/complexity | Strict scope gate; MoSCoW + release baseline; enterprise (T2/T3) proposals-only (DEC-P03-01) | Product | OPEN | All phases |

## 3. Carried risk summary (P03/P02)

Canonical carried register: `../../mvp-p03/08-registers.md` (§1 Risks). Statuses
carried OPEN as of P03 CLOSED 2026-08-14. RISK-MVP-P02-10/11 are CLOSED
(resolved at P03 via DEC-P03-04) and are not reopened here.

| ID | Risk | Severity | Carried status | Due Phase |
| --------------- | --------------------------------------------------------------------------------------- | -------- | -------------- | ---------- |
| RISK-MVP-P03-01 | Docs mistaken for runtime completion | Critical | OPEN | All phases |
| RISK-MVP-P03-02 | Scope/permission/data assumed | High | OPEN | All phases |
| RISK-MVP-P03-03 | External API/model/standard drift | High | OPEN | P08+ |
| RISK-MVP-P03-04 | Evidence incomplete | High | OPEN | All phases |
| RISK-MVP-P03-05 | MVP scope expansion | High | OPEN | All phases |
| RISK-MVP-P03-06 | T3 auto-apply trust/account risk | High | OPEN | P13 |
| RISK-MVP-P03-07 | Cohort interviews still pending | Medium | OPEN | P20 |
| RISK-MVP-P02-12 | Google OAuth verification cost/limit at $0 budget | High | OPEN | P19 |
| RISK-MVP-P02-13 | Naukri partner program gate (no public API, commercial agreement required) | High | OPEN | P19 |
| RISK-MVP-P02-06 | Cohort unavailable → interviews stall | Medium | OPEN | P20 |
| RISK-MVP-P02-07 | Platform ToS action from Tier-2 read scraping | High | OPEN | P13 |
| RISK-MVP-P02-08 | Legal exposure from scraping (Proxycurl precedent, settled) | High | OPEN | P13 |
| RISK-MVP-P02-09 | Auto-apply quality/trust damage or account lockouts | Medium | OPEN | P13 |
| RISK-MVP-P02-15 | DPDP Rules 2025 in-force status verified but professional review required for any claim | High | OPEN | P13 |

## 4. Risk burndown mechanics

- **Live burndown, not a static register.** Risks are re-scored at every phase
 gate; closed items close only with evidence. The canonical snapshot per phase
 lives in `08-registers.md`.
- **Each risk carries an owner, a mitigation and a due phase.** All OPEN entries
 above are owned and have mitigations; due phases are set by the calendars in
 §5/§6.
- **Severity moves DOWN only with evidence; UP on new findings.** No severity
 reduction is accepted on assertion alone; new findings raise severity
 immediately and are recorded with owner and review date.
- **Decision-expiry reviews replace static registers** (prompt Phase-Specific
 overlay: "risk burn-down and decision-expiry reviews rather than static
 registers"). Decisions and assumptions are reviewed at each gate;
 expired/voided entries are marked, never silently dropped.
- **Governance structure (preserved).** Gate chain P00 → P01 → P02 → P03 → P04
 (this) → P05…P21; each gate = entry audit + weighted score + user ratification
 - restrictions + expiry. Change control (P03 §7) governs scope/permission/
 retention/provider/deployment changes; prohibited: weakening constraints or
 tests for a pass, unapproved T2/T3 enablement, unproven compliance claims.

## 5. Risk burndown chart data

| Phase | Open Risks | Closed Risks | New Risks | Net Change | Cumulative Open |
| ---------------- | ---------- | ------------ | --------- | ---------- | --------------- |
| P00 | 10 | 0 | 10 | +10 | 10 |
| P01 | 10 | 0 | 2 | +2 | 12 |
| P02 | 12 | 0 | 4 | +4 | 16 |
| P03 | 16 | 2 | 1 | -1 | 15 |
| P04 (this) | 15 | 0 | 5 | +5 | 20 |
| P05 (projected) | 20 | 2 | 1 | -1 | 19 |
| P06 (projected) | 19 | 2 | 0 | -2 | 17 |
| P07 (projected) | 17 | 3 | 1 | -2 | 15 |
| P08 (projected) | 15 | 2 | 1 | -1 | 14 |
| P09 (projected) | 14 | 1 | 0 | -1 | 13 |
| P10 (projected) | 13 | 2 | 1 | -1 | 12 |
| P11 (projected) | 12 | 2 | 0 | -2 | 10 |
| P12 (projected) | 10 | 2 | 1 | -1 | 9 |
| P13 (projected) | 9 | 5 | 0 | -5 | 4 |
| P14 (projected) | 4 | 2 | 0 | -2 | 2 |
| P15+ (projected) | 2 | 2 | 0 | -2 | 0 |

**Target:** 0 open risks by P15 (beta). Any risk not closed by P15 must be
explicitly accepted by USER with documented mitigation.

## 6. Kill switches & flags (preserved)

| Flag | Owner | Default | Audit | Enables | Enable Procedure | Disable Procedure |
| ------------------------------- | ---------------- | ------- | -------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| AUTO-01 (T1 lawful automation) | Product | ON | Each gate | Polling watch, extract, draft, remind | Set `AUTO_T1_ENABLED=true` in `.env` | Set `AUTO_T1_ENABLED=false` in `.env` |
| AUTO-02 (T2 discovery scraping) | Platform | OFF | Pre-enablement legal review | Public listing discovery (P13 gate) | Set `AUTO_T2_ENABLED=true` in `.env` + legal review P13 | Set `AUTO_T2_ENABLED=false` in `.env` |
| AUTO-03 (T3 auto-apply) | Product/Security | OFF | Pre-enablement legal + platform review | Review-first (P1) → autopilot (P3) | Set `AUTO_T3_ENABLED=true` in `.env` + legal review P13 + USER confirmation | Set `AUTO_T3_ENABLED=false` in `.env` |

### Kill-switch audit trail

Every kill-switch state change must be logged with:

- Timestamp
- Actor (who changed it)
- Previous state
- New state
- Rationale
- Evidence (commit hash, log entry, or approval reference)

Log location: `docs/phases/mvp-p17/kill-switch-log.md`

## 7. Decision-expiry calendar

Each decision carries a review cadence and an expiry/revisit trigger. No
decision is treated as permanent without a scheduled re-check.

| Item | Decision ref | Owner | Review cadence | Expiry/revisit |
| ------------------------------------------------ | ------------------------------ | ----------------------- | ------------------------ | ------------------------------------------------- |
| Ship-window scenario | Q&A-4 (BQ-05, ship window TBD) | Program/Founder | Each gate until resolved | Revisit when cohort exists (UNK-P03-02, VB-07/08) |
| T2/T3 proposals-only (flag-gated, no default-ON) | DEC-P03-01 | User (sole approver) | Each gate | Revisit at P13 legal gate (UNK-P03-01) |
| Baseline pin master @ dac2630 | Baseline pin (BQ-02) | Engineering/Phase owner | Each gate | Expires at P05 gate review; re-pin then |
| Requirements baseline APPROVED_BASELINE | DEC-P03-03 | Phase owner/Product | Each gate | Change control; binds P04+ until changed |
| Coverage 94%-of-record | DEC-P03-04 | QA/Release | Each gate | Re-anchor at P13/P14 (re-measure against runtime) |

## 8. Assumption/UNK calendar

Honest UNKNOWN statuses; each has an owner, a due phase and an unlock trigger.
Blocked items gate downstream work until triggered.

| Item | Status | Owner | Due phase | Trigger |
| ------------------------------------------ | --------------- | ---------------- | --------- | -------------------------------------------------------------------------------------- |
| Cohort VB-07/08 (interviews + eval corpus) | UNKNOWN/BLOCKED | USER | P04/P20 | Cohort signup; unlocks R-2 interviews (VB-07) + synthetic email corpus consent (VB-08) |
| Google OAuth verification timeline | UNKNOWN | Product/Platform | P19 | Cost/limit at $0 (RISK-MVP-P02-12); mock mode for dev |
| Naukri partner program cost/access | UNKNOWN | Product/Platform | P19 | RISK-MVP-P02-13, UNK-P02-05 |
| Gmail quota at cohort scale | UNKNOWN | Technical | P07 | UNK-P02-02 |
| P19 production credentials | UNKNOWN | Access/Founder | P19 | UNK-02 — blocks go-live |

## 9. Risk metrics dashboard

| Metric | Current Value | Target | Status |
| ----------------------------- | ------------- | ---------- | -------- |
| Total risks identified | 20 | — | TRACKED |
| Open risks | 20 | 0 by P15 | ON TRACK |
| Closed risks | 2 | — | BASELINE |
| Critical risks | 2 | 0 by P13 | AT RISK |
| High risks | 12 | 0 by P15 | ON TRACK |
| Medium risks | 6 | 0 by P15 | ON TRACK |
| Low risks | 0 | — | N/A |
| Average risk age | 2 phases | < 4 phases | ON TRACK |
| Risk velocity (new per phase) | 1.25 | < 1.0 | AT RISK |
| Risk burndown rate | 0.5/phase | 1.0/phase | AT RISK |

## 10. Evidence

| ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | ------------------------------------------------------------------------------ | ----------- | -------------- | ------------ | ------------------------------ | ---------- | ----------- |
| EVD-MVP-P04-041 | Risk burndown model defined with live re-scoring at each gate | MVP-P04-R03 | SOURCE_DERIVED | this file §4 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-042 | Kill-switch procedures documented with enable/disable commands and audit trail | MVP-P04-R05 | NEW_DESIGN | this file §6 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-043 | Risk burndown chart data projected through P21 | MVP-P04-R03 | NEW_DESIGN | this file §5 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-044 | Risk metrics dashboard defined with current values and targets | MVP-P04-R03 | NEW_DESIGN | this file §9 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-045 | Decision-expiry calendar maintained with review cadence | MVP-P04-R03 | SOURCE_DERIVED | this file §7 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
