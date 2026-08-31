# CONT-P11 — 02 Migrations & Jobs

**Deliverable:** `DEL-CONT-P11-02` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Data Architect

## Alembic

| Migration | Scope | Type |
|-----------|-------|------|
| `0010` `0019` `0020` | `42/42 RLS` fail-closed | `SET app.workspace_id` GUC |
| `0021_retention_runs` | `gdpr retention 31` | `pg_cron` + `erasure_service` |
| `0022_agent_schedules_last_run` | `durable daemon` Redis/BullMQ → `queue-worker` | `0022` catch-up |

No new Alembic this phase — `CONT-P11` is **design** for `cont-p07` expand–contract `additive shadow`. Future `6→22` memory types `ADVISORY` → new column `nullable` + dual-write ledger.

## Jobs / Events (Temporal `ADR-038`)

| Queue | Activity | Timeout | DLC |
|-------|----------|---------|-----|
| `vaeloom-ingest-q` | `ingest pipeline 17 parsers` | `agent_timeout 120s` `config.py:74` | `Retry 3 + DLQ` |
| `vaeloom-agent-q` | `DURABLE_AGENT_RUN` `LangGraph shadow 0%` | `30s circuit 3/30s` | `queue-worker` retry/backoff |
| `vaeloom-connectors-q` `...-schedules-q` `...-approvals-q` `...-documents-q` etc | `8 queues` `11 activities` | per-queue | `temporal/client.py` `TemporalUnavailableError 503` fail-closed |

**Compatibility:** Old `background_daemon 60s` `main.py:163` → new `queue-worker` `durable` — both coexist via `start_background_daemon()` no-op when `TEMPORAL_ENABLED=true`.

---
_Version 1.0 2026-08-31 — `rg "temporal" apps/api/src/api/main.py 208`._
