# CONT-P14 — 08 Registers (DEL-03 defect/waiver + risk/decision/assumption)

## Defects/waivers — see `05-evidence-defects-gate.md` (canonical table)

DEF-P14-01 (Slack env, WAIVED) · DEF-P14-02 (xdist hang, WAIVED w/ policy) ·
DEF-P14-03 (RLS live-PG, OPEN, owner SRE) · DEF-P14-04 (DB-prompts, OPEN) ·
DEF-P14-05 (perf defer, CLOSED by note).

## Risks
- RISK-P14-01: PG-gated suites unverified in SQLite CI — mitigant: dedicated
  PG job ownership; owner SRE.
- RISK-P14-02: concurrent-session uncommitted-work loss (observed P13) —
  mitigant: verify-on-disk + prompt commits; owner Eng.

## Decisions
- DEC-P14-01: No full-suite run this phase (finding 39); targeted + carried
  suites constitute certification evidence.
- DEC-P14-02: Perf re-measurement not required (zero perf-surface change).

## Assumptions / Exceptions
- ASM-P14-01: carried-suite results stand (zero drift, tree-clean verified).
- EXC-CONT-P12-01 carried (2026-12-31). No new exceptions.
