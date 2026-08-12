# MVP-P00 — 03. Maturity and Evidence Matrix

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Method:**
> repository inspected and runtime checks EXECUTED 2026-08-06 and **RE-EXECUTED
> 2026-08-12** (Windows PowerShell, Python 3.14.6, pnpm, Playwright 3 projects)
> **Key rule applied:** documentation completeness ≠ runtime readiness. Every
> row below is classified by evidence actually observed, not by prose.
> **Register root:** `docs/phases/mvp-p00/`

## 1. Classification legend (per phase prompt §12)

`SOURCE_DERIVED` (design only) · `EXTERNAL_VERIFIED` (standard/verified
externally) · `NEW_DESIGN` · `STAKEHOLDER_DECISION` ·
`IMPLEMENTED_WITH_EVIDENCE` (code + passing test observed) ·
`IMPLEMENTED_UNVERIFIED` (code present, no passing test observed) ·
`NOT_EXECUTED` (nothing ran) · `NOT_APPLICABLE` (out of scope)

## 2. Runtime evidence — commands actually run

### 2.1 Backend test suite (apps/backend) — RE-RUN 2026-08-12 @ `3ad6bca`

```text
env: JWT_SECRET=super-secret-key-12345-dev-only, ENCRYPTION_KEY=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=,
     DATABASE__URL=sqlite+aiosqlite:///./test-evidence.db, LLM_API_KEY=mock-key, OTEL_SDK_DISABLED=true
command: python -m pytest tests/ -q -p no:cacheprovider            (full suite)
result:  2333 passed, 2 xfailed, 0 failed — 9m15s (555s)
command: python -m pytest tests/security -q -p no:cacheprovider    (security suite)
result:  172 passed, 0 failed — 1m50s (110s)
command: python -m pytest tests/ --co -q                            (collection)
result:  2335 tests collected
command: python -m pytest tests/ -q --cov=src/backend/ --cov-report=term
result:  2333 passed, 2 xfailed — TOTAL coverage 94% (641 missing lines) — 14m09s
```

**Status change vs 2026-08-06/08-11:** the prior 47 env-caused failures and the
27 `*_requires_auth` lastfailed are **not reproducible at HEAD** — the full
suite is green when run with the documented env contract (auth middleware works
against SQLite fixtures; OTEL disabled avoids the protobuf × Python 3.14 import
break). No code fix was required; the env contract is the documented test
config.

**Coverage note (honesty):** AGENTS.md's "all source files 100% coverage" is
**STALE** — fresh measurement is 94% total. Lowest files: `webhook_service.py`
64%, `middleware/tenant.py` 68%, `routers/admin_console.py` 72%,
`services/sso.py` 74%, `services/retention.py` 79%, migration 0005_rls 52%
(migrations exercised only via runner tests). Tracking: RISK-P00-13.

### 2.2 Frontend checks (apps/web) — RE-RUN 2026-08-12

| Check      | Command                                               | Result                                                                                                                           |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck  | `pnpm --filter @vaeloom/web typecheck` (tsc --noEmit) | **PASS** (exit 0)                                                                                                                |
| Lint       | `pnpm --filter @vaeloom/web lint` (next lint)         | **PASS with warnings** (no-console: error-tracking.ts ×3, web-vitals.ts ×1)                                                      |
| Unit tests | `pnpm --filter @vaeloom/web test` (jest)              | **37/37 PASS** (7 suites) — was 6 failed / 14 passed at baseline; connector page + sidebar specs now green                       |
| E2E        | `npx playwright test` (testing/e2e, 3 projects)       | **39/39 PASS** (34s) — login/workspace/connector flows × chromium/firefox/mobile-chrome; @playwright/test installed at repo root |

### 2.3 Repo-wide quality checks — 2026-08-12 (new, not run at baseline)

| Check           | Command                                                     | Result                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier (CI)   | `pnpm format:check`                                         | **FAIL (exit 2)** — pre-existing drift on committed files: `sdk/typescript/src/types.ts`, `SECURITY.md`, `testing/accessibility/audit-pages.ts`, `axe-config.ts`, `testing/integration/test-containers.ts` → CI `lint-typecheck` job would fail → RISK-P00-11 |
| Ruff (CI scope) | `ruff check packages/python-common/src apps/ai-service/src` | **FAIL (18 errors)** — style drift (UP007 `X                                                                                                                                                                                                                  | None`, 11 auto-fixable) → CI `python-checks` job would fail → RISK-P00-12 |
| Ruff (backend)  | `ruff check src tests` (apps/backend)                       | 405 errors — **not** CI-enforced for apps/backend (ci-backend.yml runs pytest only); informational only                                                                                                                                                       |
| Nx root lint    | `pnpm lint` (nx run-many)                                   | Hangs in this shell (same limitation as `pnpm dev` — some packages lack lint targets); per-package lint clean                                                                                                                                                 |

## 3. Maturity matrix — MVP track objectives

| #    | MVP objective                                                                                              | Evidence class                          | Evidence observed                                                                                                                                                | Gap                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| M-01 | Eight runtime agents + Orchestrator                                                                        | IMPLEMENTED_WITH_EVIDENCE (partial)     | Orchestrator (loop/router/state/base) + 23 agent dirs under `agents/`; scope-lock tests (mvp_scope_enforced) green in full suite                                 | 15 extra agents = enterprise scope creep (CF-05); 8-agent MVP set mapping confirmed in P05 |
| M-02 | Six memory types                                                                                           | IMPLEMENTED_WITH_EVIDENCE (partial)     | `schemas/memory_types.py`, `memory_service.py`, `memory_versioning.py`, memory_agent (extraction/merge/retrieval/handler) + tests green                          | 6-type vs 22-type registry divergence still OPEN (deferred P07/P12 per user decision)      |
| M-03 | Suggest-mode-first trust/approval UX                                                                       | IMPLEMENTED_WITH_EVIDENCE (partial)     | approval API + idempotency middleware (P11 batch 1, `bfae40f`); ApprovalCard in web; approval + idempotency tests green                                          | ApprovalCard still not wired to backend API (P10→P11 handoff item)                         |
| M-04 | Resume / ATS value                                                                                         | IMPLEMENTED_WITH_EVIDENCE               | resume_agent, ats_agent, resume_service, application_service, routes; tests green in full suite                                                                  | No real-user validation (cohort — BQ-05/UNK-05)                                            |
| M-05 | Lawful opportunity assistance (Gmail draft-only, approved job submission)                                  | IMPLEMENTED_WITH_EVIDENCE (partial)     | gmail_client + gmail watch/draft-only API (P11 batch 2, `929e659`), gmail_agent; `test_gmail_router` green                                                       | Approved job submission via official integration not yet proven end-to-end (P13)           |
| M-06 | Gmail deadline extraction + reminders                                                                      | IMPLEMENTED_WITH_EVIDENCE               | reminder_agent, scheduler_agent, scheduler_service; scheduler tests green                                                                                        | No live Gmail evidence (no credentials — BQ-02/UNK-03)                                     |
| M-07 | Export / deletion (GDPR)                                                                                   | IMPLEMENTED_WITH_EVIDENCE               | gdpr.py service + consent router; GDPR + consent tests green                                                                                                     | Legal review pending; DPDP rules doc absent                                                |
| M-08 | Workspace-scoped isolation                                                                                 | IMPLEMENTED_WITH_EVIDENCE               | tenant.py middleware, workspace_service, permission_service; tenant/isolation tests green (incl. security suite 172/172)                                         | RLS coverage 52% in migration 0005 (projection-level isolation proof in P07)               |
| M-09 | Bounded operational viability (PaaS, SLOs, runbooks)                                                       | SOURCE_DERIVED / IMPLEMENTED_UNVERIFIED | infra/ (terraform, k8s, monitoring, runbooks) present                                                                                                            | No deploy, no SLO evidence — BLOCKER for GO (BQ-02 deferred to P19)                        |
| M-10 | WCAG 2.2 AA                                                                                                | IMPLEMENTED_UNVERIFIED                  | a11y-audit.yml, testing/accessibility                                                                                                                            | No a11y run evidence in this env (P14)                                                     |
| M-11 | Security/privacy hardening (JWT validation, plugin sandbox, rate limiting, CORS, CSRF, IP allowlist, RBAC) | IMPLEMENTED_WITH_EVIDENCE               | middleware/ (auth, csrf, rbac, tenant, ip_filter, rate_limit, security_headers, prompt_injection), plugin_sandbox.py; **security suite 172/172 PASS 2026-08-12** | Legal review + external audit pending (P13)                                                |

## 4. Documentation-maturity (for reference only — never runtime evidence)

| Item                        | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| docs tree                   | 492 .md, 20 ADRs, canonical 01–06                      |
| gap-analysis report         | baseline 74/100 → completion report 93/100 (docs only) |
| IMPLEMENTATION-CHECKLIST.md | Phase 0–1 marked complete (unverified vs runtime)      |
| COMMIT_PLAN.md              | ~280-commit plan (planning artifact)                   |

## 5. Test inventory (backend, on-disk)

- `apps/backend/tests/`: **130 test files + 3 conftest.py + 1 debug harness**
  (134 `.py` total) — unit, integration, security, conftest with mock_llm/
  mock_connector fixtures; 2335 tests collected / 2333 passed.
- `testing/`: 10 suites (accessibility, chaos, e2e, fuzz, integration,
  performance, security, smoke, unit, visual-regression) — **e2e live (39/39);
  chaos/fuzz/security/smoke/visual-regression dirs still empty**.
- CI: 11 workflows (ci, ci-backend, ci-frontend, ci-integration, security-audit,
  security-scan, a11y-audit, docs-validate, docker-build, deploy,
  deploy-staging).

## 6. Headline conclusion

Runtime truth re-verified 2026-08-12 @ `3ad6bca`:

- **Backend:** 2335 collected → **2333 PASS, 0 failed, 2 xfailed** — first fully
  green full-suite run in P00 history (was 47 env-fails, then 27 lastfailed).
  Security suite 172/172 PASS. Coverage 94% (641 lines uncovered — stale 100%
  claim retired).
- **Frontend:** typecheck + lint clean; jest **37/37**; e2e **39/39 across 3
  browsers**.
- **Repo-wide CI drift:** prettier `format:check` FAIL on 5 committed files and
  CI-scope ruff FAIL (18) — CI `lint-typecheck`/`python-checks` jobs would be
  red; owned by RISK-P00-11/12, remediation cheap (auto-fix).
- **No deployment, no SLO, no production evidence, no a11y run in this
  environment** — every "production-ready / secure / compliant / accessible /
  scalable" claim in docs remains UNVERIFIED.
- **Docs are mature (492) but not authoritative for runtime state** — repo
  evidence outranks them.

→ Full breakdown feeds the gate score in `09-gate-2026-08-12.md`.

## 7. Completion pass 2026-08-12 (docs-only)

Prompt-mandated paperwork closed without touching source code:

- **§10 Enterprise completeness** → `10-enterprise-completeness.md` — 19
  domains: 10 APPLICABLE (incl. change control), 6 BLOCKED (compliance, UX/a11y,
  performance, reliability, operations, DevOps → owning phases P13/P14/P15/
  P16/P17/P19 named), 3 NOT_APPLICABLE (cost, sustainability, localization) —
  each with reason.
- **§23 Evidence & traceability** → `11-evidence-traceability.md` —
  EVD-MVP-P00-001…021 (every material claim → file/run → result → date →
  verifier; failures visible).
- **Future-readiness overlay** → `12-future-readiness-backlog.md` — FB-01…05
  (manifest, SBOM/AI-BOM, retention/hashing, conflict protocol, scope
  protection) with adoption triggers + owners; no silent scope expansion.
- **§26/§27 DoR/DoD** → `13-readiness-and-done.md` — all items checked with
  evidence pointers; gate sign-off honestly marked [ ] pending USER.
- **§30 Completion response (A–P)** → `14-completion-response.md`.
- **§28 gate re-score** → `09-gate-2026-08-12.md` §8 — **75.69/100** (corrected
  arithmetic; evidence/traceability 93, documentation 90, scope 78).
