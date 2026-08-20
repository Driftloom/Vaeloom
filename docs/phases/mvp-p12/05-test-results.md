# MVP-P12 — 05. Test Results

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation  
> **Date:** 2026-08-20 (corrected) · **Baseline:** `95d9848` + P12 changes  
> **Environment:** SQLite test environment with mock LLM fixtures

## Summary

| Metric                           | Value                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| Full suite result                | **2405 passed, 4 skipped, 2 xfailed, 0 failed** (1677.24s) |
| Baseline (pre-P12)               | 2333 passed, 2 xfailed (per AGENTS.md 2026-08-13)          |
| Net tests added                  | **+72** (68 new P12 tests + suite hygiene)                 |
| Failures remediated this session | **25 → 0**                                                 |
| Regressions                      | **0**                                                      |

## New Tests Added (68, all passing)

| #   | File                                 | Tests | Coverage                                                                                                                                                                                                                 |
| --- | ------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `tests/test_provider_key_service.py` |    14 | BYOK: hint masking, Fernet roundtrip, provider validation (OpenAI header / Google header / custom format), rotation, priority resolution (workspace > user > system), inactive skip, mark_used, delete + cross-user deny |
| 2   | `tests/test_provider_keys_router.py` |    12 | Auth 401, create/list (no plaintext leak), short/unknown provider → 400/422, PATCH deactivate/rotate, unknown PATCH field → 400, cross-user 404, DELETE 204, validate endpoint                                           |
| 3   | `tests/test_llm_byok.py`             |    12 | Model/provider inference, `_resolve_api_key` priority + marks-used + BYOK-failure→system fallback, anthropic embedding rejection, BYOK key flows into embedding/completion                                               |
| 4   | `tests/test_agent_catalog.py`        |     4 | Catalog returns 8 canonical agents with skills/memory scopes/tool definitions                                                                                                                                            |
| 5   | `tests/test_memory_filters.py`       |     8 | workspace_id filter, superseded hidden/shown, status=all, active-only default                                                                                                                                            |
| 6   | `tests/test_agent_eval_execution.py` |     9 | 12-case golden dataset executed through orchestrator `handle()` (mock LLM + patched `async_session_factory`); adversarial blocks, clarify, fallback; unit scoring                                                        |

## Remediation of Full-Suite Failures (25 → 0)

| Root cause                                                                                               | Files fixed                                                                                                                                               | Tests affected                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Stale package conftest fakes (no `**kwargs`, missing stream/tools fakes)                                 | `tests/integration/conftest.py`, `tests/security/conftest.py`                                                                                             | 12 (memory API, workspace isolation, XSS)                    |
| Wave-2 key guards + autouse fakes vs pre-existing extended tests                                         | `tests/test_llm_service_extended.py` (restore originals for tools/stream dispatch, instance keys for private stream tests, updated embedding-guard regex) | 14                                                           |
| Committed OpenAPI spec stale (missing provider-keys, catalog, memories feed/lineage)                     | `docs/backend/openapi.yaml` regenerated from live app (88 paths)                                                                                          | 1 (spec-vs-live)                                             |
| Test-pollution leak: `test_main.py` prometheus patch left `api.main` without `/metrics` in `sys.modules` | `tests/test_main.py` fixture teardown drops `api.main`                                                                                                    | (fixed `test_spec_paths_match_live_app` in full-suite order) |

All previously failing files re-verified individually after fixes before the
final full-suite run: `test_llm_service_extended.py` 39/39, memory/xss 44/44,
`test_openapi_spec.py` 4/4.

## Test Subsets (P12-focused)

| #   | Subset                                  | File(s)                               | Tests | Result      |
| --- | --------------------------------------- | ------------------------------------- | ----: | ----------- |
| 1   | SAML validation                         | `tests/test_saml.py`                  |    14 | ✅ ALL PASS |
| 2   | Connector services                      | `tests/test_connector_ext_service.py` |    34 | ✅ ALL PASS |
| 3   | Orchestrator loop                       | `tests/test_orchestrator*.py`         |    54 | ✅ ALL PASS |
| 4   | Memory service                          | `tests/test_memory_service.py`        |    28 | ✅ ALL PASS |
| 5   | LLM service                             | `tests/test_llm_service.py`           |    10 | ✅ ALL PASS |
| 6   | LLM service (extended, real HTTP paths) | `tests/test_llm_service_extended.py`  |    39 | ✅ ALL PASS |
| 7   | LLM validator                           | `tests/test_llm_validator.py`         |    19 | ✅ ALL PASS |
| 8   | BYOK service                            | `tests/test_provider_key_service.py`  |    14 | ✅ ALL PASS |
| 9   | BYOK router                             | `tests/test_provider_keys_router.py`  |    12 | ✅ ALL PASS |
| 10  | BYOK/LLM integration                    | `tests/test_llm_byok.py`              |    12 | ✅ ALL PASS |
| 11  | Agent catalog                           | `tests/test_agent_catalog.py`         |     4 | ✅ ALL PASS |
| 12  | Memory filters                          | `tests/test_memory_filters.py`        |     8 | ✅ ALL PASS |
| 13  | Eval execution (12 golden cases)        | `tests/test_agent_eval_execution.py`  |     9 | ✅ ALL PASS |

## Test Environment

| Component  | Configuration                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Database   | SQLite with aiosqlite (mock pgvector → Text columns)                                              |
| LLM        | `mock_llm` autouse fixture (conftest.py) — `**kwargs` fakes for embedding/completion/tools/stream |
| Connectors | `mock_connector_test` autouse fixture (conftest.py)                                               |
| Redis      | In-memory fallback (no Redis required)                                                            |
| Python     | 3.14 (`C:\Python314`; `.python-version` pins 3.12 for prod)                                       |

## Regression Check

| Check                                   | Status |
| --------------------------------------- | ------ |
| No tests removed                        | ✅     |
| No tests modified to weaken assertions  | ✅     |
| No `@pytest.mark.skip` added            | ✅     |
| No threshold lowered                    | ✅     |
| Full suite green (baseline 2333 → 2405) | ✅     |

Honest note: `tests/test_llm_service_extended.py`, `tests/test_main.py` and the
package `conftest.py` files were **modified** — not to weaken assertions, but to
align with wave-2 production behavior (key guards, autouse stream/tools fakes,
BYOK router) and to fix a genuine cross-module test-pollution leak. The OpenAPI
spec file was regenerated to match the live app.

## Known Test Gaps

| #   | Gap                                                                    | Severity | Target Phase |
| --- | ---------------------------------------------------------------------- | -------- | ------------ |
| 1   | Eval executed against mock LLM; no live-provider adversarial execution | MEDIUM   | P14          |
| 2   | No integration test for chunking → embedding → retrieval pipeline      | MEDIUM   | P14          |
| 3   | BYOK custom-provider keys validated by format only (no remote call)    | MEDIUM   | P14          |
| 4   | Model router not tested with real provider API calls                   | LOW      | P14          |
| 5   | Cost tracking accuracy not verified against actual billing             | LOW      | P17          |
