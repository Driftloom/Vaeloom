# ENT-P01 — 01 Problem Statement — Enterprise Scope & Problem Definition

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** `DEL-ENT-P01-01` (v1.0)  
> **Owner:** Lead Product Manager & Enterprise Domain Specialist  
> **Reviewed By:** Enterprise Architect, Privacy Engineer, UX Researcher  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Executive Summary & Problem Context

The core value proposition of Vaeloom at the MVP stage centered on the
individual job seeker: compound career memory, proactive job search, automated
semantic ATS tailoring, and ReAct-driven multi-agent workflows.

However, enterprise institutional customers—including **higher education career
centers**, **corporate outplacement agencies**, and **executive search
firms**—face systemic structural challenges that cannot be addressed by
single-tenant or consumer-grade architectures:

1. **The Institutional Privacy Paradox:** Educational institutions (under FERPA)
   and corporate sponsors (under corporate liability and GDPR/DPDP) must guide,
   report on, and accelerate placement outcomes without violating candidate
   ownership of private career memories, journal entries, or confidential
   compensation targets.
2. **The Advisory Scalability Wall:** Enterprise career advisors and
   outplacement coaches manage caseloads of 200–500 candidates simultaneously.
   Manual resume reviews, mock interview feedback, and application tracking lead
   to advisor burnout and low candidate engagement (<18% active platform
   retention after 60 days).
3. **Privilege Creep & Unbounded Agency:** Expanding the autonomous agent roster
   from 8 MVP agents to the 28 governed enterprise agents risks unauthorized
   cross-workspace execution, unsanctioned tool invocation, and token budget
   exhaustion if agent boundaries, capabilities, and approval gates are not
   enforced by the server-side kernel.
4. **Data Sovereignty & Cross-Cohort Leakage:** Enterprise buyers require strict
   regional data residency (EU, US, India), cryptographically verifiable
   multi-tenant cell isolation, and zero cross-tenant contamination in vector
   indexes, relational tables, and LLM context windows.

---

## 2. Falsifiable Enterprise Problem Statements

Each problem statement below is formulated as a falsifiable, evidence-backed
hypothesis that governs subsequent architectural, security, and product design.

| ID         | Problem Statement                                                                                                                                                                                                                                                                           | Observable Baseline & Evidence                                                                                                 | Falsification Criteria                                                                                                                                             | Enterprise Mandate                                                                                                                                      |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **EPS-01** | **Multi-Tenant Boundary vs Personal Memory Ownership**<br>Institutional administrators assume platform ownership grants unilateral visibility into candidate memories, which dissuades candidates from storing truthful career reflections, leading to shallow, low-efficacy agent outputs. | User research across higher education pilots (`User-Research.md`); FERPA 34 CFR Part 99; GDPR Art. 5(1)(b) purpose limitation. | False if candidate adoption and depth of memory creation (>15 items/candidate) remain steady even when institutional administrators hold unrestricted read access. | Candidate memory is sovereign. Institutional access requires explicit, granular, time-bounded candidate consent with audit logging.                     |
| **EPS-02** | **Advisory Caseload Saturation & Feedback Latency**<br>Career advisors spend >70% of their working hours on repetitive low-level resume formatting and basic skill gap identification, leaving <30% for high-leverage strategic interview prep and employer networking.                     | Institutional staff time-tracking studies; average turnaround for resume feedback is 4.8 business days.                        | False if advisors spend <25% of their working hours on tactical resume syntax reviews without autonomous ATS tooling.                                              | Autonomous ATS auditing and semantic skill-gap extraction must automate tier-1 feedback in <5 seconds, freeing advisors for high-impact interventions.  |
| **EPS-03** | **Unbounded Agency & Autonomous Tool Misuse**<br>Permitting autonomous agents to execute multi-step career actions without deterministic policy gates risks accidental application submission, quota exhaustion, or unverified contact reaching hiring managers.                            | OWASP Top 10 for Agentic Applications (2026); `apps/api/src/api/agents/loop.py` approval-gated tool registry.                  | False if 28 autonomous agents operating concurrently maintain zero unconsented external actions without human-in-the-loop (HITL) gates.                            | All destructive, external, or consequential agent actions (job submission, email dispatch, external MCP execution) must require explicit HITL approval. |
| **EPS-04** | **Knowledge Graph & Memory Taxonomy Fragmentation**<br>Expanding beyond MVP's 6 memory types to 22 enterprise memory types without strict schema validation causes context poisoning, semantic drift, and contradictory reasoning in System 2 synthesis.                                    | `tests/test_knowledge_graph.py`; Module 05 cognitive pipeline benchmarks; Pydantic validation schemas.                         | False if unstructured vector storage alone provides >90% precision on multi-hop career trajectory queries across 22 memory categories.                             | Implement typed Pydantic models, vector-graph hybrid retrieval, and deterministic schema enforcement for all 22 memory types.                           |
| **EPS-05** | **Cross-Cohort & Cross-Tenant Data Contamination**<br>Shared database pools and co-located vector namespaces risk leaking proprietary university placement pipelines, corporate restructuring plans, or candidate identities across enterprise tenants.                                     | `tests/test_rls_live_pg.py` verifying 42/42 RLS tables; tenant context isolation invariants in `TenantMiddleware`.             | False if multi-tenant applications on shared PostgreSQL schemas with software-only WHERE clauses never experience cross-tenant data leakage under load.            | Strict PostgreSQL Row-Level Security (RLS) with fail-closed session variables (`app.tenant_id`, `app.workspace_id`) and regional tenant cell isolation. |
| **EPS-06** | **Institutional Attribution & Placement Verifiability**<br>Universities and outplacement providers struggle to prove ROI and placement outcomes to stakeholders because candidate career tracking relies on unverified self-reporting.                                                      | National Association of Colleges and Employers (NACE) First-Destination Survey response rates (<35%).                          | False if institutions reliably achieve >75% placement tracking without automated connector integration (Gmail, LinkedIn, GitHub).                                  | Implement automated connector reconciliation, verified offer tracking, and privacy-preserving outcome reporting.                                        |

---

## 3. Detailed Enterprise User Journeys

### Journey 1: Institutional Provisioning & Candidate Consent Grant

```
[Institutional Admin]
       │
       ▼
1. Provisions Organization & Cohorts (via SCIM / SSO / CSV upload)
       │
       ▼
2. Invites Candidates with Scope-Bound Institutional Policy
       │
       ▼
[Candidate User]
       │
       ▼
3. Enrolls via Enterprise SSO / Personal Magic Link
       │
       ▼
4. Configures Private Career Vault (Zero Institutional Visibility by Default)
       │
       ▼
5. Receives "Institutional Advisory Request" → Grants Granular, Time-Bounded Consent:
   - Shared: Resumes, Target Roles, Application Statuses
   - Masked/Private: Personal Journaling, Target Salary, Health/Disability Notes
```

### Journey 2: Cognitive Co-Pilot Advisory Workflow

```
[Candidate User]
       │
       ▼
1. Ingests Job Specification & Generates Tailored Resume (Playwright PDF + DOCX)
       │
       ▼
2. System 1 (TypeSafe AI) routes ATS checks; System 2 (Gemma 4 31B) synthesizes cover letter
       │
       ▼
3. Candidate submits tailored package for "Advisor Review" (HITL Queue)
       │
       ▼
[Career Advisor / Coach]
       │
       ▼
4. Opens Advisor Dashboard → Reviews Diff, ATS Match Score, and Semantic Gap Highlights
       │
       ▼
5. Adds Strategic Annotations & Approves Document → Instant Candidate Notification
```

---

## 4. Enterprise Scope Boundaries

### In Scope

1. **Multi-Tenancy & Governance:** Regional tenant cells, organization/cohort
   hierarchies, role-based access control (RBAC), and SCIM v2.0 provisioning.
2. **Candidate Sovereignty & Consent Engine:** Granular permission delegations,
   audit logs, purpose-bound visibility, and one-click consent revocation.
3. **Enterprise Agent Roster:** 28 governed agent personas with strictly typed
   tool capabilities, circuit breakers, and rate-limiting.
4. **22-Memory Taxonomy:** Structured career memory models with temporal
   validity, provenance tracking, and pgvector semantic indexing.
5. **Advisor Control Plane:** Caseload management, cohort progress analytics,
   intervention queues, and aggregate outcome dashboards.
6. **Regulatory Compliance:** Full alignment with FERPA (US), GDPR (EU), India
   DPDP Act (2025 Rules), and EU AI Act (2026 transparency mandates).

### Out of Scope

1. **Unconsented Administrative Surveillance:** Administrators cannot view
   candidate chat conversations, private journal notes, or off-platform job
   searches without explicit candidate consent.
2. **Fully Autonomous Application Submissions:** The platform will never submit
   job applications to external portals without affirmative candidate approval.
3. **Cross-Tenant Data Pooling for Model Training:** Customer enterprise data
   will never be pooled or utilized to train shared foundation models.
4. **Unreviewed Third-Party MCP Execution:** Arbitrary code execution or
   unverified MCP servers are blocked; all connectors must be signed and
   sandboxed.

---

## 5. Traceability & Regulatory Grounding

- **Source Traceability:** Mapped to canonical sources `INT-01`
  (`Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`), `INT-04`
  (`vaeloom-enterprise-e2e.md`), and `INT-06`
  (`06-vaeloom-enterprise-paper.md`).
- **Standard Traceability:** Mapped to `EXT-02` (OWASP Agentic Applications Top
  10), `EXT-04` (NIST AI RMF 1.0), `EXT-14` (GDPR), and `EXT-17` (FERPA/COPPA).
- **Deliverable Reference:** Governs requirements `ENT-P01-R01` through
  `ENT-P01-R08` and establishes baseline for `DEL-ENT-P01-02` through
  `DEL-ENT-P01-05`.
