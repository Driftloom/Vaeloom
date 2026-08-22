# ADR-033: ReAct Gating, True Token Streaming, and Durable Background Scheduling

| Metadata     | Value                                              |
| ------------ | -------------------------------------------------- |
| **Status**   | Accepted                                           |
| **Date**     | 2026-08-23                                         |
| **Deciders** | Backend Lead                                       |
| **Owner**    | Orchestrator Team                                  |
| **Tags**     | orchestrator, streaming, scheduling, redis, bullmq |

## Context

Post-implementation audit of the agentic loop surfaced three weaknesses:

1. **ReAct ran unconditionally.** `_try_react_loop` attempted LLM-driven dynamic
   tool calling before every static dispatch (`loop.py`), adding nondeterminism,
   latency, and cost to every chat even when the deterministic static dispatcher
   would have sufficed.
2. **Token events were fake.** `run_agent_loop_stream` typewriter-chunked the
   already-complete result (40-char slices) — clients saw a streaming _effect_
   but no real-time provider output.
3. **The background daemon executed jobs inline** in the API process: not
   multi-instance safe (duplicate cron fires), work lost on API restarts, and no
   retry semantics.

## Decision

### 1. ReAct is opt-in (default OFF)

- New setting `agent_react_enabled: bool = False` (`AGENT_REACT_ENABLED=1` to
  enable).
- Static dispatch is the unconditional primary path; ReAct is best-effort on
  top.
- `_try_react_loop` double-guards the flag internally (defense in depth).

### 2. True SSE-with-tools token streaming

- `LLMService.generate_completion_with_tools_stream()` parses provider SSE:
  OpenAI `delta.tool_calls` fragments accumulate by index; Anthropic
  `text_delta` / `input_json_delta` per content block. Emits typed events:
  `text_delta`, `tool_calls`, `done`.
- No-key environments (tests) delegate to the buffered tool completion, keeping
  ONE mock surface (`conftest.mock_llm` patches only the buffered method).
- `act_phase(..., on_token=...)` threads a sync callback down to the ReAct
  round; `run_agent_loop_stream` pumps callbacks through an `asyncio.Queue` so
  `token` SSE frames carry REAL deltas while Act is still running. The
  typewriter chunking remains only as fallback for the static-dispatch path (no
  LLM stream exists there).

### 3. Daemon becomes an enqueuer; worker executes

- When Redis is available, the daemon **claims** each due slot atomically (Redis
  `SETNX vaeloom:daemon:claim:{key}` TTL 120s — crash self-healing) and enqueues
  BullMQ-compatible jobs onto the `schedules` queue:
  - `schedule.agent_run` — AgentSchedule slot (input, agent_id)
  - `schedule.job_run` — raw scheduled_jobs HTTP/event row
  - `daemon.watcher` — daily scans (`gmail` | `calendar` | `job_finder`)
- Execution lives in the dedicated worker process
  (`python -m api.workers.queue_worker`, compose service `queue-worker`,
  `make dev-worker`). Failed jobs retry with exponential backoff (5s·2^attempts,
  capped 5 min) up to `maxAttempts` (default 3), then dead-letter into
  `bull:{queue}:failed`. Delayed retries ride a `bull:{queue}:delayed` zset
  promoted by `zrem` (atomic across workers).
- **Degraded mode:** without Redis the daemon executes inline exactly as before
  — local dev and CI need no Redis.
- **Catch-up:** on startup each enabled schedule's most recent missed slot
  (bounded to 24h, one slot max) is claimed+enqueued once;
  `agent_schedules.last_run_at` (migration 0022) prevents re-firing.

## Consequences

- Chat with `AGENT_REACT_ENABLED=0` (default) is fully deterministic; enabling
  it adds live tool-calling plus real token streaming at no extra LLM calls.
- Horizontal scaling of the API no longer duplicates cron work; restarts lose
  nothing queued. Operators must run the queue-worker container/process in
  production for durable execution (otherwise inline degraded mode applies).
- Supervisor: single-agent requests stream REAL tokens via the orchestrator
  loop; multi-agent DAG layers deliberately keep agent-level granularity —
  interleaving tokens from parallel sub-runs would produce garbled output.

## Operational Rollout

- Compose: `queue-worker` service in `docker-compose.yml` and
  `docker-compose.prod.yml`; local entrypoint `make dev-worker`.
- Kubernetes: `infra/kubernetes/apps/queue-worker/deployment.yaml` (2 replicas,
  Redis ping liveness exec probe), wired into the base kustomization.
- `.env.example` documents `AGENT_REACT_ENABLED=0`;
  `infra/ops/LAUNCH-CHECKLIST.md` gained worker-deployment items.

## Verification

- `tests/test_streaming_and_daemon_durability.py` (20 tests): gate on/off,
  parser fixtures for both providers, live-delta pump, supervisor single-path
  token passthrough, dedup/inline fallback, catch-up idempotency, watcher
  routing, retry→dead-letter ladder.
- Updated legacy suites to the new contracts: `test_workers*.py` (zadd
  dead-letter, delayed retry, two-queue run_worker),
  `test_main.py::TestRouterRegistration` + gaps endpoint test (FastAPI lazy
  `_IncludedRouter`: assert via `app.openapi()["paths"]`), `test_tenant.py`
  (workspace header trust per RLS design).
- Full backend suite green post-change: **2572 passed / 0 failed** (4 skipped, 2
  xfailed).
