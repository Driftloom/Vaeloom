# DR Drill Log

> **Purpose:** Dated record of every disaster-recovery drill (restore, failover,
> tabletop) with scope, RTO/RPO achieved, and gaps. A drill counts only when
> logged here with date + evidence. **Owner:** SRE / Security Team **Last
> Updated:** 2026-09-15 (WS-D — log created) **Related:**
> [`../DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md) (engineering targets:
> Critical RTO ≤1h / RPO 5m), [`../security/SOC2.md`](../security/SOC2.md) CC7.4
> (committed SLA ceiling: RPO <1h / RTO <4h)

## Log

| Date | Drill type | Scope | RTO achieved | RPO achieved | Result / gaps                                                                                                                                                                                           | Evidence               |
| ---- | ---------- | ----- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| —    | —          | —     | —            | —            | **No drill executed yet as of 2026-09-15.** The cadence in `DISASTER_RECOVERY.md` (weekly restore-to-staging, quarterly failover, bi-annual tabletop, monthly integrity check) is planned, not history. | This log (first entry) |

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
