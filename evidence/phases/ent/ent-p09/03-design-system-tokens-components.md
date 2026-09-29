# ENT-P09 — 03 Design System Tokens & Component Specifications

> **Phase:** `ENT-P09` (UI/UX and Design System)  
> **Deliverable:** `DEL-ENT-P09-03` (v1.0)  
> **Owner:** Principal Design Systems Engineer & UI-Kit Maintainer  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Three-Tier Design Token Architecture (`@vaeloom/ui-kit`)

Vaeloom organizes design tokens into a strict three-tier hierarchy conforming to
the Design Tokens Community Group (DTCG) specification:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: PRIMITIVE TOKENS                        │
│  - Raw values: slate-900 (#0f172a), indigo-600 (#4f46e5), space-4 (1rem)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 2: SEMANTIC TOKENS                         │
│  - Intent-mapped: surface-canvas, text-primary, border-interactive      │
│  - Theme-aware: Automatically adapt between Light and Dark mode        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 3: COMPONENT TOKENS                        │
│  - Element-scoped: button-primary-bg, dialog-backdrop-blur, card-glow │
└────────────────────────────────────────────────────────────────────────┘
```

### CSS Custom Properties Implementation (`packages/ui-kit/src/styles/tokens.css`):

```css
:root {
  /* Tier 1: Primitives */
  --pr-indigo-600: #4f46e5;
  --pr-indigo-500: #6366f1;
  --pr-slate-950: #020617;
  --pr-slate-900: #0f172a;
  --pr-slate-100: #f1f5f9;
  --pr-emerald-500: #10b981;
  --pr-amber-500: #f59e0b;
  --pr-rose-500: #f43f5e;

  /* Tier 2: Semantic (Light Mode Baseline) */
  --bg-canvas: #ffffff;
  --bg-surface: #f8fafc;
  --text-primary: #0f172a;
  --text-muted: #64748b;
  --border-subtle: #e2e8f0;
  --color-brand: var(--pr-indigo-600);
  --color-success: var(--pr-emerald-500);
  --color-warning: var(--pr-amber-500);
  --color-danger: var(--pr-rose-500);

  /* Tier 3: Component Primitives */
  --btn-primary-bg: var(--color-brand);
  --btn-primary-text: #ffffff;
  --card-radius: 0.75rem;
  --card-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
}

.dark {
  /* Tier 2: Semantic (Dark Mode Baseline) */
  --bg-canvas: var(--pr-slate-950);
  --bg-surface: var(--pr-slate-900);
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --border-subtle: #1e293b;
  --color-brand: var(--pr-indigo-500);
  --btn-primary-bg: var(--color-brand);
  --btn-primary-text: #ffffff;
}
```

---

## 2. Typography Scale & Contrast Ratios

Typography utilizes modern variable font stacks (`Plus Jakarta Sans` for display
headers, `Inter` for functional data tables and body copy):

| Token Name           | Size (`rem` / `px`) | Line Height |  Font Weight   | Minimum Contrast Ratio |    WCAG Compliance     |
| :------------------- | :-----------------: | :---------: | :------------: | :--------------------: | :--------------------: |
| `--font-display-2xl` |   `2.5rem / 40px`   |    `1.2`    |   Bold (700)   | **11.4 : 1** on Canvas |        **AAA**         |
| `--font-display-xl`  |   `2.0rem / 32px`   |   `1.25`    |   Bold (700)   | **11.4 : 1** on Canvas |        **AAA**         |
| `--font-heading-lg`  |   `1.5rem / 24px`   |    `1.3`    | SemiBold (600) | **9.2 : 1** on Canvas  |        **AAA**         |
| `--font-heading-md`  |  `1.25rem / 20px`   |    `1.4`    | SemiBold (600) | **7.8 : 1** on Canvas  |        **AAA**         |
| `--font-body-base`   |   `1.0rem / 16px`   |    `1.5`    | Regular (400)  | **7.5 : 1** on Canvas  |        **AAA**         |
| `--font-caption-sm`  |  `0.875rem / 14px`  |    `1.4`    |  Medium (500)  | **5.2 : 1** on Canvas  | **AA** (Exceeds 4.5:1) |

---

## 3. Core Component Library Specifications (`packages/ui-kit`)

All `@vaeloom/ui-kit` components wrap headless Radix UI primitives to ensure
complete keyboard navigation, ARIA semantics, and focus management:

### Component Catalog:

| Component Name      | Radix Primitive Foundation      | Key Variants & Sizes                                                    | Accessibility & ARIA Behaviors                                                              |
| :------------------ | :------------------------------ | :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **`Button`**        | Native `<button>`               | `default`, `outline`, `ghost`, `destructive`, `brand`; `sm`, `md`, `lg` | Full keyboard Enter/Space triggers; visible 2px offset focus ring; loading spinner state.   |
| **`Dialog`**        | `@radix-ui/react-dialog`        | Alert modal, confirm sheet, drawer                                      | Traps keyboard focus; closes on `Escape`; restores focus to triggering element on unmount.  |
| **`DropdownMenu`**  | `@radix-ui/react-dropdown-menu` | Action menu, user profile picker                                        | Arrow key item navigation; Type-ahead search; ARIA `role="menu"` and `aria-expanded`.       |
| **`StreamingCard`** | Custom `@vaeloom/ui-kit`        | `reasoning`, `tool_call`, `final_answer`                                | Dynamic pulse border glow; `aria-live="polite"` announcing new LLM reasoning steps.         |
| **`DataTable`**     | TanStack Table v8 wrapper       | Sortable, paginated, dense                                              | Screen-reader column headers (`aria-sort`); keyboard tab-navigable row actions.             |
| **`Toast`**         | `@radix-ui/react-toast`         | `success`, `info`, `warning`, `error`                                   | Auto-dismiss timer with pause on hover; polite screen reader announcements via live region. |

---

_Signed: Principal Design Systems Engineer & UI-Kit Maintainer — 2026-09-29_
