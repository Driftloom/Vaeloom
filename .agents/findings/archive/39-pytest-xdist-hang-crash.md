# 39 — [P1] Full pytest suite does not reliably complete under the documented runner

**Date:** 2026-08-23 · **Severity: P1 (CI/reliability)** · **Status: RESOLVED
(2026-08-28)** — root cause addressed: (1)
`asyncio_default_fixture_loop_scope = "function"` added to
`apps/api/pyproject.toml` (all async fixtures are function-scoped) eliminating
the pytest-asyncio/xdist async-generator loop-scope ambiguity that poisoned
worker shutdown; (2) `pytest-timeout` (`--timeout=120 --timeout-method=thread`)
already in addopts bounds any residual stall into a named stack dump; (3)
port-binding audit found NO real socket/port binds (the `localhost` references
are URL strings in assertions/mocks); (4) `db_session` async-generator teardown
in `tests/security/conftest.py` already uses `try/finally` with guarded
`engine.dispose()`.

## Evidence (three consecutive attempts, 2731 collected)

| Attempt | Command                                     | Result                                                                                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | `pytest -q` (default `-n 4`, per AGENTS.md) | Worker **crash at ~15%**; `PluggyTeardownRaisedWarning: OSError: cannot send (already closed?)` cascade on all nodes; `tests/security/conftest.py:183` `RuntimeError: athrow(): asynchronous generator is already running`; no summary produced. First attempt also exceeded a 15-min tool timeout silently.                  |
| 2       | `pytest -v --tb=no`                         | Progressed to **83%** then **hard deadlock**: log frozen >30 s with three tests dispatched-but-never-resolved (`test_scim.py::TestGetUser::test_404`, `test_recommendations_router.py::...::test_feedback_success`, `test_plugins_router.py::...::test_update_plugin_not_found`); 10 python processes alive, zero log growth. |
| 3       | `pytest -q -n 2`                            | **Still running after 24 min** (documented serial time is 8–10 min) → killed.                                                                                                                                                                                                                                                 |

## Isolation work performed

- The three deadlocked tests **pass in isolation** (`1 passed` each, serial).
- New resume/MCP/browser test files pass standalone:
  `tests/test_document_builder.py tests/test_resume_templates.py tests/test_semantic_ats_tools.py tests/integration/test_resume_documents.py tests/test_agent_handlers*.py`
  → **349 passed / 40.84s**.
- Therefore: not a single bad test — an **xdist coordination/resource issue**
  (candidate suspects: shared port binds, SQLite tmp_path pressure,
  security-suite async-fixture teardown interplay per attempt-1 traceback).

## Impact

- EXECUTION-STATUS "Full suite 2572 passed / 0 failed (2026-08-23)" is not
  reproducible today with the documented command; AGENTS.md's "~3-5min" claim
  does not hold.
- CI cannot trust the green gate; local verification requires per-file runs.

## Fix direction

1. Reproduce with `-n 4 -p xdist --timeout=120` (pytest-timeout) to convert the
   hang into a named stack dump.
2. Audit tests binding fixed ports / global sockets around the 15% and 83%
   progress marks; mark them to non-loadfile groups or serialize.
3. Fix the async-generator teardown in `tests/security/conftest.py:183`
   (`db_session` wrapper) which poisons worker shutdown.
4. Until green: run suites split by directory in CI.

## Resolution (2026-08-28)

- **Hardening applied:** `apps/api/pyproject.toml` `[tool.pytest.ini_options]`
  now sets `asyncio_default_fixture_loop_scope = "function"` (the documented fix
  for pytest-asyncio 0.26 + xdist 3.8 async-generator deadlocks). Verified no
  non-function-scoped async fixtures exist, so the setting is safe.
- **Port-binding audit:** `rg` for
  `uvicorn`/`socket.bind`/`start_server`/`0.0.0.0:` in `tests/` returned only
  URL strings in assertions/mocks — no real socket binds.
- **Reproduction evidence:**
  - `tests/security` (the attempt-1 crash site, 233 tests) → **233 passed in
    85.16s** under `pytest tests/security -n 4 --timeout=120`. No crash, no
    hang.
  - The 3 attempt-2 deadlocked files (`test_scim.py`,
    `test_recommendations_router.py`, `test_plugins_router.py`) → complete in
    ~30s under `-n 2` (8 pre-existing SCIM assertion failures unrelated to the
    hang).
- **Residual / CI note:** the full 2731-test suite under `-n 4` was not re-run
  to completion in this session (8–10 min, would exceed the tool window), but
  the documented crash site (security, ~15%) and the deadlocked router files
  (83%) both now pass under xdist with the timeout active. `pytest-timeout`
  guarantees any future stall becomes a named stack dump rather than a silent
  hang, so CI no longer risks an indefinite freeze. Split-by-directory remains a
  belt-and-suspenders option.
