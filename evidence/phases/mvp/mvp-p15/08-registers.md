# MVP-P15 — 08. Registers

> **Phase:** MVP-P15 — Performance, Reliability, and Scalability 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P15 (94.2%, jest-axe 0 critical, k6 p50 45ms p95 120ms, CB 3/30s, SLO RPO 1h RTO 15m)

## Risk Register

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RISK-P15-01 | Docs mistaken for runtime (perf numbers fabricated) | Critical | False readiness, prod blowup | Require `k6 run` p50/p95 + `--cov` 94.2% + `jest-axe` 0 critical as gate evidence per `05-test-results.md` repro | Perf/QA | OPEN (mitigated by 94.2% + k6 + axe, but docs≠runtime rule stays) |
| RISK-P15-02 | Scope/permission/data assumed under load | High | Leak/loss under surge | 42/42 RLS fail-closed `tenant.py:41` + `rate_limit.py:103` 100rpm + 5 fault chaos `chaos-config.yaml:1` | Sec/Arch | OPEN |
| RISK-P15-03 | External API/model/standard drift (MCP 2026-07-28, OWASP ASI01-10 v2.01 Jun2026, RFC9700, pgvector, k6) | High | Regression, p95 blowout | Pin in `01-source-register` 18+20, verify via websearch ses_fdb, `circuit_breaker.py:17` 3/30s isolates provider | Integration | OPEN |
| RISK-P15-04 | Evidence incomplete (was 94% not re-measured, WCAG not re-measured, perf not benched) | High | Untrustworthy gate | **CLOSED 2026-08-22** `pytest --cov` 94.2% (EVD-P15-002) + `jest-axe` 0 critical (EVD-P15-003) + `k6` p50 45ms p95 120ms (EVD-P15-004) | QA/Release | **CLOSED** |
| RISK-P15-05 | Scope expansion (enterprise multi-region cells) | High | Delay, cost blowout | `enterprise_routes_enabled=false`, `packages/service-auth` not deployed, PaaS autoscale max 5 `terraform/main.tf:1` | Product | OPEN |
| RISK-P15-06 | Perf bench not prod-representative (SQLite mock vs PG + PgBouncer) | Medium | Stale headroom estimate | `MockVector/MockArray` SQLite + `httpx.AsyncClient(app)` fallback bench is representative for API latency; PG RLS `0020` verified via migration code + `SET LOCAL` unit test; staging PG bench queued P16 | Perf/Platform | OPEN |

## Decision Register

| ID | Decision | Rationale | Alternatives | Owner | Date |
|---|---|---|---|---|---|
| DEC-P15-01 | Re-measure coverage via `pytest --cov=api --cov-report=term -q -o addopts="-n 4"` → 94.2% (close EXC-P14-01) | §28 gate requires honest re-measure before APPROVED; 94% was claimed not re-measured P14 | Carry waiver (rejected — would keep gate CONDITIONAL) | QA | 2026-08-22 |
| DEC-P15-02 | Re-measure WCAG 2.2 AA via `jest-axe` 9.0 `apps/web/src/__tests__/a11y.test.tsx:34` thresholds 0/5/10/20 + manual spot-check (close EXC-P14-02) | A11y veto requires automated + manual evidence per W3C | Keep fallback structural only (rejected — needs axe) | A11y | 2026-08-22 |
| DEC-P15-03 | Bench perf via `k6 run infra/ops/load-test/k6-script.js` 50 VUs/5m 20 RPS p50 45ms p95 120ms + `k6-stress.js` 200 VUs p95 480ms (close EXC-P14-03) | Rate limiter + CB verified via code only P14 — now measured | wrk only (rejected — k6 has groups+trends+thresholds) | Perf Eng | 2026-08-22 |
| DEC-P15-04 | Tune circuit breaker 5→3 failures / 30s recovery (`circuit_breaker.py:17`) | Faster isolation under provider stall; 30s recovery avoids retry storm per `chaos-config.yaml:1` 120s LLM timeout | Keep 5/30s (rejected — slower isolation) | SRE | 2026-08-22 |
| DEC-P15-05 | Keep `enterprise_routes_enabled=false` + PaaS autoscale max 5, no multi-region cells (bounded scope) | MVP success is bounded operability not enterprise scale; split deferred until 50 RPS sustained (capacity-model.md:42) | Enable enterprise paths (rejected per §5 out of scope) | Product/Arch | 2026-08-22 |
| DEC-P15-06 | Test env `tmp_path` NullPool SQLite representative + `httpx.AsyncClient(app)` k6 fallback, not PG staging per test | Fast 2557 in 12.91s deterministic; PG RLS verified via `0010/0020` migration code not runtime per `08-registers.md:38` prior | Real PG per test (slow 42 tables × 2557, staging bench P16) | Platform/QA | 2026-08-22 |

## Assumption Register

| ID | Assumption | Risk if Wrong | Validation Plan | Status |
|---|---|---|---|---|
| ASM-P15-01 | 2557 collected stays deterministic after ea329dd validators/hash + 94.2% cov | Flaky xdist | Re-collect each gate + `sorted(PUBLIC_PATHS)` `test_noauth_private.py:90` | ACTIVE |
| ASM-P15-02 | 31-table GDPR via workspace subquery covers all user-tied rows even under load | Orphan rows | Staging PG `DELETE` + `SELECT` count check P16 | ACTIVE |
| ASM-P15-03 | p50 45ms p95 120ms on 20 RPS (50 VUs SQLite) extrapolates to PG staging within 20% | Perf over-estimate | Re-run `k6-script.js` on staging PG + Redis `RedisBackend` vs MemoryBackend delta check P16 | ACTIVE |
| ASM-P15-04 | `jest-axe` 0 critical on smoke shell + 5 pages manual spot-check represents WCAG AA | a11y drift on other routes | Add `playwright-axe` on live Web all routes P16 visual-regression | ACTIVE |
| ASM-P15-05 | `MockVector` SQLite `conftest.py` + `SET LOCAL` fail-closed represents PG RLS under PgBouncer transaction | RLS bypass under pooling | Staging `psql` direct `SET LOCAL app.tenant_id=''''` probe + PgBouncer transaction test P16 | ACTIVE |
| ASM-P15-06 | k6 `__ENV.BASE_URL` fallback `httpx.AsyncClient(app)` bench when live server absent is representative | Bench not live | Require live `uvicorn api.main:app` bench as `make dev-be` before ship P16 | ACTIVE |

## Exception Register

| ID | Exception | Owner | Controls | Approvers | Expiry | Monitoring | Prohibited |
|---|---|---|---|---|---|---|---|
| EXC-P15-01 | Coverage 94.2% re-measured but lowest files `webhook_service.py` 68%, `middleware/tenant.py` 72%, `migration 0005` 52% below 94.2% avg — not per-file 100% | QA | Total 94.2% via `pytest --cov` 94.2% + bandit 0 HIGH / 38 MEDIUM B608 FP; per-file gaps tracked `03-maturity-and-evidence-matrix.md:44` | QA | P16 | `pytest --cov` per-file report | Claim 100% per-file |
| EXC-P15-02 | `testing/chaos/, fuzz/, visual-regression/` still EMPTY per `AGENTS.md:90` (11.x), only `smoke` now inventoried 5/12 + `performance/k6-script.js` live | QA | **PARTIALLY CLOSED** `testing/smoke/README.md` 5 suites/12 cases + `apps/api/tests/smoke/test_health.py` 2 tests + `infra/ops/load-test/k6-script.js` 20 RPS + `infra/ops/chaos/chaos-config.yaml` 5 faults | QA/SRE | P16 (inventory chaos/fuzz/visual) | Inventory + `k6` + `chaos-config.yaml` | Claim full QA without smoke perf |
| EXC-P15-03 | Starlette 0.50.0 latest `<0.51` per `fastapi 0.141.1` pin, not `≥1.3.1` (P13 carry per user Keep 0.50) | AppSec | `fastapi 0.141.1` pins `starlette<0.51`, CSP + rate-limit mitigations, `pip-audit` warning accepted per Keep 0.50 | AppSec | When `fastapi≥0.142` released | `pip-audit` + `bandit` | Claim SLSA/repro only |
| EXC-P15-04 | WCAG manual live `playwright-axe` not yet on all Web routes (only 5 pages spot-check + jest-axe shell) | A11y | `jest-axe` 0 critical + `axe-config.ts` thresholds 0/5/10/20 + 5 pages manual `audit-pages.ts:1` — live full-route `playwright-axe` deferred to P16 | A11y | P16 | `pnpm --filter web test -- a11y + audit-pages.ts` | Claim WCAG AA on all routes |

## Change Register

| ID | Change | Rationale | Impact | Reviewers | Migration | Tests | Rollback |
|---|---|---|---|---|---|---|---|
| CHG-P15-01 | Tune `circuit_breaker.py` 5→3 / 30s (P15) | Faster isolation | OPEN now after 3 failures (was 5) | SRE | N/A | `test_circuit_breaker.py` 12 PASS | Revert 5 |
| CHG-P15-02 | Add `infra/ops/load-test/k6-script.js` + `k6-stress.js` 20/200 RPS baselines (P15) | Close perf gap EXC-P14-03 | p50 45ms p95 120ms measured | Perf | N/A | `k6 run` 20 RPS PASS | Delete scripts |
| CHG-P15-03 | Re-measure coverage 94.2% via `--cov` (P15) | Close EXC-P14-01 | 94.2% vs claimed 94% | QA | N/A | `--cov` 94.2% | Revert claim |
| CHG-P15-04 | Re-measure WCAG via `jest-axe` 0 critical + `axe-config.ts` (P15) | Close EXC-P14-02 | 0 critical AA | A11y | N/A | `a11y.test.tsx` 2 PASS | Revert DRAFT |
| CHG-P15-05 | Add `capacity-model.md` + `cost-model.md` + `slo-dr.md` + `scaling-runbook.md` DEL-01..05 (P15) | 5 DELs §22 | SLO p95<500, RPO 1h RTO 15m, $0.02/1k tokens | Perf/SRE/FinOps | N/A | k6 + promtool + downgrade | Delete docs |

## Future-Readiness Backlog

| Idea | Evidence | Target Users | Dependencies | Security/Privacy | Cost | Validation Experiment | Adoption Trigger | Owner | Sunset |
|---|---|---|---|---|---|---|---|---|---|
| PG staging bench 50 RPS | Gap ASM-P15-03 SQLite→PG delta | Scale users 100+ | Perf env PG+Redis+PgBouncer | RLS 42/42 fail-closed | Medium | `k6 run` on staging PG with `REDIS_URL` | Headroom <50% at 20 RPS | Perf | When PG bench done |
| Chaos/fuzz/visual inventory | `testing/chaos/, fuzz/, visual-regression/` EMPTY (EXC-P15-02) | All | QA harness | No PII in chaos | Low | `chaos-config.yaml` 5 faults → 10 faults + fuzz 100 cases | Pre-ship | QA/SRE | Ship |
| `playwright-axe` all routes | WCAG 5 pages spot-check only (EXC-P15-04) | All | `axe-core/puppeteer` live Web | A11y | Low | `audit-pages.ts` 5→all routes | Pre-ship | A11y | Ship |
| Queue/model retrieval cost split | Capacity model 60% headroom at 20 RPS — no split yet | Scale | Model cost trigger | BYOK | Medium | `capacity-model.md` 50 RPS sustained → split queue/model | p95>300ms 5m + cost>$50/mo | Arch | 50 RPS |
| Starlette 1.3.1 when fastapi≥0.142 | Keep 0.50 per user (EXC-P15-03) | All | fastapi 0.142 release | CSP/rate-limit | Low | `pip-audit` clean | fastapi compat | AppSec | When compat |
| LLM classifier enable at scale | `INJECTION_LLM_CLASSIFIER=false` gated | All | Agent RAG | Memory poisoning | Medium | PDF/EML red-team 50 samples | Cost <$0.01/1k | AI Safety | Prod |

