# API Reference

> **Purpose:** Central index for Vaeloom API documentation, SDK references, and integration guides
> **Status:** ✅ Published
> **Owner:** Platform Team
> **Version:** 2.0
> **Last Updated:** 2026-07-17

## Overview

Vaeloom exposes a comprehensive REST API for programmatic access to memory, agents, knowledge graph, and workspace functionality. The API is versioned, authenticated, and follows RESTful conventions.

## API Documentation

| Document | Description |
|---|---|
| [API Architecture](../Backend/API-Architecture.md) | API design principles and patterns |
| [API Reference](../Backend/API-Reference.md) | Complete API endpoint reference |
| [API Versioning](../Backend/API-Versioning.md) | Versioning strategy and lifecycle |
| [REST Standards](../Backend/REST-Standards.md) | REST conventions and best practices |
| [GraphQL](../Backend/GraphQL.md) | GraphQL integration details |
| [Authentication](../Backend/Authentication.md) | Auth patterns and token management |
| [Rate Limiting](../Backend/Rate-Limiting.md) | Rate limit policies |

## SDKs

| SDK | Language | Status | Package |
|---|---|---|---|
| [TypeScript SDK](../../sdk/typescript) | TypeScript | ✅ Alpha | `@vaeloom/sdk` |
| [Python SDK](../../sdk/python) | Python 3.12+ | ✅ Alpha | `vaeloom-sdk` |
| [REST API](../../sdk/rest-api) | HTTP | ✅ Stable | N/A |

## Quick Start

```typescript
import { VaeloomClient } from '@vaeloom/sdk';

const client = new VaeloomClient({ apiKey: 'your-api-key' });
const status = await client.healthCheck(); // "ok"
```

## Related Documents

- [SDK Documentation](../SDK-Documentation.md)
- [Integration Guide](../Integration-Guide.md)
- [Backend Architecture](../Backend/Backend-Architecture.md)
