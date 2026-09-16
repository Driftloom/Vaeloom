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
