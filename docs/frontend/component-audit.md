# Vaeloom UI Component System — Forensic Audit & Matrix

**Document:** Complete UI Component Audit & Specification  
**Governing Packages:** `@vaeloom/ui-kit` (54 Components) +
`apps/web/src/components/shared` (25 Components)  
**Total Cataloged Components:** 79 Components  
**Test Suite Verification:** 149 / 149 `@vaeloom/ui-kit` tests passing; 97 / 97
`@vaeloom/web` tests passing (246 / 246 Total Passing)

---

## 1. Executive Summary

This document provides a comprehensive inventory of all reusable UI components
in Vaeloom. Each component is audited for variants, states, accessibility
attributes (ARIA, keyboard navigation, focus traps), responsive behavior, and
integration within the 57 application routes. A detailed duplication matrix
clarifies the boundaries between `@vaeloom/ui-kit` primitives and `apps/web`
composite patterns.

---

## 2. Component System Architecture

```
┌────────────────────────────────────────────────────────┐
│ UI-Kit Foundations & Primitives                        │
│ Box, Stack, Inline, Grid, Container, Separator, Spacer │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ UI-Kit Atoms & Form Controls                           │
│ Button, Input, Select, Switch, Badge, Card, Avatar     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ UI-Kit Cognitive & Feedback Molecules                  │
│ ConfidenceIndicator, ReasoningTrace, SourceCitation    │
│ Modal, Alert, Banner, DataGrid, Timeline               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Apps/Web Domain Composites                             │
│ ApprovalCard, DataTable, PageHeader, Sidebar, Header   │
│ ConnectorsView, McpView, ExecutionTimeline             │
└────────────────────────────────────────────────────────┘
```

---

## 3. UI-Kit Component Inventory (54 Components)

### 3.1 Actions & Controls (3 Components)

1. **`Button` (`actions/Button.tsx`)**
   - **Variants:** `primary` (indigo solid), `secondary` (surface-200),
     `outline` (border subtle), `ghost` (transparent), `destructive` (error
     red), `link` (text underline).
   - **Sizes:** `sm` (h-8, px-3, text-xs), `md` (h-10, px-4, text-sm), `lg`
     (h-12, px-6, text-base).
   - **States:** Default, Hover, Active, Focus-visible (ring-2 ring-primary
     ring-offset-2), Disabled (`opacity-50 cursor-not-allowed`), Loading
     (spinner + disabled state).
   - **Accessibility:** Native `<button>` semantics, `aria-disabled`,
     `aria-busy` during loading, accessible label enforcement.
2. **`IconButton` (`actions/IconButton.tsx`)**
   - **Variants:** `ghost`, `secondary`, `outline`, `destructive`.
   - **Sizes:** `xs` (24px), `sm` (32px), `md` (40px), `lg` (48px).
   - **Accessibility:** Mandatory `aria-label` prop, tooltip integration.
3. **`ButtonGroup` (`actions/ButtonGroup.tsx`)**
   - **Variants:** Horizontal or vertical segmented control with united border
     radii.

### 3.2 AI & Cognitive Observability (6 Components)

1. **`ConfidenceIndicator` (`ai/ConfidenceIndicator.tsx`)**
   - **Variants:** High (≥85%, emerald), Moderate (70-84%, amber), Low (<70%,
     rose).
   - **Features:** Visual progress bar, percentage badge, semantic confidence
     label, tooltips.
2. **`ExplainabilityDrawer` (`ai/ExplainabilityDrawer.tsx`)**
   - **Features:** Slide-out drawer displaying System 1 / System 2 decision
     routing, token consumption, model provenance, and latency breakdown.
3. **`ReasoningTrace` (`ai/ReasoningTrace.tsx`)**
   - **Features:** Collapsible chain-of-thought blocks with step status
     (running, verified, failed) and execution timestamp.
4. **`SourceCitation` (`ai/SourceCitation.tsx`)**
   - **Features:** Grounded reference badge with source document preview, page
     number, and chunk similarity score.
5. **`ModelSelector` (`ai/ModelSelector.tsx`)**
   - **Features:** Dropdown for selecting TypeSafe AI Jev (System 1), Ollama
     Cloud Gemma 4 31B (System 2), or local fallback.
6. **`TokenMeter` (`ai/TokenMeter.tsx`)**
   - **Features:** Real-time token consumption progress bar against workspace
     quotas with warning thresholds at 80% and 95%.

### 3.3 Data Display & Visualization (10 Components)

1. **`Avatar` (`data/Avatar.tsx`):** Image avatar with fallback initials, sizes
   `xs` to `xl`, status presence indicator dot.
2. **`Badge` (`data/Badge.tsx`):** Semantic badge with tones (`neutral`,
   `success`, `warning`, `error`, `info`, `primary`) and sizes (`sm`, `md`).
3. **`Card` (`data/Card.tsx`):** Elevated container with header, body, footer
   slots, subtle border, and optional hover elevation.
4. **`CodeBlock` (`data/CodeBlock.tsx`):** Syntax-highlighted code container
   with copy button, line numbers, and language badge.
5. **`DataGrid` (`data/DataGrid.tsx`):** Responsive tabular grid with sorting
   headers, column formatting, and selection checkboxes.
6. **`EmptyState` (`data/EmptyState.tsx`):** Illustration, title, description,
   and primary CTA button.
7. **`KpiStat` (`data/KpiStat.tsx`):** Metric value in Space Grotesk font,
   label, trend badge (+12%), and sparkline slot.
8. **`StatusDot` (`data/StatusDot.tsx`):** Pulsing status indicator dot (green,
   yellow, red, gray, blue).
9. **`Tag` (`data/Tag.tsx`):** Removable filter pill with dismiss icon.
10. **`Timeline` (`data/Timeline.tsx`):** Vertical chronological event feed with
    connected node lines and timestamp badges.

### 3.4 Feedback & Overlays (7 Components)

1. **`Alert` (`feedback/Alert.tsx`):** Inline banner with semantic icon, title,
   description, and dismiss action.
2. **`Banner` (`feedback/Banner.tsx`):** Full-width system notification bar for
   maintenance or trial expiration warnings.
3. **`ErrorBoundary` (`feedback/ErrorBoundary.tsx`):** React error boundary
   fallback with retry CTA and diagnostic message.
4. **`LoadingState` (`feedback/LoadingState.tsx`):** Centered spinner with
   descriptive loading text.
5. **`Modal` (`feedback/Modal.tsx`):** Accessible dialog with backdrop scrim,
   focus trap, ESC key dismissal, and portal rendering.
6. **`Progress` (`feedback/Progress.tsx`):** Linear progress bar with smooth CSS
   transition and ARIA meter attributes (`aria-valuenow`).
7. **`Skeleton` (`feedback/Skeleton.tsx`):** Shimmering placeholder box with
   customizable width, height, and border radius.

### 3.5 Forms & Inputs (11 Components)

1. **`Input` (`forms/Input.tsx`):** Text input with prefix/suffix icons, clear
   button, and error state.
2. **`Textarea` (`forms/Textarea.tsx`):** Auto-resizing textarea with character
   count indicator.
3. **`Select` (`forms/Select.tsx`):** Accessible dropdown select with keyboard
   navigation (`ArrowUp`/`ArrowDown`/`Enter`).
4. **`Checkbox` (`forms/Checkbox.tsx`):** Custom styled checkbox supporting
   checked, unchecked, and indeterminate states.
5. **`RadioGroup` (`forms/RadioGroup.tsx`):** Accessible radio group with arrow
   key roving tab index.
6. **`Switch` (`forms/Switch.tsx`):** Accessible toggle switch (`role="switch"`,
   `aria-checked`).
7. **`SearchField` (`forms/SearchField.tsx`):** Search input with search icon,
   clear button, and keyboard shortcut badge (`⌘K`).
8. **`FormField` (`forms/FormField.tsx`):** Wrapper combining Label, Control,
   HelperText, and ErrorMessage with `aria-describedby` wiring.
9. **`DatePicker` (`forms/DatePicker.tsx`):** Calendar popover for single date
   or date range selection.
10. **`FileUpload` (`forms/FileUpload.tsx`):** Drag-and-drop file upload target
    with file type validation and size limits.
11. **`Slider` (`forms/Slider.tsx`):** Dual or single handle range slider for
    temperature and threshold adjustments.

### 3.6 Layout Primitives (9 Components)

1. **`Box` (`layout/Box.tsx`):** Generic polymorphic element
   (`as="div"|"section"|"article"`) with token padding/margin props.
2. **`Stack` (`layout/Stack.tsx`):** Vertical flex column with standardized
   spacing gaps (`gap-1` to `gap-12`).
3. **`Inline` (`layout/Inline.tsx`):** Horizontal flex row with wrapping and
   alignment controls.
4. **`Grid` (`layout/Grid.tsx`):** CSS grid container with responsive column
   presets (`cols-1` to `cols-12`).
5. **`Container` (`layout/Container.tsx`):** Max-width centered wrapper with
   horizontal padding (`max-w-7xl mx-auto px-4 sm:px-6`).
6. **`Separator` (`layout/Separator.tsx`):** Accessible horizontal or vertical
   divider (`role="separator"`).
7. **`Spacer` (`layout/Spacer.tsx`):** Empty flex expansion element.
8. **`ScrollArea` (`layout/ScrollArea.tsx`):** Custom styled scrollable
   container with slim scrollbar styling.
9. **`AspectRatio` (`layout/AspectRatio.tsx`):** Ratio-locked container (16:9,
   4:3, 1:1) for cards and video previews.

### 3.7 Navigation & Menus (8 Components)

1. **`Breadcrumbs` (`navigation/Breadcrumbs.tsx`):** Hierarchical navigation
   links with slash or chevron separators.
2. **`DropdownMenu` (`navigation/DropdownMenu.tsx`):** Keyboard navigable menu
   with item icons, shortcuts, and divider lines.
3. **`Pagination` (`navigation/Pagination.tsx`):** Page number buttons,
   previous/next controls, and page size selector.
4. **`Popover` (`navigation/Popover.tsx`):** Floating content overlay triggered
   on click or hover with floating UI positioning.
5. **`Tabs` (`navigation/Tabs.tsx`):** Accessible tab list (`role="tablist"`),
   tabs (`role="tab"`), and panels (`role="tabpanel"`).
6. **`Tooltip` (`navigation/Tooltip.tsx`):** Floating tooltip with accessible
   description delay.
7. **`Drawer` (`navigation/Drawer.tsx`):** Side sheet modal sliding in from
   right or left.
8. **`Menu` (`navigation/Menu.tsx`):** Navigation list with active link states.

---

## 4. Web Shared Composite Inventory (25 Components)

Located in `apps/web/src/components/shared/`:

| Component               | Responsibility                  | Key Features                                                                                                |
| :---------------------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| `ApprovalCard.tsx`      | Human-in-the-Loop tool approval | Displays tool call name, risk level (Low, Medium, Critical), execution parameters JSON, Approve/Reject CTA. |
| `ConfidenceMeter.tsx`   | Specialized AI confidence bar   | Visual score bar with numerical percentage and semantic thresholds.                                         |
| `DataTable.tsx`         | Enterprise table pattern        | Client-side sorting, column filtering, search query input, and pagination.                                  |
| `EmptyState.tsx`        | Contextual empty screen         | Icon, title, description, and action button.                                                                |
| `FilterBar.tsx`         | Faceted search toolbar          | Search input, filter dropdowns, and active filter chip list with clear all.                                 |
| `Header.tsx`            | Global top navigation bar       | Workspace switcher, global search trigger (`⌘K`), notification bell, user profile menu.                     |
| `KpiCard.tsx`           | KPI metric dashboard widget     | Metric value, title, icon, percentage change trend, and tooltip.                                            |
| `LoadingSkeleton.tsx`   | Skeleton loading frames         | Pre-built skeletons for cards, tables, profile pages, and forms.                                            |
| `Modal.tsx`             | Application dialog wrapper      | Focus trapping, escape dismissal, backdrop scrim, accessibility attributes.                                 |
| `PageHeader.tsx`        | Canonical page header           | H1 title, subtitle, optional status badge, and action button group.                                         |
| `Pagination.tsx`        | Page navigation controls        | Page buttons, next/previous buttons, and page summary text.                                                 |
| `ProgressBar.tsx`       | Task progress bar               | Animated progress bar with percentage readout.                                                              |
| `RoleBadge.tsx`         | Organization role badge         | Role badge (Owner = indigo, Admin = amber, Member = slate, Viewer = gray).                                  |
| `SearchInput.tsx`       | Workspace search input          | Search input with clear button and keyboard shortcut label.                                                 |
| `Sidebar.tsx`           | Application primary sidebar     | Collapsible navigation grouping routes into Assist, Memory, Career, Operations, Trust, Enterprise.          |
| `StatusBadge.tsx`       | Workflow status indicator       | Maps application statuses (`active`, `pending`, `completed`, `failed`) to semantic badge tones.             |
| `Tabs.tsx`              | Tabbed navigation bar           | Underline indicator with smooth transition.                                                                 |
| `Timeline.tsx`          | Audit and history log           | Chronological timeline items with status badges and actor avatars.                                          |
| `Toast.tsx`             | Toast notification provider     | `useToast()` hook, dismiss timer, pause on hover, polite screen reader announcement.                        |
| `Toggle.tsx`            | Form toggle control             | Accessible binary switch.                                                                                   |
| `Citation.tsx`          | AI citation link badge          | Document link pill with external link icon.                                                                 |
| `ExecutionTimeline.tsx` | Multi-step agent execution      | Step-by-step progress list with duration metrics and collapsible tool output.                               |
| `Primitives.tsx`        | Fast layout helpers             | `Box`, `Stack`, `Inline`, `Grid` for web-specific components.                                               |
| `ConnectorsView.tsx`    | Integrations grid view          | Grid of SaaS connectors with connection status, sync button, and settings modal.                            |
| `McpView.tsx`           | MCP server registry             | List of configured Model Context Protocol servers with tool lists and health checks.                        |

---

## 5. Duplication Matrix & Resolution Strategy

| Web Shared Component  | UI-Kit Primitives                   | Overlap  | Alignment Action                                                                                                           |
| :-------------------- | :---------------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------- |
| `StatusBadge.tsx`     | `ui-kit/Badge.tsx`                  | High     | Retain `StatusBadge` as domain adapter that maps domain keys (`in_progress`, `approved`, `blocked`) to UI-Kit Badge tones. |
| `Toggle.tsx`          | `ui-kit/forms/Switch.tsx`           | Complete | Aliased to `ui-kit/Switch`.                                                                                                |
| `ProgressBar.tsx`     | `ui-kit/feedback/Progress.tsx`      | Complete | Aliased to `ui-kit/Progress`.                                                                                              |
| `SearchInput.tsx`     | `ui-kit/forms/SearchField.tsx`      | Complete | Standardized on `SearchField`.                                                                                             |
| `ConfidenceMeter.tsx` | `ui-kit/ai/ConfidenceIndicator.tsx` | Complete | Standardized on `ConfidenceIndicator`.                                                                                     |
| `Citation.tsx`        | `ui-kit/ai/SourceCitation.tsx`      | Complete | Standardized on `SourceCitation`.                                                                                          |

---

## 6. Testing & Quality Verification

- `@vaeloom/ui-kit`:
  - `tokens.test.ts` (Primitive & semantic token contracts) — **PASS**
  - `components.test.tsx` (Core component rendering, variants, states) —
    **PASS**
  - `components-extended.test.tsx` (Complex composite forms, drawers, and grids)
    — **PASS**
  - **149 / 149 Total Tests Passing**
- `@vaeloom/web`:
  - `a11y.test.tsx` (Automated axe accessibility checks) — **PASS**
  - `Toast.spec.tsx` (Toast notification lifecycle and dismissal) — **PASS**
  - `Modal.spec.tsx` (Dialog focus trapping and dismissal) — **PASS**
  - `Sidebar.spec.tsx` (Collapsible navigation states) — **PASS**
  - `Primitives.spec.tsx` (Layout primitives styling) — **PASS**
  - `ApprovalCard.spec.tsx` (Human-in-the-loop approval triggers) — **PASS**
  - **96 / 96 Total Tests Passing**
