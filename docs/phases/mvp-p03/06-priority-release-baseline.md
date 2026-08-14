# MVP-P03 — 06. Priority & Release Baseline (DEL-MVP-P03-04)

> **MVP-P03 re-run 2026-08-14.** Baseline: repo `master` @ `23cc0b4` (pushed
> 0/0). MoSCoW across all requirements; counts verified against
> `03-requirements.md` (76 rows). Release baseline = P0+P1 for MVP; P2/P3 gated.
> BQ-06: user is sole approver.

## 1. MoSCoW summary

| Priority           | Count | Requirements                                                                                                               | Ship                                 |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **P0 (Must)**      | 57    | FR-01..03,05,10..13,30,31,35,40..42,50,51,60..62; NFR-04..07,10..13,15..20; FR-h52..h66,68,70; NFR-h15..17,20..22; AUTO-01 | MVP gate                             |
| **P1 (Should)**    | 16    | FR-04,20,21,22,33(review-first),43; NFR-01..03,21,22; FR-h67,69; NFR-h18,19; AUTO-03                                       | MVP (incl. T3 review-first proposal) |
| **P2 (Could)**     | 2     | FR-32 (T2 discovery — gated proposal), AUTO-02                                                                             | Post-MVP / legal gate (P13)          |
| **P3 (Won't now)** | 1     | FR-34 (T3 autopilot — gated proposal)                                                                                      | Post-MVP / legal+platform gate       |
| **Total**          | 76    | All requirement rows in `03-requirements.md`                                                                               | —                                    |

> Counts = rows in `03-requirements.md` by priority column. AUTO-03 counted once
> (P1 review-first; its autopilot sub-mode is P3 via FR-34). Corrigendum: the
> 2026-08-07 MoSCoW table (21/11/2/3) under-counted rows in the 2026-08-07
> requirements file; this re-run counts the actual rows.

## 2. Release baseline — MVP (P0+P1)

Release = cohort trial capability (VB-01..06, BQ-02-04 load 100/1,000):

- Full trust/approval UX (FR-50/51) + draft-only Gmail (FR-42) + erasure
  (FR-61/62)
- Ingest (resume parse ≥90%, FR-03) + 6-memory store (retrieval ≥80%, FR-10) +
  source-grounded facts (FR-11)
- Deadline extraction ≥90% (FR-41) + reminders (FR-43)
- ATS tailoring (FR-21/22) + application tracking (FR-30/35)
- T3 review-first ships as P1 (FR-33: draft → user edit → send) — proposal
  gated: send only on per-application user action with approval records
- T2 (FR-32) + T3 autopilot (FR-34) EXCLUDED from MVP — legal review (P13) +
  user re-confirmation before enablement; never default-ON (AUTO-02/03)
- P2/P3 items deferred behind gates (legal review, platform review)

## 3. Release-blocking rules (prompt §8 BQ-06)

- P0 items are release-blocking; P1 items are required for the MVP release.
- Only the user (sole approver) may change any priority, via approved change
  control (`07-change-control.md`).
- T2/T3 runtime activation is prohibited without user re-confirmation + legal
  review (P13) + operable kill switches (AUTO-02/03).
- No release claim without evidence (DoD) — docs ≠ runtime (RISK-MVP-P03-01).
