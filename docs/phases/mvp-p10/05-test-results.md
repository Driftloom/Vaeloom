# MVP-P10 — 05. Test Results (real runs, 2026-08-10)

## 1. Unit/component (jest + RTL)

```
pnpm --filter web test   →   Test Suites: 7 passed, 7 total
                              Tests: 37 passed, 37 total
```

| Suite                                       | Tests | Covers                                                                                                                              |
| ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ApprovalCard.spec.tsx`                     | 7     | render, approve/reject callbacks + ids, diff/scopes/provenance/risk/confidence, past-expiry disabled + copy, T3 alert, keyboard a/r |
| `Modal.spec.tsx`                            | 4     | open render, closed null, focus moved into dialog, Escape close                                                                     |
| `Sidebar.spec.tsx`                          | 3     | 6 IA groups, enterprise `gated`, aria-current, emoji aria-hidden                                                                    |
| `Toast.spec.tsx`                            | 2     | render + auto-dismiss (fake timers), polite live region                                                                             |
| existing (useWorkspace ×2, connectors page) | 20    | regression — all still green                                                                                                        |

## 2. Static checks

| Check     | Command                       | Result                                                                                                      |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Lint      | `pnpm --filter web lint`      | pass; only 4 pre-existing `no-console` warnings in `lib/error-tracking.ts`, `lib/web-vitals.ts` (unchanged) |
| Typecheck | `pnpm --filter web typecheck` | 0 errors                                                                                                    |

## 3. Build + runtime

| Check            | Command                             | Result                                                |
| ---------------- | ----------------------------------- | ----------------------------------------------------- |
| Production build | `pnpm --filter web build`           | pass; 27 routes; First Load JS shared 103 kB          |
| Runtime smoke    | `next start -p 3100` + `GET /login` | **HTTP 200**; page contains skip link + Vaeloom title |

## 4. Not yet run (honest, scheduled)

| Check                                                                                                                          | Phase | Reason                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | ----- | -------------------------------------------------------- |
| axe-core automated audit (all 27 routes, WCAG 2.2 AA)                                                                          | P14   | tooling pin per ASP-P09-02; P14 owns full audit          |
| Screen-reader manual pass (NVDA/VoiceOver), zoom 200%, reduced-motion AT test, usability sessions (≥80% task success, SUS ≥70) | P14   | needs cohort + P14 scope                                 |
| E2E (Playwright) on changed journeys                                                                                           | P14   | playwright suite exists but not in this phase scope      |
| Approval API live wiring                                                                                                       | P11   | backend approval endpoints not implemented yet (by plan) |
