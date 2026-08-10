# MVP-P10 — 07. Evidence (EVD)

> Each claim: requirement → artifact → command/result. Plans are not evidence;
> all below are real runs (2026-08-10) or immutable file states.

| ID              | Claim                                                                                    | Req     | Type              | Location                                                                  | Result   | Verified    |
| --------------- | ---------------------------------------------------------------------------------------- | ------- | ----------------- | ------------------------------------------------------------------------- | -------- | ----------- |
| EVD-MVP-P10-001 | No CSP/CSRF/secrets changes; typed client reused                                         | R03     | git diff review   | `04-code-config.md`                                                       | PASS     | Phase owner |
| EVD-MVP-P10-002 | Reduced-motion + focus-visible + skip-link CSS                                           | R04     | file              | `globals.css`                                                             | VERIFIED | Phase owner |
| EVD-MVP-P10-003 | Modal focus trap + restore + useId                                                       | R04     | file + test       | `ui-kit/Modal.tsx`, `Modal.spec.tsx`                                      | VERIFIED | Phase owner |
| EVD-MVP-P10-004 | ApprovalCard + supporting components                                                     | R01     | file + test       | `ApprovalCard.spec.tsx` (7 tests)                                         | VERIFIED | Phase owner |
| EVD-MVP-P10-005 | Sidebar 6-space IA + gating + a11y                                                       | R01     | file + test       | `Sidebar.spec.tsx` (3 tests)                                              | VERIFIED | Phase owner |
| EVD-MVP-P10-006 | Feature wiring (chat disclosure, settings rights, memory correction, consentApi/gdprApi) | R01/R03 | files + typecheck | `ChatWindow.tsx`, `settings`, `memory`, `api-client.ts`                   | VERIFIED | Phase owner |
| EVD-MVP-P10-007 | Build + bundle                                                                           | R04     | run               | `pnpm --filter web build` — 27 routes, 103 kB shared                      | PASS     | Phase owner |
| EVD-MVP-P10-008 | Full test suite + lint + typecheck + smoke                                               | R04     | run               | `test` 37/37 · lint pass · tsc 0 err · `next start` HTTP 200 w/ skip link | PASS     | Phase owner |
| EVD-MVP-P10-009 | Restriction compliance (P09 1–4)                                                         | R07     | audit             | `02-predecessor-audit.md` §2                                              | PASS     | Phase owner |
| EVD-MVP-P10-010 | User ratification                                                                        | R08     | question-tool     | PENDING                                                                   | PENDING  | User        |

## Traceability chain

P09 design (§03–§07) → P10 tasks (`03-workstreams.md`) → code (`04`) → tests
(`05`) → security/a11y (`06`) → evidence (this file) → risks/decisions
(`08-registers.md`) → gate (`09`) → handoff (`10`).
