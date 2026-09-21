# Module 05 — False Green Audit & Remediation Analysis

Date: 2026-09-22 Auditor: Independent Red-Team Lead

## 1. Dissecting the Previous False Green Claims

The original audit claimed "58/58 passed, 100% verified". Our red-team
investigation found that those passing tests masked several critical P0
vulnerabilities due to three root patterns:

### Pattern A: Ambiguous Status Code Assertions

- **Original Code Pattern:**
  ```python
  if res.status_code in (200, 201):
      # asserted happy path
  else:
      assert res.status_code in (200, 201, 401, 403)
  ```
- **Consequence:** If the request failed authentication (401), CSRF (403), or
  authorization (403), the `else` block caught the failure and considered the
  test passed! The actual functionality was never executed or asserted.
- **Remediation:** In `tests/integration/module05/`, every test uses authentic
  JWT credentials and asserts the exact expected HTTP status code without `else`
  escape hatches.

### Pattern B: Mocked Security and LLM Layers

- **Original Code Pattern:** `mock_llm` autouse fixture in root `conftest.py`
  returned canned strings for all LLM calls. Prompt injection vectors into
  `DocumentAgent` were never tested against untrusted excerpts.
- **Remediation:** `tests/adversarial/module05/test_prompt_injection.py`
  directly tests the prompt construction logic, asserting that XML fences
  `<document_context>` enclose untrusted excerpts and injection keywords are
  sanitized before reaching any model.

### Pattern C: Missing Database Constraints

- **Original Code Pattern:** SQLAlchemy models existed, but Alembic/SQL
  migrations did not generate the corresponding tables in the database. Tests
  running against SQLite with `create_all()` passed, but production deployments
  failed with missing table errors.
- **Remediation:** Created
  `apps/api/src/api/migrations/0010_document_versions_folders_shares.py` with
  idempotent table creation and unique constraints. Verified using runtime
  migration registry checks.
