# Finding: Memory Write Path Broken

| Metadata           | Value       |
| ------------------ | ----------- |
| **ID**             | FINDING-003 |
| **Severity**       | P0-CRITICAL |
| **Status**         | OPEN        |
| **Date**           | 2026-08-16  |
| **Assigned Phase** | P07         |
| **Owner**          | AI Team     |

## Description

The memory agent extracts entities from user input but never persists them to
the database. The core product feature (memory) is non-functional at the
persistence layer.

## Evidence

- `memory_agent/extraction.py` — LLM-based entity extraction works
- `memory_agent/handler.py` — `execute()` method calls extraction but the write
  path to `memory_records` and `knowledge_nodes` is broken
- No INSERT statements in the memory write path
- Knowledge graph and vector store are empty shells in production

## Impact

Users can input data but it's never stored. The "memory-first" product promise
is broken. All downstream features (RAG, knowledge graph, agent context) have no
data to work with.

## Remediation

1. Debug the memory write path in `memory_agent/handler.py`
2. Ensure extracted entities are INSERTed into `knowledge_nodes` and
   `knowledge_edges`
3. Ensure embeddings are upserted into the `embeddings` table
4. Write integration tests that verify end-to-end memory persistence

## Related

- `docs/04-memory-knowledge-graph.md` — memory architecture
- `docs/architecture/Data-Flow.md` — ingestion pipeline
