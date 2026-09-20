# 03. Design Token Architecture

## 1. Three-Layer Token Architecture

Vaeloom enforces a strict 3-tier token hierarchy modeled after modern enterprise
design systems (e.g. Goldman Sachs Design System, Primer, Spectrum):

```
+-------------------------------------------------------------------+
| Layer 1: Primitive Tokens (Global)                                |
| Raw values: colors (zinc.900, blue.500), space (4px, 8px), etc.   |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| Layer 2: Semantic Tokens (System / Alias)                         |
| Purpose-bound: color.bg.canvas, color.text.primary, space.md      |
| Maps to Primitives based on Active Theme (Dark / Light / HC)      |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| Layer 3: Component Tokens (Component-Specific)                   |
| Scoped: button.primary.bg, input.border.focus, table.row.hover    |
| Product features consume Layer 2 or Layer 3 ONLY.                 |
+-------------------------------------------------------------------+
```

## 2. Token Files & Locations

All tokens are canonically authored in `@vaeloom/ui-kit/src/tokens/`:

- `primitives.json`: Global scale of color, spacing, typography, radius,
  elevation, motion.
- `semantic.json`: Meaningful aliases (`color.bg.surface`, `color.text.muted`,
  `color.border.subtle`).
- `component.json`: Component bindings (`button.primary.bg`, `card.bg`, etc.).
- `themes/dark.json`: Dark theme variable mapping (default).
- `themes/light.json`: Light theme variable mapping.
- `themes/high-contrast.json`: High-contrast accessibility theme mapping.

## 3. CSS Variable Mapping & Runtime Consumption

Tokens compile to CSS variables via `generateCssVariables()` in
`@vaeloom/ui-kit`:

- `:root`, `.dark` -> `--color-bg-canvas: #08080a;`, etc.
- `.light` -> `--color-bg-canvas: #f8f9fc;`, etc.
- `.high-contrast` -> `--color-bg-canvas: #000000;`, etc.

Tailwind CSS in `apps/web/tailwind.config.js` maps directly to these CSS
variables, preventing arbitrary hex or hardcoded values in markup.
