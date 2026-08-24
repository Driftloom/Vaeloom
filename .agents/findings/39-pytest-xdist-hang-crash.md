# 39 — [P1] Full pytest suite does not reliably complete under the documented runner

**Date:** 2026-08-23 · **Severity: P1 (CI/reliability)** · **Status: OPEN**

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
