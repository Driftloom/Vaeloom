# CONT-P15 — 03 Resilience / Chaos / DR (WS-15.3, DEL-03)

## Verified @ HEAD

- **SLOs:** `docs/operations/SLO.md` — 6 targets (API 99.9%, p99 <500ms,
  agent p99 <10s, accuracy >90%, ingestion p95 <30s, DB 99.95%) + error
  budgets (43min → 7.2h) + violation response ladder.
- **DR runbook:** `docs/DISASTER_RECOVERY.md` — RTO 1h critical / 4h high,
  RPO 5min DB / 1h files, RDS snapshots (35d) + WAL (7d) + S3 export.
- **Failure domains:** provider/cache/queue/DB failure handling via CB +
  retries + graceful degradation (Wave 1/3); Temporal 503 fail-closed;
  idempotency 409 replays.
- **Cell posture:** workspace RLS isolation + per-workspace budgets/quotas
  bound noisy-neighbor blast radius (no full cell-split in MVP scope —
  recorded as future boundary per track mission).

## Drill status (honest)

- Restore drill on SQLite: BLOCKED by DEF-P15-06 (fresh bootstrap partial).
- PG restore drill: NOT_EXECUTED in this env (no PG) — RDS snapshot path is
  runbook-documented, never drill-proven here. Recorded as residual with
  owner SRE + trigger (staging PG available).
