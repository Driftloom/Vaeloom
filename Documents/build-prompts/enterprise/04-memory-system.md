# 04 — Memory System (Enterprise upgrade)
### Read first: `mvp/04-memory-system.md`. This is the highest-value upgrade in the whole enterprise folder — take the same care here you took in the MVP file.

## Objective
Complete the memory taxonomy from six MVP types to the full twenty, add the Reflection Agent as a real standalone agent (not just MVP's basic consolidation job), and add full memory governance (versioning, provenance, export/import) as first-class, user-facing capabilities.

## Requirements
- **Full taxonomy (14 new types added to MVP's six):** `semantic`, `procedural`, `timeline`, `event`, `decision`, `skill`, `learning`, `relationship`, `task`, `goal`, `project`, `research`, `behavior`, `context`. Each needs its own extraction logic (file 04 MVP's `extraction.py` pattern, extended) — do not bolt these on as generic unstructured JSON; each type answers a genuinely different question (see `Meridian-Complete-Documentation.md` §6.1 for what each type is for) and should be extracted with that question in mind.
- **Reflection Agent (`apps/ai-service/agents/reflection_agent/`):** a real, scheduled (not per-event) agent — not MVP's basic consolidation job — that reviews recent memory for higher-level patterns (e.g. repeated rejection of a role type implying an unstated preference) and writes suggestions to a review queue, never directly to Preference/Career memory without user confirmation. Confidence bar for pattern-inference is higher than for single-fact extraction, since it's inferring intent, not reading a stated fact.
- **Memory governance:**
  - **Versioning:** every `memory_records` row keeps full edit history, not just current state.
  - **Provenance:** already required in MVP for retrieval; extend it to be queryable directly (a user can ask "why does the system think this" and get a real answer tracing to source).
  - **Export/import:** structured, portable export (extends `mvp/15-security-compliance.md`'s export-everything) that can be re-imported to bootstrap a new workspace or migrate between environments.
  - **Confidence/importance/freshness formalized:** MVP scored these ad hoc per-query; this phase makes them explicit, stored, and independently queryable/tunable fields, not just implicit ranking inputs.
- **Dedicated stores:** by this point `enterprise/02-database-schema.md` has already migrated the graph/vector layers — this file's extraction/retrieval code should be updated to target Neo4j/Qdrant directly rather than the MVP Postgres-extension versions.

## Out of scope
Cross-workspace or cross-tenant shared memory (not planned at all — memory is always individually owned, this is a hard product boundary, not a missing feature).

## Acceptance criteria
- [ ] Each of the 14 new memory types has its own extraction test with realistic seeded input.
- [ ] The Reflection Agent, run against a seeded pattern (three rejected frontend roles), produces a correctly-worded suggestion and does NOT silently update Preference memory without confirmation.
- [ ] A memory export from one workspace successfully re-imports into a fresh workspace with full fidelity.
- [ ] Provenance queries ("why does the system think X") resolve correctly for records created before and after this upgrade.
