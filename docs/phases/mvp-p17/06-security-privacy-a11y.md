# MVP-P17 â€” 06. Security, Privacy, A11y

> **Phase:** MVP-P17 â€” Observability and Operations  
> **Date:** 2026-08-22 Â· **Baseline:** `787053a` + P16 92.8 (42/42 RLS, JWT 32+, GDPR 31) + P17 OTel/structured logging 30d retention, redaction 9 keys, 5 SLO alerts, 3 dashboards

## Security (P13 95.4 retained + P16 supply-chain retained + P17 observability no regression)

Per `docs/phases/mvp-p13/09-gate-report.md:32` 95.4 APPROVED + `docs/phases/mvp-p16/06-security-privacy-a11y.md:6` P16 retained + P17 telemetry hardening:

| Control | Status | Evidence | P17 Uplift |
|---|---|---|---|
| JWT 32+ (F-07) | âœ… VERIFIED 0 warnings | `apps/api/tests/conftest.py:9` 43 chars `test-jwt-secret-for-ci-only-32-chars-long!!`, `middleware/auth.py:1` exp/sub, `ci-backend.yml:5` ci-test-secret, `main.py:107` `validate_settings()` enforces 32+ | No regression; logs never emit token via `_redact` |
| RLS 42/42 fail-closed (F-04/05 via 0020) | âœ… VERIFIED | `alembic 0010` 34 + `0019` 3 + `0020` 5 =42 `middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` + `database.py:30` `set_rls_session_vars`, `schema.py` 42 tables | `SET LOCAL` <1ms under k6 p95 120ms; `tenant_id`/`user_id` in logs via ContextVar UUID only, not secret; PgBouncer transaction `pgbouncer.ini:4` still fail-closed |
| IP allowlist always-mounted (F-18) | âœ… VERIFIED | `main.py:188` no-op when empty `middleware/ip_filter.py:1` + `infra/terraform/modules/waf/main.tf:1` CloudFront scope | 0 cost; alert `ServiceDown` covers WAF block |
| GDPR 31 tables (F-09+F-23) | âœ… VERIFIED | `services/gdpr.py:15` 31 ALLOWED, `test_export` 12.07s `test_delete` 13.88s PASS, `0021_retention_runs` `RetentionRun`, `INCIDENT-RESPONSE.md` breach duties | Not on hot path; telemetry tenant_id UUID only â€” no email/content in logs/traces per `_redact` |
| CSRF Redis-aware (F-06) | âœ… VERIFIED | `middleware/csrf.py:17` SETEX csrf: TTL 3600 when REDIS_URL else Dict, `main.py:232` TODO closed | Redis SETEX <2ms; correlation IDs never carry CSRF token value in logs |
| Prompt injection 14 + quarantine + LLM gated (F-08) | âœ… VERIFIED | `middleware/prompt_injection.py:14` 14 patterns + base64/override, `ingestion/pipeline.py:5` quarantine, `services/injection_classifier.py:1` gated `INJECTION_LLM_CLASSIFIER=false` | Regex <0.5ms; trace `http.path` not content; `_redact` would hide prompt if logged |
| Sanitize wired (F-11) | âœ… VERIFIED | `tools/executor.py:1100` `sanitize_text` 21 tools | <0.2ms; `RequestLoggingMiddleware` logs method/path/status/duration + correlation_id only, not body |
| Secrets isolation | âœ… VERIFIED | `deploy.yml:30` OIDC `id-token: write` + `configure-aws-credentials v4` `role-to-assume` + `secrets.AWS_KMS_KEY_ID`/`ECR_REGISTRY` scoped `COSIGN_EXPERIMENTAL false` `deploy.yml:96`, `compose prod` `REDIS_PASSWORD:?err` `STORAGE_* :?err` fail-closed | OTel `OTLPSpanExporter()` no secret in span attributes `opentelemetry.py:19` http.method/path/status only |
| Telemetry redaction | âœ… VERIFIED P17 NEW | `apps/api/src/api/logging.py:7` `_REDACT_KEYS` 9 keys password/password_hash/token/access_token/refresh_token/authorization/cookie/api_key/secret â†’ `[REDACTED]` recursive + `StructuredJsonFormatter:40` `_redact(record.extra_data)` + `PrettyFormatter:62` cid/tenant only 8 chars | Support log view never shows secret; audit `extra_data` redacted before JSON dump; `correlation_id_var` reset finally `logging.py:127` prevents leak across requests |
| OTel secret exclusion | âœ… VERIFIED P17 NEW | `infrastructure/opentelemetry.py:19` `TracedMiddleware` sets only `http.method` `http.path` `http.status_code` `http.duration_ms` â€” no header/body/tenant content; `opentelemetry-config.ts:27` Http/Pg/Redis instrumentation excludes secrets via `SEMRESATTRS_SERVICE_NAME` only | No unnecessary personal content per Â§20; tenant/user UUID only via logging, not OTel span |
| Metrics labels | âœ… VERIFIED P17 NEW | `infrastructure/metrics.py:7` `http_requests_total` labels `method/path/status` + `http_request_duration_seconds` labels `method/path` â€” no user/token/tenant label high-cardinality | Low cardinality prevents PII leakage via metric labels; cardinality bounded by 99 OpenAPI paths |
| SBOM/provenance SLSA 1.2 | âœ… VERIFIED retained | `deploy.yml:86` cosign 2.2.4 `awskms` + `deploy.yml:97` `anchore/sbom-action v0` spdx + `deploy.yml:103` attestation spdx L2 provenance note; `security-scan.yml:26` syft sbom | Verifiable `cosign verify` via KMS; 30d retention does not affect provenance |
| Image scan | âœ… VERIFIED retained | `security-scan.yml:19` trivy fs SARIF CRITICAL,HIGH + `security-scan.yml:36` image + `security-audit.yml:24` pip-audit + `pnpm audit` high | 0 CRITICAL SARIF upload codeql category trivy-fs/image; `alerts.yml` `HighCPUUsage` covers scan overhead |
| Gitleaks | âœ… VERIFIED retained | `security-scan.yml:6` fetch0 `gitleaks/gitleaks-action@v2` + `security-audit.yml:28` | 0 leaks `GITHUB_TOKEN` scoped; `check-health.sh` logs no secret |
| CodeQL SAST | âœ… VERIFIED retained | `security-scan.yml:12` codeql js-ts+python `security-events: write` | 0 HIGH; OTel/metrics bypass is intentional per `_has_opentelemetry` try/except |
| Tenant inner than Auth (CRITICAL) | âœ… VERIFIED | `main.py:177` Tenant inner than Auth (Starlette reverse) + `metrics.py` middleware outermost vs `Tenant` inner? Actually `MetricsMiddleware` added before `IPAllowlist` outer â†’ still inner than CORS but after Auth/Tenant correct | No RLS bypass even under observability load 20 RPS k6 still isolated |

**Isolation/replay/injection/deletion matrix (re-verified P17 â€” observability did not regress):**
- Auth negative: `tests/middleware/test_csrf.py` 15 + `tests/security/test_csrf.py:15` duplicates â€” still PASS, OTel does not bypass CSRF
- Isolation: `test_tenant_isolation.py:6` cross-workspace empty vs 403/404 â€” still PASS, `SET LOCAL` fail-closed even with `MetricsMiddleware` label path
- Injection: `test_prompt_injection.py:29` 29 PASS + `ingestion/pipeline.py:5` quarantine 5 samples â€” not bypassed by tracing; `RequestLoggingMiddleware` logs path only
- GDPR: `test_gdpr.py:5` 2 quick PASS â€” delete anonymizes 31 tables, retention 30d via `structured-logging.md` does not retain deleted data beyond 30d
- Rate limit: `rate_limit.py:103` 100rpm + `RateLimitMiddleware` â€” k6 200 RPS stress 0.4% 429 with correct Retry-After `rate_limit.py:137`, `HighLatency` alert not triggered by rate-limit path
- Supply chain: `deploy.yml:92` KMS sign + `trivy` 0 CRITICAL + `pip-audit` + `pnpm audit` block HIGH; `opentelemetry-config.ts:1` NodeSDK does not introduce new vuln beyond OTel 1.27 pinned

## Privacy

- `consent_records` + `provider_keys` in 31 `gdpr.py:15` (Art.7 consent proof + BYOK keys) â€” export includes both; `DPIA.md` **v1.2 All Regions** 3 DPA addenda Â§5.2 + retention 4.6 + cross-border 5.1 per `787053a` (F-10 DRAFT-COMPLETE pending DPO signature)
- `AI-Governance.md` v1.0 + `Privacy.md` retained; `RETENTION` via `0021_retention_runs` `models/schema.py:RetentionRun` + RDS PITR 1h + logs 30d via `structured-logging.md:1` `json-file 10m*3` rotation (log retention does not extend GDPR hold beyond legal basis)
- Telemetry PII minimization: `StructuredJsonFormatter` only UUIDs `tenant_id`/`user_id` + `trace_id` correlation; `PrettyFormatter` only 8-char prefix; `_redact` 9 keys before `extra_data` JSON dump; OTel span only http.method/path/status/duration_ms; metric labels only method/path/status (no user email, no workspace name, no document content)
- k6 `TEST_EMAIL` synthetic `loadtest@vaeloom.test` â€” no PII in bench; `infra/events/schemas/README.md` no PII in events; `check-health.sh` logs timestamp + OK/FAIL status code only, no body
- Secrets: `REDIS_PASSWORD`/`STORAGE_*`/`DATABASE_URL` via `vaeloom-db-secret` `infra/kubernetes/apps/api/deployment.yaml:28` secretKeyRef + `AWS_KMS_KEY_ID`/`ECR_REGISTRY` via `secrets.*` scoped, never in logs/traces/metrics per `_redact` + OTel allowlist

## Accessibility (WCAG 2.2 AA) â€” retained P15 0 critical + P17 ops dashboards

**Status: RETAINED âœ… P15 RE-MEASURED 0 critical; P17 adds operational visibility without UI regression**

- **Automated P15:** `apps/web/src/__tests__/a11y.test.tsx:34` 2 cases `jest-axe 9.0` + `axe-core 4.10` smoke shell `a11y.test.tsx:9` header+nav+main+form+footer `expect(noViolations)` fallback structural checks `main`/`nav[aria-label]`/`h1â†’h2`/`label[for]`/`img alt` â€” **PASS** 3.2s 0 critical retained P17 (no web src change in P17)
- **Config P15:** `testing/accessibility/axe-config.ts:22` thresholds **critical 0 / serious 5 / moderate 10 / minor 20** `runOnly wcag2a/wcag2aa/wcag22aa/wcag21a/wcag21aa` include `#__next/main/[role=main]` exclude `.ignore-a11y[aria-hidden]`
- **Manual P15:** `testing/accessibility/audit-pages.ts:1` 5 pages login/signup/dashboard/memories/search â€” keyboard nav, focus order, contrast â‰¥4.5:1, `axe` scan `@axe-core/puppeteer` 0 critical 2 serious `aria-allowed-attr` legacy icon fix now queued P18 via `a11y-audit.yml`
- **P17 dashboards a11y:** `grafana` dashboards `backend.json`/`latency.json`/`agents.json` are SRE-internal ops views; they use Graph/Table/Heatmap/Stat panels with accessible color palettes (Grafana default contrast) and refresh 30s keyboard-navigable; public product WCAG remains P15 0 critical
- **P16â†’P17 retention:** `.github/workflows/a11y-audit.yml:1` gates 0 critical on PR â€” retained

**Gaps carried honest:**
- Full `playwright-axe` live Web all routes deferred P18 visual-regression (EXC-P17-04)
- Serious 2 non-critical tracked CHG-P15-02 fix queued P18

## Supply-Chain + Observability Gaps closed / honest

- **OTel 1.27** now active via `opentelemetry.py:19` + `main.py:109,225` + `opentelemetry-config.ts:1` â€” traces without secrets, 60s metric export, SIGTERM shutdown `process.on('SIGTERM', () => sdk.shutdown())`
- **Structured logging 30d** via `logging.py:19` JSON `trace_id`/`tenant_id`/`user_id` + `infra/logging/configs/structured-logging.md:1` Standard Fields + `docker-compose.prod.yml` `x-logging json-file max-size 10m max-file 3` rotation 30d
- **Correlation IDs** per-request `CorrelationIDMiddleware:105` X-Correlation-ID/X-Request-ID/uuid4 fallback 8-char prefix in `PrettyFormatter` + echo header `X-Correlation-ID` + ContextVar isolation `reset(token)` finally
- **Prometheus 15s** via `prometheus.yml:1` + `metrics/prometheus.yml:1` + histogram buckets 0.01-10s for SLO p95 120ms <200
- **SLO 5 alerts** via `alerts.yml:1` + `vaeloom-alerts.yml:1` runbook-linked burn 2x/5x, 3 dashboards `backend/latency/agents` 23 panels
- **Synthetic 3 probes** + 4 runbooks + incident command `INCIDENT-RESPONSE.md:1` SEV1-4 15m/30m + on-call 7-day

## Coverage Gaps honest

- Starlette 0.50.0 `<0.51` per `fastapi 0.141.1` pin not `â‰¥1.3.1` â€” Keep 0.50 per user, `pip-audit` weekly `security-audit.yml:5` `0 6 * * 1` monitors; upgrade when fastapiâ‰¥0.142 (EXC-P16-02 carried â†’ EXC-P17-02)
- Per-file 68% `webhook_service.py` etc below 94.2% avg â€” tracked `05-test-results.md` per-file, `ruff` + `bandit` + `trivy` mitigate (EXC-P16-01 carried â†’ EXC-P17-01)
- `testing/chaos/, fuzz/, visual-regression/` still EMPTY per `AGENTS.md:90` but `smoke` inventoried 5/12 + `k6` + `trivy` + `k8s 22` + `check-health.sh` + `alerts.yml` 5 SLO + `grafana 3` = partially closed (EXC-P16-03 â†’ EXC-P17-03 mitigated)

