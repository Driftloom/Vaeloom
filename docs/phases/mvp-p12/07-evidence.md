# MVP-P12 — 07. Evidence Register

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation 
> **Date:** 2026-08-20 (corrected) · **Baseline:** `95d9848` + P12 changes

## Evidence Table

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ----------- |
| EVD-P12-001 | Circuit breaker wired into agent loop | MVP-P12-R01 | code | [`orchestrator/loop.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/loop.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-002 | Rate limiter wired into agent loop | MVP-P12-R01 | code | [`orchestrator/loop.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/loop.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-003 | Kill switches in orchestrator router | MVP-P12-R01 | code | [`orchestrator/router.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/router.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-004 | Document chunking with overlap | MVP-P12-R03 | code | [`ingestion/chunking.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/ingestion/chunking.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-005 | Context window management in retrieval | MVP-P12-R03 | code | [`agents/memory_agent/retrieval.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/agents/memory_agent/retrieval.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-006 | Model routing by task complexity | MVP-P12-R06 | code | [`services/model_router.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/model_router.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-007 | Cost tracking per agent/model | MVP-P12-R06 | code | [`services/model_router.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/model_router.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-008 | Eval framework + golden dataset (12 cases) | MVP-P12-R04 | code | [`infrastructure/agent_eval.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/agent_eval.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-009 | Adversarial prompt detection (4 categories, 14 patterns) | MVP-P12-R03 | code | [`infrastructure/agent_eval.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/agent_eval.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-010 | Agent metrics collector + kill switches | MVP-P12-R05 | code | [`infrastructure/agent_observability.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/agent_observability.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-011 | Full suite passes (2405 pass, 0 fail) | MVP-P12-R04 | test | `pytest tests/ -q` (SQLite, mock LLM, 1677s) | 2405 PASS | 2026-08-20 | Phase owner |
| EVD-P12-012 | Adversarial detection wired into LLM validator | MVP-P12-R03 | code | [`services/llm_validator.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/llm_validator.py) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-013 | BYOK provider keys (CRUD, rotation, validate, Fernet encryption, priority resolution) | MVP-P12-R01 | code+test | [`services/provider_key_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/provider_key_service.py), [`routers/provider_keys.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/provider_keys.py), [`alembic/versions/0016_provider_keys_byok.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/alembic/versions/0016_provider_keys_byok.py) | 26/26 PASS | 2026-08-20 | Phase owner |
| EVD-P12-014 | Eval framework executed — 12 golden cases through orchestrator | MVP-P12-R04 | test | [`tests/test_agent_eval_execution.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/test_agent_eval_execution.py) | 9/9 PASS | 2026-08-20 | Phase owner |
| EVD-P12-015 | Agents catalog endpoint (8 canonical) | MVP-P12-R01 | code+test | [`routers/agents.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/agents.py), [`tests/test_agent_catalog.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/test_agent_catalog.py) | 4/4 PASS | 2026-08-20 | Phase owner |
| EVD-P12-016 | Memory filters (workspace/superseded/status) | MVP-P12-R03 | code+test | [`routers/memory.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/memory.py), [`schemas/memory.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/schemas/memory.py), [`tests/test_memory_filters.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/test_memory_filters.py) | 8/8 PASS | 2026-08-20 | Phase owner |
| EVD-P12-017 | Research verified: model pricing, ASI01–ASI10, MCP 2026-07-28, NIST RMF + AI 600-1, Gmail watch 7-day expiry | MVP-P12-R02 | research | [`01-source-register.md`](01-source-register.md), [`08-registers.md`](08-registers.md) | VERIFIED | 2026-08-20 | Phase owner |
| EVD-P12-018 | OpenAPI spec regenerated and matches live app (88 paths) | MVP-P12-R07 | test | [`docs/backend/openapi.yaml`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/docs/backend/openapi.yaml), [`tests/test_openapi_spec.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/test_openapi_spec.py) | 4/4 PASS | 2026-08-20 | Phase owner |

## Traceability Matrix

| Requirement | Design | Code | Tests | Evidence | Risk |
| --------------------------------------- | ------------------------- | -------------------------------------------------------- | ----------------------------------------------- | --------------------------- | ----------- |
| MVP-P12-R01 (Safe agent lifecycle) | WS-12.1 | `loop.py`, `router.py`, `agent_observability.py` | Orchestrator tests (54) | EVD-001, 002, 003 | RISK-P12-03 |
| MVP-P12-R02 (Evidence-backed claims) | All workstreams | All files documented | 2405 full suite | EVD-001–018 | RISK-P12-01 |
| MVP-P12-R03 (Security/privacy/AI risks) | WS-12.4, WS-12.2, WS-12.6 | `agent_eval.py`, `llm_validator.py`, `chunking.py`, BYOK | Validator (19), eval execution (9), filters (8) | EVD-004, 005, 009, 012, 016 | RISK-P12-02 |
| MVP-P12-R04 (Validation coverage) | WS-12.4 | `agent_eval.py` (golden dataset) | Eval execution 9/9 + full suite | EVD-008, 011, 014 | RISK-P12-04 |
| MVP-P12-R05 (Operations/telemetry) | WS-12.5 | `agent_observability.py`, `model_router.py` | Orchestrator tests | EVD-010 | RISK-P12-05 |
| MVP-P12-R06 (Data/AI lineage) | WS-12.3 | `model_router.py` (cost), `chunking.py` (metadata) | LLM tests (10) | EVD-006, 007 | RISK-P12-03 |
| MVP-P12-R07 (Traceability) | This document | All evidence mapped | Full matrix | This table | — |
| MVP-P12-R08 (Gate passage) | Gate report | 88.4/100 weighted score | 2405/2405 pass | `09-gate-report.md` | — |

## Deliverable Completion

| Deliverable | Status | Evidence |
| ------------------------------------------------ | ----------- | -------------------------------------------------------------------- |
| DEL-MVP-P12-01 — Agent runtime/policies | ✅ VERIFIED | EVD-001, 002, 003; `loop.py`, `router.py` |
| DEL-MVP-P12-02 — Prompt/tool registry | ✅ VERIFIED | EVD-006, 007, 008; `model_router.py`, `agent_eval.py` |
| DEL-MVP-P12-03 — Retrieval/memory pipelines | ✅ VERIFIED | EVD-004, 005, 016; `chunking.py`, `retrieval.py`, memory filters |
| DEL-MVP-P12-04 — Model router/evals | ✅ VERIFIED | EVD-006, 007, 008, 009, 014; `model_router.py`, `agent_eval.py` |
| DEL-MVP-P12-05 — AI observability/kill switches | ✅ VERIFIED | EVD-010; `agent_observability.py` |
| DEL-MVP-P12-06 — BYOK provider keys (discovered) | ✅ VERIFIED | EVD-013, 015; `provider_key_service.py`, `provider_keys.py`, catalog |
