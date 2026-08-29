# Design vs Reality — Gaps Between Docs and Actual Code

> **Date:** 2026-08-18 · **Method:** Compare doc claims against actual source
> code

## Summary

The P09 design artifacts and `docs/frontend/` documentation describe an
aspirational UI that is **partially implemented**. Key gaps exist between what
the docs promise and what the code delivers.

## Critical Gaps

### GAP-001: 64+ components promised, 22 exist

- **Doc claim:** `docs/frontend/Component-Library.md` describes 64+ components
  across 5 atomic layers
- **Reality:** 22 component files exist (5 ui-kit + 17 shared + layout)
- **Missing:** Toast (exists but different), diff-viewer (exists),
  provenance-badge (exists), confidence-meter (exists), consent-toggle-group
  (MISSING), expiry-timer (exists), tablist (MISSING), dropdown (MISSING),
  breadcrumbs (MISSING), command-palette (MISSING), pagination (MISSING),
  skeleton (MISSING), avatar (MISSING), badge (MISSING), tooltip (MISSING),
  popover (MISSING), accordion (MISSING), tabs (MISSING), alert (MISSING), sheet
  (MISSING)
- **Impact:** P10 will need to build ~30+ components from scratch

### GAP-002: 91 CSS tokens promised, ~20 exist

- **Doc claim:** `docs/frontend/Design-System.md` describes 91 CSS custom
  properties
- **Reality:** ~20 tokens in `tailwind.config.ts` (dark + light variants)
- **Missing:** Component-level tokens (--card-bg, --btn-primary-bg,
  --modal-shadow, etc.)
- **Impact:** P10 will need to create component token layer

### GAP-003: Enterprise gating is cosmetic only

- **Doc claim:** P09 `03-ia-journeys.md`: "Enterprise-gated" spaces
- **Reality:** Sidebar shows "gated" badge but NO route protection exists
- **Impact:** Any user can access /admin, /billing, /organizations, etc.
- **Fix:** Add middleware route protection

### GAP-004: Focus trap not implemented

- **Doc claim:** P09 `04-screen-state-specs.md`: "Modal focus trap" as
  restriction
- **Reality:** Modal component has no focus trap. Keyboard shortcuts modal has
  no focus trap.
- **Impact:** Keyboard users can tab out of modals.

### GAP-005: WCAG 2.2 AA not achieved

- **Doc claim:** P09 `07-wcag-usability-plan.md`: "WCAG 2.2 Level AA target"
- **Reality:** Multiple accessibility gaps:
  - ConfidenceMeter: no progressbar role
  - ProgressBar: no progressbar role
  - SearchInput: no aria-label
  - Table: no scope, aria-sort, keyboard
  - StatusBadge: no role=status
  - Modal: no focus trap
- **Impact:** Not WCAG 2.2 AA compliant

### GAP-006: AI disclosure not persistent

- **Doc claim:** P09 `04-screen-state-specs.md` §5: "Persistent header
  throughout session"
- **Reality:** Chat page has no persistent AI disclosure header
- **Impact:** EU AI Act Article 50 compliance gap

### GAP-007: Optimistic UI not implemented

- **Doc claim:** P09 `04-screen-state-specs.md` §4: Optimistic UI patterns
  designed
- **Reality:** No optimistic UI patterns implemented anywhere
- **Impact:** P10 must implement from scratch

### GAP-008: Error tracking is a stub

- **Doc claim:** `docs/frontend/ErrorTracking.md` presumably describes error
  tracking
- **Reality:** `error-tracking.ts` has Sentry commented out, only console.error
- **Impact:** No production error visibility

### GAP-009: i18n is minimal

- **Doc claim:** `docs/frontend/Internationalization.md` describes full i18n
- **Reality:** `en.json` exists but most strings are hardcoded in components
- **Impact:** Cannot add new locales without refactoring all components

### GAP-010: Charts/visualization not implemented

- **Doc claim:** `docs/frontend/Charts.md` describes Recharts + D3.js strategy
- **Reality:** No chart library installed. GraphViewer uses basic SVG.
- **Impact:** Dashboard widgets have no data visualization

### GAP-011: Forms library not integrated

- **Doc claim:** `docs/frontend/Forms.md` describes React Hook Form integration
- **Reality:** No React Hook Form in package.json. Forms use native HTML.
- **Impact:** No validation, auto-save, or multi-step wizard support

### GAP-012: State management is fragmented

- **Doc claim:** `docs/frontend/State-Management.md` describes TanStack Query +
  Zustand
- **Reality:** SWR is used (not TanStack Query). Zustand exists but duplicated
  with hooks.
- **Impact:** Inconsistent data fetching patterns

### GAP-013: Animation system not implemented

- **Doc claim:** `docs/frontend/Animation-System.md` describes
  micro-interactions
- **Reality:** Only CSS `prefers-reduced-motion` and Toast enter animation exist
- **Impact:** No page transitions, no skeleton animations, no micro-interactions

### GAP-014: Mobile architecture not implemented

- **Doc claim:** `docs/frontend/Mobile-Architecture.md` describes companion app
- **Reality:** No mobile-specific code. Responsive classes exist but no bottom
  nav.
- **Impact:** Mobile experience is poor

### GAP-015: Testing coverage is minimal

- **Doc claim:** P09 `07-wcag-usability-plan.md`: "jest-axe/axe-core at P14"
- **Reality:** 6 test files, 32 tests. No a11y testing. No jest-axe installed.
- **Impact:** Cannot verify WCAG compliance automatically

## What IS Implemented (Matching Docs)

| Feature                       | Status | Evidence                         |
| ----------------------------- | ------ | -------------------------------- |
| 23 page routes                | REAL   | All page.tsx files exist         |
| Dark/light theme              | REAL   | tailwind.config.ts + ThemeToggle |
| Keyboard shortcuts (9)        | REAL   | useKeyboardShortcuts.tsx         |
| Skip link                     | REAL   | SkipLink.tsx + globals.css       |
| Reduced motion                | REAL   | globals.css media query          |
| Toast notifications           | REAL   | Toast.tsx with aria-live         |
| Toggle accessibility          | REAL   | role="switch" + aria-checked     |
| ApprovalCard                  | REAL   | With approve/reject/expiry       |
| DiffViewer                    | REAL   | LCS-based word diff              |
| ProvenanceBadge               | REAL   | Source badge component           |
| ConfidenceMeter               | REAL   | 0-100% bar (missing a11y)        |
| ExpiryTimer                   | REAL   | Countdown with aria-live         |
| Sidebar 6-group IA            | REAL   | 6 groups, 14 links               |
| Space Grotesk + IBM Plex Mono | REAL   | next/font in layout              |
| SWR data fetching             | REAL   | useWorkspace hooks               |
| i18n infrastructure           | REAL   | I18nProvider + en.json           |

## Impact Assessment

| Gap Category              | Count               | P10 Effort |
| ------------------------- | ------------------- | ---------- |
| Missing components        | ~30                 | HIGH       |
| Missing tokens            | ~70                 | MEDIUM     |
| Missing a11y              | 6 components        | MEDIUM     |
| Missing enterprise gating | 1 middleware        | LOW        |
| Missing focus trap        | 1 component         | LOW        |
| Missing AI disclosure     | 1 component         | LOW        |
| Missing error tracking    | 1 integration       | LOW        |
| Missing i18n strings      | ~200 strings        | HIGH       |
| Missing charts            | 1 library + widgets | HIGH       |
| Missing forms library     | 1 integration       | MEDIUM     |
