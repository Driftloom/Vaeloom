# @vaeloom/ui-kit

Shared React component library for the Vaeloom web app (v0.1.0, private
workspace package). Consumed by `apps/web` via `transpilePackages` in
`next.config.js` — no separate build or publish step.

## Install

Workspace-only (not published to npm):

```bash
pnpm install
# then in apps/web: import { Button } from "@vaeloom/ui-kit";
```

Peer dependencies: `react ^18.3.0 || ^19.0.0`, `react-dom ^18.3.0 || ^19.0.0`.

## Usage

```tsx
import { Button, Card, Input, Modal, Spinner } from '@vaeloom/ui-kit';

<Card>
  <Input placeholder="Search" />
  <Button>Go</Button>
</Card>;
```

Current exports (`src/index.ts`): `Button`, `Card`, `Input`, `Modal`, `Spinner`
(+ `ButtonProps`, `CardProps`, `InputProps`, `ModalProps`). Everything else in
`docs/frontend/Component-Library.md` (Table, Form, ProposalCard, AgentStatus,
...) is a spec target, not implemented — check `src/index.ts` before importing
anything not listed here.

## Tokens: which one is real

`src/tokens/` is the **design source of record, not the runtime source**.

- Runtime authority: `apps/web/src/styles/globals.css`.
- This package's JSON (`primitives.json`, `semantic.json`, `component.json`,
  `themes/*.json`) is never imported by the app build. `generateCssVariables()`
  has no callers outside its own test.
- The two engines are not aligned. Against the current `globals.css`: colour is
  disjoint (only `--color-focus-ring` and `--color-focus-ring-offset` exist in
  both, value-identical); `--radius-*` / `--elevation-*` are aligned across
  both; `--space-*`, `--font-size-*` and `--font-weight-*` exist only here. Do
  not assume a `--color-*` name from this package reaches the DOM.

`TOKEN_SOURCE_OF_TRUTH` is exported from the package root for code that wants to
assert on this rather than trust a comment.

## Accessibility

- Icon-only and text-only controls carry `min-h-6 min-w-6` (24px, WCAG 2.5.8 AA)
  via the shared `MIN_TOUCH_TARGET` constant in
  `src/components/layout/touchTarget.ts`. Use it instead of ad-hoc padding.
- Validation props (`error`, `hint`) must set `aria-invalid`, `aria-describedby`
  and a `role="alert"` message. A dropped `error` prop is a bug.
