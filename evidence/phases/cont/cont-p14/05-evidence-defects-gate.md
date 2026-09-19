# CONT-P14 — 05 Evidence / Defects / Gate-prep (WS-14.5, DEL-03/04/05)

## Coverage (DEL-02)

Repo baseline 94% retained (P15 `--cov`, carried — no coverage-surface change
in P13/P14 deltas beyond +2 additive files fully covered by their own suites:
`test_saml_failclosed` covers new branches). Per-file coverage tooling quirk
noted (module-path mapping under `src` layout; CI `--cov=src/api/` is
authoritative).

## Quality dashboard (DEL-04)

CI jobs as dashboard: `ci-backend` (tests+cov) · `ci-frontend` · `ci-integration`
· temporal dedicated · `security-audit`/`security-scan` · `a11y-audit` ·
`docs-validate`. Per-phase EVD tables (`07-evidence-bundle.md` each phase) +
registers (`08-registers.md`) form the immutable record.

## Defect / waiver register (DEL-03) — also in `08-registers.md`

| ID | Defect/waiver | Severity | Status |
| --- | --- | --- | --- |
| DEF-P14-01 | Slack `invalid_auth` in `test_executor_live_mocks` | Low (env) | WAIVED — proven pristine via stash-check |
| DEF-P14-02 | Full suite xdist hang (finding 39) | Medium (velocity) | WAIVED — per-file/serial policy enforced |
| DEF-P14-03 | RLS live-PG run pending | Medium | OPEN — condition for P14 close-owned P15 entry? No: P15 entry; blocks nothing here |
| DEF-P14-04 | W5 DB-versioned prompts residual | Low | OPEN — CONT-P12 known gap, non-blocking |
| DEF-P14-05 | Perf re-measurement deferred | Low | CLOSED by 04-note (no perf-surface change) |
