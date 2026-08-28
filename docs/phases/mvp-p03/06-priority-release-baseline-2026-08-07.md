# MVP-P03 — 06. Priority & Release Baseline (DEL-MVP-P03-04)

> MoSCoW across all requirements; release baseline = P0+P1 for MVP; P2/P3 gated.

## 1. MoSCoW summary

| Priority | Count | Requirements | Ship |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **P0 (Must)** | 21 | FR-01..05, 10..13, 30,31,35, 40..42, 50,51, 60..62; NFR-04..07, 10..13, 15..20; FR-h52,60..66,68,70; NFR-h15..17,20,21,22 | MVP gate |
| **P1 (Should)** | 11 | FR-04,20,21,22,33(review-first),43; NFR-01,02,03,21,22; FR-h67,69; NFR-h18,19 | MVP (review-first T3) |
| **P2 (Could)** | 2 | FR-32 (T2 discovery, AUTO-02 gated), US-20 | Post-MVP / legal gate |
| **P3 (Won't now)** | 3 | FR-34 (autopilot, AUTO-03), US-22, enterprise items | Post-MVP / legal+platform gate |

## 2. Release baseline — MVP (P0+P1)

Release = cohort trial capability (VB-01..06, BQ-02-04 load 100/1,000):

- Full trust/approval UX (FR-50/51) + draft-only Gmail (FR-42) + erasure
 (FR-61/62)
- Ingest (resume parse ≥90%) + 6-memory store (retrieval ≥80%) + source-grounded
 facts
- Deadline extraction ≥90% (FR-41) + reminders (FR-43)
- ATS tailoring (FR-21/22) + application tracking (FR-30/35)
- T3 review-first mode ships as P1 (draft → user edits → send)
- T2/T3-autopilot EXCLUDED from MVP (legal review + gates before enablement)

## 3. Release-blocking rules (prompt §8 BQ-06)

- P0 items are release-blocking; only user (sole approver) may change priority
 via approved change control (`07-change-control.md`).
- No release claim without evidence (DoD) — docs ≠ runtime.
