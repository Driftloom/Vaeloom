# MVP-P10 — 06. Security / Privacy / A11y Notes

## Security & privacy

| Control                 | Implementation                                                                                                                       | Evidence |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| No secrets in client    | no new env vars; typed client reused; transformKeys only                                                                             | EVD-001  |
| CSP/CSRF untouched      | zero changes to middleware, next.config, csrf lists (AGENTS.md item 4)                                                               | EVD-001  |
| Least-privilege UI      | T3 (gmail.send) consent toggle rendered **disabled**; Gmail stays draft-only; no send affordance added anywhere                      | EVD-006  |
| Consequential action UI | ApprovalCard = proposal/action separation; nothing executes client-side; payload-bound diff + scopes + risk shown                    | EVD-004  |
| Data rights             | typed-confirm erasure (no more dual window.confirm), receipt with backup-expiry semantics (BQ-P07-01), consent scopes plain-language | EVD-006  |
| Logs/telemetry          | no new logging; chat disclosure avoids sensitive echoes                                                                              | EVD-001  |

## Accessibility (WCAG 2.2 AA targets, implemented)

| Criterion           | Implementation                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4.1 Bypass blocks | `.skip-link` (sr-only → focus-visible) + `#main-content` on all 3 layouts                                                                                              |
| 2.4.7 Focus visible | global `:focus-visible` outline (primary, 2px offset) + component rings                                                                                                |
| 2.3.3 Animation     | `prefers-reduced-motion: reduce` kill-switch in globals.css                                                                                                            |
| 4.1.2/4.1.3         | `role="dialog" aria-modal aria-labelledby` (unique via useId), `aria-live="polite"` (toast region, chat log, expiry), `aria-current="page"`, `role="log"`, `aria-busy` |
| 1.1.1 Non-text      | emoji nav icons `aria-hidden` (names conveyed by link text); SVG close icons aria-hidden + labeled buttons                                                             |
| 3.2.x Predictable   | modal focus trap prevents focus escape; focus restored on close                                                                                                        |
| 2.4.3 Focus order   | first focusable (close) receives focus on modal open                                                                                                                   |

## Boundaries honored

- DEC-P09-01 boundary: desktop-first, en, NVDA/VoiceOver + keyboard-only —
  implementation does not require other browsers/AT.
- No new runtime dependencies (P06 governance); bundle 103 kB shared JS.
- Enterprise surfaces visible-but-gated; no new routes; memory page change is
  content-only (restriction 4).
