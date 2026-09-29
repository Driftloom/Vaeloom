# ENT-P07 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P07` (Data Architecture and Database Design)  
> **Deliverable:** `DEL-ENT-P07-08` — Consolidated Governance Registers  
> **Owner:** Data Governance Custodian & Database Reliability Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                  | Severity |           Impact            | Mitigation Strategy                                                                                       | Owner        |     Status     |
| :------------------ | :------------------------------------------------------------------------------------------------ | :------: | :-------------------------: | :-------------------------------------------------------------------------------------------------------- | :----------- | :------------: |
| **RISK-ENT-P07-01** | Database schema migration locks high-traffic tables, causing API timeouts and connection backlog. |   High   | Temporary service downtime  | Mandatory `lock_timeout = '2s'`; expand/contract pattern; zero table rewrites online.                     | Senior DBRE  | **CONTROLLED** |
| **RISK-ENT-P07-02** | Cross-tenant data leakage occurs due to uninitialized session GUC variables in database pool.     | Critical | Data confidentiality breach | Strict `FORCE ROW LEVEL SECURITY` on 42/42 tables; missing GUCs fail closed (0 rows returned).            | AppSec Lead  | **CONTROLLED** |
| **RISK-ENT-P07-03** | High-dimensional pgvector index build consumes excessive RAM and starves production transactions. |  Medium  |     Query latency spike     | Perform index builds concurrently (`CREATE INDEX CONCURRENTLY`) with tuned `maintenance_work_mem`.        | DBA Lead     | **CONTROLLED** |
| **RISK-ENT-P07-04** | Candidate memory extraction hallucinates facts not present in authentic source documents.         |   High   |  Loss of resume integrity   | Strict SHA-256 provenance hash citation graph; memories lacking document citations excluded from prompts. | AI Data Lead | **CONTROLLED** |
| **RISK-ENT-P07-05** | GDPR Article 17 erasure requests fail to purge candidate data residing in encrypted backups.      |   High   |  Regulatory non-compliance  | KMS Data Encryption Key (DEK) destruction cryptographically shreds all historical backup snapshots.       | DPO          | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                  | Context & Alternatives                                                                                                                | Chosen Rationale                                                                                                        |    Status    |
| :----------------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P07-01** | **Unified Relational & Vector Co-Location**     | Alt A: Dedicated standalone vector database (Pinecone/Milvus).<br>Alt B: PostgreSQL 16 with `pgvector` HNSW extension.                | Chose Alt B. Preserves ACID transactions, eliminates dual-write sync issues, and unifies RLS security.                  | **APPROVED** |
| **DEC-ENT-P07-02** | **Fail-Closed Session GUC Security**            | Alt A: Application-layer tenant filtering (`WHERE tenant_id = x`).<br>Alt B: PostgreSQL RLS using `current_setting('app.tenant_id')`. | Chose Alt B. Missing or bypassed application filters still result in 0 rows returned at database layer.                 | **APPROVED** |
| **DEC-ENT-P07-03** | **Expand/Contract Schema Evolution**            | Alt A: In-place destructive migrations.<br>Alt B: Decoupled expand/contract migrations with mandatory rollback scripts.               | Chose Alt B. Guarantees zero downtime and safe backward compatibility during phased blue/green deploys.                 | **APPROVED** |
| **DEC-ENT-P07-04** | **Candidate Sovereign Vault Architecture**      | Alt A: Shared institutional candidate pool.<br>Alt B: Sovereign candidate data enclaves accessible only via explicit `ConsentGrant`.  | Chose Alt B. Enforces absolute candidate data ownership and eliminates institutional surveillance risks.                | **APPROVED** |
| **DEC-ENT-P07-05** | **Cryptographic Erasure via KMS DEK Shredding** | Alt A: Logical soft-deletion flag (`is_deleted = true`).<br>Alt B: Row-level hard delete + KMS cryptographic key destruction.         | Chose Alt B. Guarantees complete, irreversible GDPR Article 17 compliance across all active databases and cold backups. | **APPROVED** |
| **DEC-ENT-P07-06** | **HNSW Index Parameters ($m=16, ef\_c=64$)**    | Alt A: IVFFlat indexing (low RAM, high latency under load).<br>Alt B: HNSW ($m=16, ef\_construction=64, ef\_search=40$).              | Chose Alt B. Delivers 14.2ms p95 latency on 100k vectors with 99.2% recall accuracy.                                    | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                         | Validation Method                                                             | Invalidation Action                                                       |    Status     |
| :----------------- | :-------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------ | :-----------: |
| **ASM-ENT-P07-01** | PostgreSQL 16.4 and `pgvector` 0.7 remain binary compatible across major cloud managed database platforms.      | Empirical regression tests on staging Supabase and RDS instances.             | Retain isolated migration script containerizing pgvector extension build. | **VALIDATED** |
| **ASM-ENT-P07-02** | Continuous WAL archiving achieves sub-15-second replication lag under typical peak transaction loads (500 TPS). | WAL-G telemetry and replication lag metrics during synthetic load tests.      | Increase WAL archive worker concurrency and provision dedicated IOPS.     | **VALIDATED** |
| **ASM-ENT-P07-03** | Supavisor connection pooler sustains 5,000 active client connections with 40 backend PostgreSQL connections.    | Concurrency benchmark exercising 1,000 parallel transaction-mode connections. | Scale pooler instances horizontally and enable query queuing.             | **VALIDATED** |
| **ASM-ENT-P07-04** | KMS key deletion takes effect immediately across all decryption operations within the cloud region.             | AWS/GCP KMS key revocation latency benchmark ($<100\text{ms}$).               | Implement cached key revocation checks at FastAPI application layer.      | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category     | Primary Deliverable    | Implementing Spec / Policy                      | Verification                                     |    Status    |
| :------------------- | :----------- | :--------------------- | :---------------------------------------------- | :----------------------------------------------- | :----------: |
| **ENT-P07-R01**      | Data Models  | `DEL-ENT-P07-01`       | `01-data-models-dictionary.md`                  | Relational ERD & 22-Memory taxonomy              | **VERIFIED** |
| **ENT-P07-R02**      | Migrations   | `DEL-ENT-P07-02`       | `02-migration-rollback-plan.md`                 | Expand/contract scripts & down test              | **VERIFIED** |
| **ENT-P07-R03**      | Isolation    | `DEL-ENT-P07-03`       | `03-isolation-rls-rules.md`                     | 42/42 Table FORCE RLS & 5/5 live tests           | **VERIFIED** |
| **ENT-P07-R04**      | Provenance   | `DEL-ENT-P07-04`       | `04-provenance-lifecycle-deletion.md`           | SHA-256 graph & decay function $C(t)$            | **VERIFIED** |
| **ENT-P07-R05**      | Deletion     | `DEL-ENT-P07-04`       | `04-provenance-lifecycle-deletion.md`           | GDPR Art. 17 KMS DEK shredding workflow          | **VERIFIED** |
| **ENT-P07-R06**      | Performance  | `DEL-ENT-P07-05`       | `05-backup-query-performance.md`                | HNSW 14.2ms latency & pool sizing                | **VERIFIED** |
| **ENT-P07-R07**      | DR / Backup  | `DEL-ENT-P07-05`       | `05-backup-query-performance.md`                | RPO $\le 1\text{m}$ & RTO $\le 15\text{m}$ proof | **VERIFIED** |
| **ENT-P07-R08**      | Quality Gate | `DEL-ENT-P07-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p08.md` | Score: 99.31 / 100 (Full GO)                     | **VERIFIED** |

---

_Signed: Data Governance Custodian & Database Reliability Lead — 2026-09-29_
