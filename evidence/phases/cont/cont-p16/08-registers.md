# CONT-P16 — 08 Registers

## Defects — see `05-evidence-defects.md` (canonical)

DEF-P16-01 (FIXED) · DEF-P16-02 (FIXED) · DEF-P16-03 (OPEN SRE) + P15 set carried.

## Risks
- RISK-P16-01: TF/scan evidence is CI-authoritative, never locally reproduced —
  mitigant: pinned versions + workflow presence verified; owner Platform.
- RISK-P16-02: kustomize restructure moves 20+ dirs — mitigant: `git mv`
  preserves history; builds verified 4/4; owner Platform.

## Decisions
- DEC-P16-01: `base/apps` + `base/infra` layout (load-restrictor compliant,
  matches `apply -k base` pipeline).
- DEC-P16-02: keep configmap 5000 values, flag for SRE (no silent align).

## Assumptions / Exceptions
- ASM-P16-01: no cluster available — validation is build-level, not deploy-level.
- EXC-CONT-P12-01 carried (2026-12-31). No new exceptions.
