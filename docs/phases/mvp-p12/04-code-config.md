# MVP-P12 — 04. Code and Configuration Changes

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation  
> **Date:** 2026-08-20 · **Baseline:** `95d9848` + P12 changes

## New Files

| #   | File                                                                                                                                                   | Module         | Lines | Purpose                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ----: | -------------------------------------------------------------------------------------------------------------------- |
| 1   | [`ingestion/chunking.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/ingestion/chunking.py)                                     | ingestion      |  ~180 | Document chunking with paragraph/sentence/character strategies, configurable overlap, context window fitting         |
| 2   | [`services/model_router.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/model_router.py)                               | services       |  ~149 | Model selection by task complexity (fast/balanced/powerful tiers), 8-model catalog, per-agent cost tracking          |
| 3   | [`infrastructure/agent_observability.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/agent_observability.py)     | infrastructure |  ~170 | Agent metrics collector (success rate, latency, cost, errors) + runtime kill switches (per-agent and global)         |
| 4   | [`infrastructure/agent_eval.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/agent_eval.py)                       | infrastructure |  ~346 | Eval framework: 12 golden cases, AgentEvaluator with scoring, adversarial prompt detection with 4 pattern categories |
| 5   | [`services/provider_key_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/provider_key_service.py)               | services       |  ~210 | BYOK: Fernet encryption, key hints, provider validation, priority resolution, mark_used                              |
| 6   | [`routers/provider_keys.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/provider_keys.py)                               | routers        |  ~150 | BYOK CRUD + PATCH + DELETE + validate endpoints                                                                      |
| 7   | [`schemas/provider_key.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/schemas/provider_key.py)                                 | schemas        |   ~80 | `ProviderKeyCreate/Update/Read` with masked `key_hint`                                                               |
| 8   | [`alembic/versions/0016_provider_keys_byok.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/alembic/versions/0016_provider_keys_byok.py) | alembic        |   ~55 | `provider_keys` table migration                                                                                      |

**Total new code:** ~1,340 lines across 8 files

## Modified Files

| #   | File                                                                                                                                                                                                                    | Change                                                                                                                                                          | Lines Changed | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------: | -------- |
| 1   | [`orchestrator/loop.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/loop.py)                                                                                                        | Wired circuit breaker check before `act_phase()`; rate limiter acquisition in `act_phase()`; timeout enforcement around LLM calls; approval dispatch refactored |      ~40      | HIGH     |
| 2   | [`orchestrator/router.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/router.py)                                                                                                    | Added kill switch check before routing; adversarial detection before dispatch; metrics recording after execution                                                |      ~30      | HIGH     |
| 3   | [`ingestion/pipeline.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/ingestion/pipeline.py)                                                                                                      | Added chunking step to pipeline after document parsing                                                                                                          |      ~10      | MEDIUM   |
| 4   | [`agents/memory_agent/retrieval.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/agents/memory_agent/retrieval.py)                                                                                | Added context window management — results truncated to fit model context limit                                                                                  |      ~15      | MEDIUM   |
| 5   | [`services/llm_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/llm_service.py)                                                                                                  | Integrated cost tracking via model router; token usage recorded per call                                                                                        |      ~20      | MEDIUM   |
| 6   | [`services/llm_validator.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/llm_validator.py)                                                                                              | Enhanced with adversarial detection from eval module                                                                                                            |      ~10      | MEDIUM   |
| 7   | [`services/llm_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/llm_service.py)                                                                                                  | BYOK: `_resolve_api_key` (awaited `mark_used`, groq inference, embedding guard for non-OpenAI)                                                                  |      ~35      | HIGH     |
| 8   | [`services/agent_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/agent_service.py)                                                                                              | BYOK wiring in agent dispatch; removed bogus `workspaceId` lookup                                                                                               |      ~15      | MEDIUM   |
| 9   | [`routers/agents.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/agents.py)                                                                                                              | `GET /api/v1/agents/catalog` (8 canonical agents)                                                                                                               |      ~20      | MEDIUM   |
| 10  | [`routers/memory.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/memory.py) + [`schemas/memory.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/schemas/memory.py) | Memory filters: `workspace_id`, `include_superseded`, `status=all`                                                                                              |      ~25      | MEDIUM   |
| 11  | [`main.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/main.py)                                                                                                                                  | Mounted provider-keys router                                                                                                                                    |      ~3       | LOW      |
| 12  | [`infrastructure/agent_eval.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/agent_eval.py)                                                                                        | "flagged" refusal indicator in `_score_response`/`_detect_behavior`                                                                                             |      ~2       | LOW      |

**Total modifications:** ~220 lines across 12 files

### Test-infrastructure fixes (remediation)

| File                                                                                                                                                                                                                                             | Change                                                                                                              | Effect                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`tests/conftest.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/conftest.py)                                                                                                                                               | provider-keys router added to test app; `**kwargs` fakes aligned                                                    | Test app reflects live routes                    |
| [`tests/integration/conftest.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/integration/conftest.py), [`tests/security/conftest.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/security/conftest.py) | Stale fakes updated (`**kwargs`, stream/tools)                                                                      | Fixed 12 memory/xss failures                     |
| [`tests/test_main.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/test_main.py)                                                                                                                                             | `_patch_prometheus` drops `api.main` from `sys.modules` on teardown                                                 | Fixed cross-module pollution removing `/metrics` |
| [`tests/test_llm_service_extended.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/test_llm_service_extended.py)                                                                                                             | Restored originals for tools/stream dispatch; instance keys for private stream tests; updated embedding-guard regex | 39/39 pass against wave-2 guards                 |
| [`docs/backend/openapi.yaml`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/docs/backend/openapi.yaml)                                                                                                                                        | Regenerated from live app (88 paths)                                                                                | Spec matches live app                            |

## Dependencies

No new external dependencies were added in P12. All new code uses existing
packages:

- `re`, `time`, `logging`, `dataclasses` — stdlib
- `asyncio` — stdlib (existing usage)
- `numpy` — existing dependency for embedding math
- `anthropic`, `openai` — existing LLM provider dependencies
- `cryptography` (Fernet) — existing dependency used for BYOK encryption

## Architecture Invariants Preserved

| Invariant                                   | Status                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Single FastAPI monolith (ADR-001)           | ✅ No new services                                                                                         |
| pgvector for embeddings (ADR-003)           | ✅ No vector DB changes                                                                                    |
| Custom orchestrator, no LangChain (ADR-005) | ✅ All new code is custom                                                                                  |
| Workspace-scoped isolation (ADR-013)        | ✅ No isolation changes                                                                                    |
| 8 canonical agents only                     | ✅ No new agent types added (catalog exposes the 8)                                                        |
| Suggest-mode-first                          | ✅ No autonomy escalation                                                                                  |
| Gmail draft-only                            | ✅ No send capability added                                                                                |
| Additive changes only                       | ✅ No production code removed; test files adjusted to match wave-2 behavior (no tests removed or weakened) |

## File Ownership

| Module                 | Owner                | Review Status |
| ---------------------- | -------------------- | ------------- |
| `ingestion/`           | Data Engineer        | Self-reviewed |
| `services/`            | AI/ML Engineer       | Self-reviewed |
| `infrastructure/`      | SRE / AI Safety Lead | Self-reviewed |
| `orchestrator/`        | AI/ML Engineer       | Self-reviewed |
| `agents/memory_agent/` | AI/ML Engineer       | Self-reviewed |
