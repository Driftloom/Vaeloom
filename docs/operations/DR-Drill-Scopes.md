# DR Drill Scopes & Cadence (Loop 3)

> **Runner:** `apps/api/scripts/dr_drill_runner.py` · **Log:**
> `evidence/dr-drills/DR-Drill-Log.md` · **Last verified:** 2026-09-23.

## 1. Scopes (every drill runs all reachable scopes)

| Scope             | What it proves                                                                                                      | Needs                                        | Absent backend                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| DB backup/restore | RPO≈0 (marker round-trip), RTO measured, 40+ tables, RLS count, extensions, alembic head == `EXPECTED_ALEMBIC_HEAD` | PG source + target + `pg_dump`/`pg_restore`  | drill cannot run (this scope is mandatory) |
| `rls-posture`     | FORCE RLS on + zero `USING(true)`-for-`vaeloom_app` grants on the 12 sharp tables (`APP_ROLE_STRICT_TABLES`)        | restored target reachable                    | `skipped`                                  |
| `redis`           | snapshot round-trip (marker key survives)                                                                           | `REDIS__URL` reachable                       | `skipped`                                  |
| `object-storage`  | put/head/delete round-trip on the artifacts bucket                                                                  | `STORAGE_ENDPOINT` + `STORAGE_BUCKET` + keys | `skipped`                                  |

`skipped` is an explicit, logged outcome — never silent, never a pass. A quarter
with only DB scope passing is a **partial drill**: fine for monthly cadence, but
the quarterly drill must show all four green (or a dated waiver).

## 2. Cadence

- **Monthly:** DB scope (automated ok). RTO ≤ 60 min, RPO ≈ 0.
- **Quarterly:** all four scopes + tabletop walkthrough (who declares, who
  pages, who talks to customers). Evidence appended to `DR-Drill-Log.md`.
- **On migration touching RLS/policies:** `rls-posture` scope against staging
  before prod deploy (this caught the 0047-class drift pattern).

## 3. SLOs

RTO < 4h committed (runbook Critical target ≤ 1h, RPO ≤ 5m). Last measured:
48.99s RTO / 0.0s RPO (2026-09-17, DB scope). Multi-scope baselines get recorded
here after the first full quarterly run.
