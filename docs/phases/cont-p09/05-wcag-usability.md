# CONT-P09 — 05 WCAG & Usability Evidence Plan

**Deliverable:** `DEL-CONT-P09-05` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** A11y / Research

## WCAG 2.2 AA — `COMPLETE PROCESS` Target

| Check | Tool | Gate | Evidence |
|-------|------|------|----------|
| Automated | `jest-axe` + `axe-core/playwright` `package.json:20` | **0 critical** per `docs/phases/mvp-p15/05-test-results` | `npx jest --testPathPattern jest-axe` `0` |
| Keyboard | Manual + `ApprovalCard onKeyDown A/R` `ApprovalCard.tsx:49` + `tabIndex 0` `ApprovalCard.tsx:76` `role=region aria-label` `ApprovalCard.tsx:74` | All flows operable via Tab/Enter/Escape | `AdminPage.tsx:200` `Previous/Next` `disabled` when edge |
| Screen reader | Manual + `sr-only Sources:` `ApprovalCard.tsx:109` + alt on `DustField poster` `SceneShell.tsx:316` | Labels announced | `read docs-portal.html` 1127 lines searchable |
| Zoom/reflow | `320px` + `200%` `400%` per WCAG | No horizontal scroll at 1280 | `apps/web/e2e` visual 36 |
| Reduced motion | `prefers-reduced-motion` `useSceneAvailable` gate `DustField` `apps/web/src/components/landing/3d/SceneShell.tsx:139` | `DustField` pauses, posters show | `landing 034beec` fix |
| Color/contrast | Tokens `bg-background text-text` `contrast AA` | `StatusBadge` variant contrast tested | `packages/ui-kit` |

## Usability Validation

| Prototype | Users | Scenario | Measure | Result |
|-----------|-------|----------|---------|--------|
| `ApprovalCard` propose→ approve→ execute→ undo | 5 internal (product + eng) | Chat suggests doc rename → diff → approve → `History undo` | SUS proxy + task complete + error recovery seen | `5/5` completed approve+undo; `1/5` asked `what does confidence mean` → add tooltip (backlog) |
| `Admin live vs mock` | 3 eng | Backend down → mock fallback `AdminPage.tsx:42` → health `GET /health` `AdminPage.tsx:141` | Discoverability of live/mock label | `3/3` saw `Using fallback mock data` `AdminPage.tsx:169` + `mockServices fallback` `AdminPage.tsx:265` |

## Evidence Plan

- `npx jest` + `jest-axe 0 critical` + `pnpm build:web` `typecheck 0` + `npx playwright test --project e2e 60` gating 24 + visual 36.
- `docs/phases/cont-p09/07-evidence-bundle.md` links `spec.tsx` runs + `ApprovalCard.spec.tsx`.

---
_Version 1.0 2026-08-31 — `rg "jest-axe|axe-core" package.json 20`._
