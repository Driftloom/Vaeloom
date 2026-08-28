# MVP-P10 — 05. Test Results (re-executed 2026-08-19, post-fix)

## 1. Unit/component (jest + RTL)

```
npx jest --passWithNoTests   →   Test Suites: 6 passed, 6 total
                                  Tests: 32 passed, 32 total
```

| Suite | Tests | Covers |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ApprovalCard.spec.tsx` | 7 | render, approve/reject callbacks + ids, diff/scopes/provenance/risk/confidence, past-expiry disabled + copy, T3 alert, keyboard a/r |
| `Modal.spec.tsx` | 4 | open render, closed null, focus moved into dialog, Escape close |
| `Sidebar.spec.tsx` | 4 | 6 IA groups, enterprise `gated`, aria-current, emoji aria-hidden |
| `Toast.spec.tsx` | 2 | render + auto-dismiss (fake timers), polite live region |
| `connectors/page.spec.tsx` | 7 | loading, available connectors, connected status, connect API, sync API, error handling (connect + sync) |
| `useWorkspace.test.ts` | 8 | useWorkspace/Agents/Memories/Connectors — undefined → empty, provided → fetch |

## 2. Static checks

| Check | Command | Result |
| --------- | ------------------ | ----------------------------------------------------------------------- |
| Lint | `npx next lint` | pass; only 5 pre-existing warnings (no-console × 4, no-img-element × 1) |
| Typecheck | `npx tsc --noEmit` | 0 errors |

## 3. Build + runtime

| Check | Command | Result |
| ---------------- | ---------------- | -------------------------------------------- |
| Production build | `npx next build` | pass; 27 routes; First Load JS shared 103 kB |

## 4. Backend tests (post-fix)

| Check | Command | Result |
| ---------------------- | ---------------------------------------------------------------------- | ---------- |
| Tenant/CSRF middleware | `pytest tests/middleware/test_tenant.py tests/middleware/test_csrf.py` | 20/20 pass |
| Application-related | `pytest tests/ -k "application"` | 42/42 pass |

## 5. Not yet run (honest, scheduled)

| Check | Phase | Reason |
| ------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------- |
| axe-core automated audit (all 27 routes, WCAG 2.2 AA) | P14 | tooling pin per ASP-P09-02; P14 owns full audit |
| Screen-reader manual pass (NVDA/VoiceOver), zoom 200%, reduced-motion AT test, usability sessions (≥80% task success, SUS ≥70) | P14 | needs cohort + P14 scope |
| E2E (Playwright) on changed journeys | P14 | playwright suite exists but not in this phase scope |
| Approval API live wiring | P11 | backend approval endpoints exist; UI designed vs P08 contract |
