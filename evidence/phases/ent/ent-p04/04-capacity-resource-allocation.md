# ENT-P04 — 04 Capacity, Resource Allocation & RACI Matrix

> **Phase:** `ENT-P04` (Project Planning and Delivery Governance)  
> **Deliverable:** `DEL-ENT-P04-04` (v1.0)  
> **Owner:** Engineering Operations Director & Head of People  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise RACI Matrix across Delivery Lifecycle

The RACI framework defines governance accountability across Phases `ENT-P04`
through `ENT-P21`:

- **R (Responsible):** The role that performs the work package activities.
- **A (Accountable):** The individual role with final approval authority
  (strictly 1 'A' per phase).
- **C (Consulted):** Domain specialists providing inputs, reviews, and guidance.
- **I (Informed):** Stakeholders kept apprised of progress and milestones.

| Phase ID & Name                      | Program Mgr | Chief Arch | Backend Lead | Frontend Lead | AI / ML Lead | AppSec / DPO |  QA Lead  | Lead SRE  | Product Lead |
| :----------------------------------- | :---------: | :--------: | :----------: | :-----------: | :----------: | :----------: | :-------: | :-------: | :----------: |
| **ENT-P04: Project Planning**        |    **A**    |     C      |      C       |       C       |      C       |      C       |     C     |     C     |      R       |
| **ENT-P05: Solution Architecture**   |      I      | **A** / R  |      C       |       C       |      C       |      C       |     I     |     C     |      C       |
| **ENT-P06: Tech Stack & Standards**  |      I      |     A      |      R       |       R       |      C       |      C       |     C     |     C     |      I       |
| **ENT-P07: Database Architecture**   |      I      |     A      |      R       |       I       |      C       |      C       |     C     |     C     |      I       |
| **ENT-P08: API & Contract Design**   |      I      |     A      |      R       |       C       |      C       |      C       |     C     |     I     |      C       |
| **ENT-P09: UI/UX Design System**     |      I      |     C      |      I       |       R       |      I       |      C       |     C     |     I     |    **A**     |
| **ENT-P10: Frontend Implementation** |      I      |     C      |      C       |   **A** / R   |      I       |      C       |     C     |     I     |      C       |
| **ENT-P11: Backend Implementation**  |      I      |     C      |  **A** / R   |       C       |      C       |      C       |     C     |     C     |      I       |
| **ENT-P12: AI Agent & Memory**       |      I      |     C      |      C       |       I       |  **A** / R   |      C       |     C     |     C     |      C       |
| **ENT-P13: Security & Compliance**   |      I      |     C      |      C       |       C       |      C       |  **A** / R   |     C     |     C     |      C       |
| **ENT-P14: Testing & Quality Eng**   |      I      |     C      |      C       |       C       |      C       |      C       | **A** / R |     C     |      I       |
| **ENT-P15: Performance & Scale**     |      I      |     C      |      C       |       I       |      C       |      I       |     C     | **A** / R |      I       |
| **ENT-P16: DevOps & CI/CD**          |      I      |     C      |      C       |       C       |      I       |      C       |     C     | **A** / R |      I       |
| **ENT-P17: Observability & Ops**     |      I      |     C      |      C       |       I       |      I       |      C       |     I     | **A** / R |      I       |
| **ENT-P18: Docs & Transfer**         |      I      |     C      |      C       |       C       |      C       |      C       |     C     |     I     |  **A** / R   |
| **ENT-P19: Release & Cutover**       |    **A**    |     C      |      C       |       C       |      C       |      C       |     C     |     R     |      C       |
| **ENT-P20: Post-Deploy Audit**       |    **A**    |     C      |      C       |       C       |      C       |      C       |     C     |     C     |      R       |
| **ENT-P21: Continuous Imprv**        |      I      |     C      |      C       |       C       |      C       |      I       |     I     |     C     |  **A** / R   |

---

## 2. FTE Staffing & Capacity Allocation Plan

To deliver the critical path over 21 weeks without burnout, the following
full-time equivalent (FTE) staffing model is provisioned across 4 delivery
waves:

| Functional Role                            | Wave 1 (W01–W05) | Wave 2 (W06–W12) | Wave 3 (W13–W17) | Wave 4 (W18–W21) | Key Deliverable Focus                         |
| :----------------------------------------- | :--------------: | :--------------: | :--------------: | :--------------: | :-------------------------------------------- |
| **Enterprise Solution Architect**          |     1.0 FTE      |     0.5 FTE      |     0.5 FTE      |     0.25 FTE     | Cell topology, C4 diagrams, ADR governance    |
| **Senior Backend Engineers (FastAPI)**     |     2.0 FTE      |     3.0 FTE      |     1.5 FTE      |     1.0 FTE      | RLS queries, BullMQ job queues, SCIM v2.0     |
| **Senior Frontend Engineers (Next.js)**    |     1.0 FTE      |     2.5 FTE      |     1.0 FTE      |     0.5 FTE      | Advisor dashboards, visual diffs, WCAG AA     |
| **AI / ML Systems Engineer**               |     1.0 FTE      |     2.0 FTE      |     1.0 FTE      |     0.5 FTE      | Jev S1 + Gemma 4 S2 routing, XML fencing      |
| **Application Security Engineer (AppSec)** |     0.5 FTE      |     1.0 FTE      |     1.0 FTE      |     0.5 FTE      | Zero-trust verification, GDPR purge, red-team |
| **Quality Assurance / Test Engineer**      |     1.0 FTE      |     1.5 FTE      |     2.0 FTE      |     1.0 FTE      | Playwright E2E suites, automated regressions  |
| **Site Reliability Engineer (SRE/DevOps)** |     0.5 FTE      |     1.0 FTE      |     2.0 FTE      |     1.0 FTE      | Terraform IaC, multi-cell K8s, Prometheus     |
| **Technical Program Manager (TPM)**        |     1.0 FTE      |     1.0 FTE      |     1.0 FTE      |     1.0 FTE      | CPM scheduling, gate governance, CCB          |
| **Enterprise Product Manager**             |     1.0 FTE      |     1.0 FTE      |     1.0 FTE      |     1.0 FTE      | Requirements, design-partner pilot cutover    |
| **TOTAL HEADCOUNT (FTE)**                  |   **9.0 FTE**    |   **13.5 FTE**   |   **11.0 FTE**   |   **6.75 FTE**   | Peak execution in Wave 2 (13.5 FTE)           |

---

## 3. Team Topologies & Stream Alignment

In alignment with modern team topologies:

1. **Stream-Aligned Product Teams:**
   - **Candidate Experience Stream:** Focuses on candidate sovereign vaults, ATS
     tailor flows, and document compilation.
   - **Institutional Advisor Stream:** Focuses on cohort management, advisor
     intervention queues, and review analytics.
2. **Platform & Cell Infrastructure Team:**
   - Owns multi-tenant database migrations, RLS policies, SCIM v2.0
     provisioning, and Kubernetes cell deployments.
3. **Cognitive & Agent Subsystem Team:**
   - Owns the 28-agent ReAct orchestration, 22-memory retrieval pipeline,
     TypeSafe AI routing, and Ollama Cloud fallback engine.

---

## 4. Skills Matrix & Enablement Training

| Core Competency                | Required Standard                                                                                     | Target Roles     | Verification Mechanism                                       |
| :----------------------------- | :---------------------------------------------------------------------------------------------------- | :--------------- | :----------------------------------------------------------- |
| **PostgreSQL RLS & pgvector**  | Deep expertise in GUC session variables, force row level security, and HNSW cosine distance indexing. | Backend, DBA     | Live PostgreSQL RLS test pass (`tests/test_rls_live_pg.py`). |
| **Two-Tier Cognitive Routing** | Deterministic sub-50ms System 1 scoring and System 2 XML fenced prompting.                            | AI/ML, Backend   | Zero-mock cognitive integration test suite pass.             |
| **Zero-Trust AppSec & OWASP**  | OWASP Top 10 for Agentic Applications 2026, IDOR prevention, and cryptographic key destruction.       | AppSec, All Devs | 404-test API security suite pass.                            |
| **WCAG 2.1 AA Accessibility**  | Axe-core automated audits, keyboard navigation, focus trap, screen-reader semantics.                  | Frontend, QA     | `quality.spec.ts` zero serious/critical violation pass.      |

---

## 5. Resource Contention Resolution Protocol

If concurrent feature development creates contention for shared resources (e.g.
database schema migrations or security review bandwidth):

1. **Critical Path Priority:** Tasks lying on the CPM Critical Path (`ENT-P07`,
   `ENT-P08`, `ENT-P12`, `ENT-P13`) receive instantaneous priority over
   non-critical branch tasks.
2. **Security Veto Precedence:** AppSec and DPO compliance reviews supersede
   schedule deadlines; security gates cannot be bypassed to preserve dates.
3. **Escalation Path:** Contention unresolved within 4 hours is escalated to the
   Engineering Operations Director for immediate resource re-allocation.

_Signed: Engineering Operations Director & Head of People — 2026-09-29_
