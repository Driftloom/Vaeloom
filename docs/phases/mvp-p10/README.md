# MVP-P10 — README

## Status

**FRONTEND_IMPLEMENTATION — EXECUTED** against `master` @ `0e75bdf` (P09). Real
code changes, real tests run. Runtime evidence: see `07-evidence.md`.

## What was implemented (small reviewable chunks)

| #   | Change                                                                                                                                                                                                                                    | Files                                                                                 | Evidence |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| 1   | Design tokens: `success`/`warning`/`info` (+ light variants)                                                                                                                                                                              | `apps/web/tailwind.config.ts`                                                         | EVD-001  |
| 2   | A11y base CSS: skip-link class, `:focus-visible` outline, `prefers-reduced-motion` kill-switch, toast animation                                                                                                                           | `apps/web/src/styles/globals.css`                                                     | EVD-002  |
| 3   | Modal (ui-kit): focus trap (Tab cycle), focus restore on close, unique `aria-labelledby` via useId                                                                                                                                        | `packages/ui-kit/src/components/Modal.tsx`                                            | EVD-003  |
| 4   | New components: SkipLink, ToastProvider/useToast (aria-live polite), DiffViewer (LCS word diff), ProvenanceBadge, ConfidenceMeter, ExpiryTimer (live region), ApprovalCard (evolves deleted ProposalCard)                                 | `apps/web/src/components/shared/*`                                                    | EVD-004  |
| 5   | Shell: Sidebar → 6 IA spaces (Assist/Memory/Career/Operations/Trust & Rights/Enterprise-gated), `aria-current`, emoji aria-hidden; skip link in root layout + `#main-content` targets (workspace/login/signup)                            | `Sidebar.tsx`, `layout.tsx`, auth pages                                               | EVD-005  |
| 6   | Feature wiring: ChatWindow AI disclosure + `role="log"`; Settings typed-confirm delete (receipt w/ backup-expiry) + Consent Scopes section + T3 gated toggle; MemoryCorrectionPanel (supersession copy, wired to live `memoryApi.update`) | `ChatWindow.tsx`, `settings/page.tsx`, `memory/page.tsx`, `MemoryCorrectionPanel.tsx` | EVD-006  |
| 7   | API client: `consentApi` (grant/revoke/me/scopes) + `gdprApi` (export/delete) typed wrappers                                                                                                                                              | `apps/web/src/lib/api-client.ts`                                                      | EVD-006  |

## Verification run (2026-08-10)

| Check                | Command                       | Result                                         |
| -------------------- | ----------------------------- | ---------------------------------------------- |
| Unit/component tests | `pnpm --filter web test`      | **37 passed** (20 baseline + 17 new), 7 suites |
| Lint                 | `pnpm --filter web lint`      | pass (4 pre-existing no-console warnings)      |
| Typecheck            | `pnpm --filter web typecheck` | pass (0 errors)                                |
| Production build     | `pnpm --filter web build`     | pass (27 routes, shared JS 103 kB)             |
| Runtime smoke        | `next start` + GET `/login`   | HTTP 200, skip link present in DOM             |

## Scope guardrails honored

- No new routes (memory page content-only addition). No new runtime deps.
- Approval API NOT called — UI designed against P08 contract; wiring at P11
  (handoff restriction). Gmail stays draft-only; T3 toggle disabled-gated.
- Enterprise nav visible-but-gated; CSRF/CSP untouched (AGENTS.md item 4).
- Typed client + transformKeys patterns reused; no secrets in client.
