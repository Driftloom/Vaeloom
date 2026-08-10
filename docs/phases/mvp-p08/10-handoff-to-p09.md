# MVP-P08 → MVP-P09 Handoff

## Phase Summary

MVP-P08 designed the API/integration/contract layer over the **live** 72-path
OpenAPI surface (snapshot evidence), with additive deltas:

- Approval API (propose/decide/execute/revoke) — release-blocking
- Idempotency keys + RFC 9457 error envelope + async Job polling (202)
- Memory domain deltas (6-taxonomy) + supersession semantics
- Gmail watcher contract (draft-only; kill-switch pause)
- Events/webhooks/jobs schemas; SDK/tool/MCP/plugin contracts
- AuthN/AuthZ deltas (RFC 9700, RLS binding, HMAC workload identity)
- Compatibility & deprecation policy (BQ-P08-01)

## Evidence

| ID                   | Requirement | Artifact                                          |
| -------------------- | ----------- | ------------------------------------------------- |
| EVD-MVP-P08-001      | R01/R02     | `01` §3 live openapi dump (72 paths / 70 schemas) |
| EVD-MVP-P08-002..006 | R01..R07    | `03`–`07`                                         |
| EVD-MVP-P08-007      | R03         | BQ-P08-01 question-tool record                    |
| EVD-MVP-P08-008      | R08         | PENDING user ratification                         |

## Gate: CONDITIONAL APPROVED — RESTRICTIONS APPLY (88/100)

| Restriction                                                               | Target phase |
| ------------------------------------------------------------------------- | ------------ |
| 1. Approval API ships before any send-capable path (release-blocking)     | P11          |
| 2. No breaking change w/o 1-cycle notice + user approval; openapi-diff CI | P11+         |
| 3. CSRF skip-list stays auth-only; widen only with security review        | every phase  |
| 4. Gmail draft-only; no send without per-user T3 enablement               | P11/P13      |

## Open issues carried

- RISK-P08-01..05 (register §1) — owners assigned
- UNK-02 creds → P19 · UNK-P03-01 legal → P13 · VB-07 cohort → user
- Approval/idempotency/Gmail-watcher implementation → P11 (P10 = core platform)

## Scope for MVP-P09

- UI/UX & Design System for the web app:
  - Information architecture for P1+P2 personas & user flows (onboarding,
    agents, memory, approvals, Gmail, notifications, settings, rights)
  - Design system/tokens from `packages/ui-kit` + existing components
  - Accessibility (WCAG), theming (existing light/dark), keyboard nav
  - Use real existing web routes/pages as the canvas; no runtime code changes
- Carry restrictions: no code, no breaking changes, design-only phase.
- Evidence at P09 gate = source-grounded design artifacts (route inventory,
  component inventory, IA diagram, token map), not screenshots.

## Constraints for successor

- Repo truth: web app is Next.js 15 + existing routes (16+ pages) — inventory
  them; do not invent new routes beyond IA proposal.
- ui-kit/design tokens exist — map, don't recreate.
- A11y + theming + keyboard shortcuts (P12 polish features) — consider in IA.
- Restriction 3 applies: no touching middleware/CSP lists.
