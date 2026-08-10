# MVP-P09 — 05. Design System (DEL-MVP-P09-03)

> Owner: Design System Lead + Frontend Lead. Build on existing tokens/kit;
> extend, do not recreate (CF-P09-03: no icon library addition).

## 1. Tokens (existing — verified tailwind.config.ts)

| Token                            | Value                                              | Notes                           |
| -------------------------------- | -------------------------------------------------- | ------------------------------- |
| background                       | `#0a0a0f` (dark) / `#f8f9fc` (light)               | `class` dark mode, default dark |
| surface / hover / active         | `#12121a` / `#1a1a24` / `#242430`                  | `l-surface*` light variants     |
| primary / hover / active         | `#8b9af0` / `#a3b1ff` / `#7382d6`                  | periwinkle accent               |
| accent (danger) / hover / active | `#ff7b72` / `#ff948d` / `#e6655c`                  | coral; contrast-checked         |
| text / muted                     | `#e2e8f0` / `#94a3b8` (`l-text*` light)            |                                 |
| border                           | `#2e3347` (`l-border` `#e2e8f0`)                   |                                 |
| fonts                            | Space Grotesk (display+sans), IBM Plex Mono (mono) | next/font, `display: swap`      |
| shadow                           | `l-subtle`, `l-card` (light)                       | dark uses borders               |

## 2. Token additions (designed; P10 implementation)

| New token           | Purpose                      | Value (dark)                      |
| ------------------- | ---------------------------- | --------------------------------- |
| `success`           | success states               | `#4ade80`                         |
| `warning`           | stale/partial                | `#fbbf24`                         |
| `info`              | AI disclosure                | `#38bdf8`                         |
| `danger` (= accent) | destructive                  | `#ff7b72` (alias)                 |
| `focus-ring`        | WCAG 2.4.7 visible focus     | `#a3b1ff` w/ 2px offset ring      |
| spacing scale       | 4/8/12/16/24/32/48           | derived 4px base                  |
| radius scale        | sm 6 / md 8 / lg 12          | existing 6 (rounded-md) preserved |
| type scale          | 12/14/16/20/24/32 (≥16 body) | text-sm baseline preserved        |

All new colors provide ≥4.5:1 contrast vs their surfaces (verified at P10 via
automated checks; P14 audit).

## 3. Component inventory & gaps

| Existing                                                                                                        | State              | Needed (P10 design targets)                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Button (4 variants, focus ring)                                                                                 | keep               | toast, diff-viewer, provenance-badge, confidence-meter, consent-toggle-group, expiry-timer, skip-link, tablist |
| Card, Input, Modal (add focus trap), Spinner                                                                    | keep (+Modal a11y) |                                                                                                                |
| EmptyState, ErrorState, ProgressBar, SearchInput, StatusBadge, Table, Toggle, ProposalCard (evolve per §04.2.1) | keep/evolve        |                                                                                                                |
| Sidebar, TopNav, ThemeToggle                                                                                    | keep (grouped IA)  |                                                                                                                |

New components go in `packages/ui-kit` (reusable) + web `shared/` when
page-specific; all interactive components get focus-visible rings, aria states,
and keyboard support by default (existing convention).

## 4. Governance

- Tokens = single source in tailwind config + `ui-kit` props; no hard-coded
  colors in pages (audit at P10).
- Dark/light: `class` strategy (ThemeToggle exists); new tokens dual-valued.
- Deprecation: token removal requires design-system review (change control).
- Content follows `06-content-errors.md`; components ship with a11y props typed
  (e.g. `aria-label` on icon-only).
- Versioning: design tokens recorded with app release version; change log in
  registers.
