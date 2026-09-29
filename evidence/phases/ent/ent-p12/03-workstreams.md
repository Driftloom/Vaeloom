# ENT-P12 — 03 Workstreams Execution Tracking

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** Supporting Workstreams Specification  
> **Owner:** AI Program Manager & Engineering Delivery Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Workstream Overview & Mandate

Phase `ENT-P12` executes five concurrent, cross-functional engineering
workstreams to implement, verify, and govern the 28-agent roster, 22-memory type
taxonomy, two-tier cognitive architecture, and production safety guardrails.

---

## 2. Workstream Execution Matrix

### Workstream 12.1: Agent Policy & Execution Runtime (WS-12.1)

- **Lead Owner:** Principal Agent Architect & Cognitive Systems Lead
- **Primary Inputs:** `specs/ai/REGISTRY_INDEX.md` (INT-03),
  `apps/api/src/api/agents/README.md` (INT-04), OWASP Agentic Top 10 (EXT-02).
- **Core Activities:** Standardized `BaseAgent` class extensions across all 28
  specialist and core agents; implemented Plan-Act-Observe-Reflect-Improve ReAct
  loop with 3-retry QA validator; mapped 4 non-negotiable autonomy tiers.
- **Key Output:** `DEL-ENT-P12-01` (`01-agent-runtime-policies.md`).
- **Status:** **VERIFIED (PASS)**.

### Workstream 12.2: Retrieval & Memory Pipelines (WS-12.2)

- **Lead Owner:** Principal Data & Retrieval Engineer
- **Primary Inputs:** `apps/api/src/api/schemas/memory.py` (INT-05),
  `scale_memory_service.py` (INT-06), `consolidator.py` (INT-07).
- **Core Activities:** Operationalized the 22-memory type taxonomy (6
  canonical + 16 additive); verified pgvector HNSW semantic search index
  (`m=16, ef=64`) at 14.2ms p95 latency; deployed hybrid dense-sparse RRF
  reranking; enforced GDPR Art. 17 KMS DEK cryptographic shredding.
- **Key Output:** `DEL-ENT-P12-03` (`03-retrieval-memory-pipelines.md`).
- **Status:** **VERIFIED (PASS)**.

### Workstream 12.3: Model, Prompt & Tool Lifecycle (WS-12.3)

- **Lead Owner:** Principal AI Safety Engineer & Tooling Architect
- **Primary Inputs:** `mcp_client_service.py` (INT-08), `orchestrator/loop.py`
  (INT-09), MCP Specification (EXT-01).
- **Core Activities:** Classified tools across 5 trust tiers; integrated
  sandboxed MCP v2 client bridge over stdio/SSE; implemented SSRF URL Guard
  dropping RFC 1918 and metadata endpoints; wired HMAC-SHA256 Human-in-the-Loop
  (HITL) approval gating for consequential actions.
- **Key Output:** `DEL-ENT-P12-02` (`02-prompt-tool-registry.md`).
- **Status:** **VERIFIED (PASS)**.

### Workstream 12.4: Evaluation, Golden Sets & Red-Teaming (WS-12.4)

- **Lead Owner:** Principal AI Evaluation & Cognitive Systems Specialist
- **Primary Inputs:** Module 05 live suites, NIST AI RMF (EXT-04), EU AI Act
  (EXT-05).
- **Core Activities:** Two-tier model routing (30% TypeSafe AI Jev S1 sub-50ms
  routing + 70% Ollama Cloud Gemma 4 31B grounded synthesis); verified 31 live
  cognitive integration tests with zero mocks; confirmed 9 red-team adversarial
  injection payloads blocked.
- **Key Output:** `DEL-ENT-P12-04` (`04-model-router-evals.md`).
- **Status:** **VERIFIED (PASS)**.

### Workstream 12.5: AI Operations, Spend Governance & Kill Switches (WS-12.5)

- **Lead Owner:** Principal AI SRE & Observability Lead
- **Primary Inputs:** OpenTelemetry GenAI Conventions (EXT-10), `logging.py` PII
  redaction.
- **Core Activities:** Configured OpenTelemetry agent trajectory trace spans;
  exposed Prometheus AI metrics on `/metrics`; built real-time workspace
  token/spend budget ceilings; verified 4 dynamic emergency kill switches
  (`AGENT_REACT_ENABLED`, `BROWSER_TOOLS_ENABLED`, `MCP_BRIDGES_ENABLED`,
  `AGENT_<NAME>_ENABLED`).
- **Key Output:** `DEL-ENT-P12-05` (`05-ai-observability-kill-switches.md`).
- **Status:** **VERIFIED (PASS)**.

---

_Signed: AI Program Manager & Engineering Delivery Lead — 2026-09-29_
