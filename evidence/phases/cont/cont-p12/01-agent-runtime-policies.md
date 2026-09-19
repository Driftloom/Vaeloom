# CONT-P12 — 01 Agent Runtime & Policies — DEL-CONT-P12-01

**Deliverable:** `DEL-CONT-P12-01` | **Version:** 1.0 | **Date:** 2026-09-01 |
**Owner:** AI/ML Engineer + AI Safety Lead | **Reviewers:** Security Arch, SRE

## Runtime — mission/tools/memory/risk/budget/timeout/fallback/approval

`apps/api/src/api/services/agent_runtime.py:1` — shared runtime `AgentRuntime`
`AgentPolicy` `AgentRunContext`

| Agent      | Mission                              | Allowed tools                            | Budget | Timeout | Approval     | Kill switch                            |
| ---------- | ------------------------------------ | ---------------------------------------- | ------ | ------- | ------------ | -------------------------------------- |
| memory     | Extract/merge memory with provenance | memory_create, memory_update             | $0.50  | 30s     | false        | `config.agent_kill_switches["memory"]` |
| retrieval  | Hybrid retrieval provenance          | search_all, search_memories, kg_traverse | $0.50  | 30s     | false        | —                                      |
| resume     | Generate resume provenance           | resume_generate, ats_score               | $0.50  | 30s     | false        | —                                      |
| job_search | Fan-out dedup                        | job_search, browse_job_page              | $0.50  | 30s     | false        | —                                      |
| gmail      | Classify draft-only NEVER send       | gmail_classify, gmail_draft              | $0.50  | 30s     | true (draft) | —                                      |
| scheduler  | Schedule conflict check              | schedule_create                          | $0.50  | 30s     | false        | —                                      |
| github     | GitHub 7 tools least priv            | github_tools                             | $0.50  | 30s     | false        | —                                      |
| research   | Research data quarantine             | browse_job_page, scrape_company_insights | $0.50  | 30s     | false        | —                                      |

**Task 2 untrusted content:** `agent_runtime.sanitize_retrieved`
`services/agent_runtime.py:68` — retrieved/tool content cannot change policy.
Markers `ignore previous/all`, `system:`, `you are now`, `disregard policy`,
`delete files` → `[UNTRUSTED_DATA quoted]` + defense-in-depth
`services/injection_classifier.py` gated.

**Task 1 budget/timeout:** `check_budget` `check_timeout` `record_cost` →
`model_router.record_usage` lineage `model/tokens/cost_usd` + `ctx.lineage`.

**Task 7 shadow:** `shadow_compare` quality/safety/lineage/latency/cost →
`verdict candidate_better|primary_stays`; `agent_shadow_enabled`
`agent_shadow_percent` `config.py:158` (default 0, no shadow traffic until
CONT-P13 pilot).

**Failure modes:** timeout → retry `max_retries 2`; budget exceed → `429` +
ledger; kill_switch tripped → `503` fail-closed per `ZT-01` (mirrors Temporal
pattern `main.py:290`).

**Evidence:** `tests/test_cont_p12_agent_model_retrieval.py:20`
`test_agent_runtime_policy_and_sanitize` + `test_shadow_compare` 9 passed.

---

_Version 1.0 2026-09-01 —
`rg "agent_runtime" apps/api/src/api/services/agent_runtime.py`._
