# CONT-P12 — 06 Security/Privacy — AI & Data

**Date:** 2026-09-01 | **Reviewers:** Security Arch, Privacy Eng, AI Safety Lead

## Threats — OWASP Agentic 2026 + LLM Top10 2025

| Risk                       | Control                                                                                                            | Evidence                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Goal hijack / tool misuse  | `agent_runtime` `AgentPolicy.allowed_tools` + `approval` gate + tools cannot change policy (`sanitize_retrieved`)  | `agent_runtime.py:68` markers → `[UNTRUSTED_DATA quoted]` + `injection_classifier.py` gated `prompt_injection_check` |
| Memory/context poisoning   | Confidence/contradiction `confidence` `contradiction_flags` `persist_version old_state/new_state` no fabrication   | `memory_service.py:44` lineage + `0027` contradiction_flags                                                          |
| Identity/privilege abuse   | `TenantMiddleware` `app.workspace_id` + `app.user_id` + `app.tenant_id` GUC fail-closed 42/42 RLS                  | `database.py:30` `middleware/tenant.py` retained CONT-P11                                                            |
| Sensitive disclosure / PII | `_redact 9 keys` + `EncryptedString` content + workspace isolation `search_all` filters `workspace_id.isnot(None)` | `logging.py:19` + `search_service.py:134`                                                                            |
| Excessive agency           | `max_budget_usd 0.50` + `timeout_s 30` + `max_retries 2` + `requires_approval` + `kill_switch` per agent           | `agent_runtime.py:16` + `config.agent_kill_switches`                                                                 |
| Supply chain / provider    | BYOK `explicit>workspace>user>system` + ` MODEL_CATALOG` pinned versions + `prompt_registry` checksum              | `llm_service.py:34` + `model_router.py:1` + `prompt_registry.py:10`                                                  |

## Privacy — GDPR / DPDP / FERPA / COPPA

- No new PII collection this phase (memory taxonomy additive only, annotation
  not collection).
- `consent` / `gdpr` / `erasure` retained 31 paths `gdpr.py:31` +
  `retention 0021`.
- Workspace isolation verified `search_service 10 passed` +
  `memory_service 28 passed` — cross-workspace retrieval 403.
- `AI BoM` `model_lineage_enabled` records provider/model/prompt/tool/retrieval
  for DPIA All Regions 3 DPA 5.2 (CONT-P13 deep review unchanged).

## AI governance — NIST AI RMF + EU AI Act 2026-08-02 transparency

Govern/Map/Measure/Manage via `eval_harness` 10 cases + `shadow_compare`
quality/safety/lineage/latency/cost + `model_router` cost + human approval
`requires_approval` + residual-risk ownership per `00-audit` BQ-06
`REQUIRES_STAKEHOLDER_DECISION` (provider/data-use terms). No self-claim
compliance without legal review (per phase 16).

---

_Validated via `test_cont_p12` injection block + `test_memory_service` RLS._
