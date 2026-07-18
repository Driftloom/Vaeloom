# MCP Tool Registry

## Agent Tools

| Tool | Input | Output | Rate Limit |
|---|---|---|---|
| `memory.store` | `{content, type, tags}` | `{memory_id}` | 100/min |
| `memory.search` | `{query, limit}` | `{results[]}` | 200/min |
| `memory.delete` | `{memory_id}` | `{success}` | 50/min |
| `graph.query` | `{query, depth}` | `{nodes[], edges[]}` | 50/min |
| `graph.add_node` | `{label, type, properties}` | `{node_id}` | 50/min |
| `graph.add_edge` | `{source, target, relationship}` | `{edge_id}` | 100/min |
| `document.parse` | `{content, format}` | `{sections[], metadata}` | 50/min |
| `search.web` | `{query}` | `{results[]}` | 30/min |
| `email.send` | `{to, subject, body}` | `{message_id}` | 20/min |
| `calendar.query` | `{date_range}` | `{events[]}` | 30/min |
