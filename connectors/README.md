# Vaeloom Connectors

Unified connector architecture for integrating with external data sources and AI services.

## Architecture

```
connectors/
├── rest/          # REST API connector with auth, pagination, rate limiting
├── graphql/       # GraphQL connector with introspection and query builder
└── mcp/           # Model Context Protocol connector (JSON-RPC 2.0)
```

Each connector follows the same lifecycle:

1. **connect(config)** — Initialize transport, auth, and configuration
2. **query/fetch/call** — Perform data operations
3. **disconnect()** — Clean up resources

## Connector Comparison

| Feature            | REST          | GraphQL       | MCP           |
|--------------------|---------------|---------------|---------------|
| Transport          | HTTP/HTTPS    | HTTP/HTTPS    | stdio / SSE   |
| Auth Strategies    | API Key, OAuth2, Basic | Headers passthrough | N/A (transport-level) |
| Pagination         | Offset, Cursor, Page | N/A       | N/A           |
| Rate Limiting      | Token bucket  | N/A           | N/A           |
| Retry              | Exponential backoff | N/A     | N/A           |
| Introspection      | N/A           | Full schema   | tools/list, resources/list |
| Query Building     | Manual        | Builder + raw | N/A           |

## Usage Guide

All connectors share a common pattern:

```typescript
const connector = new RestConnector(); // or GraphQLConnector, McpConnector
await connector.connect({ ... });
const data = await connector.fetch(...); // or .query(), .callTool()
await connector.disconnect();
```

### Error Handling

All connectors throw typed errors with descriptive messages. Wrap calls in try/catch:

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
cd connectors/<type>
pnpm test
```
