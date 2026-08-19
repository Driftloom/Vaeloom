# MVP-P10 — 07. Evidence (EVD)

> Each claim: requirement → artifact → command/result. Plans are not evidence;
> all below are real runs (2026-08-19) or immutable file states.

| ID              | Claim                                                                                    | Req     | Type              | Location                                                | Result   | Verified    |
| --------------- | ---------------------------------------------------------------------------------------- | ------- | ----------------- | ------------------------------------------------------- | -------- | ----------- |
| EVD-MVP-P10-001 | No CSP/CSRF/secrets changes; typed client reused                                         | R03     | git diff review   | `middleware.ts`, `api-client.ts`                        | PASS     | Phase owner |
| EVD-MVP-P10-002 | Reduced-motion + focus-visible + skip-link CSS                                           | R04     | file              | `globals.css`                                           | VERIFIED | Phase owner |
| EVD-MVP-P10-003 | Modal focus trap + restore + useId                                                       | R04     | file + test       | `ui-kit/Modal.tsx`, `Modal.spec.tsx`                    | VERIFIED | Phase owner |
| EVD-MVP-P10-004 | ApprovalCard + supporting components                                                     | R01     | file + test       | `ApprovalCard.spec.tsx` (7 tests)                       | VERIFIED | Phase owner |
| EVD-MVP-P10-005 | Sidebar 6-space IA + gating + a11y                                                       | R01     | file + test       | `Sidebar.spec.tsx` (4 tests)                            | VERIFIED | Phase owner |
| EVD-MVP-P10-006 | Feature wiring (chat disclosure, settings rights, memory correction, consentApi/gdprApi) | R01/R03 | files + typecheck | `ChatWindow.tsx`, `settings`, `memory`, `api-client.ts` | VERIFIED | Phase owner |
| EVD-MVP-P10-007 | Build + bundle                                                                           | R04     | run               | `npx next build` — 27 routes, 103 kB shared             | PASS     | Phase owner |
| EVD-MVP-P10-008 | Full test suite + lint + typecheck + build                                               | R04     | run               | `jest` 32/32 · lint pass · tsc 0 err · build pass       | PASS     | Phase owner |
| EVD-MVP-P10-009 | Restriction compliance (P09 1–4)                                                         | R07     | audit             | `02-predecessor-audit.md` §2                            | PASS     | Phase owner |
| EVD-MVP-P10-010 | Applications page wired to real API                                                      | R01     | file + typecheck  | `applications/page.tsx`, `api-client.ts`                | VERIFIED | Phase owner |
| EVD-MVP-P10-011 | Security verification (no secrets, CSP/CSRF untouched, T3 gated)                         | R03     | grep + audit      | `middleware.ts`, `settings/page.tsx`                    | PASS     | Phase owner |
| EVD-MVP-P10-012 | Deep audit: 18 issues found and fixed (3 critical, 6 high, 9 medium)                     | R03/R04 | code + tests      | `.agents/findings/`, git commits `67a7f7a` + `47a3844`  | PASS     | Phase owner |
| EVD-MVP-P10-013 | Tenant isolation fix: `get_current_tenant()` reads `request.state` not header            | R03     | code + test       | `middleware/tenant.py:116`, `test_tenant.py` 20/20 pass | PASS     | Phase owner |
| EVD-MVP-P10-014 | CSRF cookie flags: `secure=True`, `httponly=True`                                        | R03     | code              | `main.py:162-163`                                       | PASS     | Phase owner |
| EVD-MVP-P10-015 | Security headers: X-XSS-Protection, Referrer-Policy, Permissions-Policy                  | R03     | code              | `security_headers.py:13-15`                             | PASS     | Phase owner |

## Traceability chain

P09 design (§03–§07) → P10 tasks (`03-workstreams.md`) → code (`04`) → tests
(`05`) → security/a11y (`06`) → evidence (this file) → risks/decisions
(`08-registers.md`) → gate (`09`) → handoff (`10`).
