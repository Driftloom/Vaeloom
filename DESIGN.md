# Vaeloom Design System

> **Single Source of Truth** for UI, Typography, Colors, Spacing, and Component
> Standards across Vaeloom (`apps/web` and `packages/ui-kit`).

---

## 1. Core Principles

1. **Semantic Tokens Over Raw Palettes**:
   - **Never** use raw Tailwind colors (`slate-*`, `zinc-*`, `gray-*`,
     `neutral-*`, `emerald-*`, etc.) for standard UI surfaces, borders, or text.
   - **Always** use semantic tokens (`text-text`, `text-text-muted`,
     `bg-surface`, `bg-background`, `border-border`, `text-success`, etc.).
   - Reason: Tokens automatically resolve correctly across both **Dark Mode**
     (pure-black enterprise navy) and **Light Mode** (refined enterprise white)
     without manual `dark:` hacks.

2. **Predictable 4px Grid**:
   - All padding, margins, and gaps must follow the standard 4px Tailwind
     spacing scale (`p-1`, `p-2`, `p-3`, `p-4`, `p-6`, `p-8`, etc.).
   - Avoid arbitrary `[Npx]` values.

3. **Consistent Component Morphology**:
   - Interactive inputs and buttons: `rounded-lg` (8px).
   - Containers, panels, cards: `rounded-xl` (12px).
   - Pills and badges: `rounded-full` or `rounded-md`.

---

## 2. Typography System

### 2.1 Font Families

| Token          | Family            | Fallback Stack                                                                 | Usage                                                             |
| -------------- | ----------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `font-sans`    | **Inter**         | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | Default body copy, inputs, table cells, general UI.               |
| `font-display` | **Space Grotesk** | `system-ui, sans-serif`                                                        | Page titles, section headings, high-impact numbers, hero banners. |
| `font-mono`    | **IBM Plex Mono** | `monospace`                                                                    | Code snippets, hashes, IDs, timestamps, keyboard shortcut keys.   |

### 2.2 Type Hierarchy & Heading Standards

| Role                    | HTML Element             | Required Classes                                                 | Examples                                       |
| ----------------------- | ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| **Page Title**          | `<h1>`                   | `text-3xl font-display font-medium text-text`                    | "Settings", "Applications", "Billing"          |
| **Error Title**         | `<h1>`                   | `text-6xl font-display font-bold text-primary`                   | "404", "403"                                   |
| **Section Header**      | `<h2>`                   | `text-xl font-display font-medium text-text`                     | Main section dividing headers                  |
| **Card / Subtitle**     | `<h3>`                   | `text-lg font-display font-medium text-text`                     | Card titles, modal headers, subsection headers |
| **Group / Eyebrow**     | `<h4>` or `<span>`       | `text-xs font-semibold uppercase tracking-wider text-text-muted` | Category labels, table column headers          |
| **Body (Default)**      | `<p>`, `<span>`, `<div>` | `text-sm text-text` or `text-text-secondary`                     | Primary readable content                       |
| **Body (Content/Docs)** | `<p>`                    | `text-base text-text leading-relaxed`                            | Privacy policy, Terms, long-form articles      |
| **Secondary / Muted**   | `<p>`, `<span>`          | `text-xs text-text-muted`                                        | Descriptions, captions, helper text            |
| **Micro / Badge**       | `<span>`                 | `text-2xs font-medium` or `font-semibold`                        | Status pills, compact count badges (10px)      |

_Note: Headings use `font-medium` or `font-semibold`. Avoid `font-bold` on
standard headings to keep the clean, refined enterprise aesthetic._

---

## 3. Color & Token Architecture

All colors map to CSS custom properties defined in
`apps/web/src/styles/globals.css` and exposed via `apps/web/tailwind.config.ts`.

### 3.1 Surface & Background Hierarchy

| Class                 | CSS Var              | Dark Value             | Light Value                  | Usage                                     |
| --------------------- | -------------------- | ---------------------- | ---------------------------- | ----------------------------------------- |
| `bg-background`       | `--bg`               | `#000000` (pure black) | `#F7F8FC` (clean white-blue) | Root application canvas                   |
| `bg-surface`          | `--surface`          | `#08080A`              | `#FFFFFF`                    | Base cards, tables, panels                |
| `bg-surface-elevated` | `--surface-elevated` | `#0E0E11`              | `#FFFFFF`                    | Modals, dropdowns, floating menus         |
| `bg-surface-100`      | `--surface-100`      | `#0E0E11`              | `#F3F4F9`                    | Inputs, sub-cards, nested blocks          |
| `bg-surface-200`      | `--surface-200`      | `#141418`              | `#ECEEF5`                    | Secondary button backgrounds, hover fills |
| `bg-surface-300`      | `--surface-300`      | `#202026`              | `#E2E5EF`                    | Borders on hover, divider lines           |
| `bg-surface-hover`    | `--surface-hover`    | `#121216`              | `#F1F3F9`                    | List item hover states                    |
| `bg-surface-active`   | `--surface-active`   | `#1A1A20`              | `#E8ECF6`                    | Selected tab/item fills                   |

### 3.2 Text Color Tokens

| Class                 | Semantic Role                     | Dark Token | Light Token |
| --------------------- | --------------------------------- | ---------- | ----------- |
| `text-text`           | Primary readable text, titles     | `#F5F7FF`  | `#171A2B`   |
| `text-text-secondary` | Secondary paragraphs, labels      | `#B7BDD6`  | `#4F566F`   |
| `text-text-muted`     | Hints, placeholders, captions     | `#8A8E9E`  | `#58617B`   |
| `text-text-dim`       | Inactive icons, subtle timestamps | `#808494`  | `#626B83`   |

### 3.3 Border Tokens

| Class                  | Usage                                    |
| ---------------------- | ---------------------------------------- |
| `border-border`        | Standard card, input, and divider border |
| `border-border-subtle` | Subtle nested borders, soft dividers     |
| `border-border-strong` | High-contrast borders, active boundaries |

### 3.4 Action & Brand Accent

| Token     | Class                           | Description                                                           |
| --------- | ------------------------------- | --------------------------------------------------------------------- |
| `action`  | `bg-action text-action-fg`      | High-contrast indigo button (`#4F46E5`), white text across all themes |
| `primary` | `text-primary`, `bg-primary/10` | Brand text link / tinted badge (`#A5B4FC` dark, `#4338CA` light)      |
| `accent`  | `text-accent`, `bg-accent`      | Focus rings, highlight elements                                       |

### 3.5 Semantic Status Tokens

Always use semantic status tokens rather than raw green/red/yellow:

| Status             | Text Class     | Background Pill Class        | Border Class        |
| ------------------ | -------------- | ---------------------------- | ------------------- |
| **Success**        | `text-success` | `bg-success/15 text-success` | `border-success/30` |
| **Warning**        | `text-warning` | `bg-warning/15 text-warning` | `border-warning/30` |
| **Error / Danger** | `text-error`   | `bg-error/15 text-error`     | `border-error/30`   |
| **Info**           | `text-info`    | `bg-info/15 text-info`       | `border-info/30`    |

---

## 4. Component Standards

### 4.1 Buttons

- **Primary Action**:
  `bg-action text-action-fg font-medium text-sm px-4 py-2 rounded-lg hover:bg-action-hover active:bg-action-active transition-all`
- **Secondary Action**:
  `bg-surface-200 text-text font-medium text-sm px-4 py-2 rounded-lg hover:bg-surface-300 border border-border transition-all`
- **Ghost Action**:
  `text-text-muted font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-surface-200 hover:text-text transition-all`
- **Danger Action**:
  `bg-error text-white font-medium text-sm px-4 py-2 rounded-lg hover:brightness-110 active:brightness-95 transition-all`

### 4.2 Inputs & Forms

- **Input Field**:
  `w-full bg-surface-100 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/20 focus:outline-none transition-all`
- **Label**: `block text-sm font-medium text-text mb-1.5`

### 4.3 Cards & Containers

- **Standard Card**:
  `bg-surface rounded-xl border border-border p-4 sm:p-5 shadow-card`
- **Hoverable Card**:
  `bg-surface rounded-xl border border-border p-4 sm:p-5 shadow-card hover:border-surface-300 hover:shadow-card-hover transition-all`

---

## 5. Migration Checklist for Legacy Code

- [ ] Replace all `text-slate-900 dark:text-white` with `text-text`
- [ ] Replace all `text-slate-600 dark:text-slate-400` with
      `text-text-secondary`
- [ ] Replace all `text-slate-500 dark:text-slate-400` with `text-text-muted`
- [ ] Replace all `bg-slate-800` / `bg-white` with `bg-surface` or
      `bg-surface-100`
- [ ] Replace all `border-slate-200 dark:border-slate-700` with `border-border`
- [ ] Replace `text-[10px]` with `text-2xs`
- [ ] Ensure headings use `font-display` and appropriate scale (`text-3xl` for
      h1, `text-xl` for h2, `text-lg` for h3)
