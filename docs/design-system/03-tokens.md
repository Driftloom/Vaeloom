# 03. Design Token Architecture

> **Corrected 2026-09-30 by a zero-trust audit.** The previous version of this
> file asserted that tokens were "canonically authored in
> `@vaeloom/ui-kit/src/tokens/`" and that they "compile to CSS variables via
> `generateCssVariables()`". Both claims were false: `generateCssVariables()`
> had no callers anywhere in the app, and the JSON tree had drifted from the
> stylesheet on 66 colour values across the three themes. See
> `docs/frontend/design-tokens-audit.md` for the evidence.

## 1. Source of truth

There is exactly **one** authoritative token file:

```
apps/web/src/styles/globals.css
```

Tailwind is the only consumer. `apps/web/tailwind.config.ts` maps every colour,
radius, shadow, font and spacing key to a `var(--token)` declared in that
stylesheet, using the `rgb(var(--x) / <alpha-value>)` form so opacity modifiers
work:

```ts
const rgb = (v: string) => `rgb(${v} / <alpha-value>)`;
colors: { background: rgb('var(--bg)'), error: { DEFAULT: rgb('var(--error)') } }
```

Anything hand-written into `packages/ui-kit/src/tokens/*.json` changes **no
pixels**, because the app build never reads those files. That is precisely why
they are now generated rather than hand-maintained.

## 2. Token layers

The runtime implements a 3-tier hierarchy, expressed as CSS custom properties:

| Layer        | Namespace                                                                                                        | Where                                       | Example                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| 1. Primitive | `--surface-50..900`, `--radius-*`, `--elevation-*`, `--shadow-*`                                                 | `:root`                                     | `--surface-300: 32 32 38`      |
| 2. Semantic  | `--bg`, `--text`, `--border`, `--primary`, `--action`, `--accent`, `--success`, `--warning`, `--error`, `--info` | `:root,.dark` / `.light` / `.high-contrast` | `--error: 248 113 113`         |
| 3. Component | `tailwind.config.ts` keys: `bg-action`, `text-error-fg`, `border-focus`                                          | config                                      | `bg-action` -> `var(--action)` |

Component tokens are not separate declarations — they are the semantic layer
addressed through Tailwind keys. That is why there is no `button.primary.bg`
custom property to drift out of sync.

**89 unique custom properties** are declared, of which 76 are the token system
and 13 are `--landing-*` (3D scene colours, deliberately outside the system and
excluded from generation).

## 3. Themes

Three themes plus an OS preference query, all as class-scoped overrides:

| Selector                                                           | Purpose                                      |
| ------------------------------------------------------------------ | -------------------------------------------- |
| `:root, .dark`                                                     | Default. Pure-black canvas, brand reference. |
| `.light`                                                           | Enterprise near-white surfaces.              |
| `.high-contrast, html.high-contrast, [data-theme="high-contrast"]` | WCAG AAA, 7:1+.                              |
| `@media (prefers-contrast: more)`                                  | Escalates border/primary/accent.             |

`html { color-scheme }` is switched alongside, so native scrollbars and form
controls follow the theme.

Every theme must override `--color-focus-ring`. If it does not, it silently
inherits the `:root` value — this was a real bug: `.high-contrast` was
inheriting the dim indigo `#818cf8` instead of the accessible yellow `#ffff00`.
`tokens.test.ts` now asserts the override exists.

## 4. The generated token record

`packages/ui-kit/src/tokens/` is a **generated, drift-checked projection** of
`globals.css`:

```
apps/web/src/styles/globals.css        <-- SOURCE (hand-edited)
          |
          +-- scripts/gen_tokens.py --> packages/ui-kit/src/tokens/
              |                             themes/{dark,light,high-contrast}.json
              |                             primitives.json   (radius + elevation)
              |                             mapping.json       (name map)
              |
              +-- --check --> exit 1 on drift (CI)
```

```bash
python scripts/gen_tokens.py            # regenerate
python scripts/gen_tokens.py --check    # CI gate
pnpm --filter @vaeloom/web tokens:check
```

`generateCssVariables()` is retained for documentation and tests only. It has
**no runtime callers** and must not be added to the app build.

### Provenance, not vagueness

Each theme file records which values come from the runtime:

```json
"provenance": {
  "generatedFrom": "apps/web/src/styles/globals.css",
  "runtimeDerived":   [ /* 40 names globals.css actually declares */ ],
  "designRecordOnly": [ /* 17 names with NO runtime counterpart */ ]
}
```

Of 57 names per theme, **40 are runtime-derived** and **17 are
design-record-only**:

- 15 AI semantic colours —
  `--color-ai-{proposed,processing,verified,needs-review,blocked}` and their
  `-muted` / `-fg` pairs. **These do not exist at runtime.** The app currently
  hard-codes `text-sky-700`, `bg-violet-500/10` and similar raw Tailwind palette
  values for AI states. Adding the globals.css tokens is tracked as open work,
  not silently assumed done.
- `--color-bg-scrim` — `globals.css` has `--overlay: 0 0 0` with **no alpha**,
  so a scrim cannot be derived from it.
- `--color-text-inverse` — not defined in any theme.

Design-record-only names are never given an invented runtime value and are not
counted as drift-checked, so nothing in the JSON implies an implementation that
does not exist.

## 5. Anti-drift guarantees

`packages/ui-kit/src/__tests__/tokens.test.ts` re-derives every runtime-derived
value straight from `globals.css` and compares. It fails on:

- a runtime-derived value that does not appear in the stylesheet
- a `runtimeDerived` name with no entry in `mapping.json`
- `runtimeDerived` and `designRecordOnly` that are not disjoint or not complete
- a value count that differs between themes
- a change to the 89-property palette size that is not an intentional bump

`apps/web/src/__tests__/design-system-guardrails.test.ts` additionally fails if
a colour family, boxShadow key or spacing key the app depends on disappears from
`tailwind.config.ts`, or if the `content` globs stop covering `src/lib`,
`src/hooks` or `src/trigger`.

## 6. What is NOT tokenised yet

- **AI semantic colours** — 15 names, design record only. See §4.
- **Motion tokens** — `primitives.json` has a `motion` block, but the app uses
  raw Tailwind `animate-*` and CSS `transition-*` values. No duration/easing
  scale is enforced.
- **Spacing scale** — `globals.css` defines no `--space-*`. Tailwind's default
  scale is used, plus one added key (`0.2`). `primitives.json` carries a `space`
  ramp that nothing consumes.
- **Typography scale** — no `--font-size-*` / `--font-weight-*` in
  `globals.css`. Headings are styled with raw Tailwind size/weight utilities,
  which is the direct cause of the 29 competing `<h1>` styles.
