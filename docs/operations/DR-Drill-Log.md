# DR Drill Log

> **Purpose:** Dated record of every disaster-recovery drill (restore, failover,
> tabletop) with scope, RTO/RPO achieved, and gaps. A drill counts only when
> logged here with date + evidence. **Owner:** SRE / Security Team **Last
> Updated:** 2026-09-15 (WS-D — log created) **Related:**
> [`../DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md) (engineering targets:
> Critical RTO ≤1h / RPO 5m), [`../security/SOC2.md`](../security/SOC2.md) CC7.4
> (committed SLA ceiling: RPO <1h / RTO <4h)

## Log

| Date       | Drill type         | Scope                                     | RTO achieved              | RPO achieved          | Result / gaps                                                                                                                                                                                                                                 | Evidence                                                                                     |
| ---------- | ------------------ | ----------------------------------------- | ------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2026-09-17 | restore-to-staging | Database (PostgreSQL 18 + pgvector + RLS) | **48.99s** (Target: ≤60m) | **0.0s** (Target: 5m) | **SUCCESS — ALL 5 CHECKS PASSED.** Restored 67/67 tables, verified 67/67 RLS-enabled, extensions `vector`, `uuid-ossp`, `pgcrypto` active, Alembic head `0042`, marker `ebdbf1d5-a05f-4e7f-a59c-3af17b10e65d` data integrity matched exactly. | `apps/api/scripts/dr_drill_runner.py`, `apps/api/backups/vaeloom_drill_20260917_190518.dump` |

## How to log a drill

1. Add a row with the execution date (UTC), drill type (restore-to-staging /
   cross-region failover / tabletop / integrity check), and scope (DB / files /
   full region).
2. Record measured RTO (detection → serving traffic) and RPO (data loss window)
   against both the runbook target (RTO ≤1h / RPO 5m Critical) and the SOC 2 SLA
   ceiling (RPO <1h / RTO <4h).
3. Link evidence (restore logs, failover timestamps, post-mortem).
4. File gaps as follow-ups; do not claim SLA compliance on an unevidenced
   target.
