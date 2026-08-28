# Temporal — Local Development (ADR-038)

## Quick start (no Docker, test-only — default)

```bash
# Temporal is OFF by default locally; unit tests use Temporal Test Server in-process.
uv run --project apps/api python -m pytest tests/temporal -q
uv run --project apps/api python -m api.temporal.worker --dry-run   # validates registration, no server needed
```

## With Docker (full durability)

```bash
cp .env.example .env

# start infra + temporal self-host stack (opt-in profile `temporal`)
docker compose --profile temporal up -d
docker compose --profile temporal ps
#   vaeloom-temporal         7233 (gRPC)  8233 (frontend)
#   vaeloom-temporal-ui      8233→8080  http://localhost:8233
#   vaeloom-temporal-db / vaeloom-temporal-visibility-db  (dedicated Postgres, not app DB)

# start api + temporal worker alongside
docker compose --profile temporal up -d api temporal-worker
# or locally:
TEMPORAL_ENABLED=true uv run --project apps/api python -m api.temporal.worker
TEMPORAL_ENABLED=true uv run --project apps/api python -m uvicorn api.main:app --port 8000
```

Verify:

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/v1/temporal/workflows/ingest:ws:hash:id  # 503 when TEMPORAL_ENABLED=false, 404/200 when true
open http://localhost:8233  # Temporal UI — namespaces, workflows, schedules
uv run --project apps/api python -c "import asyncio; from api.temporal.client import get_temporal_client; print(asyncio.run(get_temporal_client()))"
```

## Troubleshooting

- **Port 7233 occupied**: previous Temporal leftover —
 `docker compose --profile temporal down -v` then up.
- **Worker liveness**: `docker logs vaeloom-temporal-worker --tail 50`;
 healthcheck is a Temporal `Client.connect` ping.
- **No Redis**: degraded inline mode (§33) still works without Redis or
 Temporal; enable both for parity with prod.

## Debugging workflow histories

Temporal UI → copy `WorkflowId` →
`temporal workflow show --address localhost:7233 --workflow-id <id>` (or via
UI). For failing replays, add fixture under `tests/temporal/fixtures/histories/`
and run
`uv run --project apps/api python -m pytest tests/temporal/test_versioning.py -q`.

## Worker queues

| Env | Default |
| ------------------------------- | --------------------- |
| `TEMPORAL_TASK_QUEUE_INGEST` | `vaeloom-ingest-q` |
| `TEMPORAL_TASK_QUEUE_AGENT` | `vaeloom-agent-q` |
| `TEMPORAL_TASK_QUEUE_APPROVALS` | `vaeloom-approvals-q` |
| `TEMPORAL_TASK_QUEUE_SCHEDULES` | `vaeloom-schedules-q` |

Override per-env to shard load; workers poll their queue independently (ADR-038
§29).
