# CONT-P17 — 08 Registers

## Defects — see `05-evidence-defects.md` (canonical)

DEF-P17-01 (promtool, OPEN SRE) · DEF-P17-02 (live drill, OPEN SRE) +
P16/P15 sets carried.

## Risks
- RISK-P17-01: alert rules never promtool-checked locally — mitigant: YAML
  parse + unchanged-since-baseline; owner SRE.

## Decisions
- DEC-P17-01: live boot evidence over screenshot claims (this phase ran a
  real server twice: P15 signup probe + P17 metrics probe).
- DEC-P17-02: no source changes (validation-only phase).

## Assumptions / Exceptions
- ASM-P17-01: staging cluster validates what SQLite env cannot (drills).
- EXC-CONT-P12-01 carried (2026-12-31). No new exceptions.
