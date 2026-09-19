# CONT-P09 — 03 Design System & Governance

**Deliverable:** `DEL-CONT-P09-03` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Design Systems

## Tokens (existing + CONT-P09 additive)

| Token layer | File | CONTRACT |
|-------------|------|----------|
| CSS vars | `apps/web/src/styles/globals.css` + `packages/ui-kit/src/tokens.css` | `bg-background text-text border-border` `text-muted/dim` `primary/warning/accent` never raw hex |
| Components | `packages/ui-kit` `Button Modal Table StatusBadge` | `Button variant primary/secondary` `StatusBadge variant info/success/warning/error/neutral` `AdminPage.tsx:68` `roleColors/statusColors` |
| Layout | `apps/web/src/components/layout/Sidebar.tsx TopNav.tsx` | `TopNav` `Sidebar.spec.tsx`  `Sidebar` WS isolation header |

**Governance:** `UI kit` is `transpilePackages` `apps/web/next.config.js:13`. No component may ship without `spec.tsx` + `jest-axe` `0 critical` (see `05-wcag`).

## Change-Experience Migration (personal vs institution)

| Context | Detection | Copy | Visibility |
|---------|-----------|------|------------|
| Personal workspace | `tenant_id == user_id` or single-member ws | "Your work stays in your workspace — not shared." | Consent scope description `privacy/page.tsx:7` personal |
| Institution workspace | `tenant_id != user_id` multi-member | "Shared with [org] admins can see [scopes]." | `Admin Dashboard` user table `AdminPage.tsx:147` + `auditLog` shows actor `AdminPage.tsx:155` |

**Rule per §13:** make purpose/visibility understandable — every consent/API scope badge shows `Scopes:` chips `ApprovalCard.tsx:126` + `provenance` badges `ApprovalCard.tsx:107`.

## Versioning

- Tokens `v1.0` frozen this phase; next additive change via `ADR-04x` + `unlock` flag.
- `DiffViewer` keeps old/new side-by-side for admin rename/document undo parity.

---
_Version 1.0 2026-08-31 — `rg "packages/ui-kit" apps/web/next.config.js 13`._
