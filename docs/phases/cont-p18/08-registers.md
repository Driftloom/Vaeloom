# CONT-P18 — 08 Registers

## Defects

None new. Carried sets stand (P15/P16/P17 registers).

## Risks
- RISK-P18-01: DOCUMENTATION-MAP staleness (phase counts) — owned by
  parallel session currently editing it; mitigant: no parallel edit from
  this phase; owner Tech Writing.

## Decisions
- DEC-P18-01: ADR index generated from H1s (map, not substitute).
- DEC-P18-02: no doc rewrites where currency verified (avoid churn).
- DEC-P18-03: lint/link evidence CI-authoritative (no local forgery).

## Assumptions / Exceptions
- ASM-P18-01: 1066-count includes prompts/audits archives (by design).
- EXC-CONT-P12-01 carried (2026-12-31). No new exceptions.
