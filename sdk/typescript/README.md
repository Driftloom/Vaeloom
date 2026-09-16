# @vaeloom/sdk

TypeScript client for the Vaeloom REST API (v0.1.0). Axios-backed
`VaeloomClient` with typed helpers for memory CRUD, agent listing/execution,
health checks, and a raw `request()` escape hatch.

## Install

```bash
pnpm add @vaeloom/sdk@0.1.0
```

Requires Node >= 20 (repo pins v20.14.0 in `.nvmrc`). Peer dependency:
`axios ^1.7.0` (bundled as a direct dependency).

## Usage

```typescript
import { VaeloomClient } from '@vaeloom/sdk';

const client = new VaeloomClient({ apiKey: process.env.VAELOOM_API_KEY });
const mem = await client.createMemory({ title: 'Q4 notes', type: 'note' });
const hits = await client.searchMemories({ query: 'Q4', limit: 5 });
```

Point at local dev with
`new VaeloomClient({ baseUrl: "http://localhost:8000", apiKey: ... })` (default
is `https://api.vaeloom.dev`).

## API

- Memory: `createMemory(data)`, `getMemory(id)`,
  `searchMemories({ query, filters?, limit?, offset?, minScore? })`,
  `deleteMemory(id)`
- Agents: `listAgents()`, `executeAgent(agentId, input)`,
  `getAgentStatus(agentId)`
- Infra: `healthCheck()`, `request(config)` (axios passthrough)
- Types: `Memory`, `MemoryQuery`, `Agent`, `AgentExecution`, `Workspace`,
  `PaginatedResponse`, `MemoryStatus`, `AgentStatus`

Only 401/403/429 are classified (`Authentication failed` / `Permission denied` /
`Rate limit exceeded`); all other failures surface as axios errors. No retries,
no OAuth, no query builder — see `docs/SDK-Documentation.md` section 10 for the
roadmap boundary.
