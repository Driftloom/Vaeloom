# Design Token Audit — zero-trust, 2026-09-30

Scope: `apps/web/tailwind.config.ts`, `apps/web/src/styles/globals.css`,
`packages/ui-kit/src/tokens/**`.

Every number below is measured from the repository or from generated CSS, not
from prior documentation. Prior claims in this file's history were treated as
evidence to be re-verified, and two of them were false.

---

## 1. Headline: the token system was already good; the wiring was not

`globals.css` is a competent, deliberately-built token system: 89 custom
properties, 3 themes plus `prefers-contrast`, WCAG-tuned values with the
contrast ratios recorded in comments, `prefers-reduced-motion` support, and a
documented pure-black policy for scrims and graph voids.

The defects were not aesthetic. They were:

| Defect                                                                              | Measured                                   | Consequence                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Token JSON hand-maintained alongside the stylesheet                                 | 66 colour values disagreed across 3 themes | Editing the JSON changed no pixels; the JSON light palette would have **failed** the axe checks `globals.css` was tuned to pass |
| `destructive` used as a colour, never declared                                      | 11 files                                   | `cognition/page.tsx:249,418,588` error banners rendered with **no** background, border or text colour                           |
| `shadow-xs` (Tailwind v4 token, project is v3.4)                                    | 78 files                                   | No shadow                                                                                                                       |
| `py-0.2` (below the v3 spacing floor)                                               | 38 files                                   | No vertical padding                                                                                                             |
| `animate-in` / `zoom-in-95` (plugin not installed)                                  | 6 / 2 files                                | `CommandCenter`, `TopNav`, `AddCapabilityModal` got **no animation at all**                                                     |
| `bg-primary-hover` / `border-border-hover`                                          | 9 / 4 files                                | No hover state                                                                                                                  |
| `no-scrollbar` / `scrollbar-none` (plugin not installed)                            | 5 / 1 files                                | Visible scrollbar track                                                                                                         |
| `backdrop-blur-xs`, `prose`, `w-18`, `h-18`                                         | 7 files                                    | Nothing                                                                                                                         |
| `content` globs omitted `src/lib`, `src/hooks`, `src/trigger`, `src/__tests__`      | 31 files                                   | Valid classes (`text-surface-900`, `bg-[#1c1d24]`) **purged**                                                                   |
| High-contrast theme never overrode `--color-focus-ring`                             | 1 theme                                    | HC users inherited the dim `#818cf8` ring instead of `#ffff00`                                                                  |
| `--error-active` referenced by `semantic.json` + `component.json`, declared nowhere | 2 files                                    | Dangling `var()`; destructive pressed state undefined                                                                           |

**Roughly 150 class usages across 140+ files rendered nothing at all.**

---

## 2. Token architecture, as it is now

```
apps/web/src/styles/globals.css          89 custom properties  <-- SOURCE
        |
        |  tailwind.config.ts maps every key to var(--token)
        v
   runtime CSS  (3 themes + prefers-contrast)
        |
        |  scripts/gen_tokens.py  (--check in CI)
        v
packages/ui-kit/src/tokens/*.json        57 names/theme        <-- GENERATED
```

Single direction. The stylesheet is hand-edited; the JSON is an artifact.

### Counts

| Measure                                               | Value                                           |
| ----------------------------------------------------- | ----------------------------------------------- |
| Custom properties in `globals.css`                    | 89 (76 token system + 13 `--landing-*`)         |
| Colour names per theme in the JSON                    | 57, identical across all three                  |
| Runtime-derived (traceable to `globals.css`)          | 40                                              |
| Design-record-only (no runtime counterpart)           | 17                                              |
| Radius/elevation names shared with `globals.css`      | 17, all value-identical                         |
| Namespaces the JSON models but `globals.css` does not | `--space-*`, `--font-size-*`, `--font-weight-*` |

---

## 3. The three colour fixes

### 3.1 `destructive` — 11 files rendering unstyled

`ConfirmationDialog` accepts `variant="destructive"` (a prop, handled), but 15
_class_ usages had no matching colour:

```
components/execution/ExecutionTimeline.tsx:180,250,252
app/workspace/[workspaceId]/cognition/page.tsx:249,418,588,606
```

Aliased onto the existing `--error` tokens so there is exactly one danger
palette:

```ts
destructive: {
  DEFAULT: rgb('var(--error)'),
  foreground: '255 255 255',
  muted: rgb('var(--error-muted)'),
  fg: rgb('var(--error-fg)'),
  active: rgb('var(--error-active)'),
  border: rgb('var(--error)'),
}
```

### 3.2 High-contrast focus ring — a cascade leak

`globals.css` declared `--color-focus-ring` in `:root` and `.light` but **not**
in `.high-contrast`. CSS inheritance therefore gave high-contrast users the dim
indigo ring, in the one theme that can least afford a weak indicator. The
original hand-authored JSON had `#ffff00` for high-contrast, so the JSON looked
correct while the runtime was wrong — exactly the inversion the generator exists
to prevent. Found by the generator, fixed in `globals.css`, now asserted by
`tokens.test.ts`.

### 3.3 `--error-active` — a dangling reference

`semantic.json` (`color.action.destructiveActive`) and `component.json`
(`bgActive`) both dereferenced `--color-action-destructive-active`. No theme
defined it, and `globals.css` had no `--error` counterpart.

An earlier pass deleted the JSON name; that reproduced the exact
dangling-`var()` regression the existing test guards against, so the gap was
closed in `globals.css` instead — all three themes now define it, following the
`--action` family convention of deepening on hover/active:

| Theme         | `--error` | `--error-active` |
| ------------- | --------- | ---------------- |
| dark          | `#F87171` | `#DC2626`        |
| light         | `#B91C1C` | `#991B1B`        |
| high-contrast | `#FF3333` | `#CC0000`        |

The token is now actually consumed: `ui-kit` `Button`'s `danger` variant uses
`active:bg-error-active` instead of the `bg-error/80` alpha hack, and the
`.btn-danger` CSS alias mirrors it exactly.

---

## 4. Dead scale entries, restored with their real values

| Class                                 | Was                                       | Now                                     | Rationale                                                                                                          |
| ------------------------------------- | ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `shadow-xs`                           | undefined                                 | `0 1px 2px 0 rgb(0 0 0 / 0.05)`         | Equals Tailwind v4 `shadow-xs` == v3 `shadow-sm`, so intended hairline elevation is preserved rather than invented |
| `py-0.2`                              | undefined                                 | `0.05rem`                               | 38 call sites justified one scale key; 0.2 x the 0.25rem step                                                      |
| `primary.hover`                       | undefined                                 | `var(--primary-400)`                    | Link hover shifts hue within the theme instead of collapsing to fixed action indigo                                |
| `border.hover`                        | undefined                                 | `var(--border-strong)`                  | Reuses an existing token; no new colour                                                                            |
| `no-scrollbar`, `scrollbar-none`      | undefined                                 | `scrollbar-width: none` + WebKit pseudo | Firefox needs the standard property, WebKit the pseudo                                                             |
| `.markdown-body`                      | `prose` (typography plugin absent)        | token-themed markdown styles            | `prose` purged, so every `ReactMarkdown` preview rendered as an unstyled wall of text                              |
| `animate-fade-in`, `animate-scale-in` | `animate-in`/`zoom-in-95` (absent plugin) | existing keyframes already in config    | No new dependency                                                                                                  |

`w-18` / `h-18` (2 sites) were moved **onto** the scale (`w-20` / `h-20`) rather
than extending the scale for two call sites.

Verified against generated CSS: every one of the above is now emitted.

---

## 5. Anti-drift guarantees added

**`scripts/gen_tokens.py`** — parses `globals.css`, converts `R G B` triplets to
hex, writes the theme JSONs + `primitives.json` (radius/elevation) +
`mapping.json`. `--check` exits 1 on drift. Idempotent.

**`tokens.test.ts`** — replaced a "drift baseline" suite (which asserted the
drift was expected) with real synchronisation checks:

- every `runtimeDerived` value appears verbatim in `globals.css`
- every `runtimeDerived` name is traceable through `mapping.json`
- `runtimeDerived` and `designRecordOnly` are disjoint and jointly complete
- all three themes have identical value counts
- high-contrast re-declares the focus ring
- the 17 design-record-only names are asserted verbatim, so the gaps stay
  visible

**`design-system-guardrails.test.ts`** (new) — 11 checks covering token
declarations, the `content` globs, CSS/ui-kit class alignment, mojibake, and
single-`h1` structure.

---

## 6. Honest gaps — not tokenised yet

| Gap                                              | Evidence                                       | Impact                                                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **15 AI semantic colours have no runtime token** | `provenance.designRecordOnly`                  | The app hard-codes `text-sky-700`, `bg-violet-500/10`, `text-emerald-700`… for AI/memory states. These are also the wrong shade in dark mode (`-700` on a near-black surface is close to invisible). |
| **No typography scale**                          | no `--font-size-*` in `globals.css`            | Direct cause of 29 competing `<h1>` class strings.                                                                                                                                                   |
| **No motion scale**                              | `primitives.json` `motion` block is unconsumed | Durations/easings are raw Tailwind values.                                                                                                                                                           |
| **No spacing scale**                             | `primitives.json` `space` ramp is unconsumed   | Tailwind default + one added key.                                                                                                                                                                    |
| `--color-bg-scrim` underivable                   | `--overlay: 0 0 0`, no alpha                   | 13 `bg-black/{30,40,50,60,70}` scrims bypass tokens entirely.                                                                                                                                        |
| 402 arbitrary Tailwind values, 32 inline styles  | scan                                           | Concentrated in `connectors-catalog.tsx` (149, per-vendor brand hexes — arguably legitimate) and the capabilities views.                                                                             |

---

## 7. Files changed

| File                                                      | Change                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/styles/globals.css`                         | `destructive`/hover/elevation/scale keys, focus-ring override, `--error-active` x3, `.btn-*`/`.card`/`.input-*` rewritten as exact ui-kit aliases, `.markdown-body`, scrollbar utilities, 4 decorative emoji/marks removed from comments |
| `apps/web/tailwind.config.ts`                             | `content` globs, `destructive`, `primary.hover`, `border.hover`, `shadow-xs`, `spacing.0.2`, `error.active`                                                                                                                              |
| `packages/ui-kit/src/components/Button.tsx`               | `focus:` -> `focus-visible:` on the ring; `active:bg-error-active`                                                                                                                                                                       |
| `packages/ui-kit/src/components/Card.tsx`                 | `md` padding `p-4 sm:p-5` to match the `.card` alias                                                                                                                                                                                     |
| `packages/ui-kit/src/tokens/**`                           | Regenerated; `index.ts` contract rewritten; `mapping.json` added                                                                                                                                                                         |
| `scripts/gen_tokens.py`                                   | New                                                                                                                                                                                                                                      |
| `packages/ui-kit/src/__tests__/tokens.test.ts`            | Drift baseline replaced with sync verification                                                                                                                                                                                           |
| `apps/web/src/__tests__/design-system-guardrails.test.ts` | New                                                                                                                                                                                                                                      |
| `docs/design-system/03-tokens.md`                         | Corrected (it asserted the false source of truth)                                                                                                                                                                                        |
