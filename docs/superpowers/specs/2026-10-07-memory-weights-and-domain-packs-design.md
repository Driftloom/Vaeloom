# Memory Layer: Learned Ranking Weights + Domain-Pack Registry

**Date:** 2026-10-07
**Status:** Design approved in conversation; awaiting written-spec review
**Scope:** Two changes. (1) Persist learned ranking weights. (2) Replace the hard-coded memory taxonomy with a domain-pack registry.

## Objective

Vaeloom ships as a career product but is intended to become a general
agent-memory platform. The second sale depends on the memory layer not
hard-coding "career". This spec makes the two changes that keep that possible
without weakening the isolation, retrieval-correctness, or honesty properties
already established.

Success means: adding a second memory domain later is an **insert of
configuration**, not an edit to a Pydantic `Literal`, a Postgres `CHECK`
constraint, and a frontend TypeScript union.

## Constraints

These are non-negotiable and every design decision below respects them.

1. **Do not regress workspace/tenant isolation.** New tables get FORCE RLS and
   a scoped policy. No unscoped reads.
2. **Keep hybrid RRF retrieval.** No redesign of `MemoryService.search_memories`.
3. **Honest scores.** No fabricated relevance constants. If a signal is
   unavailable, score `0.0` and say so.
4. **Reversibility over speed.** Registry ships expand-only; the contract phase
   is a separate later deploy.
5. **Cognee architecture claims are unverified.** Cognee was read from its
   marketing page and GitHub landing only. No decision here depends on their
   internals. If the platform direction is ever revisited, reading their actual
   pipeline code is a prerequisite, not a follow-up.
6. **Do not grow the graph.** Graph recall holds at its current state.

## Context: what is already true

Established by audit and fixed in the 2026-10-07 retrieval work
(`tests/test_memory_vector_correctness.py`, 20 tests):

- Retrieval lives **only** in `MemoryService.search_memories`. The 448-line
  `memory_agent/retrieval.py` was dead code (zero production callers) and has
  been deleted. Ranking/budget policy is `services/context_engine.py`.
- Vector search returns **real cosine distances**. The hardcoded `0.95` is gone.
- HNSW indexes exist (migration 0011, `vector_cosine_ops`). There was never an
  "ANN index missing" problem.
- `memory_taxonomy_ledger` now has an ORM model and a real writer
  (`_record_taxonomy_change`) called on type remap.

Two claims in earlier discussion were wrong and must not be carried forward:

- The preference→ranking loop is **not** missing. It closes today via approval →
  preference `Entity` → `preferred_tags` → `rank_results`. What is missing is
  weight *persistence*.
- `rank_results` does **not** consume `user_preference_vectors.preference_vector`.
  That embedding is read only by `recommendation_service.generate()`. The ranker
  consumes structured `preferred_tags` / `preferred_types`.

## Change 1 — Learned ranking weights

### Problem

`search_ranking.py` weights are frozen process-wide:

```python
DEFAULT_WEIGHTS = {"relevance": 0.4, "recency": 0.3, "importance": 0.2, "user_preference": 0.1}

def _load_weights() -> dict[str, float]:
    raw = os.environ.get("RANKING_WEIGHTS", "")
    ...
```

`_load_weights()` is called once in `SearchRankingService.__init__`, so the
module singleton `search_ranking_service` freezes whatever env said at import.
Nothing ever changes a weight at runtime.

### Schema

New table `ranking_weight_profiles`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `tenant_id` | UUID NOT NULL | |
| `workspace_id` | UUID NOT NULL | |
| `user_id` | UUID NOT NULL | |
| `relevance` | NUMERIC(5,4) NOT NULL DEFAULT 0.4 | |
| `recency` | NUMERIC(5,4) NOT NULL DEFAULT 0.3 | |
| `importance` | NUMERIC(5,4) NOT NULL DEFAULT 0.2 | |
| `user_preference` | NUMERIC(5,4) NOT NULL DEFAULT 0.1 | |
| `sample_size` | INTEGER NOT NULL DEFAULT 0 | how many feedback rows produced this |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Unique on `(workspace_id, user_id)`. Index on `workspace_id`.

FORCE RLS with the policy shape used by migration 0062
(`workspace_capabilities`): enable, force, then a policy keyed on
`workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid`
plus a user-scope predicate. Both must be present or `0066`'s schema-wide
invariant fails the chain.

### Resolution order

Per rank call, not at construction:

1. A `ranking_weight_profiles` row for `(workspace_id, user_id)` → use it.
2. Else `RANKING_WEIGHTS` env JSON (today's behaviour).
3. Else `DEFAULT_WEIGHTS`.

With no row, behaviour is **byte-identical to today**. That is the invariant the
first test pins.

Resolution needs a session. `rank_results`/`calculate_score` are sync and have
no DB access, so weight resolution happens in the async caller
(`orchestrator/loop.py`) and the resolved dict is passed as
`user_context["weights"]`. `SearchRankingService` reads that key when present,
otherwise falls back through steps 2–3. This keeps the service pure and
testable and avoids making a sync method do I/O.

### Learning signal — and its honest limits

`recommendation_feedback` (`0002_microservice_tables.py:202`) has columns
`id, recommendation_id, user_id, tenant_id, useful, created_at`. Verified
limitations:

- **No `workspace_id`.** The signal is user/tenant scoped only.
- `recommendations.items` is an opaque JSONB blob. The score at
  recommendation time is **not** recoverable from the row.
- My audit confirmed `record_feedback` is **write-only** — nothing reads it.

Consequences, stated rather than papered over:

- We **cannot** compute "average relevance of useful vs unhelpful items"
  reliably, because the original relevance is not persisted.
- We therefore learn from the **useful-rate only**, as a bounded nudge:
  - `useful_rate = useful_count / (useful_count + unhelpful_count)`
  - `user_preference` moves toward `clamp(0.1 + 0.3 * (useful_rate - 0.5), 0.05, 0.5)`
  - Requires `sample_size >= 10` before it moves at all, so a single rating
    cannot swing ranking.
  - The other three weights stay at their env/default values.
- Feedback is attributed to a profile by looking up the feedback row's
  `user_id`, and applying it to that user's profile **for the user's current
  workspace**. Because the signal lacks a workspace, a rating made in workspace
  A influences the profile in workspace B. **This is a known cross-workspace
  imprecision**, recorded here deliberately rather than hidden. It is a
  preference-signal leak of *taste*, not of tenant data: the row is still
  written by that same user about their own content. If it is judged
  unacceptable, the fix is to add `workspace_id` to `recommendation_feedback` and
  the join becomes exact — that is a phase-1 follow-up, not a redesign.

Update runs inside `RecommendationService.record_feedback` after the insert.
Best-effort: a weight-update failure never fails the feedback write.

### Explicitly out of scope

No gradient descent, no per-query adaptation, no online learner, no use of
`preference_vector` in ranking, no cross-user weight sharing. One weight, one
signal, one direction. If `user_preference` does not measurably improve
grounded-answer quality on real traffic, the correct outcome is to delete the
table — it was built cheaply enough to discard.

### Testing

- Precedence: DB row beats env; env beats defaults; no row reproduces today's
  exact scores.
- Negative control: a profile in another workspace is never read (assert under
  FORCE RLS, plus a live-Postgres test in the style of `test_rls_live_pg.py`).
- `sample_size < 10` leaves weights untouched.
- A `record_feedback` write persists a weight change and increments
  `sample_size`.
- Weight-update failure leaves the feedback row written.
- Weights stay within `[0.05, 0.5]` for `user_preference` under adversarial
  feedback (all-useful, all-unhelpful).

## Change 2 — Domain-pack registry

### Problem

The taxonomy is closed in three places that must be hand-synchronised:

1. `apps/api/src/api/schemas/memory.py` — 24-value `MemoryType` `Literal`.
2. `alembic/versions/0027_memory_taxonomy_expand_contract.py:76` —
   `ck_memories_type_valid` CHECK on `memories.type`.
3. `packages/shared-types` — the TypeScript union.

Frontend/backend drift on this exact list is a documented past incident: the TS
`MemoryType` was a *source-format* list, so 5 of 7 UI filters matched nothing.

### Phase 1 — expand only

**New table `memory_type_packs`:**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `slug` | VARCHAR(64) UNIQUE NOT NULL | e.g. `career` |
| `version` | INTEGER NOT NULL | |
| `label` | VARCHAR(128) NOT NULL | |
| `types` | JSONB NOT NULL | array of type strings |
| `is_active` | BOOLEAN NOT NULL DEFAULT true | |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

FORCE RLS. The table holds platform configuration, not tenant data, so the
policy is the service-role form used by migration 0053
(`TO service_role, postgres, vaeloom_app USING (true)`), consistent with how
`memory_taxonomy_ledger` is treated. Reads for validation go through the service
role; the `is_active` flag gates which packs are honoured.

**Seed:** exactly one row — `career`, `version=1`, holding the current 24 values
**in the exact order declared at `apps/api/src/api/schemas/memory.py:10-14`**:

```
profile, document, career, episodic, preference, working, note, fact,
project, skill, organization, relationship, event, insight, goal, feedback,
decision, knowledge, reference, contact, financial, health, learning, workflow
```

Snapshot tests compare against this literal list, not a count. The career domain
becomes data rather than a constant.

**`memories` gains** `type_pack_slug VARCHAR(64)` and
`type_pack_version INTEGER`, backfilled to `career` / 1.

**Drop `ck_memories_type_valid`.** This is the step with real blast radius on a
table carrying a live HNSW index under a 100%-RLS invariant. It ships alone.

**Service layer:** `MemoryCreate.type` widens from `Literal` to `str`, validated
against the active pack set. Validation raises a clear error naming the slug and
the offending value. `ENTERPRISE_MEMORY_TYPES` / `CANONICAL_6` become
pack-derived, not module constants.

**Taxonomy ledger:** ledger rows record `type_pack_slug` / `type_pack_version` in
`metadata_` so provenance survives pack versioning. Existing ledger rows keep
their columns; the pack reference is additive.

### Phase 2 — contract (later, separate deploy)

Only after packs are proven in use: re-add a CHECK derived from the active pack
set, or leave types unconstrained if packs turn out to be dynamic. Deciding this
now would be guessing at a design we have not yet exercised.

Phase 1 is reversible: re-add the CHECK with the current 24 literals and drop the
two columns. No data is destroyed in phase 1.

### Frontend

`packages/shared-types` stops hand-maintaining the union as the source of truth.
Two supported options, chosen during implementation:

- **Generated artifact** — a script emits the TS union from the pack table.
  Deterministic, no runtime dependency on pack availability.
- **Runtime fetch** — packs read via a `GET /memory-type-packs` endpoint and the
  UI filters from that.

Either way, one test asserts pack contents and the TS union agree, and fails on
drift. **That test is the point of the change** — it is what was missing when the
lists diverged.

### Testing

- Snapshot test: the `career` pack equals the historical 24 values, in order.
  Pack drift is then visible in review.
- Every type currently used in the codebase resolves under the pack.
- An unknown type is rejected with an error naming the valid pack.
- Cross-tenant pack reads denied (negative control).
- Live PostgreSQL: after dropping the CHECK, inserts of pack-valid types still
  succeed and the `0066` schema-wide RLS invariant still passes.
- Rollback rehearsal: re-adding the CHECK with 24 literals succeeds.

## Sequencing

Two deploys, deliberately separated.

1. **Deploy 1 — weights.** Additive table, no change to `memories`. Reverts by
   dropping one table.
2. **Deploy 2 — registry expand.** Pack table, two new columns, backfill, drop
   the CHECK.

Deploy 1 first because it carries the only measurable success criterion and must
not be confounded by registry changes.

## Graph recall — holding

Graph recall exists (`_assemble_rag_context` reads `Entity`, `Relationship`,
`Document`) but is flat `ILIKE` string matching rather than traversal, and
`Relationship` rows are not consulted by the RAG path. **No change.** The graph
is written correctly by ingest and readable by agents; adding traversal now grows
a write-mostly surface with no evidence it improves answers. Revisit only with
instrumentation showing graph hits contribute to grounded answers.

## Risks

| Risk | Mitigation |
| --- | --- |
| Dropping the CHECK weakens DB-level integrity | Pack validation in the service layer is the new guard; contract phase restores a DB constraint once packs are proven |
| Pack contents drift from the TS union | Agreed test fails on drift — the original defect, now guarded |
| Cross-workspace preference imprecision from feedback lacking `workspace_id` | Documented above; optional follow-up adds the column; leak is user taste, not tenant data |
| Weight learning is too weak to help | One weight, one cheap signal, `sample_size >= 10` floor, deletion is a legitimate outcome |
| Concurrent development conflicts | This work touches `memories`, `search_ranking.py`, and new migrations. A concurrent process is actively committing in this repo — changes must be landed in isolation, never via bulk `git checkout` / `reset` |

## Non-goals

- Adopting or vendoring Cognee.
- Graph traversal.
- A general learning loop.
- Contract-phase CHECK restoration.
- Changing retrieval ranking semantics (`memory_service`, `context_engine`).