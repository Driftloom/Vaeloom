# Memory & Sync Production Overhaul — Design Spec

**Date:** 2026-10-18
**Status:** Approved for plan
**Scope:** `apps/web/src/app/workspace/[workspaceId]/memory/**`, `apps/web/src/components/memory/**`, vault-sync FE + BE, memory/agent/chat integration touchpoints.
**Audit:** see plan `docs/superpowers/plans/2026-10-18-memory-sync-production-overhaul.md` (scores: Memory FE 5/10, Sync 4.5/10, Memory BE 7/10, Design adherence 4/10, Integration 6/10, Overall 5/10).

---

## 1. Root cause: the phantom token vocabulary

Every memory-area surface was written against `var(--color-*)` CSS custom properties —
`--color-surface`, `--color-text-primary`, `--color-text-muted`, `--color-text-secondary`,
`--color-surface-subtle`, `--color-surface-sunken`, `--color-surface-hover`,
`--color-border`, `--color-border-strong`, `--color-brand-primary`.

**None of these exist at runtime.** They are the naming used in the *generated design-record JSON*
(`packages/ui-kit/src/tokens/themes/*.json`, produced by `scripts/gen_tokens.py` from
`globals.css`). Their only potential emitter, `generateCssVariables()` in
`packages/ui-kit/src/tokens/index.ts`, has zero callers. The runtime vocabulary is the bare
space-separated RGB triplet in `globals.css` (`--surface: 8 8 10;` …) exposed to components
exclusively through `tailwind.config.ts` semantic color classes.

Consequence: 447 class usages + ~53 inline-style usages across **11 files** (all inside the
memory area) silently drop their declaration at computed-value time. Borders vanish, panel
fills collapse into the canvas, text colors inherit — in light theme this is obvious, in dark
theme it reads as "flat and broken".

### 1.1 Canonical mapping table (binding for all lanes)

| Phantom (never do this) | Runtime truth | Tailwind class (use this) |
|---|---|---|
| `var(--color-text-primary)` | `rgb(var(--text))` | `text-text` |
| `var(--color-text-secondary)` | `rgb(var(--text-secondary))` | `text-text-secondary` |
| `var(--color-text-muted)` | `rgb(var(--text-muted))` | `text-text-muted` (fill: `fill-text-muted`, bg: `bg-text-muted`) |
| `var(--color-border)` | `rgb(var(--border))` | `border-border` / `divide-border` |
| `var(--color-border-strong)` | `rgb(var(--border-strong))` | `border-border-strong` |
| `var(--color-surface)` | `rgb(var(--surface))` | `bg-surface` |
| `var(--color-surface-subtle)` | `rgb(var(--surface-100))` (JSON: `--color-bg-subtle`) | `bg-surface-100` |
| `var(--color-surface-sunken)` | `rgb(var(--surface-50))` (JSON: `--color-bg-sunken`) | `bg-surface-50` |
| `var(--color-surface-hover)` | `rgb(var(--surface-hover))` | `bg-surface-hover` |
| `var(--color-brand-primary[, #818cf8])` | `rgb(var(--accent))` (#818CF8 dark) | Tailwind: `text-accent` / `bg-accent` / `border-accent`; inline style: `rgb(var(--accent))` |
| `var(--color-focus-ring)` | exists — valid | keep |

Rules:
1. Prefer the Tailwind class. Inline `style={}` must use `rgb(var(--x))` (triplets need `rgb()`).
2. Repo idiom wins: `text-text*` (203/176/67 files) over `text-foreground` (3 files).
3. No new CSS variables may be added for this fix — zero globals.css additions.
4. `var(--color-` must never appear in the memory area again — enforced by guardrail test.
5. **Foreground pairing (design review amendment 2):** any token fill takes its `-fg` partner — `bg-accent` ⇒ `text-accent-fg`, `bg-error` ⇒ `text-error-fg`, same for `success/warning/info/ai-proposed/ai-processing`. `text-white` on a token fill is banned (HC: `--accent-fg` is `0 0 0` on `#FFFF00`, `globals.css:317-320`; white on it measures ~1.07:1). All `-fg` tokens verified present in all 3 themes (`globals.css:92-133, 207-240, 320-347`).

## 2. Semantic palette for the knowledge graph

The graph canvas currently invents 9 hexes (`GraphViewer.tsx:12-21`) and the legend another 6
(`graph/page.tsx:59-79`). Replacement is keyed to the **real node taxonomy** — the union is
`concept, entity, document, topic, person, organization, event, project`
(`GraphViewer.tsx:10-22`); the current legend renders only 6 of the 8.

| Node type | Fill family | Shape / second channel |
|---|---|---|
| entity | `accent` | circle |
| concept | `ai-proposed` | dashed circle (HC fill ≡ accent: both `#FFFF00`, `globals.css:317`/`:342`) |
| document | `info` | rect |
| event | `ai-processing` | diamond (HC fill ≡ info: both `#00CCFF`, `globals.css:337`/`:345`; dark near-dupes `:115`/`:131`) |
| topic | `success` | hexagon |
| project | `surface-400` fill + `border-strong` stroke | rect |
| person | `surface-300` fill + `border-border` stroke | circle |
| organization | `surface-200` fill + `border-border` stroke | hexagon |

Rules (binding for Task D):
1. **Node color is never the only identity channel where themes collapse.** The colliding
   family pairs above carry shape/dash differentiation, and the Task D test asserts
   per-theme pairwise-distinct `(fill, stroke-dash, shape)` across all 8 types.
2. `warning`/`error` hues are reserved for UI state (conflicts, errors) — never node fills
   (no amber on humans/orgs; design review taste #1 auto-decided).
3. `accent` = entity fill; **selection is a ring + scale treatment**, not a color swap
   (design review taste #2 auto-decided).
4. Legend renders from the SAME const map as nodes; test asserts legend covers every
   rendered type. Edges use `border`/`border-subtle` only — `border-strong` belongs to
   neutral node strokes (fixes neutral-node ≈ edge-stroke collision, design review finding 4).
5. Hex literals in SVG `fill=`/`stroke=` attributes also become `rgb(var(--accent))` etc. or
   `currentColor` via class. One source for nodes + legend + swatches.

## 3. Honesty rules for copy and badges (binding)

Anything rendered must trace to a real API field or a real local capability:

- No invented versions ("v1.0.0 Native"), no invented paths (`~/Documents/VaeloomVault`), no
  invented activity ("Watcher daemon is listening…"), no invented install state ("Installed" /
  "Installed & Active"), no invented cadence ("30s auto-push & rebase").
- Truncated data must say so: graph badge prints `Showing 20 of N` when the API page is
  smaller than the reported total, else plain counts.
- A fetch that failed is never rendered as "empty" or "not connected". Each async surface
  gets an explicit error state with retry.
- The `sync_vault` agent tool must not write fabricated timestamps or `in_sync` state into
  connector config. It reports what it actually did (request recorded / status read), and the
  test that currently asserts fabrication is rewritten to assert honesty.

## 4. State model required on every async surface

`idle → loading → (ready | ready(stale) | empty | error)` with:

- **Error**: message + `Retry` button (re-issues the SWR mutate). Never a false empty.
- **Ready(stale) (design review amendment 6):** on a failed SWR *revalidation* with last-good
  `data` still in cache, do NOT blank the surface — keep data, show a stale marker/toast.
  `ErrorState` renders only when there is no data (`!data`). Test: data-then-reject.
- **Ready-but-truncated**: total + "Load more" (list) or "Showing X of N" (graph).
- **Empty**: distinct copy per surface; "no memories yet", not "ready".
- Optimistic mutations (status change, delete) roll back and surface error toasts.
- **Search state contract (design review amendment 5):** `POST /memories/search` returns a bare
  `list[{memory, score}]` with NO `total` (`routers/memory.py:868-904`) and defaults
  `top_k=10, threshold=0.7` (`schemas/memory.py:156-157`). Therefore: pin an explicit `top_k`;
  copy says "No strong matches" (threshold truth), never "No records match"; results labeled
  "top N matches" when the cap is hit; search is imperative (not SWR) so failure renders
  `ErrorState` explicitly; surface `aria-busy` while in flight.
- **New fetches in the vault panel (history, devices):** same D13 treatment — loading skeleton,
  `ErrorState` + Retry, `total`-driven "Showing X of N"/Load more; Resolve and "Request sync"
  disabled while in flight.

## 5. Typography / surface hierarchy (usage rules inside memory area)

- Canvas `bg-background` → panel `bg-surface` → raised `bg-surface-elevated` **plus**
  `shadow-card`/`shadow-elevated` → wells/code `bg-surface-100` → `bg-surface-200` (nested).
  (Design review amendment 4: `surface-elevated` is byte-identical to `surface` in light and
  to `surface-100` in dark/HC, and `surface-50` ≡ `surface` in HC — fill alone can never
  separate those rungs, so raised requires shadow and `surface-50` is dropped from well
  guidance. Token values: `globals.css:42-50, 166-174, 274-282`.)
- Borders: default `border-border`; hairlines `border-border-subtle`; emphasis/interactive
  hover `border-border-strong`.
- Text: primary `text-text`, secondary `text-text-secondary`, meta `text-text-muted`,
  tertiary-only `text-text-dim` (never for body copy).
- Accent is a signal (links, active node, focus), never a background for large areas other
  than chips. Chip rule: `bg-accent text-accent-fg` (§1.1 rule 5). Status colors from
  `success/warning/error/info` + `ai-*` families only.
- **Markdown follows theme via the installed `.markdown-body`** (`globals.css:529-567`),
  NOT `prose`/`prose-invert` — `@tailwindcss/typography` is not installed
  (`tailwind.config.ts:392` plugins: []; the dead-class incident is documented at
  `globals.css:522-528`; live site `[memoryId]/page.tsx:283`). (Design review amendment 3.)

## 6. Accessibility & motion

- WCAG 2.1 AA: 4.5:1 body text — the swap to semantic tokens now honors the tuned palettes
  per theme (previously unresolved vars inherited whatever contrast happened to exist).
- All new interactive elements: visible focus ring (`--color-focus-ring` utilities), ≥44px
  touch targets on mobile (`MIN_TOUCH_TARGET` from ui-kit exists).
- `motion-reduce:transition-none` on new transitions.

## 7. Guardrail

New Jest test `apps/web/src/__tests__/design-tokens.guardrail.test.tsx` scans
`src/app/**/memory/**` and `src/components/memory/**` sources, EXCLUDING `__tests__/**` and
`*.test.*` files (honesty tests legitimately embed phantom strings as negative fixtures), and
fails if:

1. `var(--color-` appears other than the allowlisted `var(--color-focus-ring)` usage, or
2. a raw `#rrggbb` hex literal appears in ANY string literal of a scanned file — not just
   `className=`/`style=` (the graph palette hexes live in const maps and `fill=`/`stroke=`
   attributes: `GraphViewer.tsx:12-21`, `graph/page.tsx:59-79`), or
3. a numeric `rgb(<digit…` / `rgba(<digit…` literal appears (only `rgb(var(--…)` is legal) —
   hex-only bans are evadable (design review amendment 8).

This is a source scan, same spirit as the existing honesty tests; it must fail before the
fixes land and pass after.

## 8. Explicitly out of scope (design)

- Rewiring `packages/ui-kit` token JSON pipeline for the whole app (separate effort).
- Adopting unused `MemoryEntity` / `MemoryRelationship` / `MemoryEvidence` ui-kit components
  (noted for a future graph rebuild; not required for correctness).
- Publishing `@vaeloom/vault-sync` npm package (copy must stay honest instead).
- `packages/agent-memory` modularization.
