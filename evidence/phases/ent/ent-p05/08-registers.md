# ENT-P05 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P05` (Solution Architecture)  
> **Deliverable:** `DEL-ENT-P05-08` — Consolidated Governance Registers  
> **Owner:** Architecture Review Board & Risk Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                    | Severity |             Impact             | Mitigation Strategy                                                                                                | Owner         |     Status     |
| :------------------ | :-------------------------------------------------------------------------------------------------- | :------: | :----------------------------: | :----------------------------------------------------------------------------------------------------------------- | :------------ | :------------: |
| **RISK-ENT-P05-01** | Multi-cell routing introduces DNS propagation latency or routing loops during regional failover.    |   High   |  Intermittent 502 Bad Gateway  | Cloudflare Anycast edge routing with 5-second health probes and health-check weighted failover.                    | Platform Lead | **CONTROLLED** |
| **RISK-ENT-P05-02** | Local Ollama container memory leaks crash host worker nodes under sustained fallback load.          |   High   |    Node OOM & pod evictions    | Kubernetes resource limits (8 CPU, 16GB RAM limit); automated restart upon unresponsiveness; BullMQ rate limiting. | SRE Lead      | **CONTROLLED** |
| **RISK-ENT-P05-03** | Inadvertent PII leakage in OpenTelemetry trace attributes or error stack traces.                    |  Medium  | GDPR / FERPA compliance breach | Centralized OTel attribute sanitization filter in `core/telemetry.py` stripping emails, names, and auth headers.   | AppSec Lead   | **CONTROLLED** |
| **RISK-ENT-P05-04** | Candidate sovereign vault DEK (Data Encryption Key) loss permanently locks user resume records.     | Critical |      Permanent data loss       | Distributed KMS key escrow with multi-party quorum recovery for cryptographic master keys.                         | SecOps Lead   | **CONTROLLED** |
| **RISK-ENT-P05-05** | Complex multi-cell database sharding exceeds operational maintenance capacity of internal DBA team. |  Medium  |        Operational toil        | Standardize cell architecture on managed Supabase Enterprise PostgreSQL with automated backups and failover.       | DBA Lead      | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                | Context & Alternatives                                                                                                  | Chosen Rationale                                                                                                       |    Status    |
| :----------------- | :-------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P05-01** | **Dedicated Regional Tenant Cells**           | Alt A: Shared multi-tenant database.<br>Alt B: Dedicated database clusters per regional cell (US, EU, India).           | Chose Alt B (ADR-041). Eliminates cross-border data leakage risk and simplifies regulatory compliance.                 | **APPROVED** |
| **DEC-ENT-P05-02** | **Two-Tier Cognitive Routing Subsystem**      | Alt A: 100% generative LLM calls.<br>Alt B: System 1 (Jev sub-50ms) + System 2 (Gemma 4 31B synthesis).                 | Chose Alt B (ADR-042). Reduces generative token costs by 65% and locks in \$0.0787 unit COGS.                          | **APPROVED** |
| **DEC-ENT-P05-03** | **Native PostgreSQL pgvector HNSW Indexing**  | Alt A: Third-party vector SaaS (Pinecone).<br>Alt B: In-database pgvector HNSW indexing.                                | Chose Alt B (ADR-043). Maintains ACID consistency with relational records and applies RLS directly to vector searches. | **APPROVED** |
| **DEC-ENT-P05-04** | **mTLS Workload Identity with SPIFFE/SPIRE**  | Alt A: Static bearer tokens in env vars.<br>Alt B: Mutual TLS with automated short-lived certificate rotation.          | Chose Alt B (ADR-044). Zero-trust security preventing lateral pod-to-pod network eavesdropping.                        | **APPROVED** |
| **DEC-ENT-P05-05** | **Candidate Sovereign Vault & Consent Model** | Alt A: Institutional super-admin access.<br>Alt B: Candidate sovereign vaults with time-bounded `ConsentGrant` records. | Chose Alt B (ADR-045). Adheres to FERPA/GDPR and empowers candidates with portable career records.                     | **APPROVED** |
| **DEC-ENT-P05-06** | **Zero-Downtime Expand/Contract Migrations**  | Alt A: Scheduled maintenance downtime.<br>Alt B: Multi-phase additive schema changes with blue/green deployment.        | Chose Alt B (ADR-046). Guarantees 99.95% uptime during nationwide university career fair traffic peaks.                | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                        | Validation Method                                                              | Invalidation Action                                                                           |    Status     |
| :----------------- | :------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P05-01** | Cloudflare Edge Anycast DNS can route global traffic to nearest regional cell in $<40\text{ ms}$.              | Synthetic global ping benchmarks across 20 global Cloudflare edge locations.   | Deploy regional GeoDNS policies with AWS Route 53 latency-based routing.                      | **VALIDATED** |
| **ASM-ENT-P05-02** | PostgreSQL 16 `FORCE ROW LEVEL SECURITY` induces $<5\%$ CPU overhead compared to unscoped queries.             | Benchmark profiling of 1,000 queries with and without RLS GUCs in Supabase PG. | Add composite B-tree indexes on `(tenant_id, id)` and `(user_id, id)` across all tables.      | **VALIDATED** |
| **ASM-ENT-P05-03** | TypeSafe AI Jev System 1 native API maintains 99.99% availability with $<50\text{ ms}$ response latency.       | Live synthetic probe testing over 72-hour window against native endpoint.      | Cache frequent decision routes in local Redis BullMQ memory to bypass external network calls. | **VALIDATED** |
| **ASM-ENT-P05-04** | Local containerized Ollama (`gemma4:12b`) can run concurrently on standard 8-core CPU Kubernetes worker nodes. | Container benchmark run in staging cluster without GPU acceleration.           | Provision dedicated GPU node pool (NVIDIA T4 or L4) for local inference workers.              | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category         | Primary Deliverable    | Implementing Spec / Model                             | Verification                              |    Status    |
| :------------------- | :--------------- | :--------------------- | :---------------------------------------------------- | :---------------------------------------- | :----------: |
| **ENT-P05-R01**      | Scope            | `DEL-ENT-P05-01`, `02` | `01-c4-trust-dataflow.md`, `02-service-contracts.md`  | C4 Models & Cell Topology                 | **VERIFIED** |
| **ENT-P05-R02**      | Evidence         | `DEL-ENT-P05-07`       | `05-test-results.md`, `07-evidence-bundle.md`         | 731 verified live tests                   | **VERIFIED** |
| **ENT-P05-R03**      | Security/Privacy | `DEL-ENT-P05-01`, `04` | `01-c4-trust-dataflow.md`, `04-threat-informed.md`    | 5 Security Enclaves & OWASP defenses      | **VERIFIED** |
| **ENT-P05-R04**      | Quality          | `DEL-ENT-P05-06`       | `apps/web/e2e/*.spec.ts`, `pytest tests/security`     | 46/46 E2E, 404 security                   | **VERIFIED** |
| **ENT-P05-R05**      | Operations       | `DEL-ENT-P05-05`       | `05-failure-evolution-model.md`                       | RTO $\le 15\text{m}$, RPO $\le 1\text{m}$ | **VERIFIED** |
| **ENT-P05-R06**      | Data/AI          | `DEL-ENT-P05-02`, `03` | `02-service-contracts.md`, `03-adr.md` (ADR-042, 043) | Jev S1 + Gemma S2 + pgvector              | **VERIFIED** |
| **ENT-P05-R07**      | Traceability     | `DEL-ENT-P05-08`       | `08-registers.md`                                     | Bidirectional link verification           | **VERIFIED** |
| **ENT-P05-R08**      | Gate             | `DEL-ENT-P05-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p06.md`       | Score: 98.99 / 100 (Full GO)              | **VERIFIED** |

_Signed: Architecture Review Board & Risk Custodian — 2026-09-29_
