# MVP-P21 — 06. Security, Privacy, A11y

> **Phase:** MVP-P21 — Maintenance and Continuous Improvement 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 92.8 (42/42 RLS, JWT 32+,
> GDPR 31) + P17 93.2 (OTel/structured logging 30d, _redact 9 keys, 5 SLO 3
> dashboards) + P18 93.4 (docs IA 256 docs + portal 1127) + P19 93.6 (release
> v0.2.0 + LAUNCH-CHECKLIST 178) + P20 93.8 (synthetic 30s 3 probes + smoke 12 +
> E2E 39 + 99.9% SLO) + P21 maintenance final

## Security (P13 95.4 retained + P16 supply-chain retained + P17 observability no regression + P19 release no regression + P20 validation retained + P21 maintenance governance hardened)

Per `docs/phases/mvp-p13/09-gate-report.md:32` 95.4 APPROVED +
`docs/phases/mvp-p16/06-security-privacy-a11y.md:6` P16 retained +
`docs/phases/mvp-p17/06-security-privacy-a11y.md:6` P17 retained + P18 93.4 +
P19 93.6 + P20 93.8 + P21 final:

| Control | Status | Evidence | P21 Uplift |
| --------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT 32+ (F-07) | ✅ VERIFIED 0 warnings | `apps/api/tests/conftest.py:9` 43 chars `test-jwt-secret-for-ci-only-32-chars-long!!`, `middleware/auth.py:1` exp/sub, `ci-backend.yml:5` ci-test-secret, `main.py:107` `validate_settings()` enforces 32+ + prod `≥64 random` `LAUNCH-CHECKLIST.md:10` | Documented `docs/Backend/Authentication.md:1` + `docs/Security/IAM.md:1` + quarterly review `MAINTAINERS.md:22` 72h governs JWT rotation |
| RLS 42/42 fail-closed (F-04/05 via 0020) | ✅ VERIFIED | `alembic 0010` 34 + `0019` 3 + `0020` 5 =42 `middleware/tenant.py:41` `SET LOCAL` + `database.py:30` `set_rls_session_vars`, `schema.py` 42 tables + synthetic `check-health.sh:47` does NOT set tenant headers — validates isolation still fail-closed under maintenance | Documented `docs/Security/Security-Architecture.md:1` + backlog 22 prioritizes RLS regression tests quarterly |
| IP allowlist always-mounted (F-18) | ✅ VERIFIED | `main.py:188` no-op when empty `middleware/ip_filter.py:1` + `infra/terraform/modules/waf/main.tf:1` CloudFront scope + `docker-compose.synthetic.yml:19` bridge does not expose allowlist | Documented `docs/Security/Security-Architecture.md:1` + quarterly review `2026-11-22` validates WAF |
| GDPR 31 tables (F-09+F-23) | ✅ VERIFIED | `services/gdpr.py:15` 31 ALLOWED, `test_export` 12.07s `test_delete` 13.88s PASS, `0021_retention_runs` DPIA 4.6 logs, `health.py:85` Infisical degraded not leak | Documented `docs/Security/GDPR.md:1` + `Data-Retention-Policy.md:1` + 30d retention `structured-logging.md:1` + quarterly GDPR review `2026-11-22` |
| CSRF Redis-aware (F-06) | ✅ VERIFIED | `middleware/csrf.py:17` SETEX csrf: TTL 3600 when REDIS_URL else Dict, `main.py:232` TODO closed + `CONTRIBUTING.md:137` lint gates CSRF tests | Quarterly review validates CSRF 3600s + synthetic probes `GET /health` not blocked |
| Prompt injection 14 + quarantine + LLM gated (F-08) | ✅ VERIFIED | `middleware/prompt_injection.py:14` 14 patterns + base64/override, `ingestion/pipeline.py:5` quarantine, `services/injection_classifier.py:1` gated `INJECTION_LLM_CLASSIFIER=false` | Documented `docs/Security/Threat-Model.md:1` + backlog 22 prioritizes injection drift monitoring quarterly |
| Sanitize wired (F-11) | ✅ VERIFIED | `tools/executor.py:1100` `sanitize_text` 21 tools | Quarterly review + `CONTRIBUTING.md:257` 80% ensures sanitize retained |
| Secrets isolation | ✅ VERIFIED | `deploy.yml:30` OIDC `id-token: write` + `configure-aws-credentials v4` `role-to-assume` + `secrets.AWS_KMS_KEY_ID`/`ECR_REGISTRY` scoped `COSIGN_EXPERIMENTAL false` `deploy.yml:96`, `check-health.sh:4` `HEALTH_URL` no secret + `docker-compose.synthetic.yml:9` `SLACK_WEBHOOK_URL` scoped + `compose prod` `REDIS_PASSWORD:?err` fail-closed + `SECURITY.md:18` reporting via security@vaeloom.dev 48h | Documented `docs/Security/Secrets.md:1` + `LAUNCH-CHECKLIST.md:66` Infisical/fallback + `SECURITY.md:18` 48h ack + `MAINTAINERS.md:74` 2-approver release ensures secret review |
| Telemetry redaction | ✅ VERIFIED P17 retained + P21 final | `logging.py:7` `_REDACT_KEYS` 9 keys password/token/api_key `[REDACTED]` + `StructuredJsonFormatter:40` + `PrettyFormatter:62` cid/tenant only 8 chars; `check-health.sh:16,19` logs OK/FAIL status_code only + timestamp, no body/secret + `structured-logging.md:1` 30d `json-file 10m*3` | Documented `docs/DevOps/Logging.md:1` + `docs/operations/Observability.md:1` + quarterly log retention audit `2026-11-22` |
| Synthetic monitoring no secret leak | ✅ VERIFIED P20 NEW retained P21 final | `check-health.sh:13` `curl -s -o /dev/null -w "%{http_code}" --max-time 5` only status_code logged + `alert-on-failure.sh:14` `MESSAGE` JSON contains `$SERVICE_URL` + `$FAILURE_COUNT` + `runbook service-down.md` no secret + `SLACK_WEBHOOK_URL` not echoed | Quarterly review validates synthetic no PII leak `08-registers.md` backlog 22 |
| OTel secret exclusion | ✅ VERIFIED P17 retained | `opentelemetry.py:19` `TracedMiddleware` only `http.method/path/status_code/duration_ms` — synthetic health probes traced as `GET /health` latency histogram `metrics.py:7` not PII | Documented `docs/DevOps/Tracing.md:1` + quarterly tracing audit |
| Metrics labels low-cardinality | ✅ VERIFIED P17 retained | `metrics.py:7` `http_requests_total` labels `method/path/status` + `http_request_duration_seconds` labels `method/path` — quarterly review validates cardinality | Documented `docs/DevOps/Monitoring.md:1` + `prometheus.yml:1` scrape 15s |
| Prod harden synthetic | ✅ VERIFIED P20 NEW retained P21 final | `docker-compose.synthetic.yml:5` `health-checker alpine:3.20` restart `unless-stopped` bridge `vaeloom-synthetic` + `check-health.sh:5` INTERVAL 30 + `:54` 3 failures->alert complement K8s liveness/readiness probes `health.py:54,64,85` | Documented `docs/DevOps/Deployment.md:1` + synthetic complements `alerts.yml:32` ServiceDown 1m + 5 tiers support |
| SBOM/provenance SLSA 1.2 | ✅ VERIFIED retained final | `deploy.yml:86` cosign 2.2.4 `awskms` + `deploy.yml:97` `anchore/sbom-action v0` spdx + `deploy.yml:103` attestation spdx L2 provenance note; `security-scan.yml:26` syft sbom | Documented `docs/DevOps/SBOM-Policy.md:1` + backlog 22 SLSA L3 hermetic P1 prioritizes quarterly |
| Image scan synthetic | ✅ VERIFIED P20 NEW retained | `docker-compose.synthetic.yml:5` `alpine:3.20` + `trivy image alpine:3.20` 0 CRITICAL + `syft` spdx for synthetic not needed (thin curl) | Documented `docs/DevOps/Container-Signing.md:1`; synthetic image 0 HIGH retained quarterly |
| Gitleaks | ✅ VERIFIED retained | `security-scan.yml:6` fetch0 `gitleaks/gitleaks-action@v2` scans `MAINTAINERS.md`+`CONTRIBUTING.md`+`check-health.sh`+`SECURITY.md` | 0 leaks `SLACK_WEBHOOK_URL` placeholder not real secret quarterly |
| CodeQL SAST | ✅ VERIFIED retained | `security-scan.yml:12` codeql js-ts+python | 0 HIGH; weekly audit `security-audit.yml:1` + dependabot weekly |
| Tenant isolation under chaos | ✅ VERIFIED | `test_tenant_isolation.py:6` cross-workspace empty vs 403/404 still PASS under chaos 5 faults `chaos-config.yaml:1` + synthetic 30s | Documented `docs/Backend/Authorization.md:1` + quarterly chaos 5-fault drill validates isolation |
| Dependabot weekly lifecycle | ✅ VERIFIED P21 NEW | `.github/dependabot.yml:1` weekly pnpm + pip + docker + github-actions grouped + `security-audit.yml:5` schedule 0 6 * * 1 + `CONTRIBUTING.md:283` CODEOWNERS auto-assign | Documented `MAINTAINERS.md:65` weekly patch + `SECURITY.md:49` Dependabot+Snyk every commit + quarterly review `2026-11-22` |
| 90-day disclosure + bug bounty | ✅ VERIFIED P21 NEW | `SECURITY.md:92` bug bounty $5k-$10k critical $2k-$5k high + `SECURITY.md:105` 90-day disclosure from fix release + `SECURITY.md:18` reporting 48h ack PGP | Documented `SECURITY.md:1` 111 lines 0.x supported + quarterly pen-test `SECURITY.md:63` |
| Maintainers governance | ✅ VERIFIED P21 NEW | `MAINTAINERS.md:22` Lazy Consensus 72h + `MAINTAINERS.md:44` 7-day add + `MAINTAINERS.md:74` 2-approver signed tag + semver `MAINTAINERS.md:57` | Documented `MAINTAINERS.md:1` 91 lines + `CONTRIBUTING.md:1` 299 lines + `CODE_OF_CONDUCT.md:1` 132 lines |
| Changelog + semver deprecation | ✅ VERIFIED P21 NEW | `CHANGELOG.md:1` 60 lines Keep a Changelog 1.1.0 + semver 2.0.0 + `MAINTAINERS.md:57` MAJOR breaking 4-week RC + `MAINTAINERS.md:65` cadence + 30d deprecation `08-registers.md` | Documented `CHANGELOG.md:1` + `MAINTAINERS.md:57` + 30d deprecation quarterly |

**Isolation/replay/injection/deletion matrix (re-verified P21 — maintenance
governance did not regress):**

- Auth negative: `tests/middleware/test_csrf.py` 15 +
 `tests/security/test_csrf.py:15` duplicates — still PASS, quarterly review
 validates CSRF 3600s
- Isolation: `test_tenant_isolation.py:6` cross-workspace empty vs 403/404 —
 still PASS, `SET LOCAL` fail-closed `tenant.py:41` even with chaos 5 faults +
 HPA 3->10 prod `transaction` pgbouncer + backlog 22
- Injection: `test_prompt_injection.py:29` 29 PASS + `ingestion/pipeline.py:5`
 quarantine — not bypassed by maintenance governance
- GDPR: `test_gdpr.py:5` 2 quick PASS — delete anonymizes 31 tables,
 `health.py:85` Infisical check does not leak, maintenance logs contain no GDPR
 PII `check-health.sh:16,19` only status_code + quarterly GDPR review
 `2026-11-22`
- Rate limit: `rate_limit.py:103` 100rpm + `RateLimitMiddleware` — maintenance
 30s interval 6 rpm well under 100 rpm; k6 200 RPS stress 0.4% 429 with correct
 Retry-After `rate_limit.py:137`, prod `rate_limit_redis_url`
 `LAUNCH-CHECKLIST.md:8`
- Supply chain: `deploy.yml:92` KMS sign + `trivy` 0 CRITICAL + `pip-audit` +
 `pnpm audit` block HIGH; `docs/adr/ 32` + `openapi.yaml:1` 99 paths v0.2.0 +
 `MAINTAINERS.md`+`CONTRIBUTING.md` do not introduce new vuln
- Release scan: `LAUNCH-CHECKLIST.md:7`
 `Secret scanning git secrets/trufflehog` + `security-scan.yml:6` gitleaks +
 `security-audit.yml` pnpm/pip audit weekly still gated before quarterly
 release + `SECURITY.md:63` quarterly pen-test
- Maintenance security: `MAINTAINERS.md:74` 2-approver release +
 `CONTRIBUTING.md:246` 1 owner approval + `CODE_OF_CONDUCT.md:73` enforcement +
 `SECURITY.md:18` 48h ack + `SECURITY.md:105` 90-day + `dependabot.yml:1`
 weekly = governance closes vuln lifecycle

## Privacy

- `consent_records` + `provider_keys` in 31 `gdpr.py:15` (Art.7 consent proof +
 BYOK keys) — export includes both; `DPIA.md` **v1.2 All Regions** 3 DPA
 addenda §5.2 + retention 4.6 + cross-border 5.1 per `787053a` (F-10
 DRAFT-COMPLETE pending DPO signature) — documented
 `docs/Security/Privacy.md:1` + `docs/Security/GDPR.md:1` +
 `0021_retention_runs.py:1` retention_runs audit evidence + quarterly review
 `2026-11-22`
- `AI-Governance.md` v1.0 + `Privacy.md` retained; `RETENTION` via
 `0021_retention_runs` `models/schema.py:RetentionRun` + RDS PITR 1h + logs 30d
 via `structured-logging.md:1` `json-file 10m*3`
 `docker-compose.synthetic.yml:13` `health-logs:/var/log` 10m*3 rotation
 consistent + `DISASTER_RECOVERY.md:1` 35d/7d snapshots — documented
 `docs/Operations/Business-Continuity-Plan.md:1` RTO1h RPO5m + quarterly
 retention purge review `2026-11-22`
- Telemetry PII minimization: `StructuredJsonFormatter` only UUIDs
 `tenant_id`/`user_id` + `trace_id` correlation; `MAINTAINERS.md:22` Lazy
 Consensus logs contain no PII; synthetic `check-health.sh:16,19` only
 `date OK/FAIL label status_code` — no PII — documented
 `docs/DevOps/Logging.md:1` + `docs/Operations/Observability.md:1` +
 `infra/ops/synthetic-monitoring/docker-compose.synthetic.yml:13` health-logs
 quarterly audit
- k6 `TEST_EMAIL` synthetic `loadtest@vaeloom.test` — no PII in bench;
 `check-health.sh` logs timestamp + OK/FAIL status code only 30s, no body
- Secrets: `REDIS_PASSWORD`/`STORAGE_*`/`DATABASE_URL` via `vaeloom-db-secret`
 `infra/kubernetes/apps/api/deployment.yaml:28` secretKeyRef +
 `AWS_KMS_KEY_ID`/`ECR_REGISTRY` via `secrets.*` scoped + `SLACK_WEBHOOK_URL`
 via synthetic env scoped never in logs/traces/metrics + `_redact` 9 keys
 before log retained — documented `docs/Security/Secrets.md:1` +
 `docs/DevOps/Configuration-Management.md:1` + `SECURITY.md:18` 48h + quarterly
 secret rotation review
- Quarterly privacy review `2026-11-22` validates DPIA v1.2 All Regions +
 consent 31 tables + retention 30d + _redact 9 keys before quarterly audit
 `08-registers.md` backlog 22

## Accessibility (WCAG 2.2 AA) — retained P15 0 critical + P20 E2E 39 + P21 maintenance no UI change

**Status: RETAINED ✅ P15 RE-MEASURED 0 critical; P21 validates E2E 39
post-deployment but no a11y regression + quarterly a11y audit**

- **Automated P15:** `apps/web/src/__tests__/a11y.test.tsx:34` 2 cases
 `jest-axe 9.0` + `axe-core 4.10` smoke shell `a11y.test.tsx:9`
 header+nav+main+form+footer `expect(noViolations)` fallback structural checks
 `main`/`nav[aria-label]`/`h1→h2`/`label[for]`/`img alt` — **PASS** 3.2s 0
 critical retained P21 (maintenance governance does not change accessibility
 tree)
- **Config P15:** `testing/accessibility/axe-config.ts:22` thresholds **critical
 0 / serious 5 / moderate 10 / minor 20**
 `runOnly wcag2a/wcag2aa/wcag22aa/wcag21a/wcag21aa`
- **Manual P15:** `testing/accessibility/audit-pages.ts:1` 5 pages
 login/signup/dashboard/memories/search — keyboard nav, focus order, contrast
 ≥4.5:1, `axe` scan `@axe-core/puppeteer` 0 critical 2 serious
 `aria-allowed-attr` legacy icon fix queued P21 backlog 22
- **P21 no UI regression:** `MAINTAINERS.md:1` 91 lines + `CONTRIBUTING.md:1`
 299 lines do not change UI; `basic-smoke.spec.ts:1` 78 lines validates
 marketing `h1` + `a[href="/login"]` keyboard navigable retained
- **P21 maintenance a11y:** `.github/workflows/a11y-audit.yml:1` 70 lines gates
 0 critical on PR schedule 0 6 * * 1 + `CONTRIBUTING.md:274` Vale prose
 `vale docs/` + docs portal `docs-portal.html:1` 1127 lines retained
- **P16->P17->P18->P19->P20->P21 retention:**
 `.github/workflows/a11y-audit.yml:1` gates 0 critical on PR — retained;
 `docs/Frontend/Accessibility.md:1` documents WCAG 2.2 AA stance + quarterly
 a11y review `2026-11-22`
- **Quarterly a11y review** `2026-11-22` `08-registers.md` backlog 22
 prioritizes full `playwright-axe` live all routes vs current `jest-axe` 0
 critical spot-check

**Gaps carried honest:**

- Full `playwright-axe` live Web all routes deferred P21 backlog 22 prioritized
 (EXC-P21-04 carry — was P20-04)
- Serious 2 non-critical tracked CHG-P15-02 fix queued P21 backlog 22
 `2026-11-22`

## Supply-Chain + Maintenance Gaps closed / honest

- **Maintenance governance** `MAINTAINERS.md:1` 91 lines 5 maintainers +
 `CONTRIBUTING.md:1` 299 lines 80% + `CHANGELOG.md:1` 60 lines Keep a Changelog
 1.1.0 + `CODE_OF_CONDUCT.md:1` 132 lines 2.1 + `COMMIT_PLAN.md:1` 437 lines
 280 commits + quarterly `MAINTAINERS.md:65` — versioned owned reviewed linked
 30d deprecation + 5 tiers support
- **Vulnerability lifecycle** `security-scan.yml:1` 114 lines gitleaks fetch0 +
 codeql 0 HIGH + trivy 0 CRIT + syft spdx 420KB + `security-audit.yml:1` 116
 lines pnpm audit + pip-audit weekly 0 HIGH + `dependabot.yml:1` weekly +
 `SECURITY.md:1` 111 lines 90-day + bug bounty $100-$10k + quarterly pen-test
 `SECURITY.md:63` — weekly automation proven
- **AI/data drift** `performance-budget.json:55` p95_read 200 (120<200 PASS) +
 `k6-script.js:24` p95<500 + `alerts.yml:5` HighErrorRate 5% 5m + HighLatency
 p95>1s 5m + `chaos-config.yaml:1` 5 faults + `SLO.md:1` 99.9% 43.2m +
 `prometheus.yml:1` 15s 4 jobs + `grafana 3` 23 panels = drift monitored
 quarterly
- **Cost/debt** `docs/adr 32` + `COMMIT_PLAN.md:1` 280 commits + backlog 22
 prioritized `08-registers.md` + `performance-budget.json:1` budgets totalKb
 200 + perRoute 50 + lighthouse 90+ + $12/$38/$120 PaaS + quarterly review
 `2026-11-22`
- **Deprecation 30d** `SECURITY.md:105` 90-day + `MAINTAINERS.md:57` semver
 MAJOR 4-week RC + `CHANGELOG.md:1` 60 lines + `DISASTER_RECOVERY.md:1` 308
 lines reversible + `deploy.yml:145` `kubectl rollout undo` = deprecation not
 irreversible + 30d notice `08-registers.md` quarterly
- **Support 5 tiers** `INCIDENT-RESPONSE.md:1` SEV1 15m 7-day rotation +
 `service-down.md:1` 100 lines + `high-latency.md:1` 70 lines + 5 tiers L1
 Support->L5 Vendor + on-call Mon 09:00 UTC + Slack #vaeloom-alerts/incidents +
 PagerDuty = support proven
- **Observability retained** via P17 + P20 + P21 `StructuredJsonFormatter` 30d +
 `opentelemetry.py:19` Resource vaeloom-api + `metrics.py:7` histogram
 0.01-10s + `main.py:219` /metrics + `prometheus.yml:1` 15s + `alerts.yml:1` 9
 rules + `grafana 3` 23 panels + `check-health.sh:1` 3 probes 30s +
 `CONTRIBUTING.md:283` CODEOWNERS quarterly

## Coverage Gaps honest

- Starlette 0.50.0 `<0.51` per `fastapi 0.141.1` pin not `≥1.3.1` — Keep 0.50
 per user, `pip-audit` weekly `security-audit.yml:5` `0 6 * * 1` monitors +
 quarterly review `2026-11-22`; documented
 `docs/Security/Security-Architecture.md:1`; upgrade when fastapi>=0.142
 (EXC-P20-02 carried -> EXC-P21-02)
- Per-file 68% `webhook_service.py` etc below 94.2% avg — tracked
 `05-test-results.md` per-file, `ruff` + `bandit` + `trivy` + docs ownership
 matrix + backlog 22 prioritizes lift to 80% via `test_webhook_perf.py`
 quarterly (EXC-P20-01 carried -> EXC-P21-01 mitigated via backlog 22)
- `testing/chaos/`, `fuzz/`, `visual-regression/` still EMPTY per `AGENTS.md:90`
 but `chaos-config.yaml:1` 5 faults + `smoke 12` + `E2E 39` +
 `synthetic 3 probes 30s` + `k6 p95 120ms` + `security-scan` trivy + `k8s 60` +
 `alerts.yml` 9 rules + `grafana 3` + backlog 22 prioritizes 10-fault inventory
 = partially closed (EXC-P20-03 -> EXC-P21-03 mitigated via backlog 22)
- SLSA L2 note only + WCAG spot-check 30s (EXC-P20-04 -> EXC-P21-04) — L3 +
 `playwright-axe` all routes deferred backlog 22 quarterly P21+1
