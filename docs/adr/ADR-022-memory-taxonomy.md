# ADR-022: Six-Domain Memory Taxonomy on Existing Schema

| Metadata     | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| **Status**   | ADOPTED — IMPLEMENTED_UNVERIFIED (verify all 6 types + supersession) |
| **Date**     | 2026-08-15 (design re-run); first documented 2026-08-07              |
| **Deciders** | Engineering Team                                                     |
| **Owner**    | Data Architect                                                       |

## Context

INT-02 defines six memory domains — Profile / Document / Career / Episodic /
Preference / Working. Prior P05 recorded "no taxonomy" as a gap; inspection @
`6e8a7b4` (`01-source-register.md` §4, CF-P05-02) now finds taxonomy machinery
in the repo, so this records design as implemented-but-unverified.

## Decision

Keep the six-domain taxonomy as the classification/retrieval contract, mapped
onto existing `memories` / `memory_records` rows — **not** new tables.

- `schemas/memory_types.py` — `MemoryType` enum + `MEMORY_TYPE_REGISTRY`
  (fine-grained entity registry: person, organization, skill, … preference,
  document, conversation) with per-type TTL and search weight.
- `migrations/0004_memory_taxonomy.py` — adds `domain` facet, `supersedes_id`
  supersession link (FR-68), `deleted_at` soft-delete, `(tenant_id, domain)`
  index on `memories`.
- `services/memory_versioning.py` — version snapshots/diffs per memory.
- Supersession via `supersedes_id`, not row deletion.

## Consequences

**Positive:** No premature schema split; retrieval scopeable by type/domain;
supersession + soft-delete support P07 provenance/lifecycle.

**Negative:** **Reconciliation caveat** — repo registry is 22 entity types, not
the six domains; mapping completeness onto the `domain` facet UNVERIFIED.
`memory_versioning.py` keeps versions in-memory (persistence UNVERIFIED);
supersession end-to-end UNVERIFIED.

## Reversibility / Rollback

Yes — additive columns and typed rows; `0004` downgrade drops `domain`,
`supersedes_id`, `deleted_at` and the index without touching other tables.

## Verification (P07/P12)

Verify all six domains are representable/queryable via `domain` and supersession
works end-to-end (FR-68; CF-P05-02).
