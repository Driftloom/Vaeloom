# MVP-P10 — 03. Workstreams & Task Status

> Prompt §11/§12. Statuses: `VERIFIED` = implemented + tested. Re-executed
> 2026-08-19; deep audit + 18 fixes applied; gate 96/100.

## WS-10.1 Application shell/routing

| Task                                                                  | Status   | Evidence                        |
| --------------------------------------------------------------------- | -------- | ------------------------------- |
| Skip link + `#main-content` landmark (root, workspace, login, signup) | VERIFIED | EVD-005, smoke check            |
| Sidebar IA regrouping (6 spaces) + enterprise gating + aria-current   | VERIFIED | EVD-005, Sidebar.spec (4 tests) |
| Global `:focus-visible` outline + reduced-motion kill switch          | VERIFIED | EVD-002                         |

## WS-10.2 Typed data/state

| Task                                                                                        | Status   | Evidence                      |
| ------------------------------------------------------------------------------------------- | -------- | ----------------------------- |
| `consentApi` + `gdprApi` typed wrappers (grant/revoke/me/scopes/export/delete)              | VERIFIED | EVD-006, typecheck            |
| Memory correction state machine (edit modal → save → toast → reload)                        | VERIFIED | EVD-006                       |
| Toast state (auto-dismiss 6s, dismiss button)                                               | VERIFIED | EVD-004, Toast.spec (2 tests) |
| No false optimistic success: corrections re-fetch after save; delete requires typed confirm | VERIFIED | EVD-006                       |

## WS-10.3 Feature workflows

| Task                                                                                                         | Status                                             | Evidence                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------ |
| ApprovalCard (diff, expiry, provenance, confidence, risk, scopes, T3 warning, kbd a/r)                       | VERIFIED (UI; API wiring deferred P11 per handoff) | EVD-004, ApprovalCard.spec (7 tests) |
| Chat AI disclosure + `role="log"` live region                                                                | VERIFIED                                           | EVD-006                              |
| Settings: consent scopes (plain-language, T3 gated-disabled), typed-confirm erasure w/ backup-expiry receipt | VERIFIED                                           | EVD-006                              |
| MemoryCorrectionPanel (supersession copy, undo-from-history note)                                            | VERIFIED                                           | EVD-006                              |
| Applications page: real API (applicationApi.list), Kanban, status badges                                     | VERIFIED                                           | EVD-010, typecheck                   |

## WS-10.4 Accessibility/performance/security

| Task                                                           | Status                                       | Evidence        |
| -------------------------------------------------------------- | -------------------------------------------- | --------------- |
| WCAG 2.2 AA targeted controls (2.4.1, 2.4.7, 4.1.3, 2.3.3)     | VERIFIED (implementation); P14 audit pending | EVD-002/004/005 |
| No new deps; bundle shared JS 103 kB (build output)            | VERIFIED                                     | EVD-007         |
| No secrets in client; transformKeys reused; CSP/CSRF untouched | VERIFIED                                     | EVD-001/011     |

## WS-10.5 Tests/delivery

| Task                                                                                 | Status                | Evidence       |
| ------------------------------------------------------------------------------------ | --------------------- | -------------- |
| 32 tests (ApprovalCard 7, Modal 4, Sidebar 4, Toast 2, Connectors 7, useWorkspace 8) | VERIFIED — 32/32 pass | EVD-008        |
| Lint, typecheck, production build                                                    | VERIFIED              | EVD-008        |
| Evidence + registers + gate + handoff docs                                           | VERIFIED              | this phase dir |
