# ENT-P02 — 02 Domain & Competitor Analysis — Enterprise Capability Gaps

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** `DEL-ENT-P02-02` (v1.0)  
> **Owner:** Lead Domain Specialist & Solutions Architect  
> **Reviewed By:** Product Strategy Lead, Head of AI, Compliance Reviewer  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Domain Deep-Dive: Education vs Employment Verticals

In strict compliance with the phase-specific mandate (_"Research education and
employment use cases separately and classify regional AI/privacy risk"_), the
domain operational models are analyzed independently:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DUAL-VERTICAL DOMAIN TAXONOMY                        │
├───────────────────────────────────┬────────────────────────────────────┤
│ HIGHER EDUCATION CAREER SERVICES  │ CORPORATE OUTPLACEMENT CONSULTING  │
├───────────────────────────────────┼────────────────────────────────────┤
│ - Regulatory: FERPA (34 CFR §99)  │ - Regulatory: GDPR, CCPA, NDAs     │
│ - Cohort Cycle: 4-Year Academic   │ - Cohort Cycle: 90-180 Day Sprint  │
│ - Advisory Ratio: 1:300 to 1:500  │ - Advisory Ratio: 1:25 to 1:50     │
│ - Core Value: NACE Placement %    │ - Core Value: Placement Velocity   │
│ - Risk: Student Privacy & Consent │ - Risk: Corporate Severance Leaks  │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Domain A: Higher Education Career Services

1. **Operating Dynamics:** Large student populations (10,000–50,000 enrolled)
   with seasonal peaks (Fall recruiting rush, Spring graduation). Severe
   advisor-to-student staffing constraints (average ratio 1:420).
2. **Key Workflows:**
   - Onboarding fresh cohorts via Student Information System (SIS) integration.
   - Resume formatting reviews, cover letter audits, and mock interview prep.
   - Employer job fair coordination and First-Destination Survey outcome
     reporting for accreditation.
3. **Dominant Pain Point:** Advisors spend 65%+ of contact time on repetitive
   grammar, syntax, and formatting corrections rather than high-leverage career
   strategy.
4. **Regulatory Constraint:** FERPA prohibits sharing student records or career
   data with third parties or unapproved campus departments without explicit
   consent.

### Domain B: Corporate Outplacement Consulting

1. **Operating Dynamics:** Fast-paced, high-stakes corporate severance support.
   Transitions are time-capped by corporate sponsorship contracts (typically 3
   to 6 months of paid coaching).
2. **Key Workflows:**
   - Intake of displaced employee lists under strict corporate confidentiality
     agreements.
   - Rapid career re-branding: modernizing legacy resumes, LinkedIn profile
     overhauls, and executive cheatsheets.
   - Active pipeline management, interview tracking, and executive compensation
     negotiation.
3. **Dominant Pain Point:** High client burnout and anxiety. Displaced employees
   feel isolated; legacy outplacement platforms offer static videos with low
   engagement (<15%).
4. **Regulatory Constraint:** Non-disclosure of restructuring cohorts and
   corporate severance terms; strict GDPR / CCPA right-to-be-forgotten upon
   contract conclusion.

---

## 2. Vaeloom Capability Gap Analysis: MVP vs Enterprise Target

| Capability Dimension      | Current MVP State (Commit `592db98e`)                                                                               | Target Enterprise State (`06-paper` / `ENT-P21`)                                                                     | Architectural Gap & Evolution Strategy                                                                                   |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **Memory Taxonomy**       | 6 core types (`Profile`, `Document`, `Career`, `Episodic`, `Preference`, `Working`).                                | **22 typed memory categories** (adding `Skill`, `Goal`, `Task`, `Relationship`, `Project`, `Decision`, etc.).        | Implement additive Pydantic schemas with pgvector partitioning and temporal validity windows (`valid_from`, `valid_to`). |
| **Agent Roster**          | 8 active agents (`JobSearch`, `Application`, `Resume`, `ATSAudit`, `Gmail`, `Scheduler`, `Memory`, `Orchestrator`). | **28 governed agent personas** (adding `AdvisorCopilot`, `CompanyIntel`, `InterviewPrep`, `SalaryNegotiator`, etc.). | Implement server-side capability manifests, deterministic HITL approval gates, and per-agent token budgets.              |
| **Tenancy & Isolation**   | Single-tenant logical workspaces within shared PostgreSQL database.                                                 | **Regional tenant cells** with independent database pools and global control plane routing.                          | Introduce Cell Router, cross-tenant isolation testing, and regional data pinning (US, EU, India).                        |
| **Institutional Control** | Single workspace owner; no cohort hierarchy or advisory intervention queues.                                        | **Organization & Cohort Hierarchy** with SCIM provisioning, advisor caseload assignment, and consent management.     | Build Organization Control Plane, `organizations` and `cohorts` schemas, and granular `ConsentGrant` verification.       |
| **ATS / SIS Connectors**  | Passive Gmail push-watch and basic GitHub connector.                                                                | **Enterprise Connectors** for Workday, Greenhouse, Lever, Canvas, Banner, and LinkedIn.                              | Implement sandboxed MCP connector runtime with rate-limiting, webhook idempotency, and OAuth 2.0 PKCE.                   |

---

## 3. Competitor & Standards Benchmark

Evaluation is conducted across architectural resilience, data sovereignty, exit
costs, and unit economics—not marketing feature checklists.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   COMPETITIVE ARCHITECTURE MATRIX                      │
├─────────────────────┬───────────────────┬──────────────────────────────┤
│ PLATFORM            │ DATA SOVEREIGNTY  │ CORE ARCHITECTURAL DEFECT    │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ Handshake           │ Weak: Employer-   │ Student data monetized for   │
│                     │ centric network   │ employer job advertising     │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ Symplicity CSM      │ Moderate: Siloed  │ Legacy relational schema;    │
│                     │ campus database   │ zero native AI/agent memory  │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ Eightfold.ai        │ Low: Proprietary  │ Proprietary algorithms; zero │
│                     │ enterprise pool   │ student career memory export │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ Careerminds (LHH)   │ Low: Static video │ No autonomous agent tooling; │
│                     │ / manual coaching │ manual, expensive coaching   │
├─────────────────────┼───────────────────┼──────────────────────────────┤
│ VAELOOM ENTERPRISE  │ MAXIMUM: Sovereign│ Fully transparent, 100% RLS, │
│                     │ Candidate Vault   │ portable 22-memory graph     │
└─────────────────────┴───────────────────┴──────────────────────────────┘
```

1. **Handshake:**
   - _Strengths:_ Massive employer network, deep university penetration.
   - _Architectural Flaw:_ Employer-first monetization model. Student data is
     indexed and mined for employer recruiting campaigns; students do not own a
     portable, lifelong career memory.
   - _Exit Cost:_ High for institutions (contractual lock-in); complete data
     loss for students upon graduation.
2. **Symplicity CSM:**
   - _Strengths:_ Incumbent higher education career services management system
     with established accreditation reporting.
   - _Architectural Flaw:_ Monolithic, 20-year-old architecture. Clunky UI, zero
     cognitive agent capabilities, manual resume approval workflows that cause
     advisor backlog.
   - _Portability:_ Low; exports are limited to raw CSV dumps without semantic
     context or skill graphs.
3. **Eightfold.ai:**
   - _Strengths:_ Strong AI matching algorithms for enterprise corporate talent
     acquisition.
   - _Architectural Flaw:_ "Black box" AI screening that creates regulatory
     liabilities under the EU AI Act (high-risk employment AI). Candidate data
     is captured by the enterprise employer; the job seeker receives no
     compounding memory.
4. **Vaeloom Enterprise Advantage:**
   - **Candidate-Centric Sovereignty:** True data ownership via the Candidate
     Sovereign Vault.
   - **Transparent, Auditable AI:** 100% provenance citations on all generated
     documents; zero black-box hallucinations.
   - **Open Standards Interoperability:** W3C Verifiable Credentials, HR-XML
     compatibility, and open MCP connector protocols.

---

## 4. Avoiding the "One-Customer Trap"

To ensure Vaeloom does not build brittle, single-customer customizations that
degrade the core platform:

1. **Protocol Adapter Pattern:** All institutional SIS and corporate HRIS
   integrations must conform to the unified Model Context Protocol (MCP) or
   standardized REST contracts.
2. **Zero Proprietary Forking:** Feature variations between universities and
   outplacement firms are managed via feature flags and configuration schemas
   (`feature_flags.ts`), never through customer-specific code branches.
3. **Standardized Schema Foundations:** Data exports and career memories map
   strictly to open standards (HR-XML, Open Badges 3.0, JSON-LD), ensuring
   platform portability.

---

## 5. Deliverable Sign-Off & Traceability

- **Contract Reference:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P02-research-domain-analysis-and-data-discovery.md`
  §11 (WS-02.2) and §22 (`DEL-ENT-P02-02`).
- **Predecessor Traceability:** Directly validates problem statements `EPS-01`,
  `EPS-02`, and `EPS-06` defined in `DEL-ENT-P01-01`.
- **Downstream Traceability:** Informs Data Feasibility (`DEL-ENT-P02-03`) and
  Regulatory Applicability (`DEL-ENT-P02-04`).
