# MVP-P03 — 06. Priority & Release Baseline (DEL-MVP-P03-04)

> **MVP-P03 re-run 2026-08-14, upgraded 2026-08-16.** Baseline: repo `master` @
> `23cc0b4` (pushed 0/0). MoSCoW across all requirements; counts verified
> against `03-requirements.md` (91 rows — 76 original + 15 gap requirements).
> Release baseline = P0+P1 for MVP; P2/P3 gated. BQ-06: user is sole approver.
> **Implementation status verified 2026-08-16** via zero-trust codebase audit.

## 1. MoSCoW summary

| Priority           | Count | Requirements                                                                                                                               | Ship                                 |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **P0 (Must)**      | 64    | FR-01..03,05,10..13,30,31,35,40..42,50,51,60..62,71..75,82,83,85; NFR-04..07,10..13,15..20; FR-h52..h66,68,70; NFR-h15..17,20..22; AUTO-01 | MVP gate                             |
| **P1 (Should)**    | 22    | FR-04,20,21,22,33(review-first),43,76,77,79,80,81,84; NFR-01..03,21,22; FR-h67,69; NFR-h18,19; AUTO-03                                     | MVP (incl. T3 review-first proposal) |
| **P2 (Could)**     | 3     | FR-32 (T2 discovery — gated proposal), FR-78, AUTO-02                                                                                      | Post-MVP / legal gate (P13)          |
| **P3 (Won't now)** | 1     | FR-34 (T3 autopilot — gated proposal)                                                                                                      | Post-MVP / legal+platform gate       |
| **P3 (gated)**     | 1     | AUTO-03 (autopilot sub-mode)                                                                                                               | Post-MVP / legal+platform gate       |
| **Total**          | 91    | All requirement rows in `03-requirements.md` (76 original + 15 gap)                                                                        | —                                    |

> Counts = rows in `03-requirements.md` by priority column. Gap requirements
> (FR-71..FR-85) added 2026-08-16 from zero-trust codebase audit. AUTO-03
> counted once at P1 (review-first); its autopilot sub-mode is P3 via FR-34.

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
- **Gap requirements P0 (MUST FIX before MVP release):** FR-71
  (TenantMiddleware), FR-72 (IP Allowlist), FR-73 (RLS coverage), FR-74 (SET
  app.tenant_id), FR-75 (RBAC consistency), FR-82 (tenant_id coverage), FR-85
  (Makefile fixes)

## 3. Implementation status (zero-trust audit 2026-08-16)

| Impl Status            | Count | % of Total | Notes                                                |
| ---------------------- | ----- | ---------- | ---------------------------------------------------- |
| IMPLEMENTED            | 3     | 3.3%       | FR-50, NFR-06, NFR-h17                               |
| IMPLEMENTED_UNVERIFIED | 28    | 30.8%      | Code exists but not verified end-to-end              |
| PARTIAL                | 18    | 19.8%      | Partially implemented; gaps documented               |
| NOT_IMPLEMENTED        | 9     | 9.9%       | Code exists but not wired/mounted, or no code        |
| DESIGN_ONLY            | 5     | 5.5%       | Design documented, zero code                         |
| STUB                   | 1     | 1.1%       | Partial implementation with TODOs                    |
| TBD_AT_IMPL (original) | 27    | 29.7%      | Original requirements awaiting implementation phases |

**Critical finding:** 7 P0 requirements are NOT_IMPLEMENTED or PARTIAL with
critical security impact (FR-71..75, FR-82, FR-85). These block MVP release if
not fixed.

## 4. Release-blocking rules (prompt §8 BQ-06)

- P0 items are release-blocking; P1 items are required for the MVP release.
- Only the user (sole approver) may change any priority, via approved change
  control (`07-change-control.md`).
- T2/T3 runtime activation is prohibited without user re-confirmation + legal
  review (P13) + operable kill switches (AUTO-02/03).
- No release claim without evidence (DoD) — docs ≠ runtime (RISK-MVP-P03-01).
- **NEW 2026-08-16:** Gap requirements FR-71..85 are release-blocking for their
  respective priorities; P0 gaps must be fixed before any MVP release claim.
