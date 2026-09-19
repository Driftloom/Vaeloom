# MVP-P10 — 06. Security / Privacy / A11y Notes

> Re-verified 2026-08-19 (post-fix deep audit)

## Security & privacy

| Control | Implementation | Evidence |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| No secrets in client | no new env vars; typed client reused; transformKeys only; grep confirms no hardcoded secrets | EVD-001/011 |
| CSP/CSRF untouched | zero changes to middleware, next.config, csrf lists (AGENTS.md item 4) | EVD-001/011 |
| Tenant isolation | `get_current_tenant()` reads `request.state.tenant_id` (JWT-derived); header bypass FIXED 2026-08-19 | EVD-012 |
| CSRF cookie flags | `secure=True` (non-local), `httponly=True`, `samesite="lax"` — FIXED 2026-08-19 | EVD-012 |
| Security headers | `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` added — FIXED 2026-08-19 | EVD-012 |
| Least-privilege UI | T3 (gmail.send) consent toggle rendered **disabled**; Gmail stays draft-only; no send affordance added anywhere | EVD-006 |
| Consequential action UI | ApprovalCard = proposal/action separation; nothing executes client-side; payload-bound diff + scopes + risk shown | EVD-004 |
| Data rights | typed-confirm erasure (no more dual window.confirm), receipt with backup-expiry semantics (BQ-P07-01), consent scopes plain-language | EVD-006 |
| Logs/telemetry | no new logging; chat disclosure avoids sensitive echoes | EVD-001 |

## Accessibility (WCAG 2.2 AA targets, implemented)

| Criterion | Implementation |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4.1 Bypass blocks | `<SkipLink />` component imported in `layout.tsx` + `#main-content` on all 3 layouts |
| 2.4.7 Focus visible | global `:focus-visible` outline (primary, 2px offset) + component rings |
| 2.3.3 Animation | `prefers-reduced-motion: reduce` kill-switch in globals.css |
| 4.1.2/4.1.3 | `role="dialog" aria-modal aria-labelledby` (unique via useId), `aria-live="polite"` (toast region, chat log, expiry), `aria-current="page"`, `role="log"` |
| 1.1.1 Non-text | SVG nav icons (aria-hidden + labeled buttons); close icons aria-hidden + labeled buttons |
| 3.2.x Predictable | modal focus trap prevents focus escape; focus restored on close; `inert` on backdrop |
| 2.4.3 Focus order | first focusable (close) receives focus on modal open |
| Toast a11y | timer leak FIXED; pause on hover; Escape dismiss; `aria-live="polite"` with sr-only tone labels |
| ProvenanceBadge | `aria-label` with source + confidence; confidence clamped 0-1 |
| ExpiryTimer | `aria-live="polite"`; fires immediately if pre-expired; interval churn FIXED via ref-based callback |

## Boundaries honored

- DEC-P09-01 boundary: desktop-first, en, NVDA/VoiceOver + keyboard-only —
 implementation does not require other browsers/AT.
- No new runtime dependencies (P06 governance); bundle 103 kB shared JS.
- Enterprise surfaces visible-but-gated; no new routes; memory page change is
 content-only (restriction 4).
