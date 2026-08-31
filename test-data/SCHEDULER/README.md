# SCHEDULER fixtures

Cron fixtures for `services/scheduler_service.py:25` `create_schedule(cron)` +
`temporal/queues.py` `create_or_update_schedule` (DB is source of truth when
`temporal_enabled` false).

- `cron-daily-9am.json` `0 9 * * * Asia/Kolkata` — daily resume nudge (tests
  `scheduler_agent` reminder + `temporal` queue `vaeloom-ingest-q`)
- `cron-weekly-digest.json` `0 9 * * 1` — weekly digest
- `per-workspace-quota.json` — `SCRAPE_QUOTA_PER_HOUR` 20/h (browser quota) per
  workspace

Distinct from `CALENDAR/event-*.json` (user-visible events) — scheduler is
trigger, calendar is instance. `CALENDAR/event-001` interview may have been
created by scheduler.

Validate: `croniter.is_valid(cron)` true.
