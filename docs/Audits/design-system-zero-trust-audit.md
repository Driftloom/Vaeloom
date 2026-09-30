# Design System — Completion Record

Zero-trust audit and remediation, 2026-09-30. Every number here is measured from
the repository or from generated CSS, not carried over from prior reports.

---

## 1. The premise was wrong, and that changed the work

The brief assumed shadcn/ui, Radix and `class-variance-authority`. **None are
installed.** The stack is:

| Layer        | Reality                                                           |
| ------------ | ----------------------------------------------------------------- |
| Framework    | Next.js 15 App Router, React 18, TypeScript 5.5                   |
| Styling      | Tailwind CSS 3.4 (`plugins: []`), one `globals.css`               |
| Components   | Hand-rolled: `packages/ui-kit` + `apps/web/src/components/shared` |
| State / data | SWR + `@/lib/api-client`                                          |
| Motion       | `motion` v13, CSS keyframes                                       |
| Icons        | 39 hand-written SVG components in `packages/ui-kit/src/icons`     |
| Tokens       | 89 CSS custom properties, 3 themes + `prefers-contrast`           |
| Tests        | Jest 115 (web) + 157 (ui-kit), Playwright e2e                     |

The design system already existed and was competent. The defects were that
**~150 Tailwind classes were used but never declared**, **144 lines of UTF-8
corruption were shipping as UI text**, and **three hand-maintained sources of
truth had drifted**.

---

## 2. Gates

| Gate                                                    | Result             |
| ------------------------------------------------------- | ------------------ |
| `apps/web` typecheck                                    | clean              |
| `apps/web` jest                                         | 115/115, 11 suites |
| `packages/ui-kit` jest                                  | 157/157, 4 suites  |
| `packages/ui-kit` tsc                                   | clean              |
| Token drift (`gen_tokens.py --check`)                   | in sync            |
| Mojibake sweep (`apps/web/src`)                         | 0 files            |
| Previously-dead Tailwind classes in generated CSS       | 15/15 now emitted  |
| Pages hand-rolling `<h1>` outside documented exemptions | **0** (was 36)     |

---

## 3. What was fixed

### 3.1 Classes that rendered nothing

`tailwind.config.ts` had `plugins: []`, so every Tailwind-v4-or-plugin class
purged. All were either given their real value or moved onto the scale.

| Class                                      | Files | Resolution                                                                                                         |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------ |
| `shadow-xs`                                | 78    | `0 1px 2px 0 rgb(0 0 0/0.05)` — equals v4 `shadow-xs` == v3 `shadow-sm`                                            |
| `py-0.2`                                   | 38    | `spacing['0.2'] = 0.05rem` (0.2 × the 0.25rem step)                                                                |
| `destructive`                              | 11    | **Was a whole missing colour family.** `cognition`'s three error banners rendered unstyled. Aliased onto `--error` |
| `bg-primary-hover` / `border-border-hover` | 13    | `var(--primary-400)` / `var(--border-strong)`                                                                      |
| `animate-in` / `zoom-in-95`                | 8     | `animate-fade-in` / `animate-scale-in` (keyframes already in config)                                               |
| `no-scrollbar` / `scrollbar-none`          | 6     | `scrollbar-width: none` + WebKit pseudo                                                                            |
| `prose`                                    | 1     | `.markdown-body`, token-themed. `ReactMarkdown` previews were unstyled walls of text                               |
| `backdrop-blur-xs`, `w-18`, `h-18`         | 4     | `backdrop-blur-sm`; `w-20`/`h-20` (moved **onto** the scale, not extended)                                         |

`content` globs omitted `src/lib`, `src/hooks`, `src/trigger`, `src/__tests__`,
so valid classes used only there were purged. Fixed.

### 3.2 Mojibake — 144 lines, 14 files

A UTF-8 double-decode shipping as UI text: `matcher_core = cosine Ã— proximity`,
`✓ Clean` rendering as `âœ“ Clean`, `INR (â‚¹)`.

Repaired with a self-validating decoder: each run is only replaced if it
round-trips to clean printable text, and 57 runs that were not safely reversible
were refused and handled explicitly. Verified with a differential pass over all
14 files — **0 punctuation deltas**, so no operator or token was damaged.

### 3.3 Token authority

`apps/web/src/styles/globals.css` is now the single source; the ui-kit JSON is
generated from it and drift-checked in CI. **66 drifted colour values
corrected.**

The generator immediately found two real bugs:

- **High-contrast never overrode `--color-focus-ring`**, so HC users inherited
  the dim indigo `#818cf8` instead of `#ffff00` — a contrast regression in the
  theme that can least afford it. The hand-authored JSON had the _right_ value,
  so the record looked correct while the runtime was wrong.
- **`--error-active`** was dereferenced by `semantic.json` and `component.json`
  but declared nowhere. Deleting it reproduced the dangling-`var()` regression
  the existing test guards against, so the gap was closed in `globals.css` (all
  3 themes) and `ui-kit` `Button` now consumes it instead of `bg-error/80`.

**15 AI semantic colours** (`proposed`/`processing`/`verified`/`needs-review`/
`blocked`) existed only as design record. `globals.css` now defines all 15 in
all 3 themes, and `tailwind.config.ts` exposes them. Design-record-only names
fell from **17 → 2** (the alpha-less scrim, and `text-inverse`).

Only three hues are new — `verified`, `needs-review` and `blocked` deliberately
alias success/warning/error, because a grounded citation _is_ a success and a
blocked tool call _is_ an error.

### 3.4 Component convergence

Three competing surfaces, resolved to two ordered ones:

1. `packages/ui-kit` — canonical implementations
2. `apps/web/src/components/shared` — thin pass-throughs (must not fork)
3. `globals.css` `@layer components` — class aliases, byte-aligned with ui-kit

| Fix                                 | Detail                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared/Tabs`                       | Was hardcoding `variant="underline"` and dropping `icon`/`badge`/`size`/`ariaLabel` — a silent API narrowing is what forces callers to route around a wrapper. Now a complete pass-through |
| `shared/Toggle`                     | Two switch widgets shipped (`h-6 w-11` vs `h-5 w-9`); `Toggle` also omitted `MIN_TOUCH_TARGET`. Now delegates to the accessible `Switch`                                                   |
| `shared/StatusBadge`                | Forked ui-kit's `Badge` with 4 duplicated variants. Now derives from it                                                                                                                    |
| `shared/Table`                      | Forwarded `sortable` but had no `sortBy`/`sortDir`/`onSort`, so `DataTable` rendered sort buttons that did nothing. Now forwarded — 6 columns in `organizations` actually sort             |
| `shared/SearchInput`, `ProgressBar` | Now delegate to `SearchField` / `Progress` (a `warning` variant was added rather than collapsing the tier)                                                                                 |
| `CommandCenter`                     | Hand-rolled `role="dialog"` with no portal, focus trap or scroll lock. Now uses `ui-kit Modal`                                                                                             |
| `TopNav` breadcrumb                 | Hand-rolled → `ui-kit Breadcrumb` (`<ol>/<li>` + `aria-current`)                                                                                                                           |
| `'use client'`                      | Added to 4 ui-kit files using hooks without it, incl. `Switch` which ships to app code                                                                                                     |
| Dead code                           | Deleted `shared/Badge.tsx`, `shared/Citation.tsx` (0 importers); moved `Modal.spec.tsx` to where the component it tests lives                                                              |

**Trade-off accepted:** ui-kit `Breadcrumb` renders `<a href>`, not `next/link`,
so the workspace crumb in `TopNav` does a full document load instead of a client
transition. The alternative was keeping a duplicate hand-rolled nav.

### 3.5 Heading structure — 29 styles → 1

The app had **29 distinct `<h1>` className strings**. `PageHeader` existed, was
correct, and had **0 consumers**.

- Hardened `PageHeader` (eyebrow, breadcrumb slot, stable `h1` id, `titleId`)
- Migrated ~44 pages; `applications`/`notifications`/`schedule`/`settings` each
  had their header copy-pasted into every state branch (4/3/3/2 duplicate `h1`s)
  — hoisted to one `PageHeader` above the branches
- Two real bugs found on the way: `forgot-password` and `reset-password` had
  their `<h1>` inside a `hidden lg:flex` marketing panel, so **mobile had no
  heading at all**
- Remaining full-bleed and narrow-auth routes are documented exemptions with
  per-entry reasons

### 3.6 Honesty and accessibility

**Fabricated data presented as real** — all removed:

| Was                                                                             | Now                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `doc.scan_status \|\| 'CLEAN'` → un-scanned uploads showed a green "✓ Clean"    | 4-state model: Clean / Scanning / Quarantined / **Not reported**        |
| `decayWeight ?? 0.85` → "85.0%" under a "Half-Life Model" label                 | "not reported" (`memory/page.tsx` had already fixed this; jobs had not) |
| `liveConnectors?.length \|\| 14` → 14 connectors on an empty workspace          | real count, 0 + empty state                                             |
| webhook `pending` → rendered as green **success** + success toast               | explicit `pending` state, tone follows reality                          |
| `.catch(() => fallbackShape)` → a 500 rendered as "you have no API keys"        | `ErrorState`                                                            |
| `localStorage` as subscription state, storage key printed in the UI             | server-only; "Not reported" when absent                                 |
| success toast after a swallowed `catch`                                         | toast only on real success                                              |
| `status_code` rendered as a duration ("200ms")                                  | separate HTTP Status row                                                |
| marketplace GET path that silently **wrote** to the DB (`seed()`)               | read-only fetch                                                         |
| install state inferred from a name substring ("ats", "crawler")                 | server install records only                                             |
| `builtin_servers[0]` fallback → installed the first _unrelated_ server          | fails honestly when the named server is absent                          |
| feature-flag "Audit Trail" = a React state array                                | relabelled "This Session", states it is not a compliance record         |
| A/B testing encoded in a description string, split **inverted** vs payload      | inversion fixed; banner states A/B is not implemented                   |
| `council` shipped client-asserted `toolsInvoked` into a signed audit credential | removed; provenance limits surfaced in the UI                           |

**Accessibility:**

- `email` thread list was `onClick` on a `<div>` — **keyboard and screen-reader
  users could not read an email body**. Now a real `<button aria-pressed>`
- `config.allow_insecure` was decided **by the browser** and sent to the server.
  Removed; the server enforces it
- `customCommand.split(' ')` submitted as an executable argv → real tokenizer
  with quoting, metacharacter rejection and an explicit "starts a local process"
  confirmation
- `council`'s textarea had **no accessible name** (label wrapped only an icon)
- 4 tables were `overflow-hidden` — clipped, not scrollable
- `files` Delete Folder was `opacity-0 group-hover:opacity-100` with no focus
  state — invisible to keyboard and touch
- cognition's Reality Gap tab rendered literally `: null` (blank tab)
- Raw `text-amber-700`/`bg-violet-500/10` families (invisible on near-black) →
  token + AI families
- `focus:` → `focus-visible:` on the button ring, in both surfaces
- ~40 min-text-size `text-[9px]`/`text-[10px]` → `text-xs`
- `aria-label` added to icon-only controls across the migrated pages

**A false affordance I nearly kept:** an agent removed the documented `A`/`R`
approve/reject shortcuts from `approvals` and `help`, concluding no handler
existed. `ApprovalCard` _does_ implement it
(`role="region" tabIndex={0} onKeyDown`, covered by its spec). I verified and
restored the documentation, and added `aria-hidden` to the `<kbd>` so screen
readers don't read a stray "A".

---

## 4. Remaining debt, measured

Reported by the guardrail on every run, not hidden:

| Debt                                    | Count               | Notes                                                                              |
| --------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Pages hand-rolling `<h1>`               | **0**               | outside documented exemptions                                                      |
| Mojibake                                | **0**               | repo-wide frontend sweep                                                           |
| Undefined Tailwind classes              | **0**               | 15/15 verified in generated CSS                                                    |
| Token drift                             | **0**               | CI-gated                                                                           |
| Token names with no runtime counterpart | **2**               | `--color-bg-scrim` (`--overlay` has no alpha), `--color-text-inverse`              |
| Typography scale                        | absent              | no `--font-size-*`; this caused the 29 h1 styles                                   |
| Motion / spacing scales                 | absent              | `primitives.json` carries unconsumed ramps                                         |
| `bg-white … text-black`                 | 0 in migrated files | `schedule`, `jobs`, `files/[documentId]`, `applications` all converted             |
| Raw Tailwind palette                    | reduced             | concentrated in `connectors-catalog.tsx` (149 per-vendor brand hexes — legitimate) |

### Known open items outside frontend scope

- **`GET /documents/{id}` does not exist.** `files/[documentId]` walks pages to
  find one document. An endpoint + `documentApi.getById` is the proper fix.
- **`council.certify` requires client-supplied `agent_name` and
  `execution_id`.** Both are `BaseModel` required fields with no server
  derivation. The fabricated _values_ were removed, but the fields need to
  become optional server-side.
- **~10 response types in `api-client.ts` declare snake_case** while
  `api.request()` unconditionally runs `transformKeys`, so those fields are
  `undefined` at runtime (`version_number`, `size_bytes`, `status_code`,
  `popular_apps`, `builtin_servers`, `redirect_url`). One fix in `transformKeys`
  or in the type declarations.
- **`organizations` invitation table** sorting was added as a behaviour change,
  not just a port.

---

## 5. Anti-regression

| Mechanism                          | Fails on                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/gen_tokens.py --check`    | any token JSON drift from `globals.css`                                                                                                                                                                                                                                                                            |
| `tokens.test.ts`                   | a `runtimeDerived` value absent from the stylesheet; a `runtimeDerived` name not traceable via `mapping.json`; `runtimeDerived`/`designRecordOnly` not disjoint or not complete; themes with unequal counts; high-contrast dropping the focus ring; an unintentional change to the property count                  |
| `design-system-guardrails.test.ts` | a colour family / boxShadow key / spacing key disappearing from the config; `content` globs losing `src/lib`/`src/hooks`/`src/trigger`; CSS aliases drifting from ui-kit class strings; a bare `focus:ring-*` returning to the button; any mojibake; any U+FFFD; >1 `<h1>` per page; an exemption list that drifts |
| `a11y.test.tsx`                    | 7 runtime `PageHeader` contracts (single `h1`, landmark, type scale, stable id, `titleId`, eyebrow+actions)                                                                                                                                                                                                        |

The guardrail counts `<h1>` **after stripping comments and string literals** —
without that, three already-migrated pages stayed on the offender list because
their only `<h1` mention was in an explanatory comment.

---

## 6. Architecture decisions

| Decision                  | Choice                                                                             | Why                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token authority           | `globals.css` is the source; JSON generated                                        | It was always the only thing Tailwind read. Hand-maintained JSON changed no pixels, which is how 66 values drifted invisibly                             |
| Component authority       | `ui-kit` canonical; `shared/` and CSS are pass-throughs                            | 77 files use `.card` and 28 import `Badge`. Migrating all of them is a large regression risk; aligning the class strings removes the divergence for free |
| Colour failures           | Alias `destructive` → `--error`                                                    | One danger palette, not two                                                                                                                              |
| Radius / padding          | Converge by lifting the canonical component to match the better existing behaviour | `.card` had `sm:p-5` in 77 files. Ripping that out to match `Card`'s `p-4` would have been a silent desktop regression                                   |
| Full-bleed pages          | Exempt, with per-entry reasons                                                     | chat/capabilities/editors have no title bar; auth cards are 400px wide and a full-width header is wrong                                                  |
| Branch-exclusive headings | Listed explicitly, not tolerated silently                                          | A static scan cannot prove branch exclusivity, so the list is asserted to be exactly the set of multi-`<h1>` files                                       |
