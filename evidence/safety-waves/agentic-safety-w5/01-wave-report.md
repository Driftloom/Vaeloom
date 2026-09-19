# Agentic Scale-Safety — Wave 5 Report (2026-09-06 → 2026-09-15)

> **Wave:** 5 (prompt registry) **Gap:** G-06 **HEAD:** `bb732402`  
> **Pre-landed:** `f82a4057` — gated here. Feeds CONT-P12 predecessor audit.

## Forensic Reconfirmation @ HEAD

`agents/*/handler.py:mission` strings + `router.py:CATEGORY_KEYWORDS` inline remain (legacy), but `orchestrator/card.py` + `card_registry.py` now sit in front: 11 declarative `AgentCard`s with versioned `system_template` + `output_schema` + `few_shot_examples` + `tools` + `safety_guidelines` + `max_react_rounds`. Loop renders via `card.render_system_prompt(context)` not mission string. G-06 CONFIRMED CLOSED at plumbing level; full DB-versioned hot-fix without deploy is a residual (see restrictions).

## Implementation

**`orchestrator/card.py`** (156 lines):
- `DEFAULT_SAFETY_GUIDELINES` (5) + `DEFAULT_SYSTEM_TEMPLATE` (Jinja2: `{{name}}/{{description}}/safety_guidelines/profile/master_resume/preferences/rag_context/tools/output_schema/few_shots`).
- `AgentCard(BaseModel)`: `name/version/description/system_template/few_shot_examples/output_schema/tools/eval_threshold/max_react_rounds/autonomy/status/safety_guidelines/metadata`; `render_system_prompt(context) -> str` via Jinja2 `BaseLoader` with plain-text fallback; `validate_output(output) -> (bool, errors)` via `jsonschema.Draft7Validator`, envelope-aware (`result` inner if outer schema lacks `result`).

**`orchestrator/card_registry.py`** (424 lines):
- 11 canonical cards: `resume`, `job_search`, `application`, `ats`, `organization`, `gmail`, `scheduler`, `career`, `memory`, `drive`, `github` — each with `tools` (least-privilege syncs from live `AGENT_REGISTRY` at `get()`), `output_schema` (resume/job_search strict), `few_shot_examples` (resume/job_search), `safety_guidelines`.
- `AgentCardRegistry`: `get(name)` (normalized + suffix-stripped `agent/handler` matching), `register`, `list_all`, `get_or_create(name, agent_instance)` fallback; `get()` dynamically merges live agent `tools` into card; singleton `card_registry` + helpers `get_agent_card/register_agent_card/list_agent_cards`.

**`orchestrator/base.py`**: `AgentContext` (workspace_id/user_id/profile/master_resume/preferences/rag_context/retained_history) + `BaseAgent.card: Any = None` + `get_system_prompt(context) -> str` forwarding to card.

**`orchestrator/loop.py`** wiring:
- `card = getattr(agent, "card", None) or get_agent_card(agent_name)`; `_try_react_loop` renders `system_content = card.render_system_prompt(context=agent_context)` with `AgentContext` hydration; `max_rounds = card_max or settings.agent_max_react_rounds`; approval/scope contract also synthesized from card+tools.

## Tests

| Suite | Result |
| --- | --- |
| `test_agent_cards.py` (render with/without context, schema validation envelope, canonical 11 registry, custom register, get_or_create, BaseAgent integration) | 7/7 |

Plus W1–W4 regression (66+24+10) green.

## Gate Verdict: GO (with residual)

G-06 CLOSED at template/contract/registry plumbing. **Residual:** cards are code-defined, not DB-backed version store; "prompt hot-fix without deploy" is operator-edit-`card_registry.py` + restart, not runtime DB write + `percent sha256(request_id)` rollout. Full DB-versioned `LoopCheckpoint`-style prompt store + A/B rollout + audit log is a follow-on (feeds CONT-P12 as a known gap, not a reopen). No agent rewrites, no prompt-content changes in this wave (per plan §5).
