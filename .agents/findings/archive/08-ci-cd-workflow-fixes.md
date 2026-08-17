# CI/CD Workflow Fixes — 2026-08-17

**Auditor:** opencode (mimo-v2.5-free) **Scope:** GitHub Actions workflows,
duplicate tests **Method:** Zero-trust audit found actionable code issues, fixed
directly

## Fixes Applied

### 1. a11y-audit.yml — WRONG PATH (CRITICAL)

**Before:** `working-directory: testing/a11y` (nonexistent) **After:**
`working-directory: testing/accessibility` (actual directory)

Also fixed:

- Removed `npx playwright test --reporter=null &` from server start (was
  starting tests before server was ready)
- Fixed artifact path: `testing/a11y/reports/` →
  `testing/accessibility/reports/`
- Fixed critical violations check path

### 2. ci.yml — PHANTOM SERVICE (CRITICAL)

**Before:** `service: [web, api, ai-service]` **After:** `service: [web, api]`

`apps/ai-service/` does not exist. Docker build would fail on every CI run.

### 3. deploy.yml — 19 PHANTOM SERVICES (CRITICAL)

**Before:** 21 services in matrix (web, api, ai-service, memory-store,
auth-service, knowledge-graph, event-bus, search-service, agent-engine,
analytics-service, audit-service, billing-service, connector-service,
document-ingestion, iam-service, integration-service, job-scheduler,
notification-service, plugin-service, rbac-service, recommendation-service)

**After:** 2 services (web, api) — the only ones with Dockerfiles

The deploy workflow had a fallback to `services/` directory (line 90), but that
directory also doesn't exist. Every service except web and api would fail at the
Docker build step.

### 4. security-audit.yml — AUDITS NEVER FAIL (HIGH)

**Before:**

- `pnpm audit`: `continue-on-error: true`
- `pip-audit`: `|| true`

**After:**

- `pnpm audit`: no continue-on-error (will fail CI on high/critical vulns)
- `pip-audit`: no || true (will fail CI on vulnerabilities)

Security audits were effectively no-ops for blocking purposes. Now they actually
block merges when vulnerabilities are found.

### 5. useWorkspace.spec.ts — DUPLICATE + BROKEN MOCK (HIGH)

**Deleted:** `apps/web/src/hooks/useWorkspace.spec.ts`

**Reason:** Duplicate of `useWorkspace.test.ts` with broken mock strategy. The
`.spec.ts` file mocks `api.request` where `api` is the `api` object, but the
actual `useWorkspace.ts` hook imports `request` directly (standalone function),
not `api.request`. The mock never intercepts anything — tests pass only because
of the SWR mock that hardcodes return data.

### 6. ci-backend.yml — REDUNDANT TEST RUN (MEDIUM)

**Before:**

```yaml
- run:
    python -m pytest tests/ -q --cov=src/api/ --cov-report=xml --cov-report=term
- run: python -m pytest tests/ --co # Full coverage
```

**After:**

```yaml
- run:
    python -m pytest tests/ -q --cov=src/api/ --cov-report=xml --cov-report=term
```

The `--co` (collect-only) run was labeled "Full coverage" but just listed tests
without running them. Wasteful and misleading.

### 7. ci-frontend.yml — OUTDATED ACTION (MEDIUM)

**Before:** `uses: pnpm/action-setup@v2` **After:** `uses: pnpm/action-setup@v4`

All other workflows use v4. This was the only one on v2.

## Remaining Issues (Not Fixed — Require Decision)

| Issue                                                        | File                                                     | Impact                                 |
| ------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------- |
| SAML signature validation no-op                              | `apps/api/src/api/services/saml.py:58`                   | Security: tampered assertions accepted |
| Tenant deprovision says "cleanup scheduled" but does nothing | `apps/api/src/api/services/tenant_provisioning.py:103`   | GDPR compliance gap                    |
| `instrumement_fastapi` typo                                  | `apps/api/src/api/infrastructure/opentelemetry.py:39`    | Cosmetic, but confusing                |
| 5 empty testing subdirectories                               | `testing/{smoke,security,chaos,fuzz,visual-regression}/` | Noise in workspace tree                |

## Files Modified

```
.github/workflows/a11y-audit.yml    — Fixed paths, removed broken Playwright start
.github/workflows/ci.yml            — Removed ai-service from matrix
.github/workflows/ci-backend.yml    — Removed redundant --co run
.github/workflows/ci-frontend.yml   — Updated pnpm/action-setup v2 → v4
.github/workflows/deploy.yml        — Trimmed to 2 services with Dockerfiles
.github/workflows/security-audit.yml — Removed || true and continue-on-error
apps/web/src/hooks/useWorkspace.spec.ts — DELETED (duplicate + broken mock)
```
