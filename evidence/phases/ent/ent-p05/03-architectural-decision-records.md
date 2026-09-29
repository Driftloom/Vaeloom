# ENT-P05 — 03 Architectural Decision Records (ADRs)

> **Phase:** `ENT-P05` (Solution Architecture)  
> **Deliverable:** `DEL-ENT-P05-03` (v1.0)  
> **Owner:** Architecture Review Board (ARB) & Chief Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## ADR-041: Dedicated Regional Tenant Cells vs Logical Shared Database

- **Status:** **APPROVED**
- **Date:** 2026-09-29 | **Deciders:** Chief Architect, CISO, Data Protection
  Officer
- **Context:** Enterprise customers across higher education and corporate
  outplacement are subject to diverging data residency regulations: US FERPA, EU
  GDPR, and India DPDP 2025. A single multi-tenant database cluster with logical
  RLS poses data egress risks and fails strict sovereign residency audits.
- **Alternatives Considered:**
  1. _Logical Shared Multi-Tenant Database:_ Single global Supabase instance
     with RLS policies separating tenants.
  2. _Dedicated Regional Tenant Cells:_ Independent regional cells (US, EU,
     India) with isolated PostgreSQL databases, S3 buckets, and local worker
     pools.
- **Decision:** Adopt **Dedicated Regional Tenant Cells** (Alternative 2).
- **Consequences:** Eliminates cross-border data leakage risk. Enables
  per-region maintenance windows. Minor increase in base infrastructure costs
  (\$550/mo per region database), fully accounted for in FinOps models.

---

## ADR-042: Two-Tier Cognitive Router Architecture (System 1 + System 2)

- **Status:** **APPROVED**
- **Date:** 2026-09-29 | **Deciders:** AI Lead, FinOps Specialist, Platform Lead
- **Context:** Routing every agent tool call or decision through large
  generative models (e.g. 31B+ LLMs) induces high latency ($>1,200\text{ ms}$)
  and unsustainable token costs, violating the sub-\$0.38 unit economics
  ceiling.
- **Alternatives Considered:**
  1. _Pure Generative System:_ All routing and drafting performed by Ollama
     Cloud Gemma 4 31B.
  2. _Pure Rule-Based Heuristic:_ Hardcoded if-else trees for tool dispatch.
  3. _Two-Tier Cognitive Routing:_ System 1 (TypeSafe AI Jev native API) for
     sub-50ms deterministic action routing, similarity scoring, and destructive
     triage; System 2 (Ollama Cloud Gemma 4 31B) for grounded synthesis.
- **Decision:** Adopt **Two-Tier Cognitive Routing** (Alternative 3).
- **Consequences:** Sub-50ms decision routing; reduces generative token
  consumption by ~65%; lowers direct COGS to \$0.0787 per document package;
  proven 100% green in Module 05 live test suite.

---

## ADR-043: Native pgvector HNSW Indexing vs External Vector Database

- **Status:** **APPROVED**
- **Date:** 2026-09-29 | **Deciders:** Database Architect, Lead Backend
  Engineer, SRE
- **Context:** The platform requires high-speed vector similarity search over 22
  candidate memory types. Integrating a third-party vector SaaS (Pinecone,
  Qdrant) introduces an external failure domain, additional egress latency, and
  compliance audit friction.
- **Alternatives Considered:**
  1. _External Managed Vector SaaS (Pinecone):_ Hosted vector search over cloud
     API.
  2. _Native PostgreSQL pgvector HNSW Indexing:_ In-database vector search
     co-located with relational candidate data.
- **Decision:** Adopt **Native pgvector HNSW Indexing** (Alternative 2).
- **Consequences:** Co-locates relational candidate data with embeddings,
  allowing ACID transactional consistency; enforces database RLS directly on
  vector searches; delivers p95 query latency $<18\text{ ms}$ on 1536-dim
  embeddings.

---

## ADR-044: Workload Identity via Mutual TLS (mTLS)

- **Status:** **APPROVED**
- **Date:** 2026-09-29 | **Deciders:** Principal Security Engineer, DevOps Lead
- **Context:** As microservices scale across ingress gateways, API pods, Redis
  brokers, and Playwright worker pools, static API keys or network IP whitelists
  are vulnerable to lateral movement if a pod is compromised.
- **Alternatives Considered:**
  1. _Shared Secret Bearer Tokens:_ Static tokens injected via environment
     variables.
  2. _Mutual TLS (mTLS) with Cryptographic Workload Identity:_ Automated
     SPIFFE/SPIRE certificate issuance and rotation for all inter-pod traffic.
- **Decision:** Adopt **mTLS with Cryptographic Workload Identity** (Alternative
  2).
- **Consequences:** Zero-trust communication between all internal services;
  automatic certificate rotation every 24 hours; prevents unauthorized
  pod-to-pod eavesdropping.

---

## ADR-045: Candidate Sovereign Vault & Time-Bounded Consent Grant Model

- **Status:** **APPROVED**
- **Date:** 2026-09-29 | **Deciders:** CISO, Data Protection Officer, Product
  Manager
- **Context:** Universities and employers must not be permitted to browse
  personal candidate career memories, diary notes, or exploratory job searches
  without candidate consent.
- **Alternatives Considered:**
  1. _Employer/Institution Super-Admin Access:_ Institutional admins can view
     all candidate profile data.
  2. _Candidate Sovereign Vault with Granular Consent Grants:_ Candidate
     memories are locked by default; institutional advisors gain access only via
     cryptographically signed, time-bounded `ConsentGrant` records.
- **Decision:** Adopt **Candidate Sovereign Vault with Consent Grants**
  (Alternative 2).
- **Consequences:** Strictly adheres to FERPA and GDPR Art. 6; empowers
  candidates with lifelong portable career vaults; prevents institutional
  overreach and liability.

---

## ADR-046: Expand/Contract Zero-Downtime Blue/Green Database Migrations

- **Status:** **APPROVED**
- **Date:** 2026-09-29 | **Deciders:** Principal Release Engineer, DBA Lead,
  Lead SRE
- **Context:** University career portals experience continuous traffic during
  fall recruiting seasons. Database schema migrations that lock tables or
  require downtime cause 504 errors and breach the 99.95% availability SLA.
- **Alternatives Considered:**
  1. _Scheduled Maintenance Windows:_ Off-hours downtime for destructive schema
     migrations.
  2. _Expand/Contract Online Migration Pattern:_ Multi-phase migrations adding
     additive/nullable fields first, running blue/green deployments, and
     retiring deprecated columns later.
- **Decision:** Adopt **Expand/Contract Online Migration Pattern** (Alternative
  2).
- **Consequences:** Enables 100% online database updates without application
  downtime; supports automated canary rollbacks without data corruption.

_Signed: Architecture Review Board (ARB) & Chief Architect — 2026-09-29_
