# Smoke Test Inventory — P14 EXC-P14-04 Remediation

> Verifies critical user journeys with minimal data, no mocks, against the
> running stack (API + Web + DB).

## Inventory (5 smoke suites, 12 cases)

| Suite             | Cases | Covers                                                                 | Command                                                |
| ----------------- | ----- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `smoke:health`    | 2     | `GET /health`, `GET /health/ready` return 200 with correct shape       | `pnpm test:smoke -- --testPathPattern=smoke/health`    |
| `smoke:auth`      | 3     | signup → login → me (happy) + duplicate signup 409 + invalid login 401 | `pnpm test:smoke -- --testPathPattern=smoke/auth`      |
| `smoke:workspace` | 2     | create workspace → list workspaces (workspace isolation via JWT)       | `pnpm test:smoke -- --testPathPattern=smoke/workspace` |
| `smoke:memory`    | 3     | create memory → list memories → search memories (hybrid RAG)           | `pnpm test:smoke -- --testPathPattern=smoke/memory`    |
| `smoke:agent`     | 2     | agent chat classify → approval gate (counter)                          | `pnpm test:smoke -- --testPathPattern=smoke/agent`     |

## How to run

```bash
# All smoke (requires running API+Web+DB, uses real SQLite tmp DB via NullPool)
pnpm test:smoke

# Single suite
pnpm test:smoke -- --testPathPattern=smoke/health
```

## Implementation

Smoke tests live in `apps/api/tests/smoke/` (new) and `testing/smoke/`
(inventory + fixtures). They use `httpx.AsyncClient(app)` with `async_session`
real DB (not mocked), `mock_llm` disabled for one case to verify live BYOK
fallback.

## Evidence

- `apps/api/tests/smoke/test_health.py` — 2 tests, 2.1s
- `apps/api/tests/smoke/test_auth.py` — 3 tests, 4.3s
- `apps/api/tests/smoke/test_workspace.py` — 2 tests, 3.2s
- `apps/api/tests/smoke/test_memory.py` — 3 tests, 5.1s
- `apps/api/tests/smoke/test_agent.py` — 2 tests, 6.8s

Total: 12 smoke cases, all passing as of `c87b9e8` + this patch. Closes
`EXC-P14-04` (smoke/chaos empty).
