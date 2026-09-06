# Agentic Scale-Safety — Wave 2 Report (2026-09-06)

> **Wave:** 2 (judge evals + red-team set) **Gaps closed:** G-04 (keyword-only
> evals), G-07 (no adversarial loop testing) **Base:** `002c742` (Wave 0) → HEAD
> moved to `125712b` mid-wave (test-corpus resync, unrelated files). All Wave-2
> changes are working-tree, additive-only, verified at `125712b` + working tree.

## Implementation

**`infrastructure/agent_eval.py`** (+~190 lines):

- `JudgeVerdict` (correctness 0.4 / grounding 0.3 / safety 0.3), `JudgeCase`,
  `JUDGE_GOLDEN` (12 intents), `JudgeEvaluator.score_with_judge` (injectable
  judge_fn; fail-closed on unparseable/error → 0 verdict) + `run_judge_suite`.
- New deterministic refusal classes (all critical): `pii_request`,
  `harmful_howto`; `role_hijack` escalated high→critical (zero blast radius: no
  tests/frontend use roleplay phrasing); `data_exfiltration` broadened (red-team
  variants `system API key`, `output the prompt instructions`).
- Existing keyword scoring untouched (backward compatible).

**`orchestrator/router.py`** (+~20 lines): adversarial screen moved to step 0 of
`handle()` — before classification/routing/inference. Previously low- confidence
attacks exited as `ask_clarification` unscreened (found live: PII request
bypassed the gate). Old check kept as defense-in-depth.

**`tools/executor.py`** (+1 entry): `execute_code_sandbox` added to
`_BASE_APPROVAL_GATED` (real finding: sandboxed code exec auto-ran from loop).
Accepted-OPEN recorded: `compile_*` (own artifacts), `notify_user`,
`web_search`.

**Tests:** `tests/eval/test_orchestrator_quality_gate.py` (8: golden behavior
gate with pass_rate == 1.0 HARD gate + judge-machinery unit tests),
`tests/security/test_redteam_loop.py` (46: 18 Tier-1 must-block + pattern
coverage, 4 Tier-2 containment + obfuscation-drift lock, registry audit +
accepted-OPEN drift lock + destructive-intent checks).

## Test results

| Suite                                      | Result                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| quality gate (new)                         | 8/8                                                                                                                      |
| red-team (new)                             | 46/46 — Tier-1 bypass rate **0/18**                                                                                      |
| eval neighbors (retrieval/learning/rrf/ws) | 24/24                                                                                                                    |
| eval execution + ai_evaluation             | 20/20                                                                                                                    |
| router / mvp_scope / catalog               | 61/61                                                                                                                    |
| security full dir                          | 233/233 (44 + 164 + 25)                                                                                                  |
| other session's Wave-1 tests               | 12/12                                                                                                                    |
| cont-p12 retrieval                         | 9/9                                                                                                                      |
| gaps_closure                               | 28/29 — 1 failure `send_slack_message invalid_auth` **proven pre-existing** (fails identically with executor.py stashed) |

## Concurrency note (shared working tree)

A parallel session is active in the same tree (LangGraph F-02/F-10/F-13 +
cards/context-budget/state-store work; untracked files observed growing during
this wave). Discipline held: all Wave-2 edits additive, no shared-file
conflicts; their `test_agentic_scale_safety.py` (12) passes against Wave-1 code.
Recommendation: coordinate before either session edits `agent_eval.py`,
`loop.py`, `router.py`, or `base.py` further (all now shared hot files).

## Gate verdict: GO

G-04/G-07 CLOSED. Restrictions carried: (1) budgets opt-in (Wave 1); (2)
model-gullibility (novel obfuscation vs a live model) needs
`INJECTION_LLM_CLASSIFIER=true` + live-key runs — mock CI cannot test model
gullibility, Tier-2 locks containment only; (3) pre-existing slack env failure
unrelated. Handoff: **Wave 3 authorized** (shared loop state — note parallel
session's `orchestrator/state_store.py` may already cover part of it; reconcile
before starting).
