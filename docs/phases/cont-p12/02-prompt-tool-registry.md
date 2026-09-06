# CONT-P12 — 02 Prompt/Tool Registry — DEL-CONT-P12-02

**Deliverable:** `DEL-CONT-P12-02` | **Version:** 1.0 | **Date:** 2026-09-01 |
**Owner:** AI/ML Engineer | **Reviewers:** Data Eng, Security

## Versioned lifecycle — task 5

`apps/api/src/api/services/prompt_registry.py:1` — `PromptRegistry`
`PromptVersion` `checksum sha256[:16]` `lineage`

| Prompt             | Latest | Model                      | Tools                                    | Checksum |
| ------------------ | ------ | -------------------------- | ---------------------------------------- | -------- |
| memory_extract     | v1.0   | claude-3-5-sonnet-20241022 | memory_create                            | sha256   |
| retrieval_hybrid   | v1.0   | claude-3-haiku-20240307    | search_all, search_memories, kg_traverse | sha256   |
| red_team_injection | v1.0   | gpt-4o-mini                | injection_classifier                     | sha256   |

**Tool lifecycle:** `register_tool(name, version, definition)` → `checksum` +
`owner` + `created_at`. `get_tool(name, version?)` latest by `created_at`. No
silent mutation — every change new `vN.0`.

**Lineage:** `PromptVersion.lineage` → persisted via `memories.lineage JSONB`
`0027` + `memory_taxonomy_ledger` `checksum`. AI BoM per
`config.ai_bill_of_materials_enabled`.

**Migration:** Existing prompts frozen at `v1.0`; new enterprise prompts
(`project/skill/...` 16 types) added as `v1.0` per taxonomy expand-contract, no
overwrite of `memory_extract` v1.

**Evidence:** `tests/test_cont_p12_agent_model_retrieval.py:30`
`test_prompt_registry_versioned` 9 passed; `prompt_registry.list_prompts()` 3
entries.

---

_Version 1.0 2026-09-01 —
`rg "PromptRegistry" apps/api/src/api/services/prompt_registry.py`._
