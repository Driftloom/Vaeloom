# ENT-P02 — 01 Research Plan & Design-Partner Protocol

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** `DEL-ENT-P02-01` (v1.0)  
> **Owner:** Lead User Researcher & Domain Specialist  
> **Reviewed By:** Head of AI Product, Principal Architect, Compliance
> Reviewer  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Research Objectives & Methodology

The objective of Phase `ENT-P02` is to replace speculative assumptions with
empirical evidence regarding domain workflows, institutional requirements, data
schemas, API integration feasibility, and regulatory liabilities.

To avoid the "one-customer trap" and prevent anecdotal feedback from overriding
systematic design, research follows a structured three-pillar empirical
protocol:

1. **Consented Design-Partner Cohort Discovery:** Structured field interviews
   and prototype testing across two distinct institutional verticals (Higher
   Education Career Services and Corporate Outplacement Consulting).
2. **Technical & Protocol Spikes:** Direct sandbox testing against official
   vendor APIs (Workday, Greenhouse, Lever, Google Workspace, Microsoft Graph)
   measuring rate limits, auth flows, and schema mappings.
3. **Cognitive Performance & Contamination Benchmarking:** Systematic evaluation
   of System 1 deterministic routing and System 2 generative synthesis against
   licensed and synthetic career datasets.

---

## 2. Decision-Linked Research Questions (RQs)

Each research inquiry is tied directly to an upcoming architectural decision and
defines an explicit stopping criterion.

| ID        | Research Question                                                                                                                | Target Decision                                                              | Investigation Method                                                                                                | Stopping / Conclusive Criteria                                                                                                      |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| **RQ-01** | How do university career advisors review student resumes and what level of student memory access is strictly necessary?          | Granular consent model and Advisor Control Plane UI architecture.            | Consented contextual inquiries with 12 university career directors and advisors.                                    | Reaches consensus across $\ge 80\%$ of participants on minimum necessary fields (resumes + target jobs only).                       |
| **RQ-02** | What are the mandatory SLA and confidentiality requirements for enterprise corporate outplacement sponsors?                      | Tenant cell partitioning and corporate NDA data retention rules.             | Executive interviews with 6 outplacement practice leads (e.g. LHH, Right Management, Careerminds).                  | Quantitative consensus on placement cycle duration (target $\le 105$ days) and single-tenant cell requirement.                      |
| **RQ-03** | How should the 22 enterprise memory types be modeled to ensure semantic precision and temporal validity without vector drift?    | Database schema design (`0062+` migrations) and pgvector index partitioning. | Synthetic benchmark with 10,000 multi-category career memory events in PostgreSQL 16.                               | $\ge 95\%$ semantic retrieval accuracy across multi-hop career trajectory queries; zero cross-category contamination.               |
| **RQ-04** | What are the API quotas, rate limits, and webhook failure modes for major enterprise ATS platforms (Workday, Greenhouse, Lever)? | Connector architecture, BullMQ queue retry backoff, and DLQ handling.        | API documentation audit and sandbox integration testing across Workday REST, Greenhouse Harvest API, and Lever API. | Complete mapping of OAuth scopes, rate limits (e.g. Greenhouse 50 req/10s), and webhook retry semantics.                            |
| **RQ-05** | What is the latency and unit cost breakdown of multi-agent reasoning when compiling multi-page Playwright PDF resumes?           | Two-tier cognitive routing and container scaling configuration in K8s.       | Distributed tracing via OpenTelemetry under 20 RPS simulated load.                                                  | p95 API response $\le 120\text{ ms}$; p95 PDF render $\le 3,800\text{ ms}$; unit cost $\le \$0.38\text{ USD}$ per tailored package. |

---

## 3. Design-Partner Discovery Protocol

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DESIGN-PARTNER SAMPLING TAXONOMY                     │
├────────────────────────────┬─────────────────────────────┬─────────────┤
│ COHORT VERTICAL            │ REPRESENTATIVE PROFILE      │ SAMPLE SIZE │
├────────────────────────────┼─────────────────────────────┼─────────────┤
│ Higher Ed: Large Public    │ 40,000+ Undergrad / Grad    │ 4 Partners  │
│ Higher Ed: Elite Private   │ 8,000+ STEM & Business      │ 3 Partners  │
│ Outplacement: Global Firm  │ Fortune 500 Restructurings  │ 3 Partners  │
│ Executive Search Boutique  │ C-Suite / VP Transitions    │ 2 Partners  │
├────────────────────────────┼─────────────────────────────┼─────────────┤
│ TOTAL INSTITUTIONS         │                             │ 12 Partners │
└────────────────────────────┴─────────────────────────────┴─────────────┘
```

### Discovery Guidelines:

1. **Consent & Anonymization:** All participant feedback is collected under
   mutual non-disclosure agreements (NDAs) and stripped of student or corporate
   employee personal identifiers before entering repository research notes.
2. **Counterexample & Failure Testing:** Researchers must actively solicit
   scenarios where existing career tools failed (e.g. inaccurate ATS parsing,
   students complaining about advisor surveillance, candidates embarrassed
   during technical interviews by exaggerated AI resume claims).
3. **Telemetry-Grounded Verification:** Self-reported advisor time metrics must
   be validated against actual recorded timestamps and platform interaction
   logs.

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Reference:** Fulfills
  `specs/phase-contracts/03-enterprise/ENT-P02-research-domain-analysis-and-data-discovery.md`
  §11 (WS-02.1) and §22 (`DEL-ENT-P02-01`).
- **Traceability Chain:** Directly implements the handoff requirements
  transferred in `DEL-ENT-P01-09`.
- **Downstream Impact:** Governs evidence collection for `DEL-ENT-P02-02`
  (Domain Analysis) through `DEL-ENT-P02-05` (Decision Implications).
