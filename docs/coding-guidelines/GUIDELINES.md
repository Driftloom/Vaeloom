# Coding Guidelines

Behavioral rules for agents working in this repo. Language standards (TS/Python
patterns, lint config) live in [`../engineering/Coding-Standards.md`](../engineering/Coding-Standards.md) —
this file is about how to *approach* a change, not how to spell it.

Paired wrong/right code is in [`EXAMPLES.md`](EXAMPLES.md). Read it before your
first non-trivial change.

**Tradeoff:** these bias toward caution over speed. For trivial tasks, use judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing, state your assumptions explicitly. If you are uncertain, ask.
If multiple interpretations exist, present them rather than picking silently. If a
simpler approach exists, say so. If something is unclear, stop and name what is
confusing.

In this repo specifically, **stop and ask before** any of these — each has a
history of being wrong in a way that looks right:

| Trigger | Why it's ambiguous | Verify with |
| --- | --- | --- |
| Adding or renaming a memory type | Two sources of truth exist and a third is generated. Changing one without the others silently breaks filters. | `AGENTS.md` → Memory subsystem invariants |
| Any migration creating a table in `public` | `0066` ends with `_assert_schema_wide_coverage`, which **raises** if any public table lacks RLS or a policy | the migration chain |
| Editing any RLS policy | SQL binds `AND` tighter than `OR`; a flat predicate reads correct but leaves a branch unconstrained | `AGENTS.md` → RLS invariants |
| Resolving weights, profile, or preference inside a DB call | GUCs are transaction-scoped. Getting this wrong does not raise — it returns zero rows and silently falls back | `AGENTS.md` → RLS invariants |
| Adding an auth endpoint | Two independent allowlists must agree or you get a 403 | `csrf.SKIP_PATHS` + `auth.PUBLIC_PATHS` |
| Adding a response field | Casing direction differs between responses and request params | `AGENTS.md` → Frontend |
| Touching `supersede_memory` | It has vector-store side effects that are best-effort and easy to drop | `AGENTS.md` → Memory subsystem invariants |
| Editing anything matching `*.generated.ts` or `openapi.yaml` | These are committed build artefacts with byte-exact CI gates | run the generator, never hand-edit |

If a change seems to need a new pattern rather than an existing one, that is the
signal to stop. This repo has enough surface area that "no precedent" usually means
you have not found the precedent yet.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

No features beyond what was asked. No abstractions for single-use code. No
"flexibility" or configurability that was not requested. No error handling for
scenarios that cannot occur. If you write 200 lines and it could be 50, rewrite it.

Two repo-specific rules that override the general "defense in depth" instinct:

- **A validation that already exists at a lower layer does not get duplicated at
  an upper one.** `MemoryCreate.type` is `str` and validates shape only. The type
  whitelist lives in the service layer against `memory_type_packs`. Re-adding it
  to Pydantic creates two sources of truth that drift — that is exactly what
  happened before 0068.
- **Prefer a data-only registry over a class hierarchy.** `services/resume_templates.py`
  is a dict. It does the job. Adding a `TemplateStrategy` ABC because there are
  "only" five templates is the wrong trade in this codebase.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd write it differently.
- If you notice unrelated dead code, mention it — don't delete it.

The repo contains real dead code that is intentionally still there:
`memory_agent/retrieval.py` was deleted at some point, but plenty of superseded
paths remain. Deleting them inside an unrelated change makes the diff unreviewable
and hides the real change.

The one exception worth taking: **a comment that is factually false and sits
directly beside your change.** Fixing it is in scope — leaving a known-false
comment so the next reader trusts it is a real cost. Fixing the comment, not
rewriting the surrounding code.

When your change creates orphans, remove only the imports and functions *your*
change made unused. Don't remove pre-existing dead code unless asked.

The test: every changed line traces directly to the request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform the task into something checkable:

- "Add validation" → write tests for invalid inputs, then make them pass
- "Fix the bug" → write a test that reproduces it, then make it pass
- "Refactor X" → tests pass before *and* after

For multi-step work, state a short plan with a verification per step before
starting. Strong success criteria let you loop unattended; weak ones
("make it work") require constant clarification.

**Prove the fix is load-bearing.** In this repo the standard is fail-before /
pass-after: the change should come with a test that fails when reverted. Several
fixes here claim exactly that (`test_memory_vector_correctness.py`, the 0067 RLS
tests), and that claim is only worth something if you can point at the test.

**Verify in the smallest scope that exercises the change**, then widen.
Run a per-file or per-area pytest invocation, not the full suite, while iterating.
See `AGENTS.md` → Backend testing for why the full-suite count is untrustworthy.

## 5. Honesty

These are enforced here, not aspirational.

- **Assert the exact expected status code.** `assert res.status_code in (200, 201,
  401, 403)` is banned. It passes when the feature is broken and the auth is wrong
  simultaneously.
- **Negative controls are mandatory for security paths.** Prove the denial happens
  (400/401/403/413), don't just prove the happy path returns 200.
- **No mocks in live-provider suites.** Live S3 (MinIO), TypeSafe AI Jev, and
  Ollama Cloud are exercised against real endpoints. A mock in those suites
  invalidates the result.
- **Never return a flattering constant.** A hardcoded `relevance_score = 0.95`
  leaked to callers as a real score for years. Unknown is `0.0`, never a nice number.
- **Don't edit an expectation to make a test green.** If a fixture disagrees with
  the code, one of the two is wrong. Decide which, deliberately, and say so.
- **Don't report numbers you did not measure.** The previous revision of
  `AGENTS.md` accumulated test-count history ("was 3640, 2731 before that") that
  was stale in days and contradicted itself across sections. A count you did not
  run in this session does not go in the file.

---

## Summary

| Principle | Failure mode it prevents |
| --- | --- |
| Think Before Coding | Silently assuming scope, fields, or which source of truth owns a rule |
| Simplicity First | Strategy/abstraction layers for a problem that has one shape |
| Surgical Changes | Reformatting and drive-by refactors that bury the real diff |
| Goal-Driven Execution | "I'll review and improve the code" with no pass/fail criterion |
| Honesty | Green tests and flattering numbers that don't reflect real behavior |

**Working:** fewer unnecessary lines in diffs, clarifying questions before
implementation rather than after mistakes, and invariants stated once in a form that
matches what the code does.
