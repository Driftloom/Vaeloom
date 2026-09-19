# CONT-P10 — 03 Component Library

**Deliverable:** `DEL-CONT-P10-03` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Design Systems

## Kit

| Component | Source | Props | A11y |
|-----------|--------|-------|------|
| `Button Modal` | `@vaeloom/ui-kit` | `variant primary/secondary` | keyboard + focus ring |
| `Table` | `components/shared/Table.tsx` | `columns Column<T> keyExtractor data` | `role=table` header scope |
| `StatusBadge` | `components/shared/StatusBadge.tsx` | `variant info/success/warning/error/neutral label` | color+text not color-only `admin/page.tsx:68` `roleColors` |
| `ApprovalCard` | `components/shared/ApprovalCard.tsx:9` | `agentName actionType diff provenance confidence expiresAt t3Warning` | `role=region aria-label` `ApprovalCard.tsx:74` `tabIndex 0` `onKeyDown A/R` `ApprovalCard.tsx:48` `sr-only` `ApprovalCard.tsx:109` |
| `EmptyState ErrorState LoadingSpinner` | `components/shared/*` | `message` | announced via `role=alert` `admin/page.tsx:165` toast |

## Coexistence

- Landing kit (`LandingKit.tsx` `ProblemSection` etc) and workspace kit coexist without CSS collision: both use `globals.css` tokens `bg-background text-text border-border`.
- No new token this phase — frozen v1.0 per `CONT-P09 03-design-system` — `cont-p10` only reuses.

---
_Version 1.0 2026-08-31 — `rg "ApprovalCard" apps/web/src/components/shared 170`._
