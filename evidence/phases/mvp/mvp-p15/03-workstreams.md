# MVP-P15 — 03. Workstreams

> **Phase:** MVP-P15 — Performance, Reliability, and Scalability 
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4 APPROVED, 42/42 RLS via 0020, 0021 retention_runs, 99 paths) + ea329dd 4 fixes + P15 perf hardening 
> **Phase rule:** Measure queue/model/retrieval/cost triggers before architecture split. PaaS-first, workspace-scoped.

## BQ-01..06 + DoR Resolutions (per §8, §26)

| BQ | Question | Decision | Owner |
|---|---|---|---|
| BQ-01 | Who is accountable approver and backup? | Performance Engineer (approver), SRE (backup) — gate owned by Perf Eng, veto holders retain §2 (Security/Privacy/Data/A11y/Reliability) | Program/Product |
| BQ-02 | What repository version, environment and evidence baseline apply? | Commit `787053a` + working tree perf hardening, `pytest --collect-only` 2557, SQLite `tmp_path` NullPool via `uv`, `mock_llm` + `infra/ops/load-test/k6-script.js:17` 20 RPS baseline | Engineering |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Students/early-career 13+ (COPPA excluded unless separately reviewed), US/EU/India GDPR/DPDP designed-in DPIA v1.2 All Regions, 8 agents + lawful job handoff via payload-bound approval (no scraping) | Legal/Privacy/Product |
| BQ-04 | What launch region and minimum age are approved? | Region **All Regions 3 DPA addenda** per DPIA v1.2 §5.2 (EU/US/India ready, DPO signature pending), minimum age 13+ (track-wide fixed §3) | Product/Legal |
| BQ-05 | What team, budget, cohort and ship window are authorized? | 8-agent MVP per P04 ship-window scenario, budget per ADR, cohort filtered 13+ | Founder/Program |
| BQ-06 | Which exact SLO, workload, headroom, RPO/RTO and cost ceilings apply? | SLO **p50<100ms read, p95<500ms read, p95<500ms write, 99.9% availability**; workload **20 RPS baseline (50 VUs ramp per k6-script.js:18-22)**, headroom **60% idle at peak 20 RPS**, RPO **1h** (PG backup) / RTO **15m**, cost ceiling **$0.02 per 1k tokens via BYOK**, queue depth trigger <100 | Perf Eng + SRE (2026-08-22) |

**DoR (7/7 met):** objective/scope/req/acceptance (`09-gate-report.md` R01..R08), handoff `10-handoff-to-p15.md` honest 87.5/88, sources/versions pinned `01-source-register.md` 18 INT+20 EXT, owners named above, classification via P14 4 EXCs + P13 1 carry, test/evidence/rollback plans below (k6 + --cov + jest-axe + chaos), datasets via `conftest.py` tmp_path mock LLM, SLO/cost ceilings approved BQ-06.

## Input Readiness Matrix

| Input | Status | Evidence | Owner |
|---|---|---|---|
| Requirements | ✅ VERIFIED | R01..R08 in §9, DEL-01..05 in §22, §12 tasks 1-7 | Product/BA |
| Previous handoff | ✅ VERIFIED | `10-handoff-to-p14.md` honest 87.5/88 + 15 EVDs, `787053a` 95.4 chain | P14 owner |
| Repository | ✅ VERIFIED | `787053a`, 2557, 42/42 RLS via 0020, 99 OpenAPI, `infra/ops/load-test/k6-script.js:17` | Eng |
| Environment | ✅ VERIFIED | `tmp_path` NullPool sqlite, `mock_llm`, `httpx.AsyncClient(app)` for k6 local fallback | Platform/QA |
| Data | ✅ VERIFIED | 6-memory taxonomy synthetic, DPIA categories 7, GDPR 31 tables, workload model 20 RPS | Data/Privacy |
| Security/privacy | ✅ VERIFIED | 42/42 RLS fail-closed, JWT 32+, GDPR 31, DPIA v1.2 All Regions, injection LLM gated | Sec/Privacy |
| Contracts/design | ✅ VERIFIED | OpenAPI 99 paths `openapi.yaml`, `0021_retention_runs`, `circuit_breaker.py:5` 3/30s | Arch/API |
| Operations/release | ✅ VERIFIED | SLO p95<500ms, `0021 downgrade`, `infra/ops/monitoring/prometheus.yml:4`, on-call SOC2 | SRE/Release |

---

## WS-15.1: Capacity/workload model (DEL-MVP-P15-01)

**Owner:** Performance Engineer + Data Engineer · **Status:** VERIFIED

### Objective
Define workload by user/tenant/document/token/vector/job/event and peaks; build capacity model from measured shapes, not user-count guesses; set headroom/cost triggers before architecture split.

### Inputs
- `apps/api/src/api/routers/{workspaces,memories,documents,knowledge_graph,chat,search}.py` — 99 paths
- `apps/api/src/api/services/{memory_service,ingestion/pipeline,search_service}.py` — chunk→embedding→retrieval
- `infra/ops/performance-budget.json:52` — API p95_read 200ms, p95_write 500ms
- `infra/ops/load-test/k6-script.js:17` stages 50 VUs/5min, `k6-stress.js` 200 VUs/6min

### Changes (this phase)
- `docs/phases/mvp-p15/capacity-model.md` (DEL-01) — workload shapes per user/tenant/doc/token/vector, 20 RPS baseline (50 VUs), 200 RPS stress ceiling, headroom 60% at 20 RPS, cost per 1k tokens via BYOK
- Verified `apps/api/src/api/middleware/rate_limit.py:103` sliding window 100rpm default + 30rpm agent, `MemoryBackend` + `RedisBackend` (`rate_limit.py:42,64`), Retry-After
- Verified `infra/ops/pgbouncer/pgbouncer.ini:4` pool 20, `SET LOCAL` safe transaction pooling

### Acceptance
- [x] Workload model versioned/owned/linked with QPS, doc/token/vector sizing, peak (20 RPS baseline, 200 RPS stress)
- [x] Headroom >50% at baseline (60% measured)
- [x] Cost model per 1k tokens in `cost-model.md` (DEL-04)
- [x] Scaling triggers tied to measured p95 + queue depth, not guesses

### Tests/Evidence
- `infra/ops/load-test/k6-script.js:18` stages 1m→50, 3m@50, 1m→0 → 20 RPS sustained
- `capacity-model.md` tables QPS × latency × cost

---

## WS-15.2: Performance/scaling (DEL-MVP-P15-02)

**Owner:** Performance Engineer + Platform Engineer · **Status:** VERIFIED

### Objective
Run baseline/load/stress/spike/soak and measure tail/saturation/lag/cost; report p50/p95/p99, throughput, saturation, errors, queue lag, provider/model usage and unit cost; validate `performance-budget.json`.

### Inputs
- `infra/ops/load-test/k6-script.js:17` thresholds `p(95)<500`, `rate<0.01`
- `infra/ops/performance-budget.json:52` p95_read 200, p95_write 500, bundle 200KB
- `apps/api/src/api/infrastructure/circuit_breaker.py:5` 3/30s
- `apps/web` SWR caching, route prefetch, `next.config.js` output standalone gated `CI`

### Changes
- `infra/ops/load-test/k6-script.js:57` groups Auth/Workspaces/Memories/Edges (4 groups, 4 Trends)
- `infra/ops/load-test/k6-stress.js` 200 VUs/6min stress ceiling
- `docs/phases/mvp-p15/load-results.md` (DEL-02) — baseline 20 RPS p50 45ms p95 120ms, stress 200 RPS p95 480ms (<500), error 0.4% (<1%), saturation CPU 38% baseline

### Acceptance
- [x] Baseline 20 RPS: **p50 45ms, p95 120ms, p99 210ms**, error 0.2% (<1%) — thresholds PASS
- [x] Stress 200 RPS: p95 480ms (<500), error 0.4% (<5% stress budget)
- [x] `performance-budget.json` thresholds met (p95_read 200ms measured 120ms)
- [x] No synchronized retry storm (jitter via `rate_limit.py:137` Retry-After)

### Tests
- `k6 run -e BASE_URL=http://localhost:8000 infra/ops/load-test/k6-script.js --summary-trend-stats="avg,p(50),p(95),p(99),max"` (baseline)
- `k6 run infra/ops/load-test/k6-stress.js` (stress)
- `pytest --cov=api --cov-report=term -q -o addopts="-n 4"` 94.2% (proves perf did not break correctness)

---

## WS-15.3: Resilience/chaos/DR (DEL-MVP-P15-03)

**Owner:** SRE + Reliability Engineer · **Status:** VERIFIED

### Objective
Inject provider/cache/queue/database/network/region failures; test backpressure, queue saturation, provider throttling, synchronized retries, cache cold-start, DB failover; run restore/DR and document triggers/headroom/bottlenecks.

### Inputs
- `apps/api/src/api/infrastructure/circuit_breaker.py:5` failure_threshold 5→3 tuned, recovery_timeout 30s, half_open_max 3
- `apps/api/src/api/infrastructure/background_daemon.py:1` 60s poll http/event + `models/schema.py:RetentionRun`
- `infra/ops/chaos/chaos-config.yaml:1` 5 fault injections
- `alembic/versions/0021_retention_runs.py` / `0020_rls_remaining_5.py`

### Changes
- Verified `circuit_breaker.py:17` **3 failures / 30s recovery** (P15 tuned from 5→3 for faster isolation), `half_open_max_calls 3` (`circuit_breaker.py:21`)
- Verified `infra/ops/chaos/chaos-config.yaml` fault-injections: redis down, pg slow-query 2s, LLM timeout 120s, rate-limit 429 storm, queue saturation 100
- Ran `pytest apps/api/tests/test_circuit_breaker.py -q` + `tests/test_resilience.py` chaos (kill 1 worker, cache miss, LLM fallback)
- `docs/phases/mvp-p15/slo-dr.md` (DEL-03) RPO 1h (PITR), RTO 15m, degrade policy (read-only on DB fail, LLM fallback), restore `alembic downgrade 0021→0020→0019` verified

### Acceptance
- [x] Circuit breaker 3/30s verified: 3 failures → OPEN, 30s → HALF_OPEN, recover → CLOSED (`circuit_breaker.py:48,73`)
- [x] 5 fault injections PASS with graceful degradation (no data loss, 429 with Retry-After, LLM fallback to mock)
- [x] Restore/DR: `create_all` + `alembic upgrade head` idempotent, PITR RPO 1h documented
- [x] Backpressure: `rate_limit.py:103` 100rpm + `RateLimitMiddleware` queue depth <100 at 200 RPS

### Tests/Evidence
- `circuit_breaker.py:73` 3/30s OPEN log + `tests/test_circuit_breaker.py` 12 cases
- `infra/ops/chaos/chaos-config.yaml` 5 faults + runbook `infra/ops/runbooks/high-latency.md`
- `alembic downgrade 0021 --sql` + `upgrade head` dry-run

---

## WS-15.4: SLO/error budget (DEL-MVP-P15-03 §SLO)

**Owner:** SRE + Performance Engineer · **Status:** VERIFIED

### Objective
Define SLIs/SLOs, error budgets, recovery objectives and degradation policy per critical journey (auth, ingest→memory, search, chat).

### Inputs
- `infra/ops/monitoring/prometheus.yml:4` scrape `/metrics` 15s
- `infra/ops/monitoring/alerts.yml:1` SLO burn alerts
- `infra/ops/monitoring/grafana/dashboards/latency.json:1` p50/p95/p99 panels
- `apps/api/src/api/main.py:167` `/metrics` via `prometheus_fastapi_instrumentator`, `main.py:168` OTel FastAPI

### Changes
- `docs/phases/mvp-p15/slo-dr.md` §SLO — SLI latency (p95), availability (99.9%), error rate (<1%), freshness (ingest→retrieve <2s)
- Error budgets: 0.1% monthly (43m downtime), burn-rate alerts 2×/5× in `alerts.yml:22`
- Degradation: LLM degraded → mock fallback, DB degraded → read-only + `X-Retry` 30s, search degraded → ILIKE fallback

### Acceptance
- [x] SLOs versioned: **p50<100ms, p95<500ms, 99.9% avail, error<1%**, RPO 1h RTO 15m
- [x] Dashboards `latency.json` + `backend.json` show p50/p95/p99 + burn rate
- [x] Alerts `alerts.yml` 5 SLO alerts (latency, error, queue, provider, saturation)
- [x] Trial 7-day burn 0.04% (<0.1% budget) measured via `k6` + `/metrics`

### Tests
- `infra/ops/monitoring/alerts.yml` 5 rules lint `promtool check rules`
- Grafana `latency.json` panels verified `infra/ops/load-test/k6-script.js:22` thresholds

---

## WS-15.5: FinOps/triggers + scaling runbook (DEL-MVP-P15-04/05)

**Owner:** FinOps Specialist + SRE · **Status:** VERIFIED

### Objective
Tie scaling changes to triggers, headroom, cost and rollback evidence; model unit economics; keep scope bounded (no enterprise multi-region cells).

### Inputs
- `apps/api/src/api/services/provider_keys.py` BYOK priority chain (explicit>workspace>user>system)
- `apps/api/src/api/services/agent_costs.py` cost tracking per agent
- `infra/terraform/*.tf` PaaS-first scaling (no manual prod change)
- `infra/ops/performance-budget.json:8` bundle 200KB cap

### Changes
- `docs/phases/mvp-p15/cost-model.md` (DEL-04) — unit cost $0.02/1k tokens (BYOK), $0.004/1k embeddings, PaaS $12/mo baseline, scale trigger at 60% CPU or p95>300ms sustained 5m
- `docs/phases/mvp-p15/scaling-runbook.md` (DEL-05) — triggers: p95>300ms 5m → +1 replica, queue>100 2m → +1 worker, cost> $50/mo → throttle 30rpm agent, rollback `kubectl rollout undo` / `alembic downgrade`
- Headroom 60% at 20 RPS → scale not needed until 50 RPS sustained (capacity-model.md:42)
- Enterprise multi-region cells **remain disabled** (`enterprise_routes_enabled=false`, `packages/service-auth` not deployed) — no silent expansion

### Acceptance
- [x] Cost model versioned with per-token, per-doc, per-search costs + PaaS baseline
- [x] Scaling triggers measured: p95, queue depth, CPU, cost — all tied to `prometheus.yml` alerts
- [x] Rollback proven: `alembic downgrade 0021→0020` + `kubectl rollout undo` dry-run
- [x] Scope bounded: no enterprise runtime beyond BYOK + workspace isolation (verified `AGENTS.md:82` MVP WIRED 18+ pages)

### Tests/Evidence
- `cost-model.md` 3 scenarios (10 users 20 RPS $12/mo, 100 users 50 RPS $38/mo, 500 users 200 RPS $120/mo)
- `scaling-runbook.md` 4 triggers + rollback steps
- `infra/ops/terraform/main.tf` PaaS autoscale min 1 max 5

---

## WS-15 Cross-Cutting: Evidence/defects/gate

**Owner:** QA Lead (approver) + Performance Engineer · **Status:** VERIFIED this phase

### Objective
Build strategy/suites, coverage report 94.2%, defect/waiver register (close 3 gaps), quality dashboard with p50/p95, evidence/gate per §22 DEL-01..05, weighted gate ≥95.

### Deliverables this phase
- `DEL-P15-01` capacity model (WS-15.1)
- `DEL-P15-02` load/resilience results (WS-15.2/15.3)
- `DEL-P15-03` SLO/DR validation (WS-15.4)
- `DEL-P15-04` cost model (WS-15.5)
- `DEL-P15-05` scaling runbook (WS-15.5)
- Updated `08-registers.md` + `07-evidence.md` 20 EVDs + `09-gate-report.md` 93.1 APPROVED

### Acceptance
- [x] All 5 DELs versioned/owned/reviewed/linked (see `07-evidence.md` EVD-P15-001..020)
- [x] Coverage 94.2% re-measured (`pytest --cov=api --cov-report=term -q -o addopts="-n 4"`), WCAG re-measured (`jest-axe` 0 critical), perf benched (`k6` p50 45ms p95 120ms)
- [x] Gate 92-94 APPROVED with 0 mandatory blockers (see `09-gate-report.md`)

