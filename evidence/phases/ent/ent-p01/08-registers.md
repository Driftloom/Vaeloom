# ENT-P01 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** Consolidated Governance Registers  
> **Owner:** Program Management Office & Risk Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                 | Severity |              Impact              | Mitigation Strategy                                                                                     | Owner         |     Status     |
| :------------------ | :----------------------------------------------------------------------------------------------- | :------: | :------------------------------: | :------------------------------------------------------------------------------------------------------ | :------------ | :------------: |
| **RISK-ENT-P01-01** | Documentation mistaken for runtime completion.                                                   | Critical |         False readiness          | Mandatory live execution evidence; zero-mock requirement enforced on all test suites.                   | QA Lead       | **CONTROLLED** |
| **RISK-ENT-P01-02** | Institutional career advisors attempt to inspect private candidate memories without consent.     | Critical | Privacy breach & legal liability | Hard PostgreSQL RLS enforcement; candidate sovereign vault logically separated from institutional view. | Security Lead | **CONTROLLED** |
| **RISK-ENT-P01-03** | Upstream cognitive model APIs (Ollama Cloud, TypeSafe AI) experience outages or latency spikes.  |   High   |       Service degradation        | Two-tier cognitive routing; local Ollama Gemma 4 12B fallback; circuit breakers.                        | AI Lead       | **CONTROLLED** |
| **RISK-ENT-P01-04** | Autonomous career agents initiate external job applications without human verification.          |   High   |   Candidate reputational harm    | External actions classified as `noul`; deterministic approval gates in `loop.py`.                       | Product Lead  | **CONTROLLED** |
| **RISK-ENT-P01-05** | Headless browser PDF rendering creates container CPU exhaustion under peak advisor review loads. |  Medium  |         Platform latency         | Worker rate-limiting (`SCRAPE_QUOTA_PER_HOUR`); Playwright process recycling.                           | Platform Lead | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                | Context & Alternatives                                                                                                 | Chosen Rationale                                                                      |    Status    |
| :----------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :----------: |
| **DEC-ENT-P01-01** | **Candidate Sovereign Vault Architecture**    | Alt A: Org-level ownership with role permissions.<br>Alt B: Candidate personal vault with time-bounded consent grants. | Chose Alt B. Preserves FERPA compliance and builds genuine candidate trust.           | **APPROVED** |
| **DEC-ENT-P01-02** | **28-Agent Capability Ceiling**               | Alt A: Deploy all 28 agents at once.<br>Alt B: 28-agent ceiling governed by individual evaluation and kill switches.   | Chose Alt B. Prevents privilege creep and token budget exhaustion.                    | **APPROVED** |
| **DEC-ENT-P01-03** | **Cognitive Pipeline Hybridization**          | Alt A: Pure generative LLM for all tasks.<br>Alt B: 30% System 1 (TypeSafe AI) + 70% System 2 (Gemma 4 31B).           | Chose Alt B. Guarantees sub-50ms deterministic action routing while optimizing cost.  | **APPROVED** |
| **DEC-ENT-P01-04** | **Strict HITL Approval on External Actions**  | Alt A: Autonomous application submission.<br>Alt B: Mandatory human-in-the-loop approval gate.                         | Chose Alt B. Eliminates employer spam and ensures candidate control over submissions. | **APPROVED** |
| **DEC-ENT-P01-05** | **Regional Tenant Cell Isolation**            | Alt A: Global pooled multi-tenant schema.<br>Alt B: Regional tenant cells with local data residency.                   | Chose Alt B. Ensures GDPR Art. 44 and India DPDP 2025 compliance.                     | **APPROVED** |
| **DEC-ENT-P01-06** | **Standardization on Port 8000 Architecture** | Alt A: Multiple ports (8020, 8050) across environments.<br>Alt B: Single standardized port 8000 for backend API.       | Chose Alt B. Eliminates Windows environment variable collision traps.                 | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                                                | Validation Method                                                              | Invalidation Action                                                                                                     |    Status     |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P01-01** | Enterprise higher education buyers prioritize candidate privacy guarantees over unilateral administrative surveillance.                | Customer discovery interviews with 15 career center directors.                 | If buyers demand full surveillance, pivot to separate administrative compliance mode with explicit student disclosures. | **VALIDATED** |
| **ASM-ENT-P01-02** | Playwright Chromium headless rendering remains viable for high-volume enterprise document generation under containerized worker pools. | Performance benchmarking under 20 RPS load with `k6-script.js`.                | If rendering latency exceeds 5.0s, offload PDF generation to dedicated asynchronous render microservice.                | **VALIDATED** |
| **ASM-ENT-P01-03** | Local Ollama `gemma4:12b` fallback provides acceptable resume tailoring quality when Ollama Cloud is offline.                          | Side-by-side LLM-as-a-judge scoring on 50 resume tailoring pairs.              | If local model quality drops below 85% ATS score, queue requests until primary cloud endpoint recovers.                 | **VALIDATED** |
| **ASM-ENT-P01-04** | PostgreSQL Row-Level Security scales to 100,000 active tenants without query planner degradation.                                      | Database benchmark testing on real Supabase PG with 100k simulated tenant IDs. | If RLS overhead exceeds 15ms per query, implement schema-per-tenant or database-per-cell partitioning.                  | **VALIDATED** |

---

## 4. Requirements Traceability Matrix

| Requirement ID  | Domain             | Primary Deliverable    | Implementing Files                                   | Test Verification                    | Gate Category                |
| :-------------- | :----------------- | :--------------------- | :--------------------------------------------------- | :----------------------------------- | :--------------------------- |
| **ENT-P01-R01** | Scope & Goals      | `DEL-ENT-P01-01`, `05` | `01-problem-statement.md`, `05-non-goals-backlog.md` | E2E route gate (`quality.spec.ts`)   | Scope & Acceptance (12)      |
| **ENT-P01-R02** | Evidence & Truth   | `DEL-ENT-P01-07`       | `05-test-results.md`, `07-evidence-bundle.md`        | 731 verified tests (100% green)      | Evidence & Traceability (8)  |
| **ENT-P01-R03** | Security & Privacy | `DEL-ENT-P01-03`, `04` | `04-architecture-framing.md`                         | API security suite (404/404)         | Security & Privacy (12)      |
| **ENT-P01-R04** | Testing & Quality  | `DEL-ENT-P01-07`       | `apps/web/e2e/*.spec.ts`                             | Playwright E2E (46/46 passed)        | Testing & Validation (12)    |
| **ENT-P01-R05** | Platform Ops       | `DEL-ENT-P01-04`       | `alerts.yml`, `prometheus.yml`                       | Prometheus health & synthetic probes | Operations & Support (5)     |
| **ENT-P01-R06** | Data & Memory      | `DEL-ENT-P01-01`, `04` | `04-architecture-framing.md`                         | `test_knowledge_graph.py` (26/26)    | Data Quality & Lifecycle (8) |
| **ENT-P01-R07** | Traceability       | `DEL-ENT-P01-08`       | `08-registers.md`                                    | Bidirectional link verification      | Evidence & Traceability (8)  |
| **ENT-P01-R08** | Quality Gate       | `DEL-ENT-P01-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p02.md`      | Gate score: 98.35 / 100 (Full GO)    | Weighted Gate (100)          |
