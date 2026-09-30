# Vaeloom Enterprise Design System — Canonical Specification

**Governing Authority:** Principal Design Systems Architect & Staff Frontend
Engineer  
**Core Package:** `@vaeloom/ui-kit`  
**Runtime Implementation:** `apps/web/src/styles/globals.css` +
`apps/web/tailwind.config.ts`  
**Themes:** Dark (Default Enterprise Obsidian, `#000000`), Light (Enterprise
Platinum, `#F7F8FC`), High-Contrast  
**Grid & Layout:** Fluid 8pt layout grid with 4pt sub-grid

---

## 1. Design System Philosophy & Zero-Trust Architecture

The Vaeloom Design System is architected to deliver high-density,
mission-critical clarity for autonomous AI agent orchestration, multi-turn
reasoning, and enterprise career pipelines. It prioritizes deterministic
legibility, zero CSS cascading conflicts, and strict WCAG 2.1 AA accessibility
across dual themes.

```mermaid
flowchart TD
    subgraph Layer 1: Primitive Tokens
        P1["Color Scales (Slate, Indigo, Emerald, Amber, Rose)"]
        P2["Spacing Scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)"]
        P3["Type Scale (Space Grotesk, Inter, IBM Plex Mono)"]
        P4["Radius Scale (none, xs, sm, md, lg, xl, 2xl, full)"]
        P5["Elevation Scale (none, raised, overlay, modal, card)"]
    end

    subgraph Layer 2: Semantic Tokens
        S1["Canvas & Surfaces (--bg, --surface, --surface-elevated, --surface-50..500)"]
        S2["Text Hierarchy (--text, --text-secondary, --text-muted, --text-dim)"]
        S3["Borders & Outlines (--border-subtle, --border, --border-strong, --focus-ring)"]
        S4["Action & Accent (--action, --action-hover, --action-active, --action-fg, --accent)"]
        S5["Status & Feedback (--success, --warning, --error, --info)"]
    end

    subgraph Layer 3: Component & Pattern Tokens
        C1["Buttons (btn-primary, btn-secondary, btn-outline, btn-destructive)"]
        C2["Containers (card, modal, drawer, popover, datagrid)"]
        C3["Form Controls (input, select, textarea, switch, checkbox)"]
        C4["AI Observability (confidence-bar, reasoning-trace, source-citation)"]
    end

    Layer 1 --> Layer 2 --> Layer 3
```

---

## 2. Canonical Dual-Theme Token Specification

All semantic colors are defined as R G B triplets in `globals.css` and consumed
via Tailwind CSS's alpha-value utility engine
(`rgb(var(--token) / <alpha-value>)`).

### 2.1 Canvas & Surface Hierarchy

| Semantic Token        | Tailwind Class                    | Dark Theme (Default)           | Light Theme               | Visual Role                      |
| :-------------------- | :-------------------------------- | :----------------------------- | :------------------------ | :------------------------------- |
| **Canvas Background** | `bg-background`                   | `0 0 0` (`#000000` Pure Black) | `247 248 252` (`#F7F8FC`) | Master screen canvas             |
| **Surface Root**      | `bg-surface` / `bg-card`          | `8 8 10` (`#08080A`)           | `255 255 255` (`#FFFFFF`) | Cards, panels, sidebars          |
| **Elevated Surface**  | `bg-surface-elevated`             | `14 14 17` (`#0E0E11`)         | `255 255 255` (`#FFFFFF`) | Modals, dropdown menus, tooltips |
| **Surface 100**       | `bg-surface-100`                  | `14 14 17` (`#0E0E11`)         | `243 244 249` (`#F3F4F9`) | Grouped sub-containers           |
| **Surface 200**       | `bg-surface-200` / `bg-secondary` | `20 20 24` (`#141418`)         | `236 238 245` (`#ECEEF5`) | Inset areas, table header rows   |
| **Surface 300**       | `bg-surface-300`                  | `32 32 38` (`#202026`)         | `226 229 239` (`#E2E5EF`) | Active item backgrounds          |
| **Surface Hover**     | `hover:bg-surface-hover`          | `18 18 22` (`#121216`)         | `241 243 249` (`#F1F3F9`) | Table row hover, menu item hover |
| **Surface Active**    | `active:bg-surface-active`        | `26 26 32` (`#1A1A20`)         | `232 236 246` (`#E8ECF6`) | Pressed button/card state        |

### 2.2 Text Hierarchy & Contrast Ratios

| Semantic Token     | Tailwind Class                              | Dark Theme                | Light Theme              | Minimum Contrast (vs Canvas)           |
| :----------------- | :------------------------------------------ | :------------------------ | :----------------------- | :------------------------------------- |
| **Primary Text**   | `text-text` / `text-foreground`             | `245 247 255` (`#F5F7FF`) | `23 26 43` (`#171A2B`)   | **18.4:1** (Dark) / **15.2:1** (Light) |
| **Secondary Text** | `text-text-secondary`                       | `183 189 214` (`#B7BDD6`) | `79 86 111` (`#4F566F`)  | **9.6:1** (Dark) / **6.2:1** (Light)   |
| **Muted Text**     | `text-text-muted` / `text-muted-foreground` | `138 142 158` (`#8A8E9E`) | `88 97 123` (`#58617B`)  | **5.4:1** (Dark) / **5.6:1** (Light)   |
| **Dim Text**       | `text-text-dim`                             | `128 132 148` (`#808494`) | `98 107 131` (`#626B83`) | **4.8:1** (Dark) / **5.1:1** (Light)   |

_All text tokens exceed WCAG 2.1 Level AA threshold (≥4.5:1 for normal text,
≥3.0:1 for large text)._

### 2.3 Actions & Interactive Accents

| Role                  | Token / Class                                 | Dark Value                | Light Value               | Invariant Rule                              |
| :-------------------- | :-------------------------------------------- | :------------------------ | :------------------------ | :------------------------------------------ |
| **Primary Action**    | `--action` / `bg-action`                      | `79 70 229` (`#4F46E5`)   | `79 70 229` (`#4F46E5`)   | Fixed brand indigo across both themes       |
| **Action Hover**      | `--action-hover` / `hover:bg-action-hover`    | `67 56 202` (`#4338CA`)   | `67 56 202` (`#4338CA`)   | Deep indigo hover                           |
| **Action Active**     | `--action-active` / `active:bg-action-active` | `55 48 163` (`#3730A3`)   | `55 48 163` (`#3730A3`)   | Darker active press                         |
| **Action Foreground** | `--action-fg` / `text-action-fg`              | `255 255 255` (`#FFFFFF`) | `255 255 255` (`#FFFFFF`) | Crisp white text (8.1:1 contrast on indigo) |
| **Primary Link**      | `--primary` / `text-primary`                  | `165 180 252` (`#A5B4FC`) | `67 56 202` (`#4338CA`)   | Theme-tuned for AA on respective canvases   |
| **Focus Ring**        | `--focus-ring` / `ring-primary`               | `#818cf8` (`indigo-400`)  | `#4f46e5` (`indigo-600`)  | Visible 2px outline with offset             |

### 2.4 Semantic Status & Feedback Tokens

| Semantic Role      | Token / Class                | Dark Theme                | Light Theme             | Tone & Usage                                  |
| :----------------- | :--------------------------- | :------------------------ | :---------------------- | :-------------------------------------------- |
| **Success**        | `--success` / `text-success` | `52 211 153` (`#34D399`)  | `5 150 105` (`#059669`) | Tests passing, agent tasks completed, active  |
| **Warning**        | `--warning` / `text-warning` | `251 191 36` (`#FBBF24`)  | `217 119 6` (`#D97706`) | Approval required, quota warnings, paused     |
| **Error / Danger** | `--error` / `text-error`     | `248 113 113` (`#F87171`) | `220 38 38` (`#DC2626`) | Validation failures, rejected actions, errors |
| **Information**    | `--info` / `text-info`       | `125 211 252` (`#7DD3FC`) | `2 132 199` (`#0284C7`) | Informational tips, telemetry notices         |

---

## 3. Typography Architecture

Vaeloom establishes a strict three-tier typographical system:

1. **Display Family — Space Grotesk (`var(--font-space-grotesk)`)**:
   - Distinctive geometric proportions designed for marketing hero sections, KPI
     figures, and page titles.
   - Weights: `font-bold` (700), `font-semibold` (600).
2. **Body & UI Family — Inter (`var(--font-inter)`)**:
   - Universal sans-serif engineered for maximum legibility at high data
     density.
   - Weights: `font-normal` (400), `font-medium` (500), `font-semibold` (600).
3. **Monospace & Telemetry Family — IBM Plex Mono
   (`var(--font-ibm-plex-mono)`)**:
   - Technical monospace used for API tokens, cryptographic hashes, model IDs,
     JSON payloads, and execution durations.
   - Weights: `font-normal` (400), `font-medium` (500).

### Typographic Scale

| Role                     | Font Class     | Size / Line Height        | Tracking   | Application                                   |
| :----------------------- | :------------- | :------------------------ | :--------- | :-------------------------------------------- |
| **Display Hero**         | `font-display` | `text-4xl` (36px / 40px)  | `-0.025em` | Marketing headline, hero banners              |
| **Page Title (H1)**      | `font-display` | `text-2xl` (24px / 32px)  | `-0.02em`  | Main page titles across all 57 routes         |
| **Section Title (H2)**   | `font-sans`    | `text-lg` (18px / 28px)   | `-0.01em`  | Card group titles, drawer headers             |
| **Component Title (H3)** | `font-sans`    | `text-base` (16px / 24px) | `normal`   | Modal titles, table group headers             |
| **Body (Default)**       | `font-sans`    | `text-sm` (14px / 20px)   | `normal`   | Primary reading text, form inputs, table data |
| **Caption / Compact**    | `font-sans`    | `text-xs` (12px / 16px)   | `normal`   | Descriptions, helper text, timestamps         |
| **Micro Badge**          | `font-sans`    | `text-2xs` (10px / 14px)  | `+0.05em`  | Status pills, uppercase tags, role chips      |
| **Code / Hash**          | `font-mono`    | `text-xs` (12px / 16px)   | `normal`   | Hashes, IDs, JSON schemas, latencies          |

---

## 4. Spacing, Elevation & Layout Grid

### 4.1 8pt Layout Grid

Layout dimensions and gaps adhere to the 8pt scale:

- `gap-1` / `p-1`: 4px (micro spacing)
- `gap-2` / `p-2`: 8px (standard element spacing)
- `gap-3` / `p-3`: 12px (compact container padding)
- `gap-4` / `p-4`: 16px (card internal padding)
- `gap-6` / `p-6`: 24px (grid gap between cards)
- `gap-8` / `p-8`: 32px (page section spacing)

### 4.2 Elevation & Shadow Semantics

| Level           | Token                 | CSS Definition                    | Usage                          |
| :-------------- | :-------------------- | :-------------------------------- | :----------------------------- |
| **None**        | `--elevation-none`    | `none`                            | Flat containers, nested boxes  |
| **Raised**      | `--elevation-raised`  | `0 1px 3px 0 rgb(0 0 0 / 0.1)`    | Cards, hover items             |
| **Card (Dark)** | `--shadow-card`       | `0 2px 8px rgb(0 0 0 / 0.6)`      | Standard cards on black canvas |
| **Overlay**     | `--elevation-overlay` | `0 4px 12px 0 rgb(0 0 0 / 0.15)`  | Dropdown menus, popovers       |
| **Modal**       | `--elevation-modal`   | `0 12px 32px 0 rgb(0 0 0 / 0.25)` | Dialogs, slide-out drawers     |

### 4.3 Container Max Widths

- `max-w-7xl` (`1280px`): Full dashboard layouts, data tables, master-detail
  views.
- `max-w-6xl` (`1152px`): Practice rooms, interviews, portfolios, workflows.
- `max-w-5xl` (`1024px`): Settings, profile, help, and privacy cockpits.
- `max-w-md` (`448px`): Authentication pages, confirmation modals.

---

## 5. Component Interaction & Accessibility Guidelines

1. **Interactive Control Target Sizing**:
   - All interactive touch targets are a minimum of `44x44px` on mobile and
     `36x36px` on desktop.
2. **Focus Visibility Mandate**:
   - Every interactive element (buttons, links, inputs, switches, tabs) must
     implement `:focus-visible` with a 2px offset ring:
   ```css
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
   ```
3. **Information Not Conveyed by Color Alone**:
   - Status indicators must always combine color with an icon and textual label
     (e.g. Danger Badge = Red border/text + AlertTriangle icon + "Failed" text).
4. **Reduced Motion Support**:
   - Smooth transitions respect user preferences via
     `@media (prefers-reduced-motion: reduce)`.
