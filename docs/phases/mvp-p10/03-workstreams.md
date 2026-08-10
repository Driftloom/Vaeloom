# MVP-P10 — 03. Workstreams & Task Status

> Prompt §11/§12. Statuses: `VERIFIED` = implemented + tested.

## WS-10.1 Application shell/routing

| Task                                                                  | Status   | Evidence                        |
| --------------------------------------------------------------------- | -------- | ------------------------------- |
| Skip link + `#main-content` landmark (root, workspace, login, signup) | VERIFIED | EVD-005, smoke check            |
| Sidebar IA regrouping (6 spaces) + enterprise gating + aria-current   | VERIFIED | EVD-005, Sidebar.spec (3 tests) |
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

## WS-10.4 Accessibility/performance/security

| Task                                                           | Status                                       | Evidence        |
| -------------------------------------------------------------- | -------------------------------------------- | --------------- |
| WCAG 2.2 AA targeted controls (2.4.1, 2.4.7, 4.1.3, 2.3.3)     | VERIFIED (implementation); P14 audit pending | EVD-002/004/005 |
| No new deps; bundle shared JS 103 kB (build output)            | VERIFIED                                     | EVD-007         |
| No secrets in client; transformKeys reused; CSP/CSRF untouched | VERIFIED                                     | EVD-001         |

## WS-10.5 Tests/delivery

| Task                                                                           | Status                | Evidence       |
| ------------------------------------------------------------------------------ | --------------------- | -------------- |
| 17 new tests (ApprovalCard 7, Modal 4, Sidebar 3, Toast 2, +1 earlier pattern) | VERIFIED — 37/37 pass | EVD-008        |
| Lint, typecheck, production build, runtime smoke                               | VERIFIED              | EVD-008        |
| Evidence + registers + gate + handoff docs                                     | VERIFIED              | this phase dir |
