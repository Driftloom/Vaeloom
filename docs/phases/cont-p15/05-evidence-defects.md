# CONT-P15 — 05 Evidence / Defects (WS-15.5 tail, DEL-03)

## Coverage note (DEL-02 support)

Repo 94% baseline retained; P15 deltas are docs-only (no source change), so
no coverage delta. New-run suites this phase: CB 15/15 + live boot smoke.

## Defect register additions (extends P14 DEF-P14-01..05)

| ID | Defect | Severity | Disposition |
| --- | --- | --- | --- |
| DEF-P15-06 | Fresh SQLite bootstrap partial schema (9 tables, no users) → signup 500; un-awaited `run_async_migrations` warning | Medium | OPEN, owner Eng. Fix: await/remove dead coroutine; extend/retire custom runner (0002–0009 only). Blocks SQLite restore-drill claims + k6 seeded runs. PG path unaffected (migration tests green). |
| DEF-P15-07 | Full k6 load re-run deferred (needs seeded user → blocked by DEF-P15-06) | Low | OPEN, trigger DEF-P15-06 close. Carried baselines stand. |
| DEF-P15-08 | PG restore drill never executed in this env | Medium | OPEN, owner SRE, trigger staging PG. Runbook-documented only. |
