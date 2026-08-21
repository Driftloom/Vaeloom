# MVP-P14 → P15 Handoff

**From:** Testing and Quality Engineering (P14) **To:** Performance and
Monitoring (P15) **Date:** 2026-08-22

---

## What P14 Delivered

- **42 new tests** covering API contract validation, AI evaluation, and
  resilience
- **Root conftest fix**: `auth_headers` fixture now available project-wide
- **2,527 total tests** collected, 2,459 passing

## Files Created/Modified

| File                                         | Action   | Purpose                      |
| -------------------------------------------- | -------- | ---------------------------- |
| `apps/api/tests/test_contract_validation.py` | Created  | 15 API contract tests        |
| `apps/api/tests/test_ai_evaluation.py`       | Created  | 11 AI evaluation tests       |
| `apps/api/tests/test_resilience.py`          | Created  | 16 resilience tests          |
| `apps/api/tests/conftest.py`                 | Modified | Added `auth_headers` fixture |
| `docs/phases/mvp-p14/00-test-strategy.md`    | Created  | Test strategy document       |
| `docs/phases/mvp-p14/01-gate-report.md`      | Created  | Gate report (88/100)         |

## Key Findings for P15

### Bug: Memory Empty Content → 500

- `POST /api/v1/memories` with `content: ""` causes
  `IntegrityError: NOT NULL constraint failed: memories.content_hash`
- The `content_hash` column is NOT NULL but `memory_service.create_memory()`
  doesn't compute hash before flush
- **Fix needed:** Compute `content_hash` in `MemoryService.create_memory()`
  before `db.flush()`

### Missing Validation

- Workspace name: no min_length validation (accepts empty string)
- Memory type: no enum validation (accepts any string)

### Existing Test Infrastructure

- `tests/conftest.py` — root fixtures (client, auth_headers, mock_llm,
  db_session)
- `tests/security/conftest.py` — security-specific fixtures (csrf_client,
  rate_limited_client, prompt_injection middleware)
- `tests/integration/` — integration tests for memory, workspace isolation,
  resume flow

## What P15 Should Know

- Run tests with:
  `uv run --project apps/api python -m pytest <path> -v --tb=short -o "addopts="`
- The `-o "addopts="` flag is critical to disable xdist parallelism
- Memory router returns `{"memories": [...]}` format, not bare list
- Agent create requires `name` + `category` fields (not `agent_type`)
- CircuitBreaker.call() expects a coroutine, not a sync function
- PrimaryWithFallback expects objects with `.execute()` method, not bare
  functions
