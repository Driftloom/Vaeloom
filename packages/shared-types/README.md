# @vaeloom/shared-types

Canonical TypeScript types shared across the Vaeloom monorepo (v0.1.0, private
workspace package). Imported by `apps/web` (`lib/api.ts`, `lib/api-client.ts`)
and any other TS package needing the domain model.

## Install

Workspace-only (not published to npm):

```bash
pnpm install
# then: import type { Memory } from "@vaeloom/shared-types";
```

No runtime dependencies — types only.

## Usage

```typescript
import type { Memory, Agent, PaginatedResponse } from '@vaeloom/shared-types';

const page: PaginatedResponse<Memory> = await api.get('/api/v1/memory');
```

Re-exported modules (`src/index.ts`): `types/domain`, `types/memory`,
`types/agent`, `types/event`, `types/api`, `types/auth`, `types/auth-dto`,
`types/workspace`, `types/tenant`, `types/connector`.

Note: the SDKs (`sdk/typescript`, `sdk/python`) currently carry their own
minimal `Memory`/`Agent` copies and do NOT depend on this package — unify on
`@vaeloom/shared-types` when the SDKs next rev. The package name
`packages/sdk-types` does not exist; do not reference it.
