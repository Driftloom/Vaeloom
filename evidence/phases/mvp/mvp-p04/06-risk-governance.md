# MVP-P04 — 06. Risk & Governance Model (DEL-MVP-P04-04)

> Owner: Risk Owner · Baseline: master @ dac2630 (P03 CLOSED 2026-08-14) ·
> Status: APPROVED_BASELINE pending gate.

Reconciled and refreshed 2026-08-15 from the prior run
(`06-risk-governance-2026-08-07.md`) and the P03 re-run register
(`../mvp-p03/08-registers.md`, canonical carried register). Phase type:
DOCS-ONLY PLANNING. This is a risk burndown and decision-expiry model, not a
static register; per-phase snapshots live in `08-registers.md`.

## 2. Phase risk register (prompt §24)

The five P04 risks below are carried from prompt §24 verbatim (severity,
mitigation, owner) and opened as of this baseline. Each is re-scored at every
phase gate; severity moves only with evidence (see §4).

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
| --------------- | ------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------ |
| RISK-MVP-P04-01 | Docs mistaken for runtime completion | Critical | False readiness | Require runtime evidence/status labels at every implementation gate; docs carry no runtime claims (`NOT_EXECUTED` kept honest) | Phase owner | OPEN |
| RISK-MVP-P04-02 | Scope/permission/data/compatibility assumed | High | Leak/loss/rework | Block or reversible validated decision; BQ records; change control; no silent scope growth | Product/Architecture/Security | OPEN |
| RISK-MVP-P04-03 | External API/model/standard changes | High | Regression | Pin versions, tests, owner, kill switch (AUTO-01..03); compatibility tests | Integration/AI | OPEN |
| RISK-MVP-P04-04 | Evidence incomplete | High | Untrustworthy gate | Immutable reports + baseline; evidence plan; coverage/EVD reconciliations remain visible with sources | QA/Release | OPEN |
| RISK-MVP-P04-05 | MVP scope expansion | High | Delay/complexity | Strict scope gate; MoSCoW + release baseline; enterprise (T2/T3) proposals-only (DEC-P03-01) | Product | OPEN |

## 3. Carried risk summary (P03/P02)

Canonical carried register: `../../mvp-p03/08-registers.md` (§1 Risks). Statuses
carried OPEN as of P03 CLOSED 2026-08-14. RISK-MVP-P02-10/11 are CLOSED
(resolved at P03 via DEC-P03-04) and are not reopened here.

| ID | Risk | Severity | Carried status |
| --------------- | --------------------------------------------------------------------------------------- | -------- | ------------------------------- |
| RISK-MVP-P03-01 | Docs mistaken for runtime completion | Critical | OPEN |
| RISK-MVP-P03-02 | Scope/permission/data assumed | High | OPEN |
| RISK-MVP-P03-03 | External API/model/standard drift | High | OPEN |
| RISK-MVP-P03-04 | Evidence incomplete | High | OPEN |
| RISK-MVP-P03-05 | MVP scope expansion | High | OPEN |
| RISK-MVP-P03-06 | T3 auto-apply trust/account risk | High | OPEN |
| RISK-MVP-P03-07 | Cohort interviews still pending | Medium | OPEN |
| RISK-MVP-P02-12 | Google OAuth verification cost/limit at $0 budget | High | OPEN |
| RISK-MVP-P02-13 | Naukri partner program gate (no public API, commercial agreement required) | High | OPEN |
| RISK-MVP-P02-06 | Cohort unavailable → interviews stall | Medium | OPEN |
| RISK-MVP-P02-07 | Platform ToS action from Tier-2 read scraping | High | OPEN |
| RISK-MVP-P02-08 | Legal exposure from scraping (Proxycurl precedent, settled) | High | OPEN |
| RISK-MVP-P02-09 | Auto-apply quality/trust damage or account lockouts | Medium | OPEN |
| RISK-MVP-P02-15 | DPDP Rules 2025 in-force status verified but professional review required for any claim | High | OPEN |
| RISK-MVP-P02-10 | Coverage discrepancy 94% vs 97% — of record 94% | Medium | CLOSED/VERIFIED (do not reopen) |
| RISK-MVP-P02-11 | EVD row count stale (22 vs 25) | Low | CLOSED (do not reopen) |

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
- **Governance structure (preserved).** Gate chain P00 ✅ → P01 ✅ 88/100 → P02
 ✅ 88/100 → P03 ✅ 89.7/100 → P04 (this) → P05…P21; each gate = entry audit +
 weighted score + user ratification + restrictions + expiry. Change control
 (P03 §7) governs scope/permission/retention/provider/deployment changes;
 prohibited: weakening constraints or tests for a pass, unapproved T2/T3
 enablement, unproven compliance claims.
- **Kill switches & flags (preserved).**

| Flag | Owner | Default | Audit | Enables |
| ------------------------------- | ---------------- | ------- | -------------------------------------- | ------------------------------------- |
| AUTO-01 (T1 lawful automation) | Product | ON | Each gate | Polling watch, extract, draft, remind |
| AUTO-02 (T2 discovery scraping) | Platform | OFF | Pre-enablement legal review | Public listing discovery (P13 gate) |
| AUTO-03 (T3 auto-apply) | Product/Security | OFF | Pre-enablement legal + platform review | Review-first (P1) → autopilot (P3) |

## 5. Decision-expiry calendar

Each decision carries a review cadence and an expiry/revisit trigger. No
decision is treated as permanent without a scheduled re-check.

| Item | Decision ref | Owner | Review cadence | Expiry/revisit |
| ------------------------------------------------ | ------------------------------ | ----------------------- | ------------------------ | ------------------------------------------------- |
| Ship-window scenario | Q&A-4 (BQ-05, ship window TBD) | Program/Founder | Each gate until resolved | Revisit when cohort exists (UNK-P03-02, VB-07/08) |
| T2/T3 proposals-only (flag-gated, no default-ON) | DEC-P03-01 | User (sole approver) | Each gate | Revisit at P13 legal gate (UNK-P03-01) |
| Baseline pin master @ dac2630 | Baseline pin (BQ-02) | Engineering/Phase owner | Each gate | Expires at P05 gate review; re-pin then |
| Requirements baseline APPROVED_BASELINE | DEC-P03-03 | Phase owner/Product | Each gate | Change control; binds P04+ until changed |
| Coverage 94%-of-record | DEC-P03-04 | QA/Release | Each gate | Re-anchor at P13/P14 (re-measure against runtime) |

## 6. Assumption/UNK calendar

Honest UNKNOWN statuses; each has an owner, a due phase and an unlock trigger.
Blocked items gate downstream work until triggered.

| Item | Status | Owner | Due phase | Trigger |
| --------------------------------------------- | --------------- | ------------------ | --------- | -------------------------------------------------------------------------------------- |
| Cohort VB-07/08 (interviews + eval corpus) | UNKNOWN/BLOCKED | USER | P04/P20 | Cohort signup; unlocks R-2 interviews (VB-07) + synthetic email corpus consent (VB-08) |
| UNK-P02-05 Naukri partner cost/access | UNKNOWN | Product/Platform | P04/P08 | Partnership cost/access confirmation before job-platform surface decision |
| UNK-P02-02 Gmail quota at cohort scale | UNKNOWN | Connector/Platform | P07 | Measured at P07 (data architecture) with quota/compat tests |
| UNK-P02-03 Google OAuth verification timeline | UNKNOWN | Product/Platform | P19 | Verification timeline before real-auth cutover (mock P02–P18, ASP-P02-01) |
| UNK-P02-01 DPDP Rules force status final | UNKNOWN | Legal/Compliance | P13 | Professional review at P13; design-to-both in force meanwhile (ASP-P03-02) |
| UNK-P03-01 T2/T3 legal outcome | UNKNOWN | Legal | P13 | Legal-review gate before T2/T3 default-ON |
| UNK-P03-02 Cohort availability timeline | UNKNOWN | USER/UX | P04/P20 | Cohort timeline confirmed before interviews/cutover planning |

## 7. Exception governance

- Every exception/waiver requires: an owner, explicit controls, an approver
 (USER, sole gate authority), an expiry, monitoring and a statement of
 prohibited downstream work.
- Waivers auto-expire at the next gate; renewal requires re-approval. **No
 expired waiver may continue** — the entry audit checks this at every gate
 (confirmed PASS at P03 re-run 2026-08-14).
- Exceptions never lower mandatory-blocker thresholds. A waiver may not be used
 to weaken constraints or tests to produce a pass (prompt §28; change-control
 prohibition preserved).

## 8. Evidence

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------- | ---------------- | ------------------------------ | ---------- | ----------- |
| EVD-MVP-P04-041 | P04 phase risk register (RISK-MVP-P04-01..05) sourced from prompt §24 with severity, impact, mitigation, owner and status OPEN | MVP-P04-R03 | SOURCE_DERIVED | This file, §2 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-042 | Carried risk register reconciled with P03 canonical register (`../mvp-p03/08-registers.md`): RISK-MVP-P03-01..07 and RISK-MVP-P02-06..09/12/13/15 OPEN; RISK-MVP-P02-10/11 CLOSED and not reopened | MVP-P04-R03 | SOURCE_DERIVED | This file, §3 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-043 | Risk burndown mechanics (gate re-scoring, evidence-only severity moves, decision-expiry reviews, kill switches AUTO-01..03) and decision/assumption/UNK calendars defined with owners, due phases and triggers | MVP-P04-R04 | NEW_DESIGN | This file, §4–§6 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-044 | Exception/waiver governance defined (owner, controls, approver USER, expiry, monitoring, prohibited downstream work; no expired waiver continues; never lowers mandatory-blocker thresholds) | MVP-P04-R04 | NEW_DESIGN | This file, §7 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
