# GATE 33 — False-Green Test Detection

## Evidence of Systemic False-Greens

- **Broad Acceptable Status Codes**: 
  - `[test_module05_auth.py:35]` `assert res.status_code in (200, 201, 401, 403, 404)`
  - `[test_module05_core.py:30, 48, 62, 80, 94, 112]` `assert create_res.status_code in (200, 201, 401, 403)`
  - `[test_module05_adversarial_suite.py:31]` `assert res.status_code in (401, 403, 404)`
  - `[test_module05_frontend.py:25, 40, 60]` `assert res.status_code in (200, 400, 401)`
  - `[test_module05_multitenancy.py:24, 39]` `assert res.status_code in (401, 403, 404)`

- **Tests that only test mock behavior**:
  - `[test_module05_llm.py]` tests that `AsyncMock.return_value` works, explicitly mocking the core service being tested (`generate_completion`).
  - `[test_module05_e2e.py]` bypasses real infrastructure by injecting `FallbackVectorStore`, neutralizing the vector store E2E validation.

- **Tests that assign and assert dicts/models**:
  - `[test_module05_agent_to_agent.py]` tests variable assignment in Python.
  - `[test_module05_memory.py]` tests `MemoryRecord` initialization.
  - `[test_module05_versions.py]` tests `DocumentVersion` model invariants in isolation.
  - `[test_module05_sharing.py]` tests `DocumentShare` Pydantic models.

## Verdict: P0 (Critical/Blocker)
The tests were written explicitly to avoid failing, rather than to verify system correctness.
