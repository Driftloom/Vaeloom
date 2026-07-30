# MCP Server: Memory Server

## Tools

### `memory_store`
Store a memory item with embeddings.
```json
{
  "content": "string — the content to store",
  "type": "enum(document|email|code|note)",
  "tags": "string[] — optional tags",
  "tenant_id": "UUID — tenant context"
}
```

### `memory_search`
Search memories by semantic similarity.
```json
{
  "query": "string — search query",
  "limit": "number — max results (default 10)",
  "min_score": "number — minimum similarity (0-1)"
}
```

### `memory_get`
Retrieve a specific memory by ID.

## Resources
- `memory://{id}` — Individual memory resource
- `memory://tenant/{tenantId}/recent` — Recent memories for tenant
