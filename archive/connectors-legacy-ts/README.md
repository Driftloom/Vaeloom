# Archived — Legacy TS Connectors

**Archived:** 2026-08-27 per ADR-036/037 (orphaned, never wired into the main
API); full package trees moved here 2026-10-22 per ADR-048. See `DEPRECATED.md`
in this dir before touching anything below. The content that follows is
historical reference for the original package design.

# Vaeloom Connectors

Unified connector architecture for integrating with external data sources and AI
services.

## Architecture

```
connectors/ (historical layout, now under archive/)
├── rest/          # REST API connector with auth, pagination, rate limiting
├── graphql/       # GraphQL connector with introspection and query builder
└── mcp/           # Model Context Protocol connector — moved to archive/connectors-mcp-ts/mcp/
```

Each connector follows the same lifecycle:

1. **connect(config)** — Initialize transport, auth, and configuration
2. **query/fetch/call** — Perform data operations
3. **disconnect()** — Clean up resources

## Connector Comparison

| Feature         | REST                   | GraphQL             | MCP                        |
| --------------- | ---------------------- | ------------------- | -------------------------- |
| Transport       | HTTP/HTTPS             | HTTP/HTTPS          | stdio / streamable-http    |
| Auth Strategies | API Key, OAuth2, Basic | Headers passthrough | N/A (transport-level)      |
| Pagination      | Offset, Cursor, Page   | N/A                 | N/A                        |
| Rate Limiting   | Token bucket           | N/A                 | N/A                        |
| Retry           | Exponential backoff    | N/A                 | N/A                        |
| Introspection   | N/A                    | Full schema         | tools/list, resources/list |
| Query Building  | Manual                 | Builder + raw       | N/A                        |

## Usage Guide

All connectors share a common pattern:

```typescript
const connector = new RestConnector(); // or GraphQLConnector, McpConnector
await connector.connect({ ... });
const data = await connector.fetch(...); // or .query(), .callTool()
await connector.disconnect();
```

### Error Handling

All connectors throw typed errors with descriptive messages. Wrap calls in
try/catch:

```typescript
try {
  const data = await connector.fetch('/users');
} catch (err) {
  if (err.message.startsWith('Not connected')) {
    // Reconnect logic
  }
}
```

### Testing

Each connector has unit tests in `src/__tests__/` using Jest and mock adapters.

```bash
cd connectors/<type>  # historical; tree now lives in archive/
pnpm test
```
