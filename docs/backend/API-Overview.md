# API Reference

> **Purpose:** Central index for Vaeloom API documentation, SDK references, and
> integration guides **Status:** ✅ Published **Owner:** Platform Team
> **Version:** 2.0 **Last Updated:** 2026-07-17

## Overview

Vaeloom exposes a comprehensive REST API for programmatic access to memory,
agents, knowledge graph, and workspace functionality. The API is versioned,
authenticated, and follows RESTful conventions.

## API Documentation

| Document                                  | Description                         |
| ----------------------------------------- | ----------------------------------- |
| [API Architecture](./API-Architecture.md) | API design principles and patterns  |
| [API Reference](./API-Reference.md)       | Complete API endpoint reference     |
| [API Versioning](./API-Versioning.md)     | Versioning strategy and lifecycle   |
| [REST Standards](./REST-Standards.md)     | REST conventions and best practices |
| [GraphQL](./GraphQL.md)                   | GraphQL integration details         |
| [Authentication](./Authentication.md)     | Auth patterns and token management  |
| [Rate Limiting](./Rate-Limiting.md)       | Rate limit policies                 |

## SDKs

| SDK                                    | Language     | Status    | Package        |
| -------------------------------------- | ------------ | --------- | -------------- |
| [TypeScript SDK](../../sdk/typescript) | TypeScript   | ✅ Alpha  | `@vaeloom/sdk` |
| [Python SDK](../../sdk/python)         | Python 3.12+ | ✅ Alpha  | `vaeloom-sdk`  |
| [REST API](../../sdk/rest-api)         | HTTP         | ✅ Stable | N/A            |

## Quick Start

```typescript
import { VaeloomClient } from '@vaeloom/sdk';

const client = new VaeloomClient({ apiKey: 'your-api-key' });
const status = await client.healthCheck(); // "ok"
```

## OpenAPI Sync (keep the spec + reference current)

`openapi.yaml` (241 paths / 294 ops, regen 2026-09-21) is generated from code —
`scripts/gen_openapi.py` imports `apps/api/src/api/main.py` with mock env vars,
so it runs offline. After any router change:

```bash
python scripts/gen_openapi.py   # from repo root
# verify: 241 paths (count ^  / keys), 294 ops
```

Then update [API-Reference.md](./API-Reference.md) (matching router table +
header counts). Excluded by design: the 10 enterprise-gated routers
(`enterprise_routes_enabled=true` only) — billing, plugins, analytics, audit,
iam, recommendations, webhooks, admin_console, scim, feature_flags. Local-dev
companion: [Local-Development.md](./Local-Development.md).

> _Last verified: 2026-09-15._

## Related Documents

- [SDK Documentation](../SDK-Documentation.md)
- [Integration Guide](../Integration-Guide.md)
- [Backend Architecture](./Backend-Architecture.md)
