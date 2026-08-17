# ADR-024: Rebuildable Projections (Never Authoritative)

| Metadata     | Value                                                   |
| ------------ | ------------------------------------------------------- |
| **Status**   | ADOPTED — design + partial implementation (INT-02 §5)   |
| **Date**     | 2026-08-15 (design re-run); first documented 2026-08-07 |
| **Deciders** | Engineering Team                                        |
| **Owner**    | Data Architect                                          |

## Context

Embeddings, knowledge-graph relationships, and search indexes are _derived_
views over relational rows; treated as authoritative they drift from and
duplicate source truth (INT-02 §5). Inspection @ `6e8a7b4`
(`01-source-register.md` §4) confirms projection infrastructure exists:
`embeddings` and `relationships` tables, `memory_records`, and
`infrastructure/search.py` (`SearchIndex` ABC + `MeilisearchIndex`).
**Meilisearch is NOT installed.** Search falls back to PostgreSQL LIKE/pgvector.
Implementation is partial.

## Decision

Relational rows are the **single source of truth**; projections are rebuildable
from them and **never authoritative**.

- Embeddings (pgvector, ADR-003) and knowledge-graph `relationships` rows are
  projection state with provenance references to source rows.
- Search indexes source rows via `SearchIndex` / `MeilisearchIndex` (Meilisearch
  is NOT installed; falls back to PostgreSQL LIKE/pgvector).
- Rebuild jobs reconstruct any projection from relational rows, bounded by
  workspace scope, so a projection can always be discarded and rebuilt.

## Consequences

**Positive:** Data-consistency guarantee per INT-02 §5 — stale/corrupt
projection is not a data-loss event; rebuild cost bounded per workspace.

**Negative:** **Partial** — no verified rebuild-job/orchestration at HEAD;
Meilisearch is NOT installed (search falls back to PostgreSQL LIKE/pgvector);
provenance columns on projection tables UNVERIFIED (P07).

## Reversibility / Rollback

Yes — projections are disposable by design; rebuild from relational rows.
Strangler-adapter applies where migration is likely (connectors, search).

## Verification (P07)

Verify provenance columns, rebuild-job capability, and the Meilisearch/pgvector
role split (INT-02 §5; `01-source-register.md` §4). **Note:** Meilisearch is NOT
installed; search is PostgreSQL LIKE/pgvector only.
