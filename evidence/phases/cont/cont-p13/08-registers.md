# CONT-P13 — 08 Registers (risk / decision / assumption / exception)

## Risks
- RISK-P13-01: RLS live-PG re-verification still pending (inherited P12) —
  mitigant code review + 0036; owner SRE; blocks P13-close-owned P14 entry? No:
  condition for P14 close.
- RISK-P13-02: concurrent-session overwrite of uncommitted work (observed:
  SAML edit lost pre-commit) — mitigant: verify-on-disk + stage/commit
  promptly; owner Eng; ongoing discipline.

## Decisions
- DEC-P13-01: SAML fail-closed by default; unsigned only via
  `SAML_ALLOW_UNSIGNED=true` with recorded expiry.
- DEC-P13-02: RBAC stays DI-helper (proven 105/105); no middleware rewrite.
- DEC-P13-03: Privacy stack certified as-is; no new GDPR code this phase.

## Assumptions
- ASM-P13-01: IdP cert provisioned out-of-band by operator (runbook 05).
- ASM-P13-02: SQLite-env skips (RLS live) covered by PG CI job.

## Exceptions
- EXC-P13-01: perf not re-measured (carried pattern) — expires P14 close.
- EXC-CONT-P12-01: carried, expires 2026-12-31.
