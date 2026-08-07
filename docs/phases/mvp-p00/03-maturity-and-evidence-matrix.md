# MVP-P00 — 03. Maturity and Evidence Matrix

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Method:**
> repository inspected and runtime checks EXECUTED 2026-08-06 (Windows
> PowerShell, Python 3.14.6, pnpm) **Key rule applied:** documentation
> completeness ≠ runtime readiness. Every row below is classified by evidence
> actually observed, not by prose. **Register root:** `docs/phases/mvp-p00/`

## 1. Classification legend (per phase prompt §12)

`SOURCE_DERIVED` (design only) · `EXTERNAL_VERIFIED` (standard/verified
externally) · `NEW_DESIGN` · `STAKEHOLDER_DECISION` ·
`IMPLEMENTED_WITH_EVIDENCE` (code + passing test observed) ·
`IMPLEMENTED_UNVERIFIED` (code present, no passing test observed) ·
`NOT_EXECUTED` (nothing ran) · `NOT_APPLICABLE` (out of scope)

## 2. Runtime evidence — commands actually run

### 2.1 Backend test suite (apps/backend)

```text
env: JWT_SECRET=super-secret-key-12345-dev-only, ENCRYPTION_KEY=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=,
     DATABASE__URL=sqlite+aiosqlite:///./dev.db, LLM_API_KEY=mock-key, OTEL_SDK_DISABLED=true
command: python -m pytest tests/ -q --no-header -p no:cacheprovider --ignore=tests/debug_test.py
result:  47 failed, 2193 passed, 2 xfailed — 14m23s, 672,256 warnings
```

**47 failures — root cause (verified):**

- `TypeError: Metaclasses with custom tp_new are not supported.` raised in
  `google.protobuf` (`C:\Python314\Lib\importlib`) — **protobuf 4.25.9 is
  incompatible with Python 3.14.6**.
- Affected: `tests/test_main.py` (middleware/router/lifespan registration),
  `tests/test_opentelemetry.py`, `tests/test_orchestrator_router.py` (3), plus
  `tests/debug_test.py` collection error (imports full app → opentelemetry →
  protobuf).
- These are **environment/dependency defects**, not application-logic failures.
  The app code paths covered by those tests are NOT verified in this
  environment.
- 2193 passing tests use SQLite + mock LLM/connector fixtures (`conftest.py`
  mocks pgvector/JSONB/UUID).
- **Finding:** AGENTS.md "1626 tests pass" is stale vs measured 2193 passed / 47
  failed (CF-04).

### 2.2 Frontend checks (apps/web)

| Check      | Command                                               | Result                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck  | `pnpm --filter @vaeloom/web typecheck` (tsc --noEmit) | **PASS** (clean)                                                                                                                                                                                                                |
| Lint       | `pnpm --filter @vaeloom/web lint` (next lint)         | **PASS with warnings** (no-console: error-tracking.ts ×3, web-vitals.ts ×1)                                                                                                                                                     |
| Unit tests | `pnpm --filter @vaeloom/web test` (jest)              | **6 failed / 14 passed** (2 suites: `connectors/page.spec.tsx` 6 fails — page renders "Loading connectors..." so `getAllByText('Sync Now')` finds nothing; `e2e/basic-smoke.spec.ts` — `Cannot find module '@playwright/test'`) |
| E2E        | jest cannot run `e2e/basic-smoke.spec.ts`             | **NOT EXECUTABLE** — @playwright/test missing from web devDeps (jest.config.js also picks up e2e/ unexpectedly — config defect)                                                                                                 |

## 3. Maturity matrix — MVP track objectives

| #    | MVP objective                                                                                              | Evidence class                          | Evidence observed                                                                                                                 | Gap                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| M-01 | Eight runtime agents + Orchestrator                                                                        | IMPLEMENTED_WITH_EVIDENCE (partial)     | Orchestrator (loop/router/state/base) + agent dirs present; 23 agent dirs total; orchestrator router tests fail (env)             | 15 extra agents = enterprise scope creep (CF-05); 8-agent MVP set needs explicit mapping in P05     |
| M-02 | Six memory types                                                                                           | IMPLEMENTED_WITH_EVIDENCE (partial)     | `schemas/memory_types.py`, `memory_service.py`, `memory_versioning.py`, memory_agent (extraction/merge/retrieval/handler) + tests | Verify six types map exactly in P07/P12                                                             |
| M-03 | Suggest-mode-first trust/approval UX                                                                       | IMPLEMENTED_UNVERIFIED                  | orchestration approval flow in code; qa_validator                                                                                 | No UI-level evidence run; approval UX untested in this env                                          |
| M-04 | Resume / ATS value                                                                                         | IMPLEMENTED_UNVERIFIED                  | resume_agent, ats_agent, resume_service, application_service, routes resume/applications/jobs                                     | No evidence run; tests not observed                                                                 |
| M-05 | Lawful opportunity assistance (Gmail draft-only, approved job submission)                                  | IMPLEMENTED_UNVERIFIED                  | gmail_client, job_board_client, gmail_agent                                                                                       | Draft-only + payload-bound approval contract unverified; enterprise out-of-scope connectors present |
| M-06 | Gmail deadline extraction + reminders                                                                      | IMPLEMENTED_UNVERIFIED                  | reminder_agent, scheduler_agent, scheduler_service                                                                                | No evidence run                                                                                     |
| M-07 | Export / deletion (GDPR)                                                                                   | IMPLEMENTED_WITH_EVIDENCE (partial)     | gdpr.py service + tests observed in test tree                                                                                     | Verify in P13                                                                                       |
| M-08 | Workspace-scoped isolation                                                                                 | IMPLEMENTED_WITH_EVIDENCE (partial)     | tenant.py middleware, workspace_service, permission_service, tests                                                                | Verify isolation tests pass in clean env                                                            |
| M-09 | Bounded operational viability (PaaS, SLOs, runbooks)                                                       | SOURCE_DERIVED / IMPLEMENTED_UNVERIFIED | infra/ (terraform, k8s, monitoring, runbooks) present                                                                             | No deploy, no SLO evidence — BLOCKER for GO                                                         |
| M-10 | WCAG 2.2 AA                                                                                                | IMPLEMENTED_UNVERIFIED                  | a11y-audit.yml, testing/accessibility                                                                                             | No a11y run evidence in this env                                                                    |
| M-11 | Security/privacy hardening (JWT validation, plugin sandbox, rate limiting, CORS, CSRF, IP allowlist, RBAC) | IMPLEMENTED_WITH_EVIDENCE (partial)     | middleware/ (auth, csrf, rbac, tenant, ip_filter, rate_limit, security_headers, prompt_injection), plugin_sandbox.py, tests       | Security test suite present; 47 env-fails block full security attestation                           |

## 4. Documentation-maturity (for reference only — never runtime evidence)

| Item                        | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| docs tree                   | 295 .md, 20 ADRs, canonical 01–06                      |
| gap-analysis report         | baseline 74/100 → completion report 93/100 (docs only) |
| IMPLEMENTATION-CHECKLIST.md | Phase 0–1 marked complete (unverified vs runtime)      |
| COMMIT_PLAN.md              | ~280-commit plan (planning artifact)                   |

## 5. Test inventory (backend, on-disk)

- `apps/backend/tests/`: 124 test files — unit, integration, security, conftest
  with mock_llm/mock_connector fixtures.
- `testing/`: 10 suites (accessibility, chaos, e2e, fuzz, integration,
  performance, security, smoke, unit, visual-regression).
- CI: 11 workflows (ci, ci-backend, ci-frontend, ci-integration, security-audit,
  security-scan, a11y-audit, docs-validate, docker-build, deploy,
  deploy-staging).

## 6. Headline conclusion

Runtime truth on 2026-08-06:

- **Backend:** 2193 tests PASS — real implementation exists; 47 env-blocked
  failures + 1 collection error prevent "all green".
- **Frontend:** typecheck + lint pass; 6/20 unit tests fail; e2e not runnable
  (missing @playwright/test + jest config picks up e2e).
- **No deployment, no SLO, no production evidence, no a11y run in this
  environment** — therefore every "production-ready / secure / compliant /
  accessible / scalable" claim in docs is UNVERIFIED.
- **Docs are mature but not authoritative for runtime state** — repo evidence
  outranks them.

→ Full breakdown feeds the gate score in `06-gate-report.md`.
