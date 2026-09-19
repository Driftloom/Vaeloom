# CONT-P21 — 08 Registers (final CONT)

## Defects

None new. Full inventory: STAB-01..10 + DEBT-11/12 (+13 keep) + P12→P20 sets.

## Risks
- RISK-P21-01: post-close drift without cadence — mitigant: `01` review
  table is the standing order; owner Release Mgr.

## Decisions
- DEC-P21-01: track close declared (22/22 gated).
- DEC-P21-02: ENT-P00 opens on user command only (no auto-start).
- DEC-P21-03: compose `version:` retired (verified harmless).

## Assumptions / Exceptions
- ASM-P21-01: parallel session docs work merges cleanly (disjoint files).
- EXC-CONT-P12-01 carried into ENT entry (expires 2026-12-31).
