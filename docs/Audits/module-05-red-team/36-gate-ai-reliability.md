# GATE 36 — Final AI Reliability Checkpoints

## Key Questions & Findings

1. **Is the LLM always mocked in all 58 tests?**
   - **Yes.** NEVER a real LLM called. The test `test_module05_llm.py` uses `AsyncMock` to explicitly mock `generate_completion`. E2E tests mock the vector store and bypass real LLM synthesis validation.

2. **Is Temporal always mocked?**
   - **Yes.** NEVER a real worker running. Background task tests just assert status strings without executing any durable code.

3. **Is S3 always mocked?**
   - **Yes.** Storage keys are asserted in memory; no real S3 operation is performed. 

4. **Is the browser E2E missing?**
   - **Yes.** NEVER a real browser tested. All tests are `httpx.AsyncClient` hitting FastAPI in-memory (`ASGITransport`).

5. **Does the `_verify_workspace_access` bug exist?**
   - The function `_verify_workspace_access` in `apps/api/src/api/routers/documents.py` DOES check `WorkspaceUser` via `select(WorkspaceUser)`. The bug described (checking only `user_id`) is partially mitigated there, but the existence of this confusion highlights inconsistent authorization logic across routers. `agents.py` checks both.

6. **Is the version race condition (`MAX(version_number) + 1`) unprotected?**
   - **Yes.** `document_service.py` calculates `latest_num + 1` without advisory locks, optimistic concurrency loops, or `SELECT FOR UPDATE`. The unique constraint will trigger an unhandled 500 Server Error under race conditions instead of retrying safely.

7. **Are there any tests that would pass even if document upload completely failed?**
   - **Yes.** `test_module05_core.py` wraps the document upload in `if res.status_code in (200, 201): ... else: assert res.status_code in (200, 201, 401, 403)`. If the upload fails with 403, the test immediately passes.

## Verdict: P0 (Critical/Blocker)
The E2E suite is functionally non-existent. "100% GREEN" is achieved solely through mocking, bypassing, and conditional fall-throughs.
