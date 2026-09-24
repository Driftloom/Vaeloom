# Vaeloom Master Component Inventory

**Package**: `@vaeloom/ui-kit` & `apps/web/src/components/`  
**Governing Standard**: Vaeloom Canonical 3-Layer Design System  
**Test Suite**: 100% Passing (Jest + Testing Library)

---

## 1. Design System Component Registry (`@vaeloom/ui-kit`)

### Primitives & Buttons

| Component     | Props                                                         | Variants                                             | Accessibility (a11y)                                                    | Usage                                            |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `Button`      | `variant`, `size`, `isLoading`, `disabled`, `type`, `onClick` | `primary`, `secondary`, `outline`, `danger`, `ghost` | Keyboard navigable (`Tab`, `Enter`, `Space`), `aria-busy` when loading. | Primary action triggers across forms and modals. |
| `IconButton`  | `icon`, `aria-label`, `size`, `variant`                       | Inherits button variants                             | Mandatory `aria-label`, focus visible ring.                             | Compact icon-only toolbars and window controls.  |
| `ButtonGroup` | `attached`, `orientation`, `children`                         | Horizontal, Vertical                                 | `role="group"` with explicit accessible grouping.                       | Segmented controls and paired action groups.     |

### Layout & Containers

| Component            | Props                                                                     | Variants                                          | Accessibility (a11y)                                             | Usage                                             |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| `Box`                | `as`, `className`, `children`                                             | Semantic tags (`div`, `section`, `article`, etc.) | Preserves semantic landmarks.                                    | Universal polymorphic container.                  |
| `Stack`              | `direction`, `spacing`, `align`, `justify`                                | Row, Column, Wrap                                 | Semantic flow layout.                                            | Vertical and horizontal layout composition.       |
| `Grid`               | `cols`, `gap`, `children`                                                 | 1-12 columns responsive                           | Standard grid structure.                                         | Responsive card grids and dashboards.             |
| `Card`               | `hover`, `selected`, `className`, `onClick`                               | Elevated, Bordered, Interactive                   | Clickable cards include keyboard enter handler.                  | Primary content grouping card.                    |
| `Panel`              | `title`, `actions`, `footer`, `bordered`                                  | Default, Accent border                            | Header landmark semantics.                                       | High-density tool and inspector panels.           |
| `Modal`              | `isOpen`, `onClose`, `title`, `size`, `children`                          | `sm`, `md`, `lg`, `xl`                            | `role="dialog"`, `aria-modal="true"`, focus trap, `Esc` dismiss. | Critical interruptions and complex forms.         |
| `Drawer`             | `isOpen`, `onClose`, `placement`, `title`                                 | `left`, `right`                                   | `role="dialog"`, focus trap, outside click dismiss.              | Detail inspectors and slide-over side panels.     |
| `ConfirmationDialog` | `isOpen`, `title`, `description`, `confirmLabel`, `onConfirm`, `onCancel` | `danger`, `warning`, `primary`                    | Native alertdialog focus containment.                            | Irreversible action confirmation (e.g. deletion). |

### Form Controls

| Component     | Props                                                        | Features                               | Accessibility (a11y)                               | Usage                                             |
| ------------- | ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `Input`       | `label`, `error`, `helperText`, `type`, standard HTML input  | Text, password, search, number         | `aria-invalid`, `aria-describedby` error linking.  | Text input fields.                                |
| `FormField`   | `label`, `required`, `error`, `helperText`, `id`, `children` | Unified wrapper for inputs and selects | Associated `<label for="...">` and error IDs.      | Standard form field wrapper with validation cues. |
| `Select`      | `label`, `options`, `value`, `onChange`, `placeholder`       | Typed options array, chevron indicator | Semantic `<select>` with keyboard up/down arrows.  | Dropdown selections.                              |
| `SearchField` | `value`, `onChange`, `onClear`, `placeholder`                | Search icon, clear button              | `type="search"` with clearable shortcut.           | Instant filter inputs.                            |
| `Checkbox`    | `label`, `checked`, `onChange`, `disabled`, `indeterminate`  | Custom styling with SVG check          | Focus ring, screen-reader compatible hidden input. | Multi-select and boolean toggles.                 |
| `Switch`      | `checked`, `onChange`, `label`, `disabled`                   | Smooth pill toggle animation           | `role="switch"`, `aria-checked`.                   | Binary setting and feature activation toggles.    |
| `Radio`       | `label`, `value`, `name`, `checked`, `onChange`              | Custom styled radio circle             | Semantic radio group navigation.                   | Mutually exclusive options.                       |
| `Textarea`    | `label`, `error`, `helperText`, `rows`                       | Auto-expand option                     | Multi-line text input with character counters.     | Descriptions, prompts, and notes.                 |

### Data Display & Telemetry

| Component   | Props                                                                                             | Features                                                            | Accessibility (a11y)                                | Usage                                         |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| `StatCard`  | `label`, `value`, `delta`, `icon`, `caption`, `onClick`                                           | Trend indicators (up/down/neutral), badges                          | Formatted value typography with clear aria context. | Executive dashboard metrics and KPI cards.    |
| `FilterBar` | `searchQuery`, `onSearchChange`, `categories`, `activeCategory`, `onCategoryChange`, `activeTags` | Category pills, active tags, clear all                              | Accessible button pills with selection state.       | Search and filter controls across data lists. |
| `DataTable` | `columns`, `data`, `sortable`, `onRowClick`, `emptyMessage`                                       | Typed column definitions, sort handlers                             | `role="table"`, header sorting indicators.          | Tabular entity displays and audit logs.       |
| `Badge`     | `variant`, `size`, `children`                                                                     | `default`, `primary`, `success`, `warning`, `error`, `info`, `mono` | High contrast text against background fills.        | Status labels, counts, and tags.              |
| `StatusDot` | `status`, `size`, `pulse`                                                                         | `online`, `offline`, `busy`, `warning`                              | Decorative element with `aria-hidden` or label.     | System and agent live status indicators.      |
| `Skeleton`  | `width`, `height`, `circle`, `className`                                                          | Shimmer gradient pulse                                              | `aria-busy="true"` container placeholder.           | Zero-CLS loading state placeholders.          |

### Navigation & Feedback

| Component           | Props                                                       | Features                               | Accessibility (a11y)                                   | Usage                                                |
| ------------------- | ----------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| `Tabs` / `TabPanel` | `tabs`, `activeTab`, `onTabChange`, `variant`               | Default, pills, underline variants     | `role="tablist"`, `role="tab"`, arrow key navigation.  | Sub-view navigation within pages.                    |
| `Breadcrumb`        | `items`, `separator`                                        | Dynamic path resolution, home link     | `nav aria-label="Breadcrumb"`, current page indicator. | Hierarchical location awareness.                     |
| `Pagination`        | `currentPage`, `totalPages`, `onPageChange`, `siblingCount` | Page number buttons, previous/next     | `nav aria-label="Pagination"`, disabled buttons.       | Multi-page dataset navigation.                       |
| `Tooltip`           | `content`, `placement`, `children`                          | Top, bottom, left, right placements    | `role="tooltip"`, hover & focus display.               | Informational helpers on buttons and badges.         |
| `EmptyState`        | `icon`, `title`, `description`, `action`                    | Centered dashed card, CTA button       | Clear descriptive text for screen readers.             | Zero-data states across all lists.                   |
| `ErrorState`        | `title`, `message`, `onRetry`, `errorCode`                  | Warning icon, error message, retry CTA | `role="alert"` with live region announcement.          | Granular error boundaries and network failure views. |

### AI Native Components

| Component             | Props                                                                             | Features                                          | Accessibility (a11y)                              | Usage                                             |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `AIMessage`           | `role`, `content`, `sourceAgent`, `confidence`, `citations`, `timestamp`          | User vs Agent styles, confidence badge, citations | Distinct user/assistant landmark styling.         | Streaming chat history and dialogue cards.        |
| `ChatComposer`        | `value`, `onChange`, `onSubmit`, `loading`, `contextPills`                        | Slash command support, Send CTA, auto-resize      | `Enter` to submit, `Shift+Enter` for newline.     | AI prompt input and conversation orchestrator.    |
| `AIInsight`           | `title`, `description`, `sourceAgent`, `confidence`, `recommendation`, `onAction` | Strategic advice card, action CTA                 | Clear visual hierarchy for AI-generated guidance. | Proactive career recommendations and gap notices. |
| `ConfidenceIndicator` | `confidence`, `size`, `showLabel`                                                 | Radial / percentage progress bar                  | Accessible percentage text representation.        | System 1 / System 2 prediction confidence score.  |

---

## 2. Web Application Shell Components (`apps/web/src/components/layout/`)

- `Sidebar.tsx`: Multi-group navigation drawer with collapsed mode (`⌘B`),
  active route marking (`aria-current="page"`), and quick shortcuts modal (`?`).
- `TopNav.tsx`: Header navigation with dynamic workspace breadcrumbs,
  notification tray with badge counter, and theme selector.
- `ThemeToggle.tsx`: Seamless switching between Dark (`dark`), Light (`light`),
  and High Contrast (`high-contrast`) themes with localStorage persistence.
- `CommandCenter.tsx`: Global spotlight command palette (`⌘K`) with fuzzy search
  across routes, actions, and agents.
