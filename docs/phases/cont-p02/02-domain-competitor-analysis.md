# CONT-P02 — 02 Domain / Competitor Analysis -- Enterprise Capability Gaps

**Deliverable:** `DEL-CONT-P02-02` | **Owner:** Domain Specialist | **Date:**
2026-08-28

## 1. Domain: Existing Vaeloom Capabilities vs Enterprise `06` Vision

| Capability      | MVP `01:149 8 agents`                                                   | Enterprise `06:712 28 agents`                                                                                                                        | Gap Analysis                                                                               | Build vs Buy Lean                                                                                          |
| --------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Memory taxonomy | `6 Profile/Document/Career/Episodic/Preference/Working`                 | `22 additive` `603` `Skill Learning Preference Relationship Task Goal Project Research Behavior Context Semantic Procedural Timeline Event Decision` | Expand via shadow reads `CONT-P12` stable IDs                                              | **Build** (additive schema)                                                                                |
| Agents          | `organization,memory,resume,ats,job_search,application,gmail,scheduler` | `+ Workspace,Career,Learning,Research,Coding,GitHub,Calendar,Internship,Analytics,Recommendation,Security,Plugin,Reflection`                         | Shadow `AGENT_REACT_ENABLED=false` → eval                                                  | **Build** via `AGENT_REGISTRY 22` already 22 of 28 partially seeded                                        |
| Connectors      | `Gmail,Drive,GitHub,ONE dir,VSCode (NOT IMPLEMENTED)` `01:168`          | `Drive/Dropbox/OneDrive,Gmail/Slack/Discord,GitHub/GitLab,LinkedIn/Indeed/Naukri,LeetCode,YouTube,Notion/Figma` `06:441`                             | `registry 14` covers 11 `06` categories; missing `Dropbox/OneDrive/Lever fine-grained/LMS` | **Buy** for OneDrive `Graph API` already `graph_calendar onedrive` tools exist; **Build** for internal LMS |
| Platform        | `Redis/BullMQ` `queue 20`                                               | `Temporal 8 queues` `Kafka` deferred                                                                                                                 | `migration.md 45` strangler `CONT-P07`                                                     | **Build** strangle already done `temporal:7233` `CONT-P00`                                                 |

## 2. Competitor / Standards Benchmark (not feature-count)

| Vendor / Spec                        | Portability                                    | Exit Cost                                          | Privacy                         | Reliability                 | Unit Econ                 | Decision                                                                                      |
| ------------------------------------ | ---------------------------------------------- | -------------------------------------------------- | ------------------------------- | --------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| pgvector vs `QDRANT_URL` vs Pinecone | `pgvector` pooled RLS `42/42` portability high | Qdrant exit via `ENABLE_VECTOR_RAG=1` flag already | `tenant_id` isolation pooled    | `p95 120ms` <200 20 RPS SLI | `$0.02/1k`                | **Keep pgvector as primary, Qdrant as optional `has_vector_store` flag** per `loop._assemble` |
| Gmail push (`EXT-12`) vs polling     | Push needs renewal/reconciliation              | Polling exits via `agent_schedules 60s`            | Least-privilege OAuth `RFC9700` | Push miss = lost deadline   | Polling fallback `0 mock` | **Dual: push + polling fallback per `gmail_agent handler 8760`**                              |
| SLSA L2 vs vendor signed images      | `syft spdx 420KB + cosign KMS 2.2.4`           | Vendor lock low                                    | SLSA provenance                 | Build source provenance     | `SLSA 1.2`                | **Keep SLSA L2**                                                                              |

**One-customer trap avoided:** No vendor/protocol becomes irreversible without
adapter — `mcp_client_service` bridges `mcp__* dynamic`
`TOOL_TIMEOUT_OVERRIDES 30s` per `06 458`, not hardcoded single provider.

---

_Evidence: `integrations/registry 14` + `AGENT_REGISTRY 22` +
`tool_definitions 49` + `loop 20 RPS headroom 60%`._
