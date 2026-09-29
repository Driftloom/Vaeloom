# ENT-P04 — 05 Risk Governance, Cost Modeling & Contingency Planning

> **Phase:** `ENT-P04` (Project Planning and Delivery Governance)  
> **Deliverable:** `DEL-ENT-P04-05` (v1.0)  
> **Owner:** Chief Risk Officer & FinOps Specialist  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Quantitative Enterprise Risk Matrix

Every identified enterprise delivery risk is quantified using Probability
($P \in [1, 5]$) and Financial/Schedule Impact ($I \in [1, 5]$), yielding an
Exposure Score ($E = P \times I \in [1, 25]$).

| Risk ID       | Risk Title & Description                                                                                                                               | $P$ | $I$ |     Score     | Exposure ($) | Contingency Mitigation Strategy                                                                                                                         | Owner           |     Status     |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :-: | :-: | :-----------: | :----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------- | :------------: |
| **RSK-04-01** | **Cloud LLM API Outage During Tailor Jobs:** Cloud cognitive API experiences global or regional downtime during nationwide hiring fairs.               |  3  |  5  | **15 (High)** |   \$45,000   | Automated circuit breaker (`RES-01`) immediately diverts traffic to local Ollama container (`gemma4:12b`); BullMQ exponential retry buffers jobs.       | SRE Lead        |   **ACTIVE**   |
| **RSK-04-02** | **Cross-Tenant Vector Index Contamination:** Improper filtering in pgvector HNSW similarity queries leaks candidate records across tenant boundaries.  |  1  |  5  |  **5 (Med)**  |  \$150,000   | Dual-layer isolation: database RLS (`TenantContext` + `set_rls_session_vars`) plus application-layer metadata filtering (`tenant_id = :tid`).           | AppSec Lead     | **CONTROLLED** |
| **RSK-04-03** | **Playwright Chromium Pool Memory Exhaustion:** High-volume concurrent PDF compiles cause Chromium process memory leaks and container OOM crashes.     |  3  |  4  | **12 (High)** |   \$20,000   | Containerized Playwright pool with strict worker lifespans (max 50 renders per worker process), rate-limiting decorators, and Redis queue backpressure. | Platform Lead   |   **ACTIVE**   |
| **RSK-04-04** | **Regulatory Delay in SOC 2 / ISO 27001 Certification:** External auditing firm encounters backlog, delaying enterprise procurement sign-off.          |  3  |  3  |  **9 (Med)**  |   \$30,000   | Pre-audit artifact generation using SLSA provenance and automated compliance evidence bundles; provision pilot customers under interim BAAs.            | Compliance Lead | **CONTROLLED** |
| **RSK-04-05** | **Token Budget Overrun on Large Prompt Injections:** Adversarial candidate resumes consume excessive tokens through invisible text injection payloads. |  2  |  4  |  **8 (Med)**  |   \$15,000   | Strict input truncation (max 100,000 chars), XML context fencing (`<document_context>`), and token budget cap ($\le \$0.38$ per document package).      | AI Lead         | **CONTROLLED** |

---

## 2. Enterprise Financial Cost Model & Unit Economics

### Infrastructure & Operational Monthly Spend Model (Production Cell Baseline: 5,000 MAU)

| Spend Category                  | Provider / Technology               | Monthly Unit Basis                              | Monthly Cost (USD) | Annualized (USD) |
| :------------------------------ | :---------------------------------- | :---------------------------------------------- | :----------------: | :--------------: |
| **Multi-Tenant Relational DB**  | Supabase Enterprise Dedicated PG 16 | High-Availability Cluster (Compute + Storage)   |      \$550.00      |    \$6,600.00    |
| **Container Cluster (K8s)**     | AWS EKS / GCP GKE                   | 3 Multi-AZ Nodes (c6i.xlarge or equivalent)     |      \$420.00      |    \$5,040.00    |
| **Object Storage (S3 / MinIO)** | Dedicated MinIO Cluster / AWS S3    | Encrypted resume artifact & PDF bucket (2 TB)   |      \$48.00       |     \$576.00     |
| **Caching & Message Broker**    | Managed Redis / Valkey              | BullMQ queue cluster with persistence           |      \$120.00      |    \$1,440.00    |
| **System 1 Decision Routing**   | TypeSafe AI Jev Native API          | ~500,000 monthly calls @ \$0.0004 / call        |      \$200.00      |    \$2,400.00    |
| **System 2 LLM Synthesis**      | Ollama Cloud Gemma 4 31B            | ~25,000 document packages @ \$0.003 / 1k tokens |      \$450.00      |    \$5,400.00    |
| **Observability & APM**         | Grafana Cloud / OpenTelemetry       | 500 GB traces, metrics, and audit logs          |      \$180.00      |    \$2,160.00    |
| **TOTAL MONTHLY RUN RATE**      | —                                   | **5,000 Active Institutional Candidates**       |   **\$1,968.00**   | **\$23,616.00**  |

### Unit Economics Calculation per Document Package

$$\text{Cost per Candidate Run} = \frac{\$1,968.00}{25,000\text{ Tailored Resumes/Letters}} = \mathbf{\$0.0787\text{ USD}}$$

> **Margin Target:** Enterprise annual licensing per seat is modeled at
> \$12.00–\$18.00/candidate/year. At \$0.0787 direct COGS per tailor event
> (average 4 events/candidate/year = \$0.315 direct COGS), the platform achieves
> a **gross software margin of $\ge 97.3\%$**.

---

## 3. Contingency Reserves & Financial Buffers

To guarantee delivery stability, the PMO has established two formal contingency
reserves:

1. **Schedule Contingency:** 10 business days (~8% of total critical path) held
   by the Program Delivery Director to absorb external audit delays.
2. **Financial Management Reserve:** \$35,000 USD (15% of annual cloud budget)
   allocated to handle token volume surges during major fall university
   recruiting peaks. Release of contingency funds requires formal CCB approval.

---

## 4. Change Control Board (CCB) Governance Protocol

The Change Control Board operates under strict procedural standards to preserve
architectural integrity:

- **Board Composition:** Program Delivery Director (Chair), Chief Enterprise
  Architect, Principal Security Engineer, Product Lead.
- **Voting Quorum:** Unanimous consent required for architectural or schema
  modifications; 3/4 majority for schedule adjustments.
- **Security & Privacy Veto:** The Principal Security Engineer and Data
  Protection Officer maintain absolute veto authority over any change affecting
  RLS policies, consent tokens, or audit retention.
- **Break-Glass Emergency Protocol:** In the event of a production Sev-1 outage,
  a 4-hour temporary hotfix may be deployed under the signature of the Lead SRE
  and Chief Architect. A full post-mortem and retroactive CCB audit must take
  place within 24 hours.

_Signed: Chief Risk Officer & FinOps Specialist — 2026-09-29_
