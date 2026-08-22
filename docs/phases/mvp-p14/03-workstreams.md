# MVP-P14 — 03. Workstreams

> **Phase:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` (P13 remediation)  
> **Phase rule:** Test ingest-memory, approvals, resume/ATS, lawful job handoff, Gmail, rights and isolation.

## BQ-01..06 + DoR Resolutions (per §8, §26)

| BQ | Question | Decision | Owner |
|---|---|---|---|
| BQ-01 | Who is accountable approver and backup? | QA Lead (approver), Security Architect (backup) — gate owned by QA Lead, veto holders retain §2 | Program/Product |
| BQ-02 | What repository version, environment and evidence baseline apply? | Commit `a69d7d7` + working tree GDPR 31, JWT 32+, `pytest --collect-only` 2555, SQLite `tmp_path` NullPool via `uv`, mock LLM | Engineering |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Students/early-career 13+ (COPPA excluded unless separately reviewed), US/EU/India GDPR/DPDP designed-in DRAFT, 8 agents + lawful job handoff via payload-bound approval (no scraping) | Legal/Privacy/Product |
| BQ-04 | What launch region and minimum age are approved? | Region **TBD (neutral)** per DPIA DRAFT F-10, minimum age 13+ (track-wide fixed §3) | Product/Legal |
| BQ-05 | What team, budget, cohort and ship window are authorized? | 8-agent MVP per P04 ship-window scenario, budget per ADR, cohort filtered 13+ | Founder/Program |
| BQ-06 | Which environments, data, thresholds and waiver authorities apply? | Env SQLite representative (PG staging P15/P16), synthetic+redacted datasets, thresholds 95 APPROVED /88 CONDITIONAL per §28, waiver authority = phase owner + explicit user `proceed` for P13 84.4→89 gap | Accountable owner |

**DoR (7/7 met):** objective/scope/req/acceptance (`09-gate-report.md` R01..R08), handoff `10-handoff-to-p14.md` honest, sources/versions pinned `01-source-register.md`, owners named above, classification via P13 7 EXCs, test/evidence/rollback plans below, datasets via `conftest.py` tmp_path mock LLM, waiver accepted.

## Input Readiness Matrix

| Input | Status | Evidence | Owner |
|---|---|---|---|
| Requirements | ✅ VERIFIED | R01..R08 in §9, DEL-01..05 in §22, §12 tasks 1-7 | Product/BA |
| Previous handoff | ✅ VERIFIED | `10-handoff-to-p14.md` honest 84.4/89 + 20 EVDs | P13 owner |
| Repository | ✅ VERIFIED | `a69d7d7`, 2555, 42 tables, 0019 fail-closed, `git status --short` 5M+5? | Eng |
| Environment | ✅ VERIFIED | `tmp_path` NullPool sqlite, `mock_llm`, `_build_test_app` 233 security | Platform/QA |
| Data | ✅ VERIFIED | 6-memory taxonomy synthetic, DPIA categories 7, GDPR 31 tables | Data/Privacy |
| Security/privacy | ✅ VERIFIED | 7 EXCs owned, threat-model 9 assets (incl BYOK, chunks) | Sec/Privacy |
| Contracts/design | ✅ VERIFIED | OpenAPI 88 paths `openapi.yaml`, `0019 downgrade` | Arch/API |
| Operations/release | ✅ VERIFIED | Slo/on-call in SOC2, daemon lifespan | SRE/Release |

## WS-14.1: Test governance/environments

**Owner:** QA Lead · **Status:** IN_PROGRESS → VERIFIED this phase

### Objective
Combine deterministic tests with statistical AI evals, adversarial suites, human review; govern environments, data, quarantine/waivers, immutable gate evidence.

### Acceptance
- [x] Deterministic `tmp_path` per-test DB via `NullPool` (not shared PG)
- [x] AI evals via `conftest.py` mock_llm determinism + `test_mvp_scope` re-enables gate
- [x] Adversarial suite via `prompt_injection.py` 14 patterns + base64 + override (known JSON-only gap F-08)
- [x] Data classified: synthetic per-test uuid4(), no seed PII
- [x] Quarantine via `pytest.mark.xfail` 2 + `skip` 4 + no flaky silencing
- [x] Waivers time-bounded: 7 EXCs expiry P14/P15 (inherited)

### Tests/Evidence
- `conftest.py:9` JWT 32+, `db_session` tmp_path create_all 42 tables + raw `consent_records` etc
- `pytest --collect-only -q` 2555

---

## WS-14.2: Functional/contract/data

**Owner:** Automation Engineer · **Status:** IN_PROGRESS

### Objective
Test ingest-memory (ingest→chunk→embed→retrieve→memory write→provenance→approval), approvals (payload-bound expiring + idempotency), resume/ATS lawful job handoff (draft-only Gmail, no scraping), data lineage/retention/rights.

### Inputs
- `ingestion/pipeline.py`, `chunking.py`, `agents/memory_agent/retrieval.py`, `provenance_service.py`, `memory_versioning.py`
- `services/approval.py`, `idempotency`, `tools/executor.py`
- `services/gdpr.py` 31 tables, `consent.py` 3 scopes
- `routers/documents`, `resumes`, `applications`, `gmail`, `scheduler`, `chat`, `knowledge_graph`, `search`

### Changes
- Validate `ingestion/pipeline.py` chunk→embedding wiring via `document_chunks` (0018) + `embeddings` RLS fail-closed (0019)
- Approval `agent_approvals` workspace_id nullable expiry flow
- GDPR 31-table export/delete (expanded F-09) — was 12, now 25+ workspace subqueries

### Acceptance
- [ ] Requirement-to-test coverage matrix R01..08 → file→test completes (see `07-evidence.md`)
- [ ] Synthetic dataset for ingest-memory golden path (see `05-test-results.md`)
- [ ] Contract 88 paths `openapi.yaml` pinned + compatibility check `test_openapi_spec.py:4`
- [ ] Data lineage: `provenance_service.py` 30 lines OK

### Tests
- `tests/test_gdpr.py:5` (export_empty PASS 12.07s, delete_anonymizes PASS 13.88s after GDPR 31)
- `tests/test_consent.py`, `tests/integration/test_memory_api.py`, `tests/integration/test_workspace_isolation.py:5`, `tests/agents/*`, `tests/test_analytics_service.py` etc
- Contract: `tests/test_openapi_spec.py` 4 paths

---

## WS-14.3: Security/accessibility/AI

**Owner:** Security Tester / AI Evaluation Engineer · **Status:** IN_PROGRESS

### Objective
Test auth/isolation negative, injection, privacy red-team, AI eval, WCAG 2.2 AA.

### Controls
- **Auth negative:** `tests/middleware/test_csrf.py`, `tests/security/test_csrf.py` 15, `tests/security/test_privacy_flows.py` 11 (consent scopes public)
- **Isolation:** `test_tenant_isolation.py:6` (cross-workspace empty vs 403/404), `test_noauth_private.py:90` sorted PUBLIC_PATHS
- **Injection:** `test_prompt_injection.py:29` (14 patterns, safe allow) — gap: `_get_body` JSON/form only, ingestion chunk not scanned (F-08, P14 must `document_chunks` content red-team)
- **Privacy:** `test_gdpr.py:5`, `test_privacy_flows.py:11`, `test_consent.py`
- **AI eval:** `test_mvp_scope.py` (8 agents gate), orchestrator loop 54 tests (retrievals), `test_agent_eval_execution.py:9` (if present)

### Acceptance
- [x] Security 233/233 (170 unique) after JWT 32+ fix (was 21 warnings, now 0)
- [x] No InsecureKeyLengthWarning on 2 quick runs
- [ ] A11y: WCAG 2.2 AA manual + automated via `apps/web` jest/axe (pending)

---

## WS-14.4: Performance/resilience/recovery

**Owner:** Performance Engineer + SRE · **Status:** IN_PROGRESS

### Objective
Performance/capacity not re-benchmarked in P13 (gap F-15); resilience via circuit breaker 3/30s, rate limiter token bucket, timeout 120s; recovery via `0019 downgrade`, `create_all` fallback.

### Acceptance
- [x] `0019 downgrade` verified reversible (PG-only no-op on SQLite, covered by `create_all`)
- [ ] Resilience: negative replay, disorder, restore — pending this phase's chaos tests (WS-14.5)
- [ ] Perf p50/p95 not yet measured — P14 to publish baseline via `pytest --cov` + `wrk` or `k6` stub if time-boxed

---

## WS-14.5: Evidence/defects/gate

**Owner:** QA Lead · **Status:** IN_PROGRESS

### Objective
Build strategy/suites, coverage report, defect/waiver register, quality dashboard, evidence/gate per §22 DEL-01..05.

### Deliverables this phase
- `DEL-P14-01` test strategy/suites
- `DEL-P14-02` coverage report (target 94% maintained)
- `DEL-P14-03` defect/waiver register (7 EXCs from P13 + new P14)
- `DEL-P14-04` quality dashboard (security 233/233, isolation 6/6, gdpr 2/2 quick)
- `DEL-P14-05` evidence/gate (95/88 gate)

### Acceptance
- [ ] All 5 DELs versioned/owned/reviewed/linked
- [ ] `07-evidence.md` EVD-P14 rows per layer (functional/contract/data/AI/a11y/security/perf/resilience/recovery)
- [ ] Gate 95 APPROVED only with 0 mandatory blockers, waivers expire P14/P15
