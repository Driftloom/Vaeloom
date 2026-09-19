# `@vaeloom/queue`

Queue abstraction layer and client utilities for asynchronous background jobs.

## Status & Architecture Note

- **Current Production Architecture:** Primary durable workflow and asynchronous job execution is orchestrated by **Temporal** (`apps/api/src/api/temporal/` per ADR-038).
- **This Package:** Provides TypeScript-side queue interfaces and BullMQ definitions used for lightweight pub/sub tasks or legacy workers.

See [`specs/temporal/catalog.md`](../../specs/temporal/catalog.md) for the authoritative background execution contract.
