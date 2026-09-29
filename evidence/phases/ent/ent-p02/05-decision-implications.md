# ENT-P02 — 05 Decision Implications & Build-vs-Buy Evaluation

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** `DEL-ENT-P02-05` (v1.0)  
> **Owner:** Chief Architect & Lead Platform Strategist  
> **Reviewed By:** VP Engineering, CISO, Financial Operations Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Rigorous Build-vs-Buy Evaluation Framework

In accordance with Section 144 of the governing contract, build-vs-buy
evaluations are benchmarked against **Portability**, **Exit Cost**, **Data
Privacy / Sovereignty**, **Reliability & SLOs**, and **Unit Economics**—not
marketing feature checklists.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   BUILD-VS-BUY DECISION MATRIX                         │
├─────────────────────┬───────────────────┬──────────────┬───────────────┤
│ ARCHITECTURAL SUBSYS│ EVALUATED OPTIONS │ DECISION     │ CORE RATIONALE│
├─────────────────────┼───────────────────┼──────────────┼───────────────┤
│ Vector Indexing     │ pgvector vs       │ BUILD        │ Zero egress;  │
│                     │ Pinecone / Qdrant │ (pgvector)   │ 42/42 RLS PG  │
├─────────────────────┼───────────────────┼──────────────┼───────────────┤
│ Cognitive Reasoning │ Proprietary Cloud │ HYBRID       │ Sub-50ms S1;  │
│                     │ vs Two-Tier Model │ (Two-Tier)   │ local fallback│
├─────────────────────┼───────────────────┼──────────────┼───────────────┤
│ Document Rendering  │ PDF SaaS vs       │ BUILD        │ Air-gapped;   │
│                     │ Playwright Pool   │ (Playwright) │ zero data leak│
├─────────────────────┼───────────────────┼──────────────┼───────────────┤
│ Connector Runtime   │ Zapier / Workato  │ BUILD        │ Sandboxed,    │
│                     │ vs MCP SDK Client │ (MCP SDK v2) │ capability-gtd│
├─────────────────────┼───────────────────┼──────────────┼───────────────┤
│ Identity & SCIM     │ Okta / Auth0 vs   │ HYBRID       │ SAML/SCIM     │
│                     │ Keycloak / Custom │ (Self-Hosted)│ cell portable │
└─────────────────────┴───────────────────┴──────────────┴───────────────┘
```

---

### Deep-Dive Analysis per Subsystem:

#### 1. Vector Store: pgvector (PostgreSQL 16) vs External Vector SaaS (Pinecone / Qdrant)

- **Portability:** pgvector is 100% open-source SQL, portable across AWS RDS,
  Supabase, Google Cloud SQL, and bare-metal Kubernetes.
- **Exit Cost:** Zero. Migrating data between PostgreSQL instances requires
  standard `pg_dump`.
- **Privacy & Sovereignty:** Uncompromising. Vectors reside in the exact same
  relational table and partition as candidate records, inheriting PostgreSQL
  Row-Level Security (`RLS`) fail-closed GUC session enforcement. External SaaS
  requires sending embeddings and document IDs outside the cell boundary.
- **Unit Economics:** Negligible marginal cost (utilizes existing PostgreSQL
  RAM/CPU). Pinecone enterprise clusters cost $\ge \$1,500/\text{month}$ per
  tenant cell.
- **Decision:** **BUILD (pgvector in PostgreSQL 16)**.

#### 2. Cognitive Inference Pipeline: Two-Tier Architecture vs Pure Closed-Source SaaS

- **Portability:** High. Standardized OpenAI-compatible API schemas
  (`https://ollama.com/v1`, `http://localhost:11434/v1`).
- **Exit Cost:** Low. Can switch between Gemma 4, Llama 3.3, and Claude 3.7 with
  configuration flags.
- **Privacy & Sovereignty:** Strict zero-retention enterprise contracts on cloud
  endpoints; fully air-gappable local fallback on `gemma4:12b`.
- **Reliability:** Two-tier model provides 99.95% resilience. If Ollama Cloud
  experiences latency spikes, System 1 deterministic rules (TypeSafe AI) handle
  triage while local Ollama synthesizes documents.
- **Unit Economics:** $\le \$0.28\text{
  USD}$ per document tailored vs $\$1.40–\$2.50\text{ USD}$ on proprietary
  multi-agent loops.
- **Decision:** **HYBRID TWO-TIER (TypeSafe AI Jev System 1 + Ollama Cloud Gemma
  4 31B with local fallback)**.

#### 3. Document Compilation Engine: Self-Hosted Playwright Chromium vs External PDF API

- **Portability:** Open-source Playwright runtime embedded directly in
  containerized worker pods.
- **Exit Cost:** Zero. HTML/CSS Jinja2 templates are completely open standards.
- **Privacy & Sovereignty:** Maximum. Candidate resumes are rendered entirely
  in-memory; zero unencrypted transmission over the public internet to
  third-party conversion services.
- **Reliability:** Headless browser processes are managed via container process
  pools with memory caps (`1,024MB`) and automatic recycling after 20 renders to
  prevent memory leaks.
- **Unit Economics:** $\$0.08–\$0.10\text{
  USD}$ compute expense per render vs $\$0.25–\$0.50$ per API call on commercial
  PDF SaaS.
- **Decision:** **BUILD (Containerized Playwright Chromium Pool)**.

#### 4. Enterprise Connector Runtime: Model Context Protocol (MCP) Client vs Enterprise iPaaS

- **Portability:** Official `mcp` SDK v2 protocol; open-source standard with
  multi-vendor adoption.
- **Exit Cost:** Low. MCP tools bridge as typed functions
  (`mcp__<Server>__<Tool>`) into the dynamic executor.
- **Privacy & Security:** Fine-grained tool scoping (`connector.mcp.execute`),
  SSRF URL guarding (`url_guard.py`), and deterministic approval interception
  for non-read-only actions.
- **Decision:** **BUILD (Official MCP Client Runtime)**.

---

## 2. Living External-Dependency Radar (Overlay §143)

The following radar tracks external API contracts, rate limits, change
advisories, and architectural mitigations:

| Dependency / Service   | Protocol / Version | Rate Limits & Quotas                                 | Deprecation / Security Watch                              | Architectural Safeguard                                                    |
| :--------------------- | :----------------- | :--------------------------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------- |
| **Google Gmail API**   | REST API v1        | 250 quota units/sec; Push watch expires every 7 days | OAuth token expiration; webhook push renewal drops        | `gmail_agent` background reconciler; automatic renewal 24h prior to expiry |
| **Microsoft Graph**    | REST v1.0          | 10,000 req/10 min per app; throttling response (429) | Identity deprecation of legacy ADAL; Graph API versioning | Sliding-window token bucket in `rate_limit.py`; exponential backoff        |
| **Greenhouse Harvest** | REST v1            | 50 requests per 10-second window                     | API key rotation; webhook signature HMAC verification     | BullMQ rate-limited queue worker; HMAC-SHA256 signature verification       |
| **TypeSafe AI Jev**    | Native v1          | 100 RPS burst; sub-50ms latency                      | Upstream service health; key rotation                     | Circuit breaker (3/30s); fallback to local deterministic action tree       |
| **Ollama Cloud**       | OpenAI-compat v1   | Enterprise tier concurrency (50 parallel streams)    | Model weights upgrade (`gemma4:31b` to newer releases)    | Local Ollama `gemma4:12b` warm container standby; circuit breaker          |

---

## 3. Architecture Decisions Certified for ENT-P03

1. **ADR-ENT-01: pgvector Primary Vector Store:** Formally certified as the
   single vector indexing engine across all enterprise cells.
2. **ADR-ENT-02: Two-Tier Cognitive Pipeline:** Formally certified; 30% System 1
   (TypeSafe AI) + 70% System 2 (Gemma 4 31B).
3. **ADR-ENT-03: Playwright Chromium Document Rendering:** Formally certified
   for high-fidelity PDF and DOCX compilation.
4. **ADR-ENT-04: Standardized MCP Connector Infrastructure:** Formally certified
   for all external integrations.

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Reference:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P02-research-domain-analysis-and-data-discovery.md`
  §11 (WS-02.5) and §22 (`DEL-ENT-P02-05`).
- **Predecessor Link:** Answers the architectural feasibility questions raised
  in `DEL-ENT-P01-01` and `DEL-ENT-P01-05`.
- **Handoff Target:** Provides the firm technical decision baseline for
  `ENT-P03` (Requirements Engineering).
