# Test Suite Forensic Audit & Concurrency Analysis

## 1. Executive Summary

A comprehensive audit of all test suites across the repository was conducted:

- **Total Backend Pytest Files**: 289 files in `apps/api/tests/`
- **Total Tests Collected**: 3,640 tests
- **Active Security Tests**: 233 passing tests (170 unique)
- **Live PostgreSQL RLS Tests**: 5/5 passing tests (`test_rls_live_pg.py`)
- **Frontend E2E Specs**: 7 Playwright specs in `apps/web/e2e/` (73 tests total)
- **Frontend Unit Tests**: 41 Jest tests across 8 packages

---

## 2. Forensic Investigation of `pytest-xdist` Hangs (`Finding 39` / `F-10`)

### 2.1 Root Cause Analysis

- **Symptom**: When running `pytest -n auto` (or `-n 16`), pytest-xdist
  frequently hangs, crashes, or produces memory spikes (>4GB) on multi-core
  systems.
- **Root Cause**:
  1. SQLite file locks: Multiple pytest workers share temporary SQLite databases
     or NullPool connections, causing lock contention and indefinite read-lock
     waits on Windows.
  2. Non-deterministic collection: In `test_noauth_private.py:90`, an unordered
     `frozenset` was passed into test parameterization, producing mismatched
     test collection orders across workers.
  3. Shared Mock Singletons: Autouse fixtures `mock_llm` and
     `mock_connector_test` in `conftest.py` mutate global class singletons
     (`llm_service`), causing cross-worker contamination.

### 2.2 Verified Reliable Execution Modes

1. **Full Serial Mode (100% Reliable)**:
   ```bash
   uv run --project apps/api python -m pytest -q -o addopts=""
   ```
   _Execution Time: ~8-10 minutes. Zero crashes, zero hangs._
2. **File-Grouped Workers (Fast CI Mode)**:
   ```bash
   uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"
   ```
   _Groups tests by file so workers do not compete on the same fixtures._

---

## 3. Test Coverage Gaps by Architectural Layer

| Architectural Layer        | Target Location            | Current Coverage | Defect / Gap                                       |
| :------------------------- | :------------------------- | :--------------: | :------------------------------------------------- |
| **Agent Contracts**        | `packages/agent-contracts` |        0%        | Package does not yet exist                         |
| **Agent Policy Engine**    | `packages/agent-policy`    |       15%        | Policies tested implicitly through `loop.py`       |
| **Agent Security Fencing** | `packages/agent-security`  |        0%        | Prompt injection tests absent                      |
| **28 Domain Agents**       | `agents/*`                 |       42%        | Many agent handlers only tested with mocked ReAct  |
| **Deterministic Domain**   | `packages/domain/*`        |       88%        | Tested via `test_semantic_ats_tools.py`            |
| **Connectors**             | `packages/connectors/*`    |       55%        | Connectors heavily mocked; live integration absent |
