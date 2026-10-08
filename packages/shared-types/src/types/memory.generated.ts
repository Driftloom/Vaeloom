/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Source of truth: `CAREER_TYPES` in
 * `apps/api/src/api/services/memory_type_packs.py`.
 * Regenerate:      `python scripts/gen_memory_type_union.py`
 * Verify (CI):     `python scripts/gen_memory_type_union.py --check`
 *
 * This union is generated rather than hand-maintained because a hand-maintained
 * copy silently diverged from the backend taxonomy once already: the list used
 * to be a source-format list (document, email, code, ...), so five of the seven
 * type filters in the memory UI matched nothing. The guard that keeps this
 * honest is `test_generated_union_matches_career_pack` in
 * `apps/api/tests/test_memory_type_packs.py`.
 *
 * Member order is the pack's declaration order, not sorted -- migration 0068
 * seeds the database from it, so order is part of the contract.
 */

/** GENERATED from the backend memory-type domain packs. Do not hand-edit. */
export type GeneratedMemoryType =
  | 'profile'
  | 'document'
  | 'career'
  | 'episodic'
  | 'preference'
  | 'working'
  | 'note'
  | 'fact'
  | 'project'
  | 'skill'
  | 'organization'
  | 'relationship'
  | 'event'
  | 'insight'
  | 'goal'
  | 'feedback'
  | 'decision'
  | 'knowledge'
  | 'reference'
  | 'contact'
  | 'financial'
  | 'health'
  | 'learning'
  | 'workflow';
