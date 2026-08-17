# Finding: ADR-024 Claims Meilisearch Is Present

| Metadata     | Value                                         |
| ------------ | --------------------------------------------- |
| **ID**       | FIND-DOC-014                                  |
| **Severity** | P2-MEDIUM                                     |
| **Status**   | OPEN                                          |
| **Source**   | Documentation Audit                           |
| **File**     | `docs/adr/ADR-024-rebuildable-projections.md` |

## Description

ADR-024 claims "Meilisearch + pgvector both present". Meilisearch is NOT
installed. `MeilisearchIndex._ensure_connected()` raises
`RuntimeError("meilisearch is not installed")`. Only pgvector is functional.
Search currently uses PostgreSQL ILIKE.

## Impact

- Misleading about search capabilities
- Performance expectations don't match reality

## Remediation

Update ADR to reflect that Meilisearch is NOT_INSTALLED and search uses SQL
ILIKE.
