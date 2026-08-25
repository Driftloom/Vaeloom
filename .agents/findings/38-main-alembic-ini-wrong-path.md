# 38 — [P1] main.py resolves the wrong alembic.ini path → alembic never applies outside apps/api CWD

**Date:** 2026-08-23 · **Severity: P1** · **Status: OPEN (frontend e2e shim
works around)**

## Evidence

`apps/api/src/api/main.py:121`:

```python
alembic_ini = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini")
```

`__file__` = `apps/api/src/api/main.py` → two dirnames = **`apps/api/src/`**.
The real config lives at **`apps/api/alembic.ini`** (verified:
`Test-Path apps\api\alembic.ini` = True, repo root = False). One more `dirname`
is needed. The CWD-relative fallback (`main.py:124`) only works when the process
is started from `apps/api`.

Live consequence (boot log, repo-root start):

```
ERROR [api.main] Alembic migration FAILED: No 'script_location' key found in configuration.
INFO  [api.main] Custom migrations applied successfully
```

The custom runner (`src/api/migrations/*`) creates knowledge tables but NOT:

- `consent_records` — `ConsentRecord` is a **Pydantic** model
  (`services/consent.py:27`), invisible to `create_all`, no DDL in any migration
  → `/consent/me` 500
- `scheduled_jobs` / `job_executions` — DDL exists ONLY in alembic
  `0002_microservice_tables.py` which never runs → `/scheduler/jobs` 500, daemon
  poller degraded

Both endpoints verified **200** after tables are created externally
(`apps/web/e2e/api-launcher.py` shim does `CREATE TABLE IF NOT EXISTS` from the
service contracts).

## Impact

Any fresh SQLite environment booted from repo root (docker-compose workdir, IDE
run buttons, CI without the shim) silently lacks three tables; consent and
scheduler surfaces break with generic errors.

## Fix direction

Use three dirnames at `main.py:121`
(`os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "alembic.ini")`)
or anchor to a module-level constant; add a startup assertion that alembic
actually reached head (log applied versions); consider giving the three orphaned
tables real model/migration ownership on the SQLite path.
