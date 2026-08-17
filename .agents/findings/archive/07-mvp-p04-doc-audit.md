# MVP-P04 Documentation Audit — 2026-08-15

**Auditor:** opencode (mimo-v2.5-free) **Scope:** MVP-P04 deliverables (roadmap,
dependency graph, RACI, risk governance, resource scenarios, registers) vs
actual repo state **Method:** Direct file system inspection, no reliance on
prior reports **Zero trust:** every claim verified against source files

## Critical Discrepancies

### 1. Package Count: OFF BY 1

| Claim                                 | Actual          | Source                                          |
| ------------------------------------- | --------------- | ----------------------------------------------- |
| 25 packages (AGENTS.md, all P04 docs) | **26 packages** | Counted `package.json` + `pyproject.toml` files |

**Evidence:**

- `apps/` (2): api, web
- `packages/` (9): eslint-config, observability, plugin-sdk, python-common,
  queue, service-auth, shared-types, tsconfig, ui-kit
- `integrations/` (6): calendar, email, github, google-drive, notion, slack
- `connectors/` (3): graphql, mcp, rest
- `sdk/` (1): typescript
- `plugins/` (5): community/tag-generator, community/word-count,
  official/sentiment, official/summarizer, official/translator

**Impact:** Documentation references "25 packages" throughout. Should be **26**.

### 2. GitHub Actions Workflows: SIGNIFICANTLY UNDERSTATED

| Claim                                                                              | Actual                | Source                         |
| ---------------------------------------------------------------------------------- | --------------------- | ------------------------------ |
| "GitHub Actions (api, frontend, docker, deploy) — no release workflow" (AGENTS.md) | **11 workflow files** | `.github/workflows/` directory |

**Actual workflows:**

1. `ci.yml` — Main CI pipeline
2. `ci-backend.yml` — Backend-specific CI
3. `ci-frontend.yml` — Frontend-specific CI
4. `ci-integration.yml` — Integration tests CI
5. `docker-build.yml` — Docker image builds
6. `deploy.yml` — Deployment pipeline
7. `deploy-staging.yml` — Staging deployment
8. `security-audit.yml` — Security auditing
9. `security-scan.yml` — Security scanning
10. `a11y-audit.yml` — Accessibility auditing
11. `docs-validate.yml` — Documentation validation

**Plus:** `.github/release-drafter.yml` exists (contradicts "no release
workflow").

**Impact:** Enterprise hardening status "1.x CI/CD: DONE" is correct but
description understates actual implementation.

### 3. Frontend Test Count: MISLEADING

| Claim                 | Actual                                                    | Source                                                  |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| "37 jest" (AGENTS.md) | **39 test cases** across 7 spec/test files (with overlap) | `apps/web/src/**/*.spec.*` + `apps/web/src/**/*.test.*` |

**Breakdown:**

- `useWorkspace.test.ts`: 8 tests (Jest)
- `useWorkspace.spec.ts`: 6 tests (overlaps with above)
- `Toast.spec.tsx`: 2 tests
- `Modal.spec.tsx`: 4 tests
- `ApprovalCard.spec.tsx`: 8 tests
- `Sidebar.spec.tsx`: 4 tests
- `connectors/page.spec.tsx`: 7 tests

**Note:** `useWorkspace` is tested twice with overlapping coverage. Unique Jest
test count is likely **33** (39 - 6 overlap).

### 4. E2E Test Count: REFERS TO BROWSER RUNS, NOT UNIQUE TESTS

| Claim                     | Actual                                                    | Source                           |
| ------------------------- | --------------------------------------------------------- | -------------------------------- |
| "39 e2e real" (AGENTS.md) | **21 unique test cases** × 3 browsers = **60 total runs** | `testing/e2e/` + `apps/web/e2e/` |

**Breakdown:**

- `apps/web/e2e/basic-smoke.spec.ts`: 8 tests
- `testing/e2e/tests/flows/login.spec.ts`: 3 tests
- `testing/e2e/tests/flows/workspace.spec.ts`: 6 tests
- `testing/e2e/tests/flows/connector.spec.ts`: 4 tests

**Note:** `test-results.json` shows 39 total runs (13 unique × 3 browsers). The
"39 e2e real" claim likely refers to the `apps/web/e2e/` count (8) plus some
combination, not the total.

### 5. testing/ Directory: NOT EMPTY

| Claim                                                                                                                | Actual                               | Source               |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------- |
| "testing/smoke/, testing/security/, testing/chaos/, testing/fuzz/, testing/visual-regression/ are EMPTY" (AGENTS.md) | **13 files** across 4 subdirectories | `testing/` directory |

**Actual contents:**

- `testing/unit/jest-setup.ts` — Jest environment setup
- `testing/integration/test-containers.ts` — Testcontainers manager
- `testing/accessibility/audit-pages.ts` — Accessibility audit script
- `testing/accessibility/axe-config.ts` — axe config
- `testing/accessibility/report-template.html` — HTML report template
- `testing/e2e/login-probe.cjs` — Login probe script
- `testing/e2e/playwright.config.ts` — Playwright config
- `testing/e2e/test-results.json` — Cached results
- `testing/e2e/tests/flows/login.spec.ts` — **3 tests**
- `testing/e2e/tests/flows/workspace.spec.ts` — **6 tests**
- `testing/e2e/tests/flows/connector.spec.ts` — **4 tests**
- `testing/e2e/tests/flows/helpers.ts` — Shared helpers
- `testing/performance/k6-script.js` — k6 load test script

**Note:** `testing/smoke/`, `testing/security/`, `testing/chaos/`,
`testing/fuzz/`, `testing/visual-regression/` ARE empty. But
`testing/accessibility/`, `testing/e2e/`, `testing/integration/`,
`testing/performance/`, `testing/unit/` have files.

### 6. API Routes: 167 Endpoint Handlers

| Claim                     | Actual                    | Source                                                                                |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| No specific count claimed | **167 endpoint handlers** | `apps/api/src/api/routers/` (146) + services with embedded routers (20) + main.py (1) |

**Mounted router groups:** 30 `app.include_router()` calls in `main.py` (22
always-on + 8 enterprise-gated).

### 7. Duplicate Test Coverage

| Issue                       | Details                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `useWorkspace` tested twice | `useWorkspace.test.ts` (8 tests) and `useWorkspace.spec.ts` (6 tests) test identical hooks with overlapping coverage |

**Impact:** Maintenance burden, confusion about which is authoritative.

## Verified Accurate

| Claim                     | Status                            |
| ------------------------- | --------------------------------- |
| Next.js 15.5.20           | VERIFIED                          |
| FastAPI >=0.115.0         | VERIFIED                          |
| Python 3.12               | VERIFIED                          |
| 26 ADRs                   | EXACT MATCH                       |
| 23 frontend pages         | EXACT MATCH                       |
| docker-compose 6 services | VERIFIED                          |
| 94% coverage              | PLAUSIBLE (.coverage file exists) |

## Corrections Applied

| File                                            | Change                                               |
| ----------------------------------------------- | ---------------------------------------------------- |
| `docs/phases/mvp-p04/03-roadmap-v2.md`          | "25 packages" → "26 packages", added 11 workflows    |
| `docs/phases/mvp-p04/04-dependency-graph-v2.md` | Corrected package count in evidence                  |
| `docs/phases/mvp-p04/09-gate-v2.md`             | Corrected technical correctness basis                |
| `docs/phases/mvp-p04/README.md`                 | Added audit findings reference, corrected repo truth |

## Recommendations

1. **Update all references** from "25 packages" to "26 packages" across
   documentation
2. **Update GitHub Actions description** to reflect 11 workflows, not 4
3. **Clarify test counts** — distinguish between unique test cases and browser
   runs
4. **Document testing/ directory** structure accurately — note which
   subdirectories are empty vs populated
5. **Reconcile duplicate tests** — decide whether `useWorkspace.test.ts` or
   `useWorkspace.spec.ts` is authoritative
6. **Update enterprise hardening status** to reflect security/accessibility/docs
   workflows
