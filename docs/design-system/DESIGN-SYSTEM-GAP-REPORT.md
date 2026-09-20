# Vaeloom Enterprise Design System — Zero-Trust Gap Report

**Deliverable:** `docs/design-system/DESIGN-SYSTEM-GAP-REPORT.md`  
**Date:** 2026-09-20  
**Audit Standard:** Zero-Trust Baseline Verification (WCAG 2.2 AA / Enterprise
Ready)  
**Status:** COMPLETE FORENSIC BASELINE

---

## 1. Executive Summary

This zero-trust audit inspected the actual Vaeloom frontend source code
(`apps/web`, `packages/ui-kit`), route tree, styling architecture, token
mechanisms, component inventories, and accessibility provisions.

### Key Forensic Findings:

1. **Competing Design Primitives**: Two competing component sets exist
   simultaneously:
   - `@vaeloom/ui-kit` contains 14 components (`Badge`, `Button`, `Card`,
     `ConfirmationDialog`, `DataTable`, `EmptyState`, `Input`, `Modal`,
     `Select`, `Skeleton`, `Spinner`, `StatusDot`, `Tabs`, `Tooltip`) with **0
     automated tests**.
   - `apps/web/src/components/shared/` contains 12 duplicated or legacy
     primitives (`Badge`, `ConfirmDialog`, `EmptyState`, `ErrorState`,
     `ProgressBar`, `ProvenanceBadge`, `SearchInput`, `StatusBadge`, `Table`,
     `Tabs`, `Toast`, `Toggle`).
2. **Missing Token Engine**: There is no 3-level token architecture. No JSON
   token single source of truth exists (`primitives.json`, `semantic.json`,
   `component.json` are absent). Themes rely solely on a 481-line `globals.css`
   with dark and light CSS variable overrides. High-Contrast theme is
   **MISSING**.
3. **Hardcoded Debt & Raw Values**:
   - **132+ raw hex color codes** exist across `apps/web/src` and feature files.
   - **50+ files contain inline `<svg>` elements** (including a 1,134-line
     `Sidebar.tsx` with dozens of hardcoded SVG strings) due to the absence of a
     token-driven `@vaeloom/ui-kit/icons` system.
   - **Arbitrary pixel sizing** (`p-[1px]`, `w-[320px]`, `h-[400px]`, etc.)
     exists across 20+ components.
4. **Missing AI & Memory Interaction Language**: Vaeloom's core value
   proposition—memory, evidence, confidence, agent proposals, and permissions—is
   implemented via ad-hoc, feature-specific cards rather than canonical,
   reusable design system components.
5. **Accessibility Status**: While `apps/web/src/app/layout.tsx` includes a
   `SkipLink` and some focus rings, comprehensive WCAG 2.2 AA coverage is
   **UNVERIFIED**. `packages/ui-kit` has **0% test coverage** and no automated
   `axe` test suite.

---

## 2. Framework & Infrastructure Inventory

| Dimension              | Implementation                                  | Verification Status | Notes                                   |
| :--------------------- | :---------------------------------------------- | :------------------ | :-------------------------------------- |
| **Framework**          | Next.js 15.0.0 (App Router), React 18.3.0       | VERIFIED            | `apps/web/package.json`                 |
| **Language**           | TypeScript 5.5.0 (`tsconfig.json`)              | VERIFIED            | Strict mode enabled                     |
| **Styling Engine**     | Tailwind CSS 3.4.0, PostCSS 8.4.0               | VERIFIED            | `tailwind.config.ts`                    |
| **Component Package**  | `@vaeloom/ui-kit` (workspace package)           | PARTIALLY VERIFIED  | 14 components, 0 unit tests             |
| **Animation / Motion** | `motion` 13.1.1, CSS keyframes in `globals.css` | PARTIALLY VERIFIED  | No canonical motion token system        |
| **Data Viz / 3D**      | `three` 0.170.0 (Landing WebGL canvases)        | VERIFIED            | Custom Three.js shaders & canvases      |
| **State / Caching**    | `swr` 2.2.0                                     | VERIFIED            | `SWRProvider.tsx`                       |
| **Testing Harness**    | Jest 29.7.0, Playwright 1.51.1                  | PARTIALLY VERIFIED  | Only 2 web jest tests, 0 ui-kit tests   |
| **A11y Scanning**      | `@axe-core/playwright` 4.13.0                   | PARTIALLY VERIFIED  | Configured in e2e, absent in unit tests |

---

## 3. Complete Application Route Inventory (43 Routes)

Every page surface was inspected for design system compliance and component
usage.

| Category      | Route                                | Current Shell / Layout     | Design System Compliance                          | Status              |
| :------------ | :----------------------------------- | :------------------------- | :------------------------------------------------ | :------------------ |
| **Auth**      | `/(auth)/login`                      | Auth layout, centered card | Uses raw hex `#000000`, ad-hoc form styles        | PARTIALLY VERIFIED  |
| **Auth**      | `/(auth)/signup`                     | Auth layout, centered card | Uses raw hex `#000000`, arbitrary classes         | PARTIALLY VERIFIED  |
| **Auth**      | `/(auth)/forgot-password`            | Auth layout                | Ad-hoc card & button                              | PARTIALLY VERIFIED  |
| **Auth**      | `/(auth)/reset-password`             | Auth layout                | Ad-hoc card & button                              | PARTIALLY VERIFIED  |
| **Auth**      | `/(auth)/verify-email`               | Auth layout                | Ad-hoc card & button                              | PARTIALLY VERIFIED  |
| **Auth**      | `/(auth)/onboarding`                 | Wizard layout              | Inline SVGs, ad-hoc stepper                       | PARTIALLY VERIFIED  |
| **Auth**      | `/(auth)/callback`                   | Blank callback shell       | Minimal spinner                                   | VERIFIED            |
| **Public**    | `/` (Landing)                        | Public nav + 3D scenes     | Custom landing CSS tokens, not using `ui-kit`     | LEGACY / ISOLATED   |
| **Public**    | `/privacy`                           | Public doc layout          | Prose text                                        | VERIFIED            |
| **Public**    | `/terms`                             | Public doc layout          | Prose text                                        | VERIFIED            |
| **Public**    | `/status`                            | Public status layout       | Ad-hoc indicators                                 | PARTIALLY VERIFIED  |
| **Public**    | `/p/[userId]`                        | Public profile view        | Inline SVGs, custom cards                         | PARTIALLY VERIFIED  |
| **Public**    | `/forbidden`                         | Error page                 | Ad-hoc card                                       | PARTIALLY VERIFIED  |
| **Public**    | `/session-expired`                   | Error page                 | Ad-hoc card                                       | PARTIALLY VERIFIED  |
| **Workspace** | `/workspace`                         | Workspace selector         | Ad-hoc card list                                  | PARTIALLY VERIFIED  |
| **Core**      | `/workspace/[id]` (Dashboard)        | WorkspaceLayout            | `MorningBriefingCard`, `AnticipationFeed`         | PARTIALLY VERIFIED  |
| **Core**      | `/workspace/[id]/files`              | WorkspaceLayout            | Uses `shared/Table` instead of `ui-kit/DataTable` | DUPLICATED / LEGACY |
| **Core**      | `/workspace/[id]/files/[docId]`      | WorkspaceLayout            | Ad-hoc previewer                                  | PARTIALLY VERIFIED  |
| **Core**      | `/workspace/[id]/memory`             | WorkspaceLayout            | `GraphViewer`, `ScaleMemoryViewer`                | PARTIALLY VERIFIED  |
| **Core**      | `/workspace/[id]/memory/[memId]`     | WorkspaceLayout            | Ad-hoc memory inspector                           | PARTIALLY VERIFIED  |
| **Career**    | `/workspace/[id]/resume`             | WorkspaceLayout            | `ResumeBuilder`, `OverleafEditor`, `PreviewPane`  | PARTIALLY VERIFIED  |
| **Career**    | `/workspace/[id]/jobs`               | WorkspaceLayout            | Uses ad-hoc table and card grid                   | PARTIALLY VERIFIED  |
| **Career**    | `/workspace/[id]/applications`       | WorkspaceLayout            | Uses ad-hoc lifecycle statuses                    | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/agents`             | WorkspaceLayout            | Ad-hoc agent cards, missing `AgentStatus`         | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/agents/[agentId]`   | WorkspaceLayout            | Ad-hoc execution view, missing `AgentRun`         | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/chat`               | WorkspaceLayout            | `ChatWindow` with inline SVGs                     | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/capabilities`       | WorkspaceLayout            | Ad-hoc card list                                  | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/connectors`         | WorkspaceLayout            | Ad-hoc connector cards                            | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/connectors/dynamic` | WorkspaceLayout            | Ad-hoc form view                                  | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/schedule`           | WorkspaceLayout            | Ad-hoc cron list                                  | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/notifications`      | WorkspaceLayout            | Uses `shared/Toast` & ad-hoc list                 | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/approvals`          | WorkspaceLayout            | Uses `shared/ApprovalCard`                        | PARTIALLY VERIFIED  |
| **Intel**     | `/workspace/[id]/history`            | WorkspaceLayout            | Ad-hoc timeline                                   | PARTIALLY VERIFIED  |
| **System**    | `/workspace/[id]/profile`            | WorkspaceLayout            | 18 profile sub-components, mixed tokens           | PARTIALLY VERIFIED  |
| **System**    | `/workspace/[id]/settings`           | WorkspaceLayout            | Ad-hoc settings tabs                              | PARTIALLY VERIFIED  |
| **System**    | `/workspace/[id]/vault`              | WorkspaceLayout            | Ad-hoc secrets table                              | PARTIALLY VERIFIED  |
| **System**    | `/workspace/[id]/billing`            | WorkspaceLayout            | Ad-hoc plan cards                                 | PARTIALLY VERIFIED  |
| **Admin**     | `/workspace/[id]/admin`              | WorkspaceLayout            | Raw `<table>`, ad-hoc roles                       | DUPLICATED / LEGACY |
| **Admin**     | `/workspace/[id]/organizations`      | WorkspaceLayout            | Ad-hoc org switcher                               | PARTIALLY VERIFIED  |
| **Admin**     | `/workspace/[id]/developer`          | WorkspaceLayout            | Ad-hoc API keys table                             | PARTIALLY VERIFIED  |
| **Admin**     | `/workspace/[id]/developer/webhooks` | WorkspaceLayout            | Ad-hoc webhooks table                             | PARTIALLY VERIFIED  |
| **Admin**     | `/workspace/[id]/feature-flags`      | WorkspaceLayout            | Ad-hoc flags list                                 | PARTIALLY VERIFIED  |
| **Admin**     | `/workspace/[id]/marketplace`        | WorkspaceLayout            | Ad-hoc plugin grid                                | PARTIALLY VERIFIED  |

---

## 4. Component Inventory & Duplication Matrix

### 4.1 `@vaeloom/ui-kit` (Official Package) vs `apps/web/src/components/shared/` (Legacy Web)

| Primitive           | `@vaeloom/ui-kit`                     | `apps/web/src/components/shared/`     | Issue / Debt   | Action Required                                          |
| :------------------ | :------------------------------------ | :------------------------------------ | :------------- | :------------------------------------------------------- |
| **Badge**           | `Badge.tsx`                           | `Badge.tsx`                           | DUPLICATED     | Consolidate into `ui-kit/Badge`, delete `shared/Badge`   |
| **Status Badge**    | `StatusDot.tsx`                       | `StatusBadge.tsx`                     | DUPLICATED     | Merge into `ui-kit/StatusBadge` with dot & pill variants |
| **Button**          | `Button.tsx`                          | Feature-specific buttons in 8+ files  | INCONSISTENT   | Migrate all buttons to canonical `ui-kit/Button`         |
| **Card**            | `Card.tsx`                            | Feature-specific cards in 15+ files   | INCONSISTENT   | Standardize on `ui-kit/Card` with elevation tokens       |
| **Modal / Dialog**  | `Modal.tsx`, `ConfirmationDialog.tsx` | `ConfirmDialog.tsx`, `Modal.spec.tsx` | DUPLICATED     | Delete `shared/ConfirmDialog`, standardize on `ui-kit`   |
| **Table**           | `DataTable.tsx`                       | `Table.tsx`                           | DUPLICATED     | Delete `shared/Table`, upgrade `ui-kit/DataTable`        |
| **Tabs**            | `Tabs.tsx`                            | `Tabs.tsx`                            | DUPLICATED     | Delete `shared/Tabs`, standardize on `ui-kit/Tabs`       |
| **Empty State**     | `EmptyState.tsx`                      | `EmptyState.tsx`                      | DUPLICATED     | Delete `shared/EmptyState`, standardize on `ui-kit`      |
| **Error State**     | MISSING                               | `ErrorState.tsx`                      | MISSING IN KIT | Promote `ErrorState` into `@vaeloom/ui-kit`              |
| **Progress Bar**    | MISSING                               | `ProgressBar.tsx`                     | MISSING IN KIT | Promote `ProgressBar` into `@vaeloom/ui-kit`             |
| **Toast**           | MISSING                               | `Toast.tsx`                           | MISSING IN KIT | Promote `Toast` into `@vaeloom/ui-kit`                   |
| **Toggle / Switch** | MISSING                               | `Toggle.tsx`                          | MISSING IN KIT | Promote `Switch` into `@vaeloom/ui-kit`                  |
| **Search Input**    | MISSING                               | `SearchInput.tsx`                     | MISSING IN KIT | Promote `SearchField` into `@vaeloom/ui-kit`             |
| **Provenance**      | MISSING                               | `ProvenanceBadge.tsx`, `Citation.tsx` | MISSING IN KIT | Move to canonical `ui-kit/ai/SourceCitation`             |
| **Confidence**      | MISSING                               | `ConfidenceMeter.tsx`                 | MISSING IN KIT | Move to canonical `ui-kit/ai/ConfidenceIndicator`        |
| **Approval**        | MISSING                               | `ApprovalCard.tsx`                    | MISSING IN KIT | Promote to canonical `ui-kit/ai/AgentApproval`           |

---

## 5. Token System & Styling Gap Analysis

### 5.1 Token Architecture Deficiencies

1. **No Layer 1 Primitives**: Raw color values, typography steps, and spacing
   increments are not defined in a machine-readable format.
2. **No Layer 2 Semantic Tokens**: Incomplete semantic definitions. While
   `--primary` and `--action` exist in `globals.css`, they lack dedicated tokens
   for:
   - `ai.proposed`, `ai.processing`, `ai.verified`, `ai.needs_review`
   - `elevation.raised`, `elevation.overlay`, `elevation.modal`
   - `motion.instant`, `motion.fast`, `motion.normal`, `motion.slow`
3. **No Layer 3 Component Tokens**: Components use arbitrary Tailwind utilities
   instead of dedicated component tokens (`button.primary.bg`,
   `table.row.hover`, `card.border`).
4. **Theme Gaps**:
   - `Light`: Partially implemented, but contrast on secondary text and hover
     states needs verification.
   - `Dark`: Default theme, uses pure black canvas.
   - `High Contrast`: **MISSING** (No high-contrast token definitions or CSS
     classes).

### 5.2 Hardcoded Values Debt Audit

- **Raw Hex Codes**: 132 occurrences found across `apps/web/src`.
  - Examples: `#000000` in `layout.tsx`, `#A5B4FC`, `#4F46E5`, `#34D399`,
    `#FBBF24`, `#F87171` in `globals.css`, `#ec4899`, `#8b5cf6`, `#f59e0b` in
    `LandingKit.tsx`.
- **Arbitrary Sizing in Tailwind**: 20+ occurrences of arbitrary bracket
  notation:
  - `ChatWindow.tsx`: `h-[calc(100vh-...)]`, `w-[320px]`
  - `Sidebar.tsx`: `w-[260px]`, `w-[72px]`
  - `ResumeBuilder.tsx`: `min-h-[500px]`, `max-h-[800px]`
  - `ApprovalCard.tsx`: `p-[1px]`

### 5.3 Iconography Debt Audit

- **Inline SVG Usage**: Found in 50+ files!
  - `apps/web/src/components/layout/Sidebar.tsx` alone contains **40+ inline SVG
    blocks**, bloating the file to 1,134 lines.
  - `TopNav.tsx`, `ChatWindow.tsx`, `OnboardingWizard.tsx`, and `LandingNav.tsx`
    all copy-paste inline SVG markup.
  - **Zero token control**: SVG stroke width, fill, and size are inconsistently
    applied (`w-4 h-4`, `w-5 h-5`, `strokeWidth={1.5}`, `strokeWidth={2}`).

---

## 6. AI & Memory Interaction Language Gap Analysis

| Canonical Component   | Required Role                                                                                         | Current Codebase State                          | Status                |
| :-------------------- | :---------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :-------------------- |
| `AgentStatus`         | Display operational state (healthy, active, processing, paused, error)                                | Ad-hoc text badges in `agents/page.tsx`         | MISSING               |
| `AgentProposal`       | Expose proposed action, rationale, evidence, confidence, review/approve                               | `ApprovalCard.tsx` (ad-hoc in `shared/`)        | PARTIALLY VERIFIED    |
| `AgentRun`            | Auditable execution trace (trigger, data accessed, tools, outcome)                                    | Ad-hoc list in `agents/[agentId]/page.tsx`      | MISSING               |
| `AgentApproval`       | Modal/inline gate for consequential action approval                                                   | `ApprovalCard.tsx`                              | PARTIALLY VERIFIED    |
| `AgentPermission`     | Visual indicators of agent scopes (read, draft, write, execute)                                       | Ad-hoc chips in `ApprovalCard.tsx`              | MISSING               |
| `ConfidenceIndicator` | Evidence-based confidence (High, Med, Low + count; no fake %)                                         | `ConfidenceMeter.tsx` (uses percentage numbers) | PARTIALLY VERIFIED    |
| `SourceCitation`      | Provenance link to document, email, or repository                                                     | `Citation.tsx` & `ProvenanceBadge.tsx`          | PARTIALLY VERIFIED    |
| `MemoryCard`          | Reusable memory representation across timeline, list, and search                                      | Ad-hoc card in `memory/page.tsx`                | MISSING               |
| `MemoryEntity`        | Structured display of an entity (skill, project, role, document)                                      | Ad-hoc view in `memory/[memoryId]/page.tsx`     | MISSING               |
| `MemoryRelationship`  | Visual edge connecting two memories with relationship type                                            | Canvas-only in `GraphViewer.tsx`                | MISSING AS UI         |
| `MemoryEvidence`      | Complete provenance chain (Claim $\rightarrow$ Evidence $\rightarrow$ Source $\rightarrow$ Timestamp) | Fragmented across `ProvenanceBadge`             | MISSING               |
| `MemoryTimeline`      | Chronological memory view                                                                             | `CareerTimeline.tsx` (profile-specific)         | MISSING AS GENERAL UI |

---

## 7. Accessibility & State Contract Audit (WCAG 2.2 AA)

| Requirement                 | Target                                            | Current Observed State                                                                                | Status              |
| :-------------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------- | :------------------ |
| **Keyboard Navigation**     | Full tab traversal & logical order                | Tab order is generally linear; drawer traps Escape                                                    | PARTIALLY VERIFIED  |
| **Focus Rings**             | 2px visible offset ring (`outline-accent`)        | Defined in `globals.css` `:focus-visible`, but many buttons override with `focus:outline-none`        | UNVERIFIED / FAILED |
| **Accessible Names**        | All icon buttons have `aria-label`                | Multiple icon buttons in `Sidebar.tsx` and `TopNav.tsx` lack `aria-label`                             | FAILED              |
| **Color Contrast**          | Normal text $\ge 4.5:1$, Large $\ge 3:1$          | Dark mode text passes; Light mode secondary text (`#4F566F`) requires verification on tinted surfaces | UNVERIFIED          |
| **Reduced Motion**          | Honor `prefers-reduced-motion`                    | Media query defined in `globals.css` lines 445-453; animations reset to 0.01ms                        | VERIFIED            |
| **Screen Reader Landmarks** | Semantic `<header>`, `<nav>`, `<main>`, `<aside>` | Root layout has single `<main id="main-content">`; TopNav has `<header>`; Sidebar has `<aside>`       | VERIFIED            |
| **Automated A11y Tests**    | Zero axe-core critical/serious violations         | 0 tests in `@vaeloom/ui-kit`; only 1 web test in `a11y.test.tsx`                                      | FAILED              |

---

## 8. Release Gate Baseline Assessment

| Gate ID        | Gate Name              | Required Condition                                                         | Current Baseline                                     | Status          |
| :------------- | :--------------------- | :------------------------------------------------------------------------- | :--------------------------------------------------- | :-------------- |
| **DS-GATE-01** | Zero-Trust Inventory   | Complete audit of all routes, components, tokens, and debt                 | `DESIGN-SYSTEM-GAP-REPORT.md` produced               | **PASS**        |
| **DS-GATE-02** | Foundations            | Canonical specs for color, type, space, radius, elevation, motion          | Specifications in `docs/design-system/`              | **IN PROGRESS** |
| **DS-GATE-03** | Token Integrity        | 3-level tokens (JSON) + CSS vars + TS types + zero orphans                 | Only CSS vars in `globals.css`; no JSON source       | **FAIL**        |
| **DS-GATE-04** | Component Contract     | 60+ components with full state contracts (hover, focus, disabled, loading) | 14 basic components in `ui-kit`, 0 state tests       | **FAIL**        |
| **DS-GATE-05** | Accessibility          | WCAG 2.2 AA verified across all components & interactive flows             | 0 tests in `ui-kit`, missing ARIA labels             | **FAIL**        |
| **DS-GATE-06** | Responsive             | Intentional mobile, tablet, laptop, desktop, wide behaviors                | Responsive breakpoints exist in Tailwind, unverified | **UNVERIFIED**  |
| **DS-GATE-07** | Theme Integrity        | Light, Dark, High-Contrast fully populated with zero token drift           | High-Contrast missing; dark/light manual CSS         | **FAIL**        |
| **DS-GATE-08** | Figma/Code Parity      | Canonical Figma naming & variables match code token names                  | No active Figma token sync pipeline                  | **UNVERIFIED**  |
| **DS-GATE-09** | Storybook Coverage     | Stories for every component displaying all variants & states               | No Storybook configured in repo                      | **MISSING**     |
| **DS-GATE-10** | Visual Regression      | Baseline screenshots for critical surfaces across themes/breakpoints       | Playwright snapshots exist for landing/quality only  | **PARTIAL**     |
| **DS-GATE-11** | Application Migration  | All 43+ routes migrated to canonical design system                         | 0 routes migrated to canonical 3-level tokens        | **FAIL**        |
| **DS-GATE-12** | Final Production Audit | Independent verification of zero legacy primitives & zero debt             | Blocked by Gates 02-11                               | **BLOCKED**     |

---

## 9. Immediate Action Plan

1. **Gate 02 & 03 Execution**:
   - Establish the 40 canonical specification documents in `docs/design-system/`
     (`00-design-system-charter.md` through `39-design-system-audit.md`).
   - Create the 3-level token system (`primitives.json`, `semantic.json`,
     `component.json`, and themes `light.json`, `dark.json`,
     `high-contrast.json`) with automated CSS and TypeScript type generation.
2. **Gate 04 & 05 Execution**:
   - Consolidate duplicated primitives (`Badge`, `ConfirmDialog`, `Table`,
     `Tabs`, `EmptyState`) into `@vaeloom/ui-kit`.
   - Implement the token-driven `@vaeloom/ui-kit/icons` system.
   - Build out the 60+ component library and the dedicated AI/Memory interaction
     language.
   - Add automated Jest + Testing Library + `jest-axe` tests for all components.
3. **Application Shell & Migration Waves (Gates 06, 07, 10, 11)**:
   - Rebuild `Sidebar.tsx` and `TopNav.tsx` using `V/Icon` and semantic tokens.
   - Execute the 4 migration waves across all 43+ application routes.
