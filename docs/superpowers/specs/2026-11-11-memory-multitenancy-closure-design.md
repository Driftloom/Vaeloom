# Memory & multi-tenancy closure — Spec 2 design

**Date:** 2026-11-11
**Status:** Design approved in conversation; awaiting written-spec review
**Depends on:** Spec 1 (`2026-10-07-pg-migration-verification-design.md`) — complete, migrations 0067/0068 verified against a real PostgreSQL.
**Migration:** `0069`. One migration, three defects.

## Why now

Spec 1 proved 0067 and 0068 apply, isolate and roll back correctly. It did not change them. Three documented debts in the memory and multi-tenancy subsystem remain, and each one is a case where the system **degrades into looking healthy**:

| Debt | How it fails quietly |
| --- | --- |
| `recommendation_feedback` has no `workspace_id` | A rating in workspace A moves the learned profile in workspace B. Nothing errors. |
| `import_memories` bypasses the pack registry | An imported row carries a type no active pack declares. Nothing errors until a search treats it as canonical. |
| `memory_records` keeps its own frozen CHECK | A second frozen vocabulary that 0068 no longer governs. They drift silently. |

## Scope

All three, in migration `0069`, plus the endpoint that makes the first of them reachable.

---

## Part 1 — workspace isolation for preference learning

### The defect

`0002_microservice_tables.py:201-209` creates `recommendation_feedback` with `user_id` and `tenant_id` but no workspace. `user_preference_vectors` keys on `(user_id, tenant_id)`. Both therefore aggregate across every workspace a user belongs to, so `recommendation_service.generate()` reads a profile that any workspace's ratings helped build.

### The change

1. **Add `workspace_id` to `recommendation_feedback`**, nullable.

2. **Backfill nothing.** Legacy rows keep `NULL` and are treated as non-contributing. This is the approved decision and the reason is sound: the parent `recommendations` table has no `workspace_id` either, so any backfill would be a guess. A guessed workspace is precisely the contamination this migration exists to remove.

3. **Learning queries filter** `WHERE workspace_id = :workspace_id`. Rows with `NULL` never contribute.

4. **`user_preference_vectors` gains `workspace_id`** and its primary key becomes `(user_id, tenant_id, workspace_id)`.

5. **Writes require it.** Every write path sets `workspace_id` from authenticated request context, never from a request body. `POST /feedback` already does this correctly — it overwrites `dto.workspace_id` from `get_workspace_id` before the service call, and passes `caller_user_id` for the ownership compare. That pattern is the template.

### The endpoint

`AGENTS.md` records "two sibling endpoints still take `user_id` from the body with no ownership compare". **That is stale: there is one.**

- `GET /{user_id}` (`recommendations.py:46-58`) already compares `user_id != current_uid` and returns 403.
- `POST /feedback` (`recommendations.py:61-93`) already derives identity from the caller.
- **`POST /index` (`recommendations.py:96-102`) does not.** It passes `dto.user_id` and `dto.tenant_id` straight to `recommendation_service.reindex()`.

Fix: compare `dto.user_id` against the caller's id and return **403** on mismatch. Exact status — 403, not 404 and not a silent no-op.

---

## Part 2 — `import_memories` must use the registry

`memory_service.import_memories` constructs `Memory(...)` directly, so imported rows carry whatever `type` the payload supplied, unchecked against `memory_type_packs`. The create/update/supersede paths already validate; this one does not, so the registry's guarantee is *"the three service write paths validate"*, not *"all memory writes"*.

**The change:** route every imported row through the same validation the other three write paths use. An out-of-vocabulary type is rejected the same way — `MemoryTypeRejected`, **HTTP 422**, not a 5xx. A routine client mistake must not burn the error budget.

**Decide deliberately:** batch imports are bulk operations. Rejecting the whole batch on one bad row is the safe default and matches the create path; a per-row reject-and-continue mode would need its own contract and is out of scope here.

---

## Part 3 — retire `memory_records`' frozen CHECK

`memory_records` carries its own `ck_memory_records_type_valid`, a second frozen vocabulary that 0068 does not govern. Two vocabularies drift apart silently.

**The change:** drop the constraint, so `memory_records` validates through the same registry as `memories`.

**Consequence to state plainly:** after this, `memory_records.type` is unconstrained at the database level and relies on the service layer, exactly like `memories.type` since 0068. That is the intended design — but it means the integrity of `memory_records.type` now depends on `import_memories` (Part 2) being correct. Parts 2 and 3 are one decision, not two, and must not ship apart.

---

## RLS requirement

Every table touched keeps RLS and at least one policy. Migration 0066 ends with `_assert_schema_wide_coverage`, which **raises if any public table lacks either**. 0069 must satisfy it or the migration chain fails.

`recommendation_feedback` is already in `0036_least_privilege_rls.py`'s table list, so its policy must be extended to scope on `workspace_id` — otherwise adding the column achieves nothing, because the policy still cannot see it.

`user_preference_vectors` changes primary key; its policy must scope on all three key columns.

---

## Verification

`pnpm verify:pg` must pass all nine steps, on top of the targeted suites for each part:

- **Part 1** — a rating in workspace A must not move the profile in workspace B. Needs a two-workspace test against the live container, because the SQLite suite cannot express RLS scoping. The `NULL`-legacy-row case needs its own assertion: a quarantined row contributes nothing.
- **Part 2** — `import_memories` with an out-of-vocabulary type returns 422; with a valid type succeeds and records pack provenance.
- **Part 3** — `ck_memory_records_type_valid` is absent after `upgrade head`, present after `downgrade -1`, and the downgrade refuses over an out-of-vocabulary row — the same proof Spec 1 built for 0068, applied to 0069.

**The rollback story must be written before a second domain ships.** Spec 1 established that `downgrade` correctly refuses over data a later pack introduced. 0069 inherits that behaviour. Once a second pack is in production, rolling back 0069 will fail while `memory_records` holds a type that pack declared. That is correct, but it is an operational decision someone has to make in advance.

## Out of scope

- Enterprise auth (SAML unwired, RBAC as a DI helper). Unrelated subsystem.
- The ~25 `USING (true)` service policies. Separate exposure, separately documented.
- Per-row reject-and-continue for imports.
- Any second domain pack.

## Risks

| Risk | Mitigation |
| --- | --- |
| Legacy feedback silently stops influencing ranking | Expected and intended. `NULL` rows are quarantined, not discarded; say so in the release note. |
| `user_preference_vectors` PK change orphans existing vectors | Vectors with no workspace become `NULL`-keyed and stop being read. Rebuild on next signal. State it. |
| Parts 2 and 3 shipped apart | `memory_records.type` becomes unconstrained while an unvalidated write path still exists. Ship as one change. |
