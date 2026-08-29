# CONT-P07 — 01 Data Models / Dictionary

**Deliverable:** `DEL-CONT-P07-01` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** Data Architect + Database Engineer

## Conceptual / Logical / Physical

| Entity        | ID                     | Owner                     | Sensitivity | Provenance                  | Lifecycle                | Physical Table    | Indexes                                         |
| ------------- | ---------------------- | ------------------------- | ----------- | --------------------------- | ------------------------ | ----------------- | ----------------------------------------------- |
| Workspace     | `workspace_id UUID PK` | `user_id`                 | `tenant`    | `created_at`                | `retention 30d`          | `workspaces`      | `PK, user_id`                                   |
| Document      | `document_id UUID PK`  | `workspace_id FK CASCADE` | `PII`       | `content_hash, parsed_ref`  | `primary delete CASCADE` | `documents`       | `workspace_id, content_hash`                    |
| DocumentChunk | `chunk_id UUID PK`     | `document_id`             | `PII`       | `source_type/doc`           | `rebuild via reindex`    | `document_chunks` | `document_id, embedding ivfflat`                |
| Entity        | `entity_id UUID PK`    | `workspace_id FK`         | `PII`       | `canonical_name 0.85 dedup` | `supersession`           | `entities`        | `workspace_id+canonical_name UNIQUE, gist_trgm` |
| Memory        | `memory_id UUID PK`    | `workspace_id`            | `PII`       | `content_hash`              | `correction history`     | `memories`        | `workspace_id, type, Vector 1536`               |
| KnowledgeNode | `node_id UUID PK`      | `tenant_id`               | `PII`       | `label+embedding`           | `rebuild`                | `knowledge_nodes` | `tenant_id, Vector`                             |

**Authoritative stores:** `postgres 16 + pgvector` for
`Entity/Memory/knowledge_nodes` (truth), `document_chunks.embedding` as
projection rebuildable via `reindex` from `Entity`.

## Mapping Version

`v1.0` at `3f61cfa` — `cell_id TEXT nullable` expand–contract `add_cell_id` demo
(never infer missing `canonical_name`).
