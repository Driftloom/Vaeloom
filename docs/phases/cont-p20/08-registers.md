# CONT-P20 — 08 Registers

## Defects

None new. STAB-01..10 in `05-stabilization-backlog.md` (canonical).

## Risks
- RISK-P20-01: stabilization debt grows if STAB-01/02 stall — mitigant:
  P0/P1 tags + triggers + owners; owner Release Mgr.

## Decisions
- DEC-P20-01: validation scope without pilot (sponsor-gated), scored honestly.
- DEC-P20-02: NO ROLLBACK (nothing deployed; RC stands).
- DEC-P20-03: synthetic replicated natively (no bash/docker in env).

## Assumptions / Exceptions
- ASM-P20-01: probe-boot equivalence to containerized synthetic (same app,
  same endpoints; interval/alerting logic reviewed, not executed).
- EXC-CONT-P12-01 carried (2026-12-31). No new exceptions.
