# MVP-P03 — 05. Traceability Matrix (DEL-MVP-P03-03)

> **MVP-P03 re-run 2026-08-14.** Baseline: repo `master` @ `23cc0b4`. Prior P03
> run 2026-08-07 superseded; historical files preserved as `*-2026-08-07.md`.
> Source → requirement → story → design/tests → evidence location → owner.
> Design/tests/evidence columns filled at implementation phases (P07+); P03
> records the mapping contract (prompt §23: trace, don't assume). Evidence
> location stays `TBD_AT_IMPL` until the implementing phase fills it — no
> invented results.

## Legend

- **Source:** INT-02 / INT-05 / prompt §N / P0x evidence / user decision
  (BQ/DEC)
- **Owner:** BA / Security / Privacy / AI / QA / Platform / UX / Product /
  Architecture
- **Design (phase):** P07 data · P08 auth/API · P09 UX · P12 AI/memory · P13
  security/a11y/eval · P14 testing · P15 perf
- **Tests (phase):** phase that owns the test activity; results land at the
  Evidence location

| Source                   | Requirement                                                        | Story       | Design (phase)     | Tests (phase)           | Evidence    | Owner            |
| ------------------------ | ------------------------------------------------------------------ | ----------- | ------------------ | ----------------------- | ----------- | ---------------- |
| INT-02 §2; P01           | FR-01 signup + consent                                             | US-01       | P07 data; P08 auth | P13 auth/consent        | TBD_AT_IMPL | Security         |
| INT-02 §2; P02 WS-02.3   | FR-02/03 profile + resume parse ≥90%                               | US-02       | P07                | P12/13 eval (BQ-P02-03) | TBD_AT_IMPL | AI/BA            |
| INT-02 §2; FR-h68        | FR-05 correction supersession                                      | US-02       | P07                | P13                     | TBD_AT_IMPL | AI               |
| BQ-P02-03                | FR-04/41 extraction ≥90%                                           | US-03/10    | P07                | P13 eval suite          | TBD_AT_IMPL | AI               |
| INT-02 §2; BQ-P02-01/03  | FR-10/11/12 memory (6 types, grounding, versioning, hit-rate ≥80%) | US-02/10/14 | P12                | P13 eval suite          | TBD_AT_IMPL | AI               |
| OWASP LLM Top 10; FR-h70 | FR-13 untrusted content cannot change policy/approval              | US-05       | P12                | P13 injection suite     | TBD_AT_IMPL | Security         |
| INT-02 §4                | FR-20 org proposals, never auto-applied                            | US-11       | P12                | P13                     | TBD_AT_IMPL | AI/BA            |
| INT-05; P02 WS-02.1      | FR-21/22 ATS tailoring + reproducible score                        | US-11       | P12                | P13 eval                | TBD_AT_IMPL | AI/BA            |
| INT-02 §3; FR-34/35      | FR-30/35 tracking + audit trail                                    | US-13       | P07                | P13                     | TBD_AT_IMPL | BA               |
| BQ-P02-02 (P1+P2)        | FR-31 fit ranking, no auto-submission                              | US-14       | P12                | P13                     | TBD_AT_IMPL | BA               |
| DEC-P02-05; AUTO-02      | FR-32 T2 discovery (flag-gated)                                    | US-20       | P13                | P13/15                  | TBD_AT_IMPL | Platform         |
| DEC-P02-05; AUTO-03      | FR-33 T3 review-first application                                  | US-21       | P13+               | P15                     | TBD_AT_IMPL | Product/Security |
| DEC-P02-05; AUTO-03      | FR-34 T3 autopilot (gated)                                         | US-22       | P13+               | P15                     | TBD_AT_IMPL | Product/Security |
| INT-02 §6; FR-h66        | FR-40 Gmail polling, read-only                                     | US-03       | P07 connector      | P13 connector tests     | TBD_AT_IMPL | Platform         |
| DEC-P01-03; FR-42        | FR-42 draft-only, never auto-send                                  | US-12       | P07                | P13                     | TBD_AT_IMPL | Security         |
| INT-02 §2; NFR-h17       | FR-43 reminders + calendar approval                                | US-04       | P07 scheduler      | P13                     | TBD_AT_IMPL | Platform         |
| INT-02 §3; ADR-009       | FR-50/51 immutable payload-bound approval                          | US-05       | P07/08             | P13 approval suite      | TBD_AT_IMPL | Security         |
| INT-02 §6.6; FR-61/62    | FR-60/61/62 export/erasure/receipt                                 | US-06       | P07                | P13 erasure matrix      | TBD_AT_IMPL | Privacy          |
| Prompt §13               | NFR-01 availability SLO ≥99.5%                                     | —           | P08                | P15                     | TBD_AT_IMPL | Platform         |
| BQ-P02-04                | NFR-02/03 latency + load 100 / 1,000                               | —           | P08                | P15 load test           | TBD_AT_IMPL | Platform         |
| Prompt §13               | NFR-04 error/timeout/retry/backpressure                            | —           | P08                | P15 failure-injection   | TBD_AT_IMPL | Platform         |
| NFR-h22                  | NFR-05 connector outage isolation                                  | —           | P12                | P15                     | TBD_AT_IMPL | Platform         |
| NFR-h17                  | NFR-06 at-least-once consumers                                     | US-04       | P08                | P13                     | TBD_AT_IMPL | Platform         |
| NFR-h16                  | NFR-07 optimistic concurrency on consequential writes              | —           | P08                | P13                     | TBD_AT_IMPL | Platform         |
| INT-02 §5; FR-h52        | NFR-10 relational SOR + rebuildable projections                    | US-02/10/14 | P07                | P13 rebuild tests       | TBD_AT_IMPL | Architecture     |
| INT-02 §2; FR-h63        | NFR-11 provenance through transformations                          | US-02/10    | P07/12             | P13                     | TBD_AT_IMPL | Architecture     |
| INT-02 §2                | NFR-12 stable IDs + versioned mappings                             | —           | P07                | P13 schema tests        | TBD_AT_IMPL | Architecture     |
| INT-02 §6.6; NFR-h20     | NFR-13 retention + deletion semantics                              | US-06       | P07                | P13                     | TBD_AT_IMPL | Privacy          |
| NFR-15/h15               | NFR-15 cross-workspace isolation                                   | US-07       | P07 schema/RLS     | P13 isolation suite     | TBD_AT_IMPL | Security         |
| RFC 9700 BCP             | NFR-16 OAuth least-privilege                                       | US-03       | P08 auth           | P13 OAuth tests         | TBD_AT_IMPL | Security         |
| DPDP §5/6                | NFR-17 consent + notice + withdrawal                               | US-01       | P07                | P13                     | TBD_AT_IMPL | Privacy          |
| OWASP LLM Top 10         | NFR-18 prompt-injection defense                                    | US-05       | P12                | P13 injection suite     | TBD_AT_IMPL | Security         |
| NFR-26                   | NFR-19 append-only audit + anchoring                               | —           | P08                | P13 audit tests         | TBD_AT_IMPL | Security         |
| NFR-h21                  | NFR-20 WCAG 2.2 AA                                                 | US-15       | P09 UX             | P13 a11y                | TBD_AT_IMPL | UX               |
| NFR-h19                  | NFR-21 SBOM + scans + signed images                                | —           | P14 CI             | P14                     | TBD_AT_IMPL | Platform         |
| NFR-25                   | NFR-22 provider DPA config, minimal egress                         | —           | P12                | P13                     | TBD_AT_IMPL | Privacy          |
| INT-02; FR-52            | FR-h52 embedding interface + metadata                              | —           | P12                | P13                     | TBD_AT_IMPL | AI               |
| INT-02; FR-60            | FR-h60 workload identity + context propagation                     | —           | P08                | P13                     | TBD_AT_IMPL | Security         |
| INT-02; FR-61/62         | FR-h61/62 erasure workflow + receipt                               | US-06       | P07                | P13 erasure matrix      | TBD_AT_IMPL | Privacy          |
| INT-02; FR-63            | FR-h63 versioned agent results                                     | —           | P12                | P13                     | TBD_AT_IMPL | AI               |
| INT-02; FR-64            | FR-h64 source-grounded labels                                      | US-10       | P12                | P13                     | TBD_AT_IMPL | AI               |
| INT-02; FR-65            | FR-h65 quarantine unsafe docs                                      | —           | P12                | P13                     | TBD_AT_IMPL | Security         |
| INT-02; FR-66            | FR-h66 integration registry + kill switch                          | US-03       | P08                | P13                     | TBD_AT_IMPL | Platform         |
| INT-02; FR-67            | FR-h67 version-pinned MCP profile                                  | —           | P08                | P13                     | TBD_AT_IMPL | Platform         |
| INT-02; FR-68            | FR-h68 supersession (FR-05)                                        | US-02       | P07                | P13                     | TBD_AT_IMPL | AI               |
| INT-02; FR-69            | FR-h69 export/deletion progress (no infra leak)                    | US-06       | P09 UX             | P13                     | TBD_AT_IMPL | UX               |
| INT-02; FR-70            | FR-h70 injection-safe policy/approval                              | US-05       | P12                | P13 injection suite     | TBD_AT_IMPL | Security         |
| INT-02; NFR-15           | NFR-h15 isolation via policy + constraints + authz                 | US-07       | P07 schema/RLS     | P13 isolation suite     | TBD_AT_IMPL | Security         |
| INT-02; NFR-16           | NFR-h16 precondition tokens                                        | —           | P08                | P13                     | TBD_AT_IMPL | Platform         |
| INT-02; NFR-17           | NFR-h17 idempotency/dedup                                          | US-04       | P08                | P13                     | TBD_AT_IMPL | Platform         |
| INT-02; NFR-18           | NFR-h18 reproducibility                                            | —           | P12                | P13                     | TBD_AT_IMPL | AI               |
| INT-02; NFR-19           | NFR-h19 SBOM/scan/sign in CI                                       | —           | P14 CI             | P14                     | TBD_AT_IMPL | Platform         |
| INT-02; NFR-20           | NFR-h20 backup-expiry status model                                 | US-06       | P07                | P13                     | TBD_AT_IMPL | Privacy          |
| INT-02; NFR-21           | NFR-h21 a11y suite                                                 | US-15       | P09 UX             | P13 a11y                | TBD_AT_IMPL | UX               |
| INT-02; NFR-22           | NFR-h22 outage isolation                                           | —           | P12                | P15                     | TBD_AT_IMPL | Platform         |
| DEC-P02-05; CF-P03-01    | AUTO-01 T1 always-on lawful automation                             | US-03/04    | P07/08             | P13                     | TBD_AT_IMPL | Platform         |
| DEC-P02-05               | AUTO-02 T2 discovery flag (OFF default, opt-in)                    | US-20       | P13                | P13/15                  | TBD_AT_IMPL | Platform         |
| DEC-P02-05               | AUTO-03 T3 auto-apply (review-first; autopilot gated)              | US-21/22    | P13+               | P15                     | TBD_AT_IMPL | Product/Security |

## Coverage & verification reconciliation

### RISK-MVP-P02-10 — test coverage 94% (of record) vs 97% (AGENTS.md)

| Figure      | Value     | Source                                                                                                                                                                                                                                                                                                                                   |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Of record   | 94% total | `docs/phases/mvp-p00/03-maturity-and-evidence-matrix.md` §2.1 (2026-08-12 `--cov=src/backend/` run, 641 missing lines), `11-evidence-traceability.md` EVD-MVP-P00-006, RISK-P00-13; accepted as the verified figure at the P02 gate (PA-MVP-P02-010, RISK-MVP-P02-10, `docs/phases/mvp-p02/18-registers.md`; gate 88.20/100, 2026-08-13) |
| Later claim | 97% total | `AGENTS.md` "Backend — Test State" — re-measured 2026-08-13 via fresh full-suite run; references the P00 matrix file, which on disk records the 94% run                                                                                                                                                                                  |

Resolution: 94%-of-record is the gate-verified figure; the AGENTS.md 97% is a
separate, later measurement (2026-08-13) not yet re-recorded in phase evidence.
The ~3-point delta is documented here for closure; it will be re-measured and
re-anchored once P13/P14 run the coverage gates.

### RISK-MVP-P02-11 — P01 gate EVD row counts (22 vs 25)

- Claim: `docs/phases/mvp-p01/14-gate-2026-08-13.md` §1 change #5 states
  "evidence plan (22 EVD rows)" while the same gate's §3 rows state "Evidence
  plan (25 EVD rows)" and "EVD-MVP-P01-001..025"; `16-verification-report.md`
  verifies the register 25/25 (✅) but repeats "Evidence plan (22 rows)" once in
  its readiness table.
- True counts (re-counted 2026-08-14): `docs/phases/mvp-p01/03-evidence-plan.md`
  defines **25** unique EVD rows (EVD-MVP-P01-001..025); 32 in-file occurrences
  (some IDs re-referenced in plan text); 41 occurrences across the phase folder
  (33 unique file+ID pairs). `docs/phases/mvp-p02/11-evidence-plan.md` defines
  **16** unique EVD rows (EVD-MVP-P02-001..016; register closed at the P02 gate
  2026-08-13).
- Reconciliation: the plan file holds 25 rows; "22" was a stale narrative count
  in gate change #5 (and once in `16-verification-report.md`). 25 matches the
  gate's §3 rows and the verification register check (25/25 ✅). No evidence
  missing; RISK-MVP-P02-11 closed here.
