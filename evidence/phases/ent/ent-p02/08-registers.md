# ENT-P02 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** Consolidated Governance Registers  
> **Owner:** Program Management Office & Risk Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                        | Severity |        Impact         | Mitigation Strategy                                                                                     | Owner            |     Status     |
| :------------------ | :-------------------------------------------------------------------------------------- | :------: | :-------------------: | :------------------------------------------------------------------------------------------------------ | :--------------- | :------------: |
| **RISK-ENT-P02-01** | External ATS platforms alter API quotas or deprecate endpoints unexpectedly.            |   High   |  Ingestion failures   | Living external-dependency radar; sliding-window rate limiters; BullMQ exponential retry queues.        | Integration Lead | **CONTROLLED** |
| **RISK-ENT-P02-02** | EU AI Act regulators classify resume tailoring as high-risk recruitment AI.             |   High   | Compliance audit risk | Grounding with 100% provenance citations; mandatory human-in-the-loop candidate sign-off; bias testing. | Compliance Lead  | **CONTROLLED** |
| **RISK-ENT-P02-03** | Expanding to 22 memory types increases pgvector index build times and memory footprint. |  Medium  |     DB saturation     | HNSW indexing with tuned parameters (`m=16`, `ef_construction=64`); tenant-partitioned tables.          | DBA Lead         | **CONTROLLED** |
| **RISK-ENT-P02-04** | Candidate career memories become stale without temporal invalidation.                   |  Medium  |  Hallucination risk   | Temporal validity windows (`valid_from`, `valid_to`) embedded in memory models; decay weighting.        | Data Lead        | **CONTROLLED** |
| **RISK-ENT-P02-05** | Cloud cognitive endpoints experience geographic network partitioning.                   |   High   | Regional cell failure | Regional Ollama local container instances (`gemma4:12b`) deployed in every cell as offline fallbacks.   | SRE Lead         | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                            | Context & Alternatives                                                                                            | Chosen Rationale                                                                                      |    Status    |
| :----------------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P02-01** | **Disaggregated Domain Modeling**         | Alt A: Unified education/employment workflow.<br>Alt B: Separate domain models for higher ed vs outplacement.     | Chose Alt B. Prevents FERPA violations in corporate contexts and aligns with distinct user cycles.    | **APPROVED** |
| **DEC-ENT-P02-02** | **HNSW pgvector Indexing**                | Alt A: IVFFlat indexing.<br>Alt B: HNSW indexing.                                                                 | Chose Alt B. Superior query recall ($\ge 98\%$) and eliminates periodic index re-clustering overhead. | **APPROVED** |
| **DEC-ENT-P02-03** | **Synthetic Evaluation Dataset Pipeline** | Alt A: Anonymized customer resumes.<br>Alt B: Fully synthetic 10k resume dataset.                                 | Chose Alt B. Eliminates all privacy leakage risks while providing statistically diverse test splits.  | **APPROVED** |
| **DEC-ENT-P02-04** | **EU AI Act High-Risk Governance**        | Alt A: Contest high-risk classification.<br>Alt B: Accept Annex III requirements and implement full transparency. | Chose Alt B. Future-proofs European enterprise market entry and establishes trust leadership.         | **APPROVED** |
| **DEC-ENT-P02-05** | **Self-Hosted Playwright Pool**           | Alt A: Commercial PDF compilation SaaS.<br>Alt B: Containerized Playwright Chromium pool.                         | Chose Alt B. Zero data egress, lower unit cost ($\le \$0.10$), and air-gapped security.               | **APPROVED** |
| **DEC-ENT-P02-06** | **Protocol Adapter Architecture**         | Alt A: Hardcoded third-party API SDKs.<br>Alt B: Model Context Protocol (MCP) client adapters.                    | Chose Alt B. Isolates agent reasoning from external API breaking changes.                             | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                                   | Validation Method                                                        | Invalidation Action                                                                                |    Status     |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P02-01** | Student Information Systems (SIS) support standard REST or LTI 1.3 integrations for cohort roster synchronization.        | API documentation review of Ellucian Banner and Workday Student.         | If SIS lacks modern APIs, provide secure CSV/SFTP batch ingestion with PGP encryption.             | **VALIDATED** |
| **ASM-ENT-P02-02** | 100k vector embeddings per tenant cell can be queried with $<20\text{ ms}$ latency on standard PostgreSQL cloud hardware. | pgvector benchmarking on Supabase PostgreSQL with 100k 1536-dim vectors. | If latency exceeds 20ms, partition vector tables by `memory_type` and active temporal status.      | **VALIDATED** |
| **ASM-ENT-P02-03** | Enterprise outplacement sponsors accept anonymized, aggregate placement analytics for contract billing.                   | Executive interviews with 3 global outplacement firms.                   | If individual reporting is required, mandate explicit employee opt-in during severance onboarding. | **VALIDATED** |
| **ASM-ENT-P02-04** | TypeSafe AI Jev System 1 maintains sub-50ms deterministic action routing under concurrent multi-tenant loads.             | Load testing at 100 RPS burst against live native endpoint.              | If latency exceeds 50ms, cache frequent deterministic decision trees in local Redis BullMQ memory. | **VALIDATED** |

---

## 4. Requirements Traceability Matrix

| Requirement ID  | Domain             | Primary Deliverable    | Implementing Files                                        | Test Verification                    | Gate Category                |
| :-------------- | :----------------- | :--------------------- | :-------------------------------------------------------- | :----------------------------------- | :--------------------------- |
| **ENT-P02-R01** | Research Scope     | `DEL-ENT-P02-01`, `02` | `01-research-plan.md`, `02-domain-competitor-analysis.md` | E2E route gate (`quality.spec.ts`)   | Scope & Acceptance (12)      |
| **ENT-P02-R02** | Evidence & Truth   | `DEL-ENT-P02-07`       | `05-test-results.md`, `07-evidence-bundle.md`             | 731 verified tests (100% green)      | Evidence & Traceability (8)  |
| **ENT-P02-R03** | Security & Privacy | `DEL-ENT-P02-04`       | `04-regulatory-applicability.md`                          | API security suite (404/404)         | Security & Privacy (12)      |
| **ENT-P02-R04** | Quality & Testing  | `DEL-ENT-P02-07`       | `apps/web/e2e/*.spec.ts`                                  | Playwright E2E (46/46 passed)        | Testing & Validation (12)    |
| **ENT-P02-R05** | Operational SLOs   | `DEL-ENT-P02-05`       | `alerts.yml`, `prometheus.yml`                            | Prometheus health & synthetic probes | Operations & Support (5)     |
| **ENT-P02-R06** | Data & Memory      | `DEL-ENT-P02-03`       | `03-data-feasibility.md`                                  | `test_knowledge_graph.py` (26/26)    | Data Quality & Lifecycle (8) |
| **ENT-P02-R07** | Traceability       | `DEL-ENT-P02-08`       | `08-registers.md`                                         | Bidirectional link verification      | Evidence & Traceability (8)  |
| **ENT-P02-R08** | Quality Gate       | `DEL-ENT-P02-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p03.md`           | Gate score: 98.59 / 100 (Full GO)    | Weighted Gate (100)          |
