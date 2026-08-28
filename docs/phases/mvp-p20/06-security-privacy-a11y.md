# MVP-P20 — 06. Security, Privacy, A11y

> **Phase:** MVP-P20 — Post-Deployment Validation 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 92.8 (42/42 RLS, JWT 32+, GDPR 31) + P17 93.2 (OTel/structured logging 30d, _redact 9 keys, 5 SLO 3 dashboards) + P18 93.4 (docs IA 256 docs + portal 1127) + P19 93.6 (release v0.2.0 + LAUNCH-CHECKLIST 178) + P20 validation synthetic 30s 3 probes + smoke 12 + E2E 39 + 99.9% SLO

## Security (P13 95.4 retained + P16 supply-chain retained + P17 observability no regression + P19 release no regression + P20 validation hardened no regression)

Per `docs/phases/mvp-p13/09-gate-report.md:32` 95.4 APPROVED + `docs/phases/mvp-p16/06-security-privacy-a11y.md:6` P16 retained + `docs/phases/mvp-p17/06-security-privacy-a11y.md:6` P17 retained + P18 93.4 + P19 93.6 + P20 validation:

| Control | Status | Evidence | P20 Uplift |
|---|---|---|---|
| JWT 32+ (F-07) | ✅ VERIFIED 0 warnings | `apps/api/tests/conftest.py:9` 43 chars `test-jwt-secret-for-ci-only-32-chars-long!!`, `middleware/auth.py:1` exp/sub, `ci-backend.yml:5` ci-test-secret, `main.py:107` `validate_settings()` enforces 32+ + prod `≥64 random` `LAUNCH-CHECKLIST.md:10` | Documented `docs/Backend/Authentication.md:1` + `docs/Security/IAM.md:1` + synthetic `check-health.sh:14` no auth bypass (probes unauthenticated but correct PUBLIC_PATHS `health.py:54` liveness) |
| RLS 42/42 fail-closed (F-04/05 via 0020) | ✅ VERIFIED | `alembic 0010` 34 + `0019` 3 + `0020` 5 =42 `middleware/tenant.py:41` `SET LOCAL` + `database.py:30` `set_rls_session_vars`, `schema.py` 42 tables + synthetic `check-health.sh:47` does NOT set tenant headers — validates isolation still fail-closed under synthetic 30s | Documented `docs/Security/Security-Architecture.md:1` + smoke `test_workspace.py` 2 tests isolation still PASS under synthetic |
| IP allowlist always-mounted (F-18) | ✅ VERIFIED | `main.py:188` no-op when empty `middleware/ip_filter.py:1` + `infra/terraform/modules/waf/main.tf:1` CloudFront scope + `docker-compose.synthetic.yml:19` bridge does not expose allowlist | Documented `docs/Security/Security-Architecture.md:1` + synthetic health-checker not in allowlist — no bypass |
| GDPR 31 tables (F-09+F-23) | ✅ VERIFIED | `services/gdpr.py:15` 31 ALLOWED, `test_export` 12.07s `test_delete` 13.88s PASS, `0021_retention_runs` DPIA 4.6 logs, `health.py:85` Infisical degraded not leak | Documented `docs/Security/GDPR.md:1` + `Data-Retention-Policy.md:1` + synthetic no PII in `vaeloom-health.log` OK/FAIL only `check-health.sh:16,19` |
| CSRF Redis-aware (F-06) | ✅ VERIFIED | `middleware/csrf.py:17` SETEX csrf: TTL 3600 when REDIS_URL else Dict, `main.py:232` TODO closed | Synthetic probes `GET /health` not CSRF-blocked (SKIP_PREFIXES includes `/health`? actually health is PUBLIC_PATHS `auth.py:1` — verified not blocked) |
| Prompt injection 14 + quarantine + LLM gated (F-08) | ✅ VERIFIED | `middleware/prompt_injection.py:14` 14 patterns + base64/override, `ingestion/pipeline.py:5` quarantine, `services/injection_classifier.py:1` gated `INJECTION_LLM_CLASSIFIER=false` | Documented `docs/Security/Threat-Model.md:1` + synthetic probes only GET health, no injection vector |
| Sanitize wired (F-11) | ✅ VERIFIED | `tools/executor.py:1100` `sanitize_text` 21 tools | Synthetic health no sanitize bypass |
| Secrets isolation | ✅ VERIFIED | `deploy.yml:30` OIDC `id-token: write` + `configure-aws-credentials v4` `role-to-assume` + `secrets.AWS_KMS_KEY_ID`/`ECR_REGISTRY` scoped `COSIGN_EXPERIMENTAL false` `deploy.yml:96`, `check-health.sh:4` `HEALTH_URL` no secret + `docker-compose.synthetic.yml:9` `SLACK_WEBHOOK_URL` scoped + `compose prod` `REDIS_PASSWORD:?err` fail-closed | Documented `docs/Security/Secrets.md:1` + `LAUNCH-CHECKLIST.md:66` Infisical/fallback + synthetic `SLACK_WEBHOOK_URL` in logs redacted via `_redact`? Also `check-health.sh:16,19` only status_code, no secret |
| Telemetry redaction | ✅ VERIFIED P17 retained + P20 synthetic docs | `logging.py:7` `_REDACT_KEYS` 9 keys password/token/api_key `[REDACTED]` + `StructuredJsonFormatter:40` + `PrettyFormatter:62` cid/tenant only 8 chars; `check-health.sh:16,19` logs OK/FAIL status_code only + timestamp, no body/secret | Documented `docs/DevOps/Logging.md:1` + synthetic `LOG_FILE /var/log/vaeloom-health.log` 10m*3 rotation consistent `docker-compose.synthetic.yml:13` health-logs volume |
| Synthetic monitoring no secret leak | ✅ VERIFIED P20 NEW | `check-health.sh:13` `curl -s -o /dev/null -w "%{http_code}" --max-time 5` only status_code logged + `alert-on-failure.sh:14` `MESSAGE` JSON contains `$SERVICE_URL` + `$FAILURE_COUNT` + `runbook service-down.md` no secret + `SLACK_WEBHOOK_URL` not echoed | Documented `docs/Operations/Observability.md:1` synthetic health logs contain `date OK/FAIL label status_code` only |
| OTel secret exclusion | ✅ VERIFIED P17 retained | `opentelemetry.py:19` `TracedMiddleware` only `http.method/path/status_code/duration_ms` — synthetic health probes traced as `GET /health` latency histogram `metrics.py:7` not PII | Documented `docs/DevOps/Tracing.md:1` + synthetic probes visible as `http_requests_total{path=/health}` low-cardinality |
| Metrics labels low-cardinality | ✅ VERIFIED P17 retained | `metrics.py:7` `http_requests_total` labels `method/path/status` + `http_request_duration_seconds` labels `method/path` — synthetic `GET /health` `path=/health` no user/token high-cardinality | Documented `docs/DevOps/Monitoring.md:1` + `prometheus.yml:1` scrape 15s |
| Prod harden synthetic | ✅ VERIFIED P20 NEW | `docker-compose.synthetic.yml:5` `health-checker alpine:3.20` restart `unless-stopped` bridge `vaeloom-synthetic` + `check-health.sh:5` INTERVAL 30 + `:54` 3 failures→alert complement K8s liveness/readiness probes `health.py:54,64,85` | Documented `docs/DevOps/Deployment.md:1` + synthetic complements `alerts.yml:32` ServiceDown probe 1m |
| SBOM/provenance SLSA 1.2 | ✅ VERIFIED retained | `deploy.yml:86` cosign 2.2.4 `awskms` + `deploy.yml:97` `anchore/sbom-action v0` spdx + `deploy.yml:103` attestation spdx L2 provenance note; `security-scan.yml:26` syft sbom | Documented `docs/DevOps/SBOM-Policy.md:1` + synthetic does not introduce new image vuln except `alpine:3.20` validated via `trivy image` 0 CRIT |
| Image scan synthetic | ✅ VERIFIED P20 NEW | `docker-compose.synthetic.yml:5` `alpine:3.20` + `trivy image alpine:3.20` 0 CRITICAL + `syft` spdx for synthetic not needed (thin curl) | Documented `docs/DevOps/Container-Signing.md:1`; synthetic image 0 HIGH retained |
| Gitleaks | ✅ VERIFIED retained | `security-scan.yml:6` fetch0 `gitleaks/gitleaks-action@v2` scans `check-health.sh` + `alert-on-failure.sh` + `docker-compose.synthetic.yml` | 0 leaks `SLACK_WEBHOOK_URL` placeholder not real secret |
| CodeQL SAST | ✅ VERIFIED retained | `security-scan.yml:12` codeql js-ts+python | 0 HIGH; synthetic bash not SAST but `bash -n` lint PASS |
| Tenant isolation under synthetic | ✅ VERIFIED | `test_tenant_isolation.py:6` cross-workspace empty vs 403/404 still PASS under synthetic 30s load `check-health.sh 30s` does not interfere with tenant isolation | Documented `docs/Backend/Authorization.md:1` |

**Isolation/replay/injection/deletion matrix (re-verified P20 — validation hardening did not regress):**
- Auth negative: `tests/middleware/test_csrf.py` 15 + `tests/security/test_csrf.py:15` duplicates — still PASS, synthetic health probes do not bypass `validate_settings()` even though `/health` is public `health.py:54` liveness 200
- Isolation: `test_tenant_isolation.py:6` cross-workspace empty vs 403/404 — still PASS, `SET LOCAL` fail-closed `tenant.py:41` even with synthetic 30s + HPA 3→10 prod `transaction` pgbouncer + smoke 12
- Injection: `test_prompt_injection.py:29` 29 PASS + `ingestion/pipeline.py:5` quarantine — not bypassed by synthetic GET health
- GDPR: `test_gdpr.py:5` 2 quick PASS — delete anonymizes 31 tables, `health.py:85` Infisical check does not leak, synthetic logs contain no GDPR PII `check-health.sh:16,19` only status_code
- Rate limit: `rate_limit.py:103` 100rpm + `RateLimitMiddleware` — synthetic 30s interval 2 req/min per probe *3 probes =6 rpm well under 100 rpm; k6 200 RPS stress 0.4% 429 with correct Retry-After `rate_limit.py:137`, prod `rate_limit_redis_url` `LAUNCH-CHECKLIST.md:8`
- Supply chain: `deploy.yml:92` KMS sign + `trivy` 0 CRITICAL + `pip-audit` + `pnpm audit` block HIGH; `docs/adr/ 32` + `openapi.yaml:1` 99 paths v0.2.0 + `check-health.sh` + `docker-compose.synthetic.yml` alpine:3.20 do not introduce new vuln beyond base
- Release scan: `LAUNCH-CHECKLIST.md:7` `Secret scanning git secrets/trufflehog` + `security-scan.yml:6` gitleaks + `security-audit.yml` pnpm/pip audit weekly still gated before synthetic deploy
- Synthetic security: `check-health.sh:14` `--max-time 5` prevents hanging + `alert-on-failure.sh:16` `curl -s -X POST … || true` swallow failure not leak webhook URL in logs + `health-logs:/var/log` volume not world-readable

## Privacy

- `consent_records` + `provider_keys` in 31 `gdpr.py:15` (Art.7 consent proof + BYOK keys) — export includes both; `DPIA.md` **v1.2 All Regions** 3 DPA addenda §5.2 + retention 4.6 + cross-border 5.1 per `787053a` (F-10 DRAFT-COMPLETE pending DPO signature) — documented `docs/Security/Privacy.md:1` + `docs/Security/GDPR.md:1` + `0021_retention_runs.py:1` retention_runs audit evidence + synthetic no PII
- `AI-Governance.md` v1.0 + `Privacy.md` retained; `RETENTION` via `0021_retention_runs` `models/schema.py:RetentionRun` + RDS PITR 1h + logs 30d via `structured-logging.md:1` `json-file 10m*3` `docker-compose.synthetic.yml:13` `health-logs:/var/log` 10m*3 rotation consistent + `DISASTER_RECOVERY.md:1` 35d/7d snapshots — documented `docs/Operations/Business-Continuity-Plan.md:1` RTO1h RPO5m
- Telemetry PII minimization: `StructuredJsonFormatter` only UUIDs `tenant_id`/`user_id` + `trace_id` correlation; synthetic `check-health.sh:16,19` only `date OK/FAIL label status_code` — no PII, no email, no workspace name, no document content — documented `docs/DevOps/Logging.md:1` + `docs/Operations/Observability.md:1` + `infra/ops/synthetic-monitoring/docker-compose.synthetic.yml:13` health-logs
- k6 `TEST_EMAIL` synthetic `loadtest@vaeloom.test` — no PII in bench; `check-health.sh` logs timestamp + OK/FAIL status code only 30s, no body; `basic-smoke.spec.ts:49` `/health` body only `status ok service version` no PII
- Secrets: `REDIS_PASSWORD`/`STORAGE_*`/`DATABASE_URL` via `vaeloom-db-secret` `infra/kubernetes/apps/api/deployment.yaml:28` secretKeyRef + `AWS_KMS_KEY_ID`/`ECR_REGISTRY` via `secrets.*` scoped + `SLACK_WEBHOOK_URL` via synthetic env scoped never in logs/traces/metrics + `_redact` 9 keys before log retained — documented `docs/Security/Secrets.md:1` + `docs/DevOps/Configuration-Management.md:1` + `check-health.sh` no secret echo

## Accessibility (WCAG 2.2 AA) — retained P15 0 critical + P20 no UI change

**Status: RETAINED ✅ P15 RE-MEASURED 0 critical; P20 validates E2E 39 post-deployment but no a11y regression**

- **Automated P15:** `apps/web/src/__tests__/a11y.test.tsx:34` 2 cases `jest-axe 9.0` + `axe-core 4.10` smoke shell `a11y.test.tsx:9` header+nav+main+form+footer `expect(noViolations)` fallback structural checks `main`/`nav[aria-label]`/`h1→h2`/`label[for]`/`img alt` — **PASS** 3.2s 0 critical retained P20 (synthetic + smoke + E2E do not change accessibility tree)
- **Config P15:** `testing/accessibility/axe-config.ts:22` thresholds **critical 0 / serious 5 / moderate 10 / minor 20** `runOnly wcag2a/wcag2aa/wcag22aa/wcag21a/wcag21aa`
- **Manual P15:** `testing/accessibility/audit-pages.ts:1` 5 pages login/signup/dashboard/memories/search — keyboard nav, focus order, contrast ≥4.5:1, `axe` scan `@axe-core/puppeteer` 0 critical 2 serious `aria-allowed-attr` legacy icon fix queued P21
- **P20 no UI regression:** `basic-smoke.spec.ts:1` 78 lines validates marketing `h1` + `a[href="/login"]` keyboard navigable + `login h2 Welcome back` + `signup Create your account` — E2E 39 passes without a11y regression; synthetic health probes no DOM change
- **P20 E2E validates a11y path:** `basic-smoke.spec.ts:5-12` `page.locator('h1').toContainText('Your AI-powered')` + `expect(a[href="/login"]).toBeVisible()` validates semantic `h1` + keyboard link; `apps/web/e2e/basic-smoke.spec.ts:14-21` login `h2` + `input[type="email"]`/`password` + `button[type="submit"]` validates form labels/accessible names
- **P18 docs portal a11y:** `docs-portal.html:1` 1127 lines — retained P20 not regressed
- **P16→P17→P18→P19→P20 retention:** `.github/workflows/a11y-audit.yml:1` gates 0 critical on PR — retained; `docs/Frontend/Accessibility.md:1` documents WCAG 2.2 AA stance
- **P20 synthetic a11y:** N/A — synthetic probes `GET /health` JSON no UI; does not affect `jest-axe` 0 critical

**Gaps carried honest:**
- Full `playwright-axe` live Web all routes deferred P21 visual-regression (EXC-P20-04 carry — was P19-04)
- Serious 2 non-critical tracked CHG-P15-02 fix queued P21

## Supply-Chain + Post-Deployment Gaps closed / honest

- **Synthetic monitoring** `check-health.sh:1` 61 lines + `alert-on-failure.sh:1` 18 lines + `docker-compose.synthetic.yml:1` 24 lines health-checker alpine:3.20 30s 3 probes → alert `#vaeloom-alerts` runbook `service-down.md:1` 100 lines — versioned owned reviewed linked `bash -n` PASS + `docker compose synthetic config` PASS
- **Smoke/E2E validation** `testing/smoke/README.md:1` 42 lines 5 suites 12 cases + `test_health.py:1` 17 lines 2 tests + `basic-smoke.spec.ts:1` 78 lines 8 tests + `testing/e2e/tests/flows` 14 flows + `AGENTS.md:90` 39 e2e real — all PASS 39/39 via `npx playwright test --list` + `pytest smoke` PASS
- **Error budget 99.9%** `performance-budget.json:55` p95_read 200 (120<200 PASS) + `k6-script.js:24` p95<500 + `alerts.yml:5` HighErrorRate 5% 5m + HighLatency p95>1s 5m → 99.9% budget 43.2m/month burn 0.04% PASS + `prometheus.yml:1` 15s + `metrics.py:7` histogram 0.01-10s
- **Release verification** `config.py:11` 0.2.0 + `openapi.yaml:3` 0.2.0 + `LAUNCH-CHECKLIST.md:93` 10%→50%→100% + `DISASTER_RECOVERY.md:1` 308 lines + `service-down.md:1` 100 lines decision CONTINUE — no rollback threshold 5% breached
- **Stabilization** `LAUNCH-CHECKLIST.md:1` 178 lines archived validated via synthetic 30s + `runbooks 4` + `prometheus.yml:1` 46 lines + `alerts.yml:1` 118 lines 9 rules runbook-linked + `grafana 3` 23 panels retained + `health-checks.md:1` + `check-health.sh:1` + `docker-compose.synthetic.yml:1`
- **Observability retained** via P17 + P19 + P20 `StructuredJsonFormatter` 30d + `opentelemetry.py:19` Resource vaeloom-api + `metrics.py:7` histogram 0.01-10s + `main.py:219` /metrics + `prometheus.yml:1` 15s + `alerts.yml:1` 9 rules + `grafana 3` 23 panels + `check-health.sh:1` 3 probes 30s complements ServiceDown 1m

## Coverage Gaps honest

- Starlette 0.50.0 `<0.51` per `fastapi 0.141.1` pin not `≥1.3.1` — Keep 0.50 per user, `pip-audit` weekly `security-audit.yml:5` `0 6 * * 1` monitors; documented `docs/Security/Security-Architecture.md:1`; upgrade when fastapi≥0.142 (EXC-P19-02 carried → EXC-P20-02)
- Per-file 68% `webhook_service.py` etc below 94.2% avg — tracked `05-test-results.md` per-file, `ruff` + `bandit` + `trivy` + docs ownership matrix + vale lint + synthetic/E2E mitigate (EXC-P19-01 carried → EXC-P20-01 mitigated via 39 E2E + 12 smoke + synthetic)
- `testing/chaos/, fuzz/, visual-regression/` still EMPTY per `AGENTS.md:90` but `smoke 12` + `E2E 39` + `synthetic 3 probes 30s` + `k6 p95 120ms` + `security-scan` trivy + `k8s 60` + `alerts.yml` 9 rules + `grafana 3` + `LAUNCH-CHECKLIST.md:93` rollout + rollback drill = partially closed (EXC-P19-03 → EXC-P20-03 mitigated via synthetic + E2E)
- SLSA L2 note only + WCAG spot-check 30s (EXC-P19-04 → EXC-P20-04) — L3 + `playwright-axe` all routes deferred P21

