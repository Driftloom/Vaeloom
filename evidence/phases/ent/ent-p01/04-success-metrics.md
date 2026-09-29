# ENT-P01 — 04 Success Metrics & KPI Framework — Enterprise Measurement

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** `DEL-ENT-P01-04` (v1.0)  
> **Owner:** Lead Data Architect & Product Operations Lead  
> **Reviewed By:** VP Engineering, CISO, Head of Product  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise North Star Metric

The unified North Star Metric for the Vaeloom Enterprise Platform is:

$$\mathbf{VMCO} = \sum_{i=1}^{N} \left( \text{Verified Offer}_i \times \text{Provenance Quality Score}_i \times \text{Candidate Sovereignty Factor}_i \right)$$

### **Verified Meaningful Career Outcomes (VMCO)**

- **Definition:** An active, verified employment offer, internship placement, or
  career advancement event achieved by an enrolled candidate where:
  1. The outcome is verified via authentic connector telemetry (e.g. Gmail offer
     letter receipt, LinkedIn company synchronization, or employer webhook).
  2. The application materials utilized exhibited ≥98% provenance citation back
     to the candidate's verified career memories.
  3. The institutional advisor intervention adhered 100% to candidate consent
     parameters with zero unauthorized memory exposure.

---

## 2. Comprehensive Metric Taxonomy & KPI Framework

The enterprise operating model enforces strict quantitative targets across six
governance domains.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE KPI DOMAIN TAXONOMY                       │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│ 1. PRODUCT & OUTCOMES    │ 2. CANDIDATE TRUST       │ 3. ADVISORY OPS  │
│ - Time to Offer (≤92d)   │ - Consent Rate (≥85%)    │ - Caseload (450) │
│ - ATS Score Lift (+28%)  │ - Privacy Leaks (0)      │ - Latency (<12h) │
├──────────────────────────┼──────────────────────────┼──────────────────┤
│ 4. SECURITY & ISOLATION  │ 5. PLATFORM SLOS         │ 6. UNIT COST     │
│ - RLS Enforced (100%)    │ - API p95 Latency (<120ms│ - Cost / Tailor  │
│ - Cross-Tenant Leaks (0) │ - Availability (99.9%)   │   (≤$0.38 USD)   │
└──────────────────────────┴──────────────────────────┴──────────────────┘
```

---

### Domain 1: Product & Career Outcome Metrics

| Metric ID     | Metric Name & Description                                                                                                           | Mathematical Formula                                                                                | Baseline | Enterprise Target | Owner        | Frequency  |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :------: | :---------------: | :----------- | :--------- |
| **M-PROD-01** | **Time-to-Offer Velocity**<br>Elapsed days from initial candidate profile onboarding to first verified job offer.                   | $\Delta t = t_{\text{offer}} - t_{\text{onboard}}$                                                  | 148 days | **$\le 92$ days** | Product Lead | Monthly    |
| **M-PROD-02** | **Semantic ATS Score Lift**<br>Average percentage point increase in resume ATS match score following cognitive tailoring.           | $\Delta S_{\text{ATS}} = S_{\text{tailored}} - S_{\text{raw}}$                                      |  +8.4%   | **$\ge +28.0\%$** | AI Lead      | Weekly     |
| **M-PROD-03** | **Application-to-Interview Conversion**<br>Percentage of tailored job applications that result in an interview invitation.          | $R_{\text{int}} = \frac{N_{\text{interviews}}}{N_{\text{applications}}} \times 100$                 |   4.8%   | **$\ge 18.5\%$**  | Product Lead | Bi-weekly  |
| **M-PROD-04** | **Verified Placement Attribution Rate**<br>Percentage of graduating cohort whose final employment status is automatically verified. | $R_{\text{attr}} = \frac{N_{\text{verified\_placements}}}{N_{\text{cohort\_graduates}}} \times 100$ |  32.0%   | **$\ge 85.0\%$**  | Data Lead    | Semesterly |

---

### Domain 2: Candidate Sovereignty & Privacy Metrics

| Metric ID     | Metric Name & Description                                                                                                                                        | Mathematical Formula                                                                             | Baseline  |    Enterprise Target    | Owner        | Frequency   |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :-------: | :---------------------: | :----------- | :---------- |
| **M-PRIV-01** | **Candidate Consent Grant Rate**<br>Percentage of candidates who voluntarily grant purpose-bound advisory sharing to institutional coaches.                      | $R_{\text{consent}} = \frac{N_{\text{grants\_accepted}}}{N_{\text{grant\_requests}}} \times 100$ | N/A (New) |    **$\ge 85.0\%$**     | Privacy Lead | Weekly      |
| **M-PRIV-02** | **Unconsented Access Violations**<br>Instances of an administrative or advisory token querying private candidate memory records.                                 | $\sum \text{Violations} = 0$                                                                     |     0     |     **STRICTLY 0**      | CISO         | Real-time   |
| **M-PRIV-03** | **Consent Revocation Propagation Latency**<br>Time taken for a candidate's consent revocation to invalidate all active advisor session tokens and cache entries. | $t_{\text{revoke}} = t_{\text{cache\_inval}} - t_{\text{user\_click}}$                           |    N/A    | **$\le 500\text{ ms}$** | SecOps Lead  | Daily Audit |
| **M-PRIV-04** | **Career Memory Compounding Density**<br>Average number of structured, validated memory nodes accumulated per active candidate profile.                          | $\bar{M} = \frac{\sum \text{Active Memories}}{N_{\text{active\_candidates}}}$                    |    6.2    |  **$\ge 24.5$ nodes**   | Product Lead | Monthly     |

---

### Domain 3: Institutional Advisory & Operational Efficiency

| Metric ID    | Metric Name & Description                                                                                                                                  | Mathematical Formula                                                                      | Baseline |    Enterprise Target    | Owner      | Frequency |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :------: | :---------------------: | :--------- | :-------- |
| **M-OPS-01** | **Effective Advisory Caseload Capacity**<br>Number of active students a single career advisor can effectively mentor simultaneously.                       | $C_{\text{advisor}} = \frac{N_{\text{active\_students}}}{N_{\text{advisors}}}$            |   120    | **$\ge 450$ students**  | Operations | Monthly   |
| **M-OPS-02** | **Advisory Review Turnaround Time**<br>Average duration from candidate submission of a tailored document to advisor approval.                              | $t_{\text{review}} = t_{\text{approval}} - t_{\text{submission}}$                         | 115 hrs  | **$\le 12\text{ hrs}$** | Operations | Weekly    |
| **M-OPS-03** | **Tier-1 Auto-Audit Completion Rate**<br>Percentage of candidate resumes passing automated syntax, ATS, and formatting checks without manual intervention. | $R_{\text{auto}} = \frac{N_{\text{auto\_audited}}}{N_{\text{total\_resumes}}} \times 100$ |    0%    |    **$\ge 94.0\%$**     | AI Lead    | Weekly    |

---

### Domain 4: Security, Isolation & Compliance Metrics

| Metric ID    | Metric Name & Description                                                                                                  | Mathematical Formula                                                                            |   Baseline   | Enterprise Target | Owner         | Frequency  |
| :----------- | :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- | :----------: | :---------------: | :------------ | :--------- |
| **M-SEC-01** | **PostgreSQL RLS Table Coverage**<br>Percentage of relational database tables enforcing Row-Level Security policies.       | $R_{\text{RLS}} = \frac{N_{\text{RLS\_tables}}}{N_{\text{total\_tables}}} \times 100$           | 100% (42/42) |  **100% (All)**   | Security Lead | Continuous |
| **M-SEC-02** | **Cross-Tenant Data Leakage Count**<br>Verified instances of cross-workspace or cross-tenant query execution.              | $\sum \text{Leaks} = 0$                                                                         |      0       |  **STRICTLY 0**   | SecOps Lead   | Real-time  |
| **M-SEC-03** | **Adversarial Injection Block Rate**<br>Percentage of red-team prompt injection or SSRF payloads blocked by input filters. | $R_{\text{block}} = \frac{N_{\text{blocked\_attacks}}}{N_{\text{attack\_attempts}}} \times 100$ |  100% (9/9)  |     **100%**      | AppSec Lead   | Continuous |

---

### Domain 5: Platform Engineering & Infrastructure SLOs

| Metric ID    | Service Level Indicator (SLI)          | Target Service Level Objective (SLO)                                    | Measurement Method                                   |
| :----------- | :------------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------- |
| **M-SLO-01** | **API Response Latency (p95)**         | **$p95 \le 120\text{ ms}$** across core endpoints at 20 RPS             | Prometheus histogram `http_request_duration_seconds` |
| **M-SLO-02** | **Document Compilation Latency (p95)** | **$p95 \le 3,800\text{ ms}$** for multi-page Playwright PDF compilation | Telemetry span `document_builder.compile_pdf`        |
| **M-SLO-03** | **System 1 Routing Latency (p99)**     | **$p99 \le 50\text{ ms}$** for TypeSafe AI deterministic action routing | Telemetry span `system1.jev_action_route`            |
| **M-SLO-04** | **Platform Service Availability**      | **$\ge 99.95\%$ uptime** (excluding scheduled maintenance)              | Blackbox synthetic probe monitoring (30s cadence)    |

---

### Domain 6: Unit Economics & Inference Cost Metrics

| Metric ID     | Metric Name & Description                                                                                                    |       Target Ceiling        | Economic Guardrail                                                 |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------: | :----------------------------------------------------------------- |
| **M-COST-01** | **Inference Cost Per Document Tailored**<br>Total LLM token expense (System 1 + System 2) per generated resume/cover letter. | **$\le \$0.28\text{ USD}$** | Exceeding \$0.50 triggers fallback to quantized local Gemma 4 12B. |
| **M-COST-02** | **Headless Rendering Compute Expense**<br>CPU/Memory container cost per PDF/DOCX render pass.                                | **$\le \$0.10\text{ USD}$** | Rate-limited via `SCRAPE_QUOTA_PER_HOUR` and process pooling.      |
| **M-COST-03** | **Total Unit Cost per Tailored Package**                                                                                     | **$\le \$0.38\text{ USD}$** | Guarantees gross profit margin $>78\%$ on enterprise SaaS seats.   |

---

## 3. Observability & Telemetry Infrastructure

Telemetry collection is implemented using open industry standards:

1. **OpenTelemetry Semantic Conventions:** All API requests, agent loops, and
   database queries propagate distributed trace contexts (`traceparent`,
   `tracestate`) without logging confidential candidate PII.
2. **Prometheus Metrics Exporter:** Real-time metrics published at `/metrics`
   (verified in `api.main:app`), scraped at 15-second intervals.
3. **Grafana Dashboards:** Dedicated dashboards configured for:
   - `backend.json`: Core API latency, throughput, error rates.
   - `latency.json`: End-to-end p50, p95, p99 latency breakdowns.
   - `agents.json`: Agent token consumption, tool execution latencies, approval
     queue backlog.
4. **Automated Alerting Rules:** Integrated into `alerts.yml` (9 Prometheus
   alerting rules firing on SLO breaches, 5xx error spikes, or RLS failures).

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Traceability:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P01-discovery-and-problem-definition.md`
  §11 (WS-01.4) and §22 (`DEL-ENT-P01-04`).
- **Dependencies:** Validated against `DEL-ENT-P01-01` (Problems) and
  `DEL-ENT-P01-03` (Value/Risk Hypotheses).
- **Handoff Target:** Establishes the empirical acceptance benchmarks for Phase
  `ENT-P02` (Domain Analysis) through `ENT-P15` (Performance & Resilience).
