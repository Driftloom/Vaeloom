# Agentic Scale-Safety — Wave 4 Report (2026-09-06 → 2026-09-15)

> **Wave:** 4 (context compaction) **Gap:** G-05 **HEAD:** `bb732402`  
> **Pre-landed:** `f82a4057` — gated here.

## Forensic Reconfirmation @ HEAD

Old `loop.py:642` flat `context_prompt[:2000] + " …[truncated]"` no longer the sole mechanism. New `infrastructure/context_budget.py` + `orchestrator/context_loader.py` are wired into `loop.py` (`compact_messages`, `truncate_text_to_tokens`, `context_loader.load_context`). G-05 CONFIRMED CLOSED.

## Implementation

**`infrastructure/context_budget.py`** (191 lines):
- `estimate_tokens` (`chars/3.8`), `ContextPartition` + `calculate_budget(total=8192, system 15% / history 25% / rag 35% / tools 25%)` normalized.
- `truncate_text_to_tokens(text, max_tokens, preserve_end, indicator)` — word-boundary, no mid-word cut, 30-char window.
- `compact_conversation_history(messages, max_tokens, summarizer_fn)` — separates system msg, greeds recent turns to 0.8*budget, summarizes dropped older turns as `[Summary ... retains N turns: ...]` with `msg_i role: snippet` provenance; `summarizer_fn` async hook (LLM) else raw fallback; never drops system msg.

**`orchestrator/context_loader.py`** (214 lines):
- `AgentContextLoader.load_context(workspace_id, user_id, rag_context, db)` hydrates `AgentContext(profile/master_resume/preferences/rag_context)` from `profile_service` → `WorkspaceUser` → `User` fallback + `Entity` (skill/career/education/experience/preference, limit 50) + latest `Document` `%resume%`; `scoped_session` RLS; `patchable get_session_cm` seam; non-blocking (always returns minimal `name/email/skills`).

**`orchestrator/loop.py`** wiring:
- Pre-LLM: `agent_context = await context_loader.load_context(...)` feeds `AgentContext` to card rendering.
- RAG: `_build_context_prompt(rag)` still assembles `Entity/Doc/Preference` lines but now capped via `truncate_text_to_tokens(context_prompt, budget.rag_cap)` with `calculate_budget(8192)`.
- History: `messages, _compacted = compact_messages(messages)` before each provider call (preserves system, compacts old turns).

## Tests

| Suite | Result |
| --- | --- |
| `test_context_budget.py` (estimate, budget defaults/custom, truncate word-boundary/preserve_end, compact noop/drops+summarizes/custom summarizer) | 10/10 |

Plus W1/W2/W3 regression green (66+24 above).

## Gate Verdict: GO

G-05 CLOSED. Restriction: 50-turn soak under fixed 8192 token ceiling is unit-proven (compaction preserves system+recent+dropped-summary), not live-model-evaluated (needs `summarizer_fn` live key). W5 handoff: **prompt registry gated next** (also pre-landed — see w5).
