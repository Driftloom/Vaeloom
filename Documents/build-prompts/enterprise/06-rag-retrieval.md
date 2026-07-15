# 06 — RAG & Retrieval (Enterprise upgrade)

## Read first
`mvp/06-rag-retrieval.md`. Assumes `enterprise/02-database-schema.md`'s vector DB migration (Qdrant) is already live.

## Objective
Add the retrieval-quality features that matter at scale but weren't worth the complexity at MVP volume: semantic caching, query rewriting beyond MVP's basic pass, and context compression.

## Requirements
- **Semantic cache (`apps/ai-service/retrieval/semantic_cache.py`):** cache retrieval results keyed by semantic similarity of the query, not exact string match — a slightly reworded repeat query should hit cache. Invalidate cache entries on any `memory.updated` event touching the relevant workspace, never serve stale results past a memory write.
- **Query rewriting (upgraded):** MVP's basic single-rewrite-pass becomes a proper query understanding step — disambiguating references using conversation history, resolving pronouns/implicit entities against the knowledge graph, and decomposing genuinely multi-part questions into sub-queries retrieved separately then merged.
- **Context compression:** for long retrieval results, compress redundant/overlapping context before handing it to an agent (beyond MVP's basic dedup) — summarize repeated information across multiple sources into one entry with multiple provenance pointers, rather than repeating the same fact five times because five documents mentioned it.
- **Freshness-aware re-ranking at scale:** MVP's re-ranking weights were static; make them tunable per-tenant and per-agent based on observed retrieval quality from the eval framework, rather than hardcoded.

## Out of scope
Changing the underlying hybrid retrieval strategy (vector + keyword + graph) — this upgrade improves quality and efficiency around it, it doesn't replace the approach.

## Acceptance criteria
- [ ] A semantically-similar-but-differently-worded repeat query hits the semantic cache.
- [ ] A cache entry is correctly invalidated immediately after a relevant memory write, verified by a test that writes then immediately re-queries.
- [ ] A multi-part test question is correctly decomposed, retrieved in parts, and merged into one coherent context.
- [ ] Context compression measurably reduces token count on a redundancy-heavy seeded test case without losing any distinct fact.
