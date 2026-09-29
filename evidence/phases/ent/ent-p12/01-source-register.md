# ENT-P12 — 01 Source Register — Authoritative Architecture & Standards Mapping

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** Supporting Source Register Specification  
> **Owner:** Principal Enterprise AI Architect & Cognitive Systems Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Authoritative Sources

| Source ID  | Document / Source Path                                          | Authority / Owner             | Applicable Scope & Policy Directives                                                                                               |
| :--------- | :-------------------------------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Enterprise Architecture Board | Governing 32-section phase lifecycle, §28 gate scoring protocol ($\ge 95.0$), and immutable evidence registers.                    |
| **INT-02** | `specs/phase-contracts/03-enterprise/ENT-P12-*.md`              | AI Systems Directorate        | Canonical governing phase contract for AI, Agent, Memory, and Data-Pipeline Implementation.                                        |
| **INT-03** | `specs/ai/REGISTRY_INDEX.md`                                    | Core AI Architecture          | Canonical 28-agent roster index, 8 architectural planes, tool trust tiers, and JSON card output schemas.                           |
| **INT-04** | `apps/api/src/api/agents/README.md`                             | Agent Engineering Lead        | 28 specialist agent modules (8 MVP, 13 Enterprise, 7 Meta/Core), Plan-Act-Observe-Reflect-Improve ReAct loop.                      |
| **INT-05** | `apps/api/src/api/schemas/memory.py`                            | Data Engineering Lead         | 22 memory type taxonomy (6 canonical + 16 enterprise additive per migration 0027), validation rules, and non-empty content guards. |
| **INT-06** | `apps/api/src/api/services/scale_memory_service.py`             | Retrieval Engineering         | pgvector HNSW semantic indexing, cosine distance search, multi-tier memory retrieval, and SHA-256 lineage tracking.                |
| **INT-07** | `apps/api/src/api/agents/memory/consolidator.py`                | Memory Systems Team           | Entity extraction, graph merge, duplicate reconciliation, confidence decay, and contradiction resolution.                          |
| **INT-08** | `apps/api/src/api/services/mcp_client_service.py`               | Integrations & Tooling        | Sandboxed Model Context Protocol (MCP v2) client service, stdio and streamable-HTTP isolation, dynamic discovery.                  |
| **INT-09** | `apps/api/src/api/orchestrator/loop.py`                         | AI Safety Lead                | ReAct execution engine, 3-retry QA validation loop, and `lookup_approval()` Human-in-the-Loop (HITL) gate enforcement.             |
| **INT-10** | `evidence/phases/ent/ent-p11/09-handoff-to-ent-p12.md`          | Backend Lead (`ENT-P11`)      | Certified handoff confirming 731 passing tests, 42/42 FORCE RLS, session GUC injection, and zero blockers.                         |

---

## 2. External Authoritative Standards & Regulatory Frameworks

| Standard ID | Official Specification                    | Issuing Body                  | Enforced Version / Snapshot | Direct Architectural Influence                                                                                                  |
| :---------- | :---------------------------------------- | :---------------------------- | :-------------------------: | :------------------------------------------------------------------------------------------------------------------------------ |
| **EXT-01**  | Model Context Protocol (MCP)              | Anthropic / MCP Project       |   2026-07-28 Spec Profile   | Sandboxed connector bridge, capability registration, version-pinned profiles, and read-only hints.                              |
| **EXT-02**  | OWASP Top 10 for Agentic Applications     | OWASP Foundation              |    2026 Official Edition    | Mitigation of agent goal hijacking, tool misuse, identity/privilege abuse, memory context poisoning, cascading agent failures.  |
| **EXT-03**  | OWASP Top 10 for LLM Applications         | OWASP Foundation              |      2025/2026 Release      | Guardrails against direct and indirect prompt injection, sensitive data leakage, and excessive agency.                          |
| **EXT-04**  | NIST AI Risk Management Framework         | NIST                          | AI RMF 1.0 + GenAI Profile  | Govern, Map, Measure, Manage governance, continuous evaluation, human oversight, and residual-risk logging.                     |
| **EXT-05**  | European Union AI Act                     | European Parliament / Council |  Regulation (EU) 2024/1689  | Mandatory transparency badging, high-risk employment AI classification, candidate sovereignty, and human-in-the-loop oversight. |
| **EXT-06**  | General Data Protection Regulation        | European Union                |  Regulation (EU) 2016/679   | Art. 17 right to erasure (KMS DEK destruction), Art. 22 automated decision-making safeguards, purpose limitation.               |
| **EXT-07**  | Digital Personal Data Protection Act      | Government of India           |    Act 2023 & Rules 2025    | Notice/consent requirements, sovereign candidate data rights, purpose limitation, and cross-border processing safeguards.       |
| **EXT-08**  | Family Educational Rights and Privacy Act | US Department of Education    |       34 CFR Part 99        | Student education records privacy, school official role-based controls, and institutional audit trails.                         |
| **EXT-09**  | Children's Online Privacy Protection Act  | US Federal Trade Commission   |       16 CFR Part 312       | Strict age gating ($< 13$ years exclusion); zero child data collection across candidate onboarding and career tools.            |
| **EXT-10**  | OpenTelemetry Semantic Conventions        | CNCF / OpenTelemetry          |  GenAI Conventions v1.27+   | Distributed trace context propagation across agent ReAct trajectories, LLM prompt/completion token metrics, span redaction.     |

---

_Signed: Principal Enterprise AI Architect & Cognitive Systems Lead —
2026-09-29_
