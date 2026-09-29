# ENT-P12 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** `DEL-ENT-P12-08` — Consolidated Governance Registers  
> **Owner:** AI Governance Custodian & Systems Release Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                               | Severity |           Impact            | Mitigation Strategy                                                                                                             | Owner          |     Status     |
| :------------------ | :------------------------------------------------------------------------------------------------------------- | :------: | :-------------------------: | :------------------------------------------------------------------------------------------------------------------------------ | :------------- | :------------: |
| **RISK-ENT-P12-01** | Indirect prompt injection through adversarial content hidden in uploaded resumes or scraped job descriptions.  |   High   |  Agent instruction hijack   | Wrap all retrieved/scraped text in `[UNTRUSTED_DATA]` markers, cap length at 4,000 chars, enforce XML fences.                   | AI Safety Lead | **CONTROLLED** |
| **RISK-ENT-P12-02** | Autonomous execution of consequential actions (application submission, email dispatch) without user awareness. | Critical |  Candidate reputation harm  | Enforce Tier 4 HMAC-SHA256 Human-in-the-Loop (HITL) approval gate; require signed user confirmation before dispatch.            | Security Lead  | **CONTROLLED** |
| **RISK-ENT-P12-03** | Stale or contradictory memory nodes accumulate over time, causing hallucinated or conflicting resume bullets.  |  Medium  |    Lower ATS match score    | `MemoryConsolidatorAgent` runs background reconciliation, tracks `supersedes_id` DAG, and prompts on low confidence.            | Memory Lead    | **CONTROLLED** |
| **RISK-ENT-P12-04** | Cloud LLM provider latency spikes or outages (Ollama Cloud / TypeSafe AI) stalling agent chat sessions.        |   High   | User experience degradation | Circuit breaker trips after 3 consecutive failures; requests automatically degrade to local Ollama 12B model or rule templates. | AI Architect   | **CONTROLLED** |
| **RISK-ENT-P12-05** | Agent reasoning runaway loops or excessive tool iterations exhausting token budgets and inflating cloud costs. |   High   |    Cloud billing spikes     | Hard execution limit of 30s per turn; per-turn token ceilings (16k in, 4k out); workspace monthly spend caps with auto-freeze.  | FinOps Lead    | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                              | Context & Alternatives                                                                                                                    | Chosen Rationale                                                                                                                              |    Status    |
| :----------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P12-01** | **Two-Tier Cognitive Separation (Jev S1 + Gemma 4 S2)**     | Alt A: Route all queries to a single heavy LLM.<br>Alt B: TypeSafe AI Jev S1 for routing/triage + Ollama Cloud Gemma 4 31B for synthesis. | Chose Alt B. Cuts deterministic action latency to $< 50\text{ms}$ while preserving high-capacity generative synthesis for tailored documents. | **APPROVED** |
| **DEC-ENT-P12-02** | **22-Memory Type Taxonomy via Additive Migrations**         | Alt A: Overwrite database with brand new schema.<br>Alt B: Expand canonical 6 types with 16 additive types via migration 0027.            | Chose Alt B. Zero downtime, full backward compatibility with MVP data, and explicit Pydantic schema validation.                               | **APPROVED** |
| **DEC-ENT-P12-03** | **pgvector HNSW Cosine Indexing with Hybrid BM25**          | Alt A: External Pinecone / Weaviate vector database.<br>Alt B: Native PostgreSQL `pgvector` HNSW indexing with lexical RRF.               | Chose Alt B. Keeps embeddings inside PostgreSQL RLS transaction boundaries; prevents data egress and simplifies ACID transactions.            | **APPROVED** |
| **DEC-ENT-P12-04** | **HMAC-SHA256 Cryptographic HITL Approval Tokens**          | Alt A: Simple boolean flag in database.<br>Alt B: Signed HMAC-SHA256 tokens with 15m TTL and single-use Redis nonces.                     | Chose Alt B. Cryptographically guarantees that only the authenticated candidate who reviewed the diff can authorize consequential tools.      | **APPROVED** |
| **DEC-ENT-P12-05** | **Strict Structural XML Fencing & Untrusted Data Wrapping** | Alt A: Raw string prompt concatenation.<br>Alt B: Explicit `<system_instructions>` and `[UNTRUSTED_DATA]` markers.                        | Chose Alt B. Proven industry defense against both direct and indirect prompt injection attacks per OWASP GenAI Top 10.                        | **APPROVED** |
| **DEC-ENT-P12-06** | **Redis-Backed Dynamic Emergency Kill Switches**            | Alt A: Code deployment required to disable agents.<br>Alt B: Instantaneous Redis flags (`AGENT_REACT_ENABLED`, etc.).                     | Chose Alt B. Enables SREs to halt runaway loops, disable compromised tools, or mute failing agents in $< 1\text{ second}$.                    | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                           | Validation Method                                                                    | Invalidation Action                                                                     |    Status     |
| :----------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P12-01** | TypeSafe AI Jev System 1 maintains sub-50ms latency across 99% of production routing requests.    | Verified via `test_jev_actions.py` latency histograms (measured 32ms p95).           | Activate local deterministic fallback heuristic table if cloud latency exceeds 150ms.   | **VALIDATED** |
| **ASM-ENT-P12-02** | pgvector HNSW semantic index query completes within 15ms under 100,000 entity vectors.            | Benchmark suite measuring pgvector retrieval latency (measured 14.2ms p95).          | Tune HNSW `ef_search` parameter or shard candidate memory tables across regional cells. | **VALIDATED** |
| **ASM-ENT-P12-03** | Structural XML context fencing prevents indirect prompt injection from leaking candidate secrets. | Verified via 9/9 passing adversarial red-team tests (`tests/adversarial/module05/`). | Quarantine external document parser outputs if unescaped control tags are detected.     | **VALIDATED** |
| **ASM-ENT-P12-04** | Redis cluster maintains $> 99.99\%$ availability for HMAC approval token nonce consumption.       | Failover testing on Redis 7.2 sentinel cluster.                                      | Persist approval state to PostgreSQL transactional table if Redis becomes unavailable.  | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category          | Primary Deliverable    | Implementing Spec / Policy                      | Verification                           |    Status    |
| :------------------- | :---------------- | :--------------------- | :---------------------------------------------- | :------------------------------------- | :----------: |
| **ENT-P12-R01**      | Agent Runtime     | `DEL-ENT-P12-01`       | `01-agent-runtime-policies.md`                  | 28-agent roster & autonomy tiers       | **VERIFIED** |
| **ENT-P12-R02**      | Tool Registry     | `DEL-ENT-P12-02`       | `02-prompt-tool-registry.md`                    | 5 trust tiers & MCP sandboxing         | **VERIFIED** |
| **ENT-P12-R03**      | HITL Approval     | `DEL-ENT-P12-02`       | `02-prompt-tool-registry.md`                    | HMAC-SHA256 signed approval gates      | **VERIFIED** |
| **ENT-P12-R04**      | Memory Pipelines  | `DEL-ENT-P12-03`       | `03-retrieval-memory-pipelines.md`              | 22 memory types + pgvector HNSW        | **VERIFIED** |
| **ENT-P12-R05**      | Cognitive Routing | `DEL-ENT-P12-04`       | `04-model-router-evals.md`                      | Jev S1 sub-50ms + Gemma 4 S2           | **VERIFIED** |
| **ENT-P12-R06**      | AI Observability  | `DEL-ENT-P12-05`       | `05-ai-observability-kill-switches.md`          | OTel traces + /metrics + kill switches | **VERIFIED** |
| **ENT-P12-R07**      | Quality Gate      | `DEL-ENT-P12-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p13.md` | Score: 99.31 / 100 (Full GO)           | **VERIFIED** |

---

_Signed: AI Governance Custodian & Systems Release Lead — 2026-09-29_
