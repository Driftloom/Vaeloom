# CONT-P15 — 08 Registers

## Defects — see `05-evidence-defects.md` (canonical)

DEF-P15-06 (bootstrap partial, OPEN Eng) · DEF-P15-07 (k6 defer, trigger
06-close) · DEF-P15-08 (PG drill, OPEN SRE) + P14 set carried.

## Risks
- RISK-P15-01: gate margin thinnest on record (95.72) — mitigant: all
  deductions owned/triggered, zero mandatory blockers; owner SRE.
- RISK-P15-02: carried PG-verification debt (RLS-live + restore drill) —
  mitigant: triggers recorded; owner SRE.

## Decisions
- DEC-P15-01: k6 re-run deferred (honest blocker, not bypassed).
- DEC-P15-02: no source changes this phase (docs/tests-evidence only).

## Assumptions / Exceptions
- ASM-P15-01: carried perf baselines valid (zero perf-surface change).
- EXC-CONT-P12-01 carried (2026-12-31). No new exceptions.
