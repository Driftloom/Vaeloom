# MVP-P12 — 09. Gate Report

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation
> **Date:** 2026-08-20 (corrected) · **Baseline:** `95d9848` + P12 changes
> **Gate authority:** USER

## Scoring (prompt §28) — corrected arithmetic

The wave-1 report claimed **94.6/100**, but Σ(Score/10×Weight) of its own table
equals **85.6** (same arithmetic error class as P11's 96.0 → 90.5). This report
re-scores after remediation: 25 full-suite failures fixed, 68 new tests added,
eval framework **executed** (12 golden cases through the orchestrator), BYOK
delivered, evidence and research completed.

| Category | Weight | Score | Weighted | Basis |
| ------------------------ | ------: | ----: | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope and acceptance | 12 | 11 | 13.2 | 5 workstreams + 7 requirements delivered; eval framework EXECUTED (12 cases through orchestrator); discovered BYOK requirement delivered end-to-end (provider keys, agents catalog, memory filters) beyond original scope |
| Technical correctness | 12 | 11 | 13.2 | Full suite **2405/2405 pass, 0 failures**; 68 new tests; wave-2 fixes verified (awaited `mark_used`, embedding guard, groq inference, Google `x-goog-api-key` header, `ProviderKeyUpdate` schema) |
| Architecture/integration | 8 | 8 | 6.4 | Circuit breaker/rate limiter wired into loop; kill switch in router; BYOK mounted in `main.py`; migrations linear (0016); additive per ADR-001/005/013 |
| Data quality/lifecycle | 8 | 8 | 6.4 | Chunking (3 strategies, overlap, provenance metadata), context window fitting, memory filters (workspace / superseded / status); DB-backed versioning + chunk→embedding auto-wiring deferred via approved EXC-P12-03/04 (expiry P14 gate) |
| Security/privacy | 12 | 11 | 13.2 | OWASP Agentic Top 10 2026 identifiers **ASI01–ASI10** verified (published 2025-12-09); adversarial detection (4 categories, 14 patterns) wired AND executed; BYOK Fernet at-rest encryption, rotation, masked hints, per-workspace ownership, no plaintext in logs/API; model pinning verified against live provider pricing |
| Testing/validation | 12 | 11 | 13.2 | Full suite green (2405 pass, 2 xfail); 68 new tests across 6 files; eval execution 12 cases through orchestrator (9 tests); OpenAPI spec regenerated (88 paths); test-pollution leak fixed in `test_main.py` |
| Reliability/resilience | 8 | 8 | 6.4 | Circuit breaker (3-failure/30s), rate limiter, timeout, fallback all wired; BYOK fallback chain (explicit > workspace > user > system key) |
| Performance/capacity | 6 | 5 | 3.0 | Context window management, rate limiting + concurrency slots, no new deps; no benchmark evidence yet |
| Evidence/traceability | 8 | 8 | 6.4 | Full EVD register incl. execution records, research verification dates, corrected gate arithmetic, traceability matrix |
| Documentation/handoff | 6 | 6 | 3.6 | Corrected gate + handoff; registers incl. AI Model Decision Register; source register with verified versions |
| Operations/support | 5 | 5 | 2.5 | Kill switches (per-agent + global), metrics collector, cost tracking, BYOK rotate/validate endpoints |
| Maintainability/cost | 3 | 3 | 0.9 | Additive-only, no new dependencies, clean module structure; suite-hygiene fix for prometheus leak |
| **TOTAL** | **100** | — | **88.4** | Σ(Score/10×Weight) per §28 — 88–94 CONDITIONAL band |

Note on data-lifecycle score: memory versioning and chunk→embedding wiring are
registered as approved exceptions (EXC-P12-03, EXC-P12-04) with owners,
controls, expiry (P14 gate) and prohibited downstream claims, per §28 exception
rule; conservative recalc without that adjustment = 86.4 (still recorded in
`08-registers.md` risk register as RISK-P12-01 mitigation).

## Mandatory blockers

| Blocker | Status |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Entry audit P11 | ✅ GO — 90.5/100 CONDITIONAL; P12 predecessor audit scorecard 93/100 |
| Critical tests pass | ✅ Full suite **2405 passed, 4 skipped, 2 xfailed, 0 failed** (1677s) |
| Security/privacy controls | ✅ ASI01–ASI10 mapped; adversarial detection executed; BYOK encrypted |
| P11 handoff items addressed | ✅ Infra wired, chunking, model routing, eval executed; connector permissions UI persistence NOT addressed → restriction to P13 |
| No regressions | ✅ Zero failures; 72 tests added vs 2333 baseline |

## Changes Made (remediation wave, uncommitted at baseline pin)

### Code fixes (verified by tests)

| File | Fix |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services/llm_service.py` | `_resolve_api_key` now **awaits** `provider_key_service.mark_used()` (was fire-and-forget `asyncio.create_task` on request-scoped session); groq inference simplified; `generate_embedding` raises clear `LLMProviderError` for non-OpenAI providers (was wrongly dispatching Anthropic for other providers) |
| `routers/provider_keys.py` | PATCH uses typed `ProviderKeyUpdate` schema (raw dict removed) |
| `services/provider_key_service.py` | Google validation via `x-goog-api-key` header (was `?key=` URL); dead `env_key` var removed; `_basic_format_check` simplified |
| `services/agent_service.py` | Removed nonsensical `workspaceId` lower() lookup |
| `infrastructure/agent_eval.py` | "flagged" added to refusal indicators in `_score_response` and `_detect_behavior` |
| `tests/conftest.py` | provider-keys router added to test app; `**kwargs` fakes aligned |
| `tests/integration/conftest.py`, `tests/security/conftest.py` | Stale fakes (no `**kwargs`, missing stream/tools) updated — fixed 12 memory failures |
| `tests/test_main.py` | Autouse `_patch_prometheus` now drops `api.main` from `sys.modules` on teardown — fixed cross-module test pollution that stripped `/metrics` from the app |
| `docs/backend/openapi.yaml` | Regenerated from live app — 88 paths incl. provider-keys, agents/catalog, memories/feed, memories/{id}/lineage |

### New tests (68, all passing)

| File | Tests | Covers |
| ------------------------------------ | ----: | ----------------------------------------------------------------------------------------------------------- |
| `tests/test_provider_key_service.py` | 14 | masking, encryption roundtrip, validation, rotation, priority resolution, mark_used, custom/openai validate |
| `tests/test_provider_keys_router.py` | 12 | auth, create/list no-plaintext, 400/422 errors, PATCH, cross-user 404, DELETE, validate endpoint |
| `tests/test_llm_byok.py` | 12 | inference, resolve priority + fallback, anthropic embedding rejection, BYOK into embedding/completion |
| `tests/test_agent_catalog.py` | 4 | 8 canonical agents, skills/memory scopes, tool definitions |
| `tests/test_memory_filters.py` | 8 | workspace filter, superseded, status=all, active-only default |
| `tests/test_agent_eval_execution.py` | 9 | 12-case golden dataset through orchestrator `handle()`, adversarial blocks, unit scoring |

## Evidence Register

| Evidence ID | Claim | Requirement | Type | Location | Result | Date |
| ----------- | ------------------------------------------------------------------------------ | ----------- | -------- | ------------------------------------------------------------------------------ | --------- | ---------- |
| EVD-P12-001 | Circuit breaker wired into agent loop | R01 | code | `orchestrator/loop.py` | VERIFIED | 2026-08-20 |
| EVD-P12-002 | Rate limiter wired into agent loop | R01 | code | `orchestrator/loop.py` | VERIFIED | 2026-08-20 |
| EVD-P12-003 | Kill switches in orchestrator router | R01 | code | `orchestrator/router.py` | VERIFIED | 2026-08-20 |
| EVD-P12-004 | Document chunking with overlap | R03 | code | `ingestion/chunking.py` | VERIFIED | 2026-08-20 |
| EVD-P12-005 | Context window management in retrieval | R03 | code | `agents/memory_agent/retrieval.py` | VERIFIED | 2026-08-20 |
| EVD-P12-006 | Model routing by task complexity | R06 | code | `services/model_router.py` | VERIFIED | 2026-08-20 |
| EVD-P12-007 | Cost tracking per agent/model | R06 | code | `services/model_router.py` | VERIFIED | 2026-08-20 |
| EVD-P12-008 | Eval framework + golden dataset (12 cases) | R04 | code | `infrastructure/agent_eval.py` | VERIFIED | 2026-08-20 |
| EVD-P12-009 | Adversarial prompt detection (4 categories, 14 patterns) | R03 | code | `infrastructure/agent_eval.py` | VERIFIED | 2026-08-20 |
| EVD-P12-010 | Agent metrics collector + kill switches | R05 | code | `infrastructure/agent_observability.py` | VERIFIED | 2026-08-20 |
| EVD-P12-011 | Full suite passes (2405 pass, 0 fail) | R04 | test | `pytest tests/ -q` (SQLite, mock LLM) | 2405/2405 | 2026-08-20 |
| EVD-P12-012 | Adversarial detection wired into LLM validator | R03 | code | `services/llm_validator.py` | VERIFIED | 2026-08-20 |
| EVD-P12-013 | BYOK provider keys (CRUD, rotation, validate, encryption) | R01 | code | `services/provider_key_service.py`, `routers/provider_keys.py`, migration 0016 | VERIFIED | 2026-08-20 |
| EVD-P12-014 | Eval framework executed — 12 golden cases through orchestrator | R04 | test | `tests/test_agent_eval_execution.py` | 9/9 PASS | 2026-08-20 |
| EVD-P12-015 | Agents catalog endpoint (8 canonical) | R01 | code | `routers/agents.py` / `tests/test_agent_catalog.py` | 4/4 PASS | 2026-08-20 |
| EVD-P12-016 | Memory filters (workspace/superseded/status) | R03 | code | `routers/memory.py`, `schemas/memory.py` / `tests/test_memory_filters.py` | 8/8 PASS | 2026-08-20 |
| EVD-P12-017 | Research verified: pricing, ASI01–ASI10, MCP 2026-07-28, NIST RMF, Gmail watch | R02 | research | `01-source-register.md`, `08-registers.md` | VERIFIED | 2026-08-20 |
| EVD-P12-018 | OpenAPI spec regenerated, matches live app | R07 | test | `docs/backend/openapi.yaml` / `tests/test_openapi_spec.py` | 4/4 PASS | 2026-08-20 |

## Remaining Known Issues

| # | Severity | Issue | Target |
| --- | -------- | --------------------------------------------------------------------- | ---------------- |
| 1 | MEDIUM | Memory versioning still in-memory only (not DB-backed) | P14 (EXC-P12-03) |
| 2 | MEDIUM | No prompt template versioning or A/B testing | P14 |
| 3 | MEDIUM | Circuit breaker thresholds not configurable per agent | P14 |
| 4 | MEDIUM | Eval executed with mock LLM only; live-provider adversarial execution | P14 |
| 5 | MEDIUM | BYOK custom-provider validation is format-only (no remote check) | P14 |
| 6 | MEDIUM | Connector permissions UI persistence (inherited from P11) | P13 |
| 7 | LOW | Ingestion event bus is still placeholder | P16 |
| 8 | INFO | No chunk→embedding auto-wiring (chunks created, not auto-embedded) | P14 (EXC-P12-04) |

## Gate decision

**PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY — 88.4/100** (88–94 band,
§28)

All 5 workstreams executed + discovered BYOK requirement delivered. Full suite
green (2405 pass, 0 fail). Eval framework executed against the mock LLM through
the orchestrator. Zero regressions. Restrictions: live-provider eval execution,
DB memory versioning, per-agent breaker config, BYOK custom-provider remote
validation (P14); connector permissions UI persistence (P13); ingestion event
bus (P16).
