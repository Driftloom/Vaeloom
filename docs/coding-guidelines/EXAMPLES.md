# Examples

Paired wrong/right code for the rules in [`GUIDELINES.md`](GUIDELINES.md). Every
example here is drawn from something that went wrong in this repo.

Each pair shows the failure, the fix, and **why** — including what the wrong
version looked like reasonable at the time.

---

## 1. Think Before Coding

### 1a. Resolving data outside the RLS session block

RLS GUCs are set with `set_config(..., is_local=true)`, which is
**transaction-scoped**. A `SELECT` that runs after the session block closes does not
error — it reads zero rows and your code silently falls back to a default.

**❌ Resolve after the session**

```python
async with scoped_session(workspace_id=ws) as db:
    result = await do_the_work(db, ...)

# ❌ Outside the block — GUCs are gone. Zero rows, no exception.
profile = await fetch_profile(result.workspace_id, result.user_id)
if profile is None:
    profile = DEFAULT_PROFILE          # every caller silently pinned to defaults
```

**✅ Resolve inside**

```python
# apps/api/src/api/services/ranking_weights.py:190-200
from ..middleware.tenant import set_rls_session_vars

await set_rls_session_vars(db, workspace_id=workspace_id, user_id=user_id)

profile = (
    await db.execute(
        text(f"SELECT id, user_preference FROM {_PROFILES_TABLE} "
             f"WHERE workspace_id = :workspace_id AND user_id = :user_id LIMIT 1"),
        {"workspace_id": workspace_id, "user_id": user_id},
    )
).mappings().one_or_none()
```

**Why:** this shipped as a whole-branch review finding. The learned-ranking feature
was unreachable — a DB row tier that could never resolve, so `RANKING_WEIGHTS` env
always governed and the learner had nothing to say. No test failed. It just quietly
did nothing.

Note the predicate and the session GUC now agree by construction: same
`workspace_id`, same `user_id`, one place.

### 1b. Patching only the LLM singleton

**❌ Patch the instance**

```python
async def fake_generate_completion(messages, model=None, **kwargs):
    return {"content": "Mock reply", "role": "assistant"}

monkeypatch.setattr(llm_service, "generate_completion", fake_generate_completion)
```

**✅ Patch the class *and* the singleton**

```python
# apps/api/tests/conftest.py:401,420-427
async def fake_generate_completion(
    self, messages: list[dict], model: str | None = None,
    temperature: float = 0.7, max_tokens: int = 4096, *args, **kwargs,
) -> dict:
    return {"content": "Mock reply from test LLM", "role": "assistant", ...}

monkeypatch.setattr(LLMService, "generate_completion", fake_generate_completion)
try:
    from api.services.llm_service import llm_service
    # ... and the singleton
except ImportError:
    pass
```

**Why:** the class-level functions take `self`; a bare function assigned to the
*singleton* does not, and calling it through the instance passes `self` as the first
positional argument — shifting every parameter. It fails loudly here, but the real
hazard is the reverse: a stale instance attribute left by an earlier test silently
shadows the class patch for the rest of the session. See
`tests/test_semantic_ats_tools.py`.

---

## 2. Simplicity First

### 2a. Re-adding a validation that already exists lower down

**❌ Whitelist the type in Pydantic**

```python
# apps/api/src/api/schemas/memory.py
MemoryType = Literal["document", "email", "code", "note", "conversation", ...]  # 24 literals

class MemoryCreate(BaseModel):
    type: MemoryType
```

**✅ Shape-only here; the whitelist lives in the service**

```python
# apps/api/src/api/schemas/memory.py:21,56,99
MemoryType = str

class MemoryCreate(BaseModel):
    type: MemoryType = Field(
        description="A memory type from an active domain pack; validated against "
                    "memory_type_packs at write time (0068)",
    )
```

**Why:** this is not under-defensive, it is a duplicate source of truth. Before
0068 the literal here and the pack table there were separate lists, and they drifted
— `packages/shared-types` shipped a 7-value source-format list that overlapped the
API's 24-value taxonomy in only 2 places, so 5 of 7 memory type filters matched
nothing. A second whitelist guarantees the drift returns.

The service-layer pack check is now the *only* guard on the write path. Migration
0068 dropped `ck_memories_type_valid` to make that true.

### 2b. A registry that grew a class hierarchy

**❌** A `TemplateStrategy` ABC, `PercentageTemplate`, `FixedTemplate`, a
`TemplateConfig` dataclass, and a `ResumeBuilder` that takes all three — for five
data rows.

**✅ A dict**

```python
# apps/api/src/api/services/resume_templates.py
TEMPLATES: dict[str, ResumeTemplate] = { ... }   # data only

def suggest_template(role: str) -> ResumeTemplate:
    ...
```

**Why:** five templates is a lookup table. The hierarchy costs setup at every call
site and buys nothing until a second *shape* of behaviour exists. When it
does, refactor then — the dict stays readable until that moment.

---

## 3. Surgical Changes

### 3a. Deleting dead code you happened to notice

**❌** While fixing something in `memory_service`, notice
`memory_agent/retrieval.py` is unreferenced and delete it in the same diff.

**✅ Mention it, don't touch it**

```
Noticed: memory_agent/retrieval.py (448 lines) has no production importers —
only 3 test files, and its ranking/budget logic is superseded by ContextEngine
(services/context_engine.py, token_budget=2000). Left it alone since it's
unrelated to this change. Worth a separate cleanup PR.
```

**Why:** it is genuinely dead — but bundling it makes the real fix harder to review
and harder to revert. The rule from `GUIDELINES.md` §3 is *mention, don't delete*.

The one exception, for contrast: a comment directly beside your change that is
**factually false** is worth fixing in place. `loop.py` claimed
`user_preference_vectors.preference_vector` was wired into ranking. It was not —
`search_ranking.py` consumes structured `preferred_tags`/`preferred_types`, and the
embedding column is read only by `recommendation_service.generate()`. A reader
trusting that comment would reason about ranking from the wrong source.

### 3b. Reformatting while you're in there

**❌**

```diff
- def validate_user(user_data):
-     # Check email format
-     if not user_data.get('email'):
+ def validate_user(user_data: dict) -> bool:
+     """Validate user data."""
+     email = user_data.get('email', '').strip()
+
+     # Validate email
+     if not email:
          raise ValueError("Email required")
```

Type hints, a docstring, a comment rewrite, and a behavioural change to username
validation — all in a bug fix about empty emails.

**✅**

```diff
  def validate_user(user_data):
      # Check email format
-     if not user_data.get('email'):
+     email = user_data.get('email', '')
+     if not email or not email.strip():
          raise ValueError("Email required")
```

Every changed line traces to the reported bug. Everything else is a separate change.

---

## 4. Goal-Driven Execution

### 4a. The assertion that passes when things are broken

**❌**

```python
def test_workspace_isolation(client):
    res = client.get(f"/workspaces/{other_ws}/memories", headers=auth)
    assert res.status_code in (200, 401, 403)
```

**✅**

```python
def test_workspace_isolation(client):
    res = client.get(f"/workspaces/{other_ws}/memories", headers=auth)
    assert res.status_code == 403          # exact, and the reason is the RLS policy
```

**Why:** the ❌ passes when the isolation works *and* when the endpoint 500s on an
auth bug *and* when auth is broken outright. It asserts nothing about the boundary
it exists to protect. Repo policy bans the broad form outright.

Pair it with a negative control — prove the cross-tenant read is *denied*, don't just
prove the happy path returns 200.

### 4b. Changing the expectation so the test passes

**❌** `test_golden_retrieval` case `r15` expects `job_search`; the router returns
`reflection`. Edit the fixture.

**✅** Decide which side is wrong, then say so.

```jsonc
// apps/api/tests/eval/golden_retrieval.json — left untouched
{
  "id": "r15",
  "query": "generate weekly digest of my job search activity",
  "category": "memory_retrieval",
  "expected_agent": "job_search"
}
```

The drift is between `router.py` (`_CATEGORY_ANCHORS`, `_ANCHOR_WEIGHT = 3`) and this
fixture. One of them is the bug. Editing the fixture makes the suite green and the
product wrong, and it destroys the only record that the two disagree.

**Why:** this is recorded as a known pre-existing failure rather than papered over,
precisely so the decision stays visible. See `AGENTS.md` → Known open gaps.

### 4c. The score that flatters itself

**❌**

```python
# A store that couldn't return a distance still produced a confident score.
result = MemorySearchResult(..., relevance_score=0.95)
```

**✅**

```python
# apps/api/src/api/services/memory_service.py:509-511
# Use the real cosine distance when the store provides it
dist = rec.metadata.get("distance")
```

`PGVectorStore` now returns the real cosine distance and `FallbackVectorStore` stops
discarding it. Unknown is `0.0`, never a nice number.

**Why:** a hardcoded `0.95` leaked to callers as a genuine relevance signal for
long enough that downstream ranking and UI treated it as measured. A flattering
default is worse than an honest `None` — it looks like data.

---

## Anti-pattern summary

| Principle | Anti-pattern | Fix |
| --- | --- | --- |
| Think Before Coding | Resolving outside the RLS session; patching only the LLM singleton | Verify the actual scoping mechanism before relying on it |
| Simplicity First | A second copy of a validation that already exists | One source of truth; layer validations by scope, not by duplication |
| Surgical Changes | Deleting dead code, reformatting in a bug fix | Mention it; change only lines that trace to the request |
| Goal-Driven Execution | Broad status assertions; editing fixtures to go green | Assert the exact code; reconcile the disagreement deliberately |
| Honesty | Hardcoded `relevance_score = 0.95` | Real value or `0.0` |

**The pattern underneath all five:** every ❌ above looks correct at the moment you
write it. None of them raised an error. The guard is knowing which invariant your
change is silently resting on and checking that one before you commit — which is
what [`AGENTS.md`](../../AGENTS.md) is for.
