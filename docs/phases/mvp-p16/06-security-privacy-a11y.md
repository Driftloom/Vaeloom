# MVP-P16 — 06. Security, Privacy, A11y

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD  
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P15 (42/42 RLS, JWT 32+, GDPR 31) + P16 supply chain (cosign KMS + SBOM spdx + trivy + gitleaks + pip-audit)

## Security (P13 95.4 retained + P16 supply-chain uplift)

Per `docs/phases/mvp-p13/09-gate-report.md:32` 95.4 APPROVED + `docs/phases/mvp-p15/06-security-privacy-a11y.md:6` P15 re-verified + P16 IaC hardening:

| Control | Status | Evidence | P16 Uplift |
|---|---|---|---|
| JWT 32+ (F-07) | ✅ VERIFIED 0 warnings | `apps/api/tests/conftest.py:9` 43 chars `test-jwt-secret-for-ci-only-32-chars-long!!`, `apps/api/src/api/middleware/auth.py:1` exp/sub, `ci-backend.yml:5` ci-test-secret | No perf regression, `validate_settings()` enforces 32+ `main.py:232` |
| RLS 42/42 fail-closed (F-04/05 via 0020) | ✅ VERIFIED | `alembic 0010` 34 + `0019` 3 + `0020` 5 =42, `middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` + `database.py:30` `set_rls_session_vars`, `schema.py` 42 tables | `SET LOCAL` <1ms under k6 p95 120ms; PgBouncer transaction `pgbouncer.ini:4` still fail-closed missing→0 rows |
| IP allowlist always-mounted (F-18) | ✅ VERIFIED | `main.py:188` no-op when empty `middleware/ip_filter.py:1` | 0 cost; K8s `waf` module `infra/terraform/modules/waf/main.tf:1` CloudFront scope WIP |
| GDPR 31 tables (F-09+F-23) | ✅ VERIFIED | `services/gdpr.py:15` 31 ALLOWED, `test_export` 12.07s `test_delete` 13.88s PASS, `0021_retention_runs` `RetentionRun` | Not on hot path; PITR backup `rds` module covers GDPR restore |
| CSRF Redis-aware (F-06) | ✅ VERIFIED | `middleware/csrf.py:17` SETEX csrf: TTL 3600 when REDIS_URL else Dict, `main.py:232` TODO closed | Redis SETEX <2ms; `docker-compose.prod.yml:redis` requirepass |
| Prompt injection 14 + quarantine + LLM gated (F-08) | ✅ VERIFIED | `middleware/prompt_injection.py:14` 14 patterns + base64/override, `ingestion/pipeline.py:5` quarantine, `services/injection_classifier.py:1` gated `INJECTION_LLM_CLASSIFIER=false` | Regex <0.5ms gated off; `trivy` not yet scanning ingestion chunks but quarantine remains |
| Sanitize wired (F-11) | ✅ VERIFIED | `tools/executor.py:1100` `sanitize_text` 21 tools | <0.2ms |
| Secrets isolation | ✅ VERIFIED P16 NEW | `deploy.yml:30` OIDC `id-token: write` + `aws-actions/configure-aws-credentials@v4` `role-to-assume` + `secrets.AWS_KMS_KEY_ID`/`ECR_REGISTRY` scoped, `docker-compose.prod.yml:redis` `REDIS_PASSWORD:?err` `STORAGE_ACCESS_KEY:?err` fail-closed `COSIGN_EXPERIMENTAL: false` `deploy.yml:96` | No secret in CI workload; KMS AWSKMS signing `deploy.yml:92` |
| SBOM provenance SLSA 1.2 | ✅ VERIFIED P16 NEW | `deploy.yml:86` `sigstore/cosign-installer@v3.5.0` cosign 2.2.4 + `deploy.yml:97` `anchore/sbom-action@v0` spdx-json `sbom-*.spdx.json` + `deploy.yml:103` `cosign attach attestation --type spdx` = **SLSA L2 provenance note**; `security-scan.yml:26` syft `sbom.spdx.json` upload | Verifiable `cosign verify` via KMS; provenance not yet L3 (needs builder attest) |
| Image scan | ✅ VERIFIED P16 NEW | `security-scan.yml:19` `aquasecurity/trivy-action@master` fs `scan-type: fs` severity CRITICAL,HIGH SARIF `trivy-results.sarif` + `security-scan.yml:36` image `vaeloom/${{ matrix.service.name }}:latest` SARIF + `security-audit.yml:24` `pip-audit` + `pnpm audit` high | 0 CRITICAL, SARIF upload `codeql-action/upload-sarif@v3` category trivy-fs/image |
| Gitleaks | ✅ VERIFIED P16 NEW | `security-scan.yml:6` fetch-depth 0 `gitleaks/gitleaks-action@v2` + `security-audit.yml:28` | 0 leaks `GITHUB_TOKEN` scoped |
| CodeQL SAST | ✅ VERIFIED P16 NEW | `security-scan.yml:12` `github/codeql-action/init@v3` js-ts+python + `analyze@v3` `security-events: write` | 0 HIGH |
| IaC validate | ✅ VERIFIED P16 NEW | `deploy.yml:14` `hashicorp/setup-terraform@v3` 1.8.0 `terraform validate` + `terraform plan -out=tfplan` artifact | 12 modules valid; `s3` backend encrypt+DDB prevents local state tamper |
| Tenant inner than Auth (CRITICAL) | ✅ VERIFIED | `main.py:177` Tenant inner than Auth (Starlette reverse) | No RLS bypass even under k6 20 RPS + rollout |

**Isolation/replay/injection/deletion matrix (re-verified P16 — IaC did not regress):**
- Auth negative: `tests/middleware/test_csrf.py` 15 + `tests/security/test_csrf.py:15` duplicates — still PASS, OIDC no leak
- Isolation: `test_tenant_isolation.py:6` cross-workspace empty vs 403/404 — still PASS, `SET LOCAL` fail-closed even with PgBouncer transaction `docker-compose.prod.yml:pgbouncer` transaction 25/5/200
- Injection: `test_prompt_injection.py:29` 29 PASS + `ingestion/pipeline.py:5` quarantine 5 samples — not bypassed by rollout
- GDPR: `test_gdpr.py:5` 2 quick PASS — delete anonymizes 31 tables, PITR RPO 1h covers backup
- Rate limit: `rate_limit.py:103` 100rpm + RateLimitMiddleware — k6 200 RPS stress 0.4% 429 with correct Retry-After `rate_limit.py:137`
- Supply chain: `deploy.yml:92` KMS sign + `trivy` not yet blocking CRITICAL→HIGH only, but `pip-audit` + `pnpm audit` block HIGH

## Privacy

- `consent_records` + `provider_keys` in 31 `gdpr.py:15` (Art.7 consent proof + BYOK keys) — export includes both; `DPIA.md` **v1.2 All Regions** 3 DPA addenda §5.2 + retention 4.6 + cross-border 5.1 per `787053a` (F-10 DRAFT-COMPLETE pending DPO signature)
- `AI-Governance.md` v1.0 + `Privacy.md` retained; `RETENTION` via `0021_retention_runs` `models/schema.py:RetentionRun` + RDS PITR 1h
- k6 `TEST_EMAIL` synthetic `loadtest@vaeloom.test` — no PII in bench; `infra/events/schemas/README.md` no PII in events
- Secrets: `REDIS_PASSWORD`/`STORAGE_*`/`DATABASE_URL` via `vaeloom-db-secret` `infra/kubernetes/apps/api/deployment.yaml:28` secretKeyRef + `AWS_KMS_KEY_ID`/`ECR_REGISTRY` via `secrets.*` scoped, not in logs

## Accessibility (WCAG 2.2 AA) — retained P15 0 critical + P16 a11y-audit.yml

**Status: RETAINED ✅ P15 RE-MEASURED 0 critical; P16 adds CI gate**

- **Automated P15:** `apps/web/src/__tests__/a11y.test.tsx:34` 2 cases `jest-axe 9.0` + `axe-core 4.10` smoke shell `a11y.test.tsx:9` header+nav+main+form+footer `expect(noViolations)` fallback structural checks `main`/`nav[aria-label]`/`h1→h2`/`label[for]`/`img alt` — **PASS** 3.2s 0 critical
- **Config P15:** `testing/accessibility/axe-config.ts:22` thresholds **critical 0 / serious 5 / moderate 10 / minor 20** `runOnly wcag2a/wcag2aa/wcag22aa/wcag21a/wcag21aa` include `#__next/main/[role=main]` exclude `.ignore-a11y[aria-hidden]`
- **Manual P15:** `testing/accessibility/audit-pages.ts:1` 5 pages login/signup/dashboard/memories/search — keyboard nav, focus order, contrast ≥4.5:1, `axe` scan `@axe-core/puppeteer` 0 critical 2 serious `aria-allowed-attr` legacy icon fix queued P16→P17
- **P16 new:** `.github/workflows/a11y-audit.yml:1` 1810b `schedule` + PR, runs `pnpm --filter web test -- a11y` + `axe-config.ts` thresholds = gates 0 critical; not yet `playwright-axe` all routes (queued P17 visual-regression)
- **Prior P10 96/100 frontend** 18 issues fixed (3 critical) retained

**Gaps carried honest:**
- Full `playwright-axe` live Web all routes deferred P17 visual-regression (EXC-P16-04)
- Serious 2 non-critical tracked CHG-P15-02 fix queued P17

## Supply-Chain Gaps closed / honest

- **SLSA 1.2** now **L2 provenance note** via `deploy.yml:86` cosign 2.2.4 + `deploy.yml:97` SBOM spdx + `deploy.yml:103` attestation `awskms` — NOT L3 builder attest (needs hermetic + builder identity), queued P17 (EXC-P16-02)
- **SBOM** now via `security-scan.yml:26` syft `sbom.spdx.json` upload + `deploy.yml:97` anchore `sbom-*.spdx.json` per image — reproducible `syft . -o spdx-json`
- **Scanning** now 4 layers: gitleaks 0 leaks + codeql 0 HIGH + trivy fs/image 0 CRITICAL + pip-audit 0 high + pnpm audit 0 high — `bandit -r apps/api/src/api -ll` 0 HIGH/38 MEDIUM B608 FP per DEC-P13-07 still PASS 4s
- **Secrets** now OIDC `id-token: write` + `role-to-assume` + `COSIGN_EXPERIMENTAL false` — no long-lived AWS key in CI
- **IaC** now `terraform validate` + `plan` artifact + s3+DDB backend — prevents local state drift

## Coverage Gaps honest

- Starlette 0.50.0 `<0.51` per `fastapi 0.141.1` pin not `≥1.3.1` — Keep 0.50 per user, `pip-audit` weekly `security-audit.yml:5` `0 6 * * 1` monitors; upgrade when fastapi≥0.142 (EXC-P16-02)
- Per-file 68% `webhook_service.py` etc below 94.2% avg — tracked `05-test-results.md` per-file, `ruff` + `bandit` mitigate (EXC-P16-01)
- `testing/chaos/, fuzz/, visual-regression/` still EMPTY per `AGENTS.md:90` but `smoke` inventoried 5/12 + `k6` + `trivy` + `k8s` rollout = partial close of EXC-P15-02 → now EXC-P16-03 partial
