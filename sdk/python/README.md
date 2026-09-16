# vaeloom-sdk

Python client for the Vaeloom REST API (v0.1.0). Synchronous
(`httpx.Client`-backed) `VaeloomClient` with pydantic models for memory CRUD,
agent listing, and health checks.

## Install

```bash
pip install vaeloom-sdk==0.1.0
```

Requires Python >= 3.12. Dependencies: `httpx>=0.27.0`, `pydantic>=2.7.0`.

## Usage

```python
from vaeloom import VaeloomClient, MemoryQuery

client = VaeloomClient(api_key="...", base_url="http://localhost:8000")
mem = client.create_memory({"title": "Q4 notes", "type": "note"})
hits = client.search_memories(MemoryQuery(query="Q4", limit=5))
```

Default `base_url` is `https://api.vaeloom.dev`. All methods are blocking
(`def`, not `async def`).

## API

- `create_memory(data) -> Memory` (POST `/api/v1/memory`)
- `get_memory(memory_id) -> Memory` (GET `/api/v1/memory/{id}`)
- `search_memories(MemoryQuery) -> PaginatedResponse[Memory]` (POST
  `/api/v1/memory/search`)
- `list_agents() -> list[Agent]` (GET `/api/v1/agents`)
- `health_check() -> str` (GET `/health`)

401/403 raise `PermissionError`, 429 raises `Exception`, anything else raises
`httpx.HTTPStatusError`. There is deliberately NO `execute_agent`, no
`delete_memory`, and no generic `request()` in this release — see
`docs/SDK-Documentation.md` section 10 for the roadmap boundary.
