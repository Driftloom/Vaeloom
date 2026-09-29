# ENT-P01 — 02 Persona & JTBD Framework — Enterprise Stakeholders

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** `DEL-ENT-P01-02` (v1.0)  
> **Owner:** Lead UX Researcher & Product Manager  
> **Reviewed By:** Domain Specialist, Privacy Lead, System Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Persona Profiles

To ensure our enterprise architecture reflects genuine user, buyer, and
regulatory needs, five distinct enterprise personas have been defined and
triangulated from user research, enterprise customer discovery, and governance
requirements.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE ECOSYSTEM STAKEHOLDERS                   │
├───────────────────────┬───────────────────────┬────────────────────────┤
│  INSTITUTIONAL BUYER  │  ENTERPRISE OPERATOR  │     CANDIDATE USER     │
│   Dr. Eleanor Vance   │     Priya Sharma      │       Alex Chen        │
│  Career Center Exec   │  Institutional Coach  │   Student / Job Seeker │
├───────────────────────┼───────────────────────┴────────────────────────┤
│   CORPORATE SPONSOR   │          COMPLIANCE & SECURITY GATEKEEPER      │
│    Marcus Sterling    │                   Sarah Jenkins                │
│ Outplacement VP / CPO │             Enterprise CISO / DPO              │
└───────────────────────┴────────────────────────────────────────────────┘
```

---

### Persona 1: Dr. Eleanor Vance — Career Center Executive Director (Institutional Buyer)

- **Organization:** Large Public University (45,000 students, 12 colleges).
- **Core Motivation:** Maximize verified graduate employment rates, satisfy
  accreditation reporting, and scale advisory services across massive cohorts
  without increasing headcount.
- **Key Pain Points:**
  - Low student engagement with legacy career management systems (<20% active
    adoption).
  - Manual, inaccurate placement data collection via low-response survey
    methods.
  - Constant anxiety over FERPA compliance and student data breaches by
    third-party EdTech vendors.
- **Decision Authority:** Budget owner for university-wide career software
  licenses ($150k–$350k ACV).

### Persona 2: Priya Sharma — Senior Career Advisor / Coach (Enterprise Operator)

- **Organization:** University Engineering & Business Career Center.
- **Core Motivation:** Help advisees land competitive roles, provide meaningful
  mentorship, and eliminate hours wasted on mechanical resume formatting.
- **Key Pain Points:**
  - Advisor-to-student ratio of 1:450; impossible to give individualized
    attention.
  - Reviewing basic resume typos and bullet formatting consumes 25+ hours per
    week.
  - Lack of visibility into whether students actually execute on coaching
    advice.
- **Platform Role:** Daily active user of the Advisor Control Plane and
  intervention queue.

### Persona 3: Alex Chen — Candidate / Job Seeker / Alum (End User & Sovereign Memory Owner)

- **Profile:** Final-year Computer Science student transitioning to tech
  workforce.
- **Core Motivation:** Land a high-paying software engineering role, stay
  organized across dozens of applications, and craft tailored application
  materials quickly.
- **Key Pain Points:**
  - Career achievements scattered across GitHub, PDFs, emails, and hackathons;
    difficult to synthesize.
  - Fear of institutional surveillance: does not want career advisors or
    university admins seeing personal salary targets or private job pursuits.
  - "Black hole" job applications: sends 100+ resumes with <5% interview
    response rates.
- **Platform Role:** Owner of private Career Memory, orchestrator of autonomous
  career agents.

### Persona 4: Marcus Sterling — VP of Talent Transition & Outplacement (Corporate Buyer)

- **Organization:** Global Enterprise Outplacement & Career Transition
  Consultancy.
- **Core Motivation:** Accelerate placement velocity for displaced employees,
  protect client corporate brand during restructurings, and prove ROI to
  enterprise clients.
- **Key Pain Points:**
  - High client churn if laid-off executives do not land within 90 days.
  - Difficulty tracking application activity across global geographies and
    languages.
  - Strict corporate NDAs regarding severance details and restructuring cohorts.
- **Decision Authority:** Procures enterprise SaaS for corporate outplacement
  programs ($200k–$500k ACV).

### Persona 5: Sarah Jenkins — Chief Information Security & Privacy Officer (Enterprise Gatekeeper)

- **Organization:** Enterprise IT / Legal / Risk Compliance Office.
- **Core Motivation:** Zero data breaches, zero regulatory fines, full
  compliance with GDPR, FERPA, and India DPDP, and strict enforcement of
  multi-tenant isolation.
- **Key Pain Points:**
  - Shadow AI adoption: employees and students pasting confidential data into
    unvetted consumer LLMs.
  - Inability to audit autonomous agent actions and verify data residency.
  - Third-party connector vulnerabilities (OAuth token theft, SSRF, prompt
    injection).
- **Platform Role:** Controls enterprise tenant provisioning, SSO/SCIM
  integration, audit log export, and compliance certifications.

---

## 2. Jobs To Be Done (JTBD) Framework

Applying the Outcome-Driven Innovation (ODI) framework, each persona's jobs are
decomposed into functional, emotional, and social dimensions.

| Persona                             | Functional Job (What they need to do)                                                                                                           | Emotional Job (How they want to feel)                                           | Social Job (How they want to be perceived)                                        |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| **Dr. Eleanor Vance** (Career Exec) | Measure, report, and optimize university-wide cohort placement rates with verified employment outcome data.                                     | Confident in institutional accreditation compliance and audit readiness.        | Recognized as an innovative leader transforming student career outcomes.          |
| **Priya Sharma** (Advisor)          | Review tailored resumes and cover letters in seconds with automated ATS syntax pre-audits and skill-gap recommendations.                        | Relieved from administrative burnout, energized by high-impact mentoring.       | Respected as a top-tier career coach who genuinely champions student success.     |
| **Alex Chen** (Candidate)           | Automatically extract, compound, and tailor verified achievements into role-specific application assets without losing personal data ownership. | In control of their career destiny; safe from employer/university surveillance. | Perceived by hiring managers as an exceptionally qualified, articulate candidate. |
| **Marcus Sterling** (Outplacement)  | Accelerate job placement for transitioning cohorts with automated pipeline tracking and executive cheatsheets.                                  | Assured that displaced employees are supported with cutting-edge tooling.       | Trusted by Fortune 500 enterprise clients as a premium transition partner.        |
| **Sarah Jenkins** (Security/DPO)    | Enforce cryptographic multi-tenant isolation, regional data residency, and deterministic policy enforcement across all agent interactions.      | Secure against compliance penalties and reputationally catastrophic data leaks. | Seen as a business enabler who maintains uncompromising security standards.       |

---

## 3. Trust Failure Scenarios (Overlay §143)

Enterprise trust is fragile. In accordance with Section 143 of the phase
contract, we explicitly model trust failure scenarios and define automated
architectural mitigations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRUST FAILURE VULNERABILITY MATRIX                   │
├──────────────────────────┬──────────────────────┬───────────────────────┤
│   FAILURE SCENARIO       │  IMPACT ON TRUST     │ SYSTEMIC MITIGATION   │
├──────────────────────────┼──────────────────────┼───────────────────────┤
│ 1. Memory Snooping       │ Candidate abandons   │ Hard cryptographic    │
│    (Unconsented Advisor  │ truthful journaling; │ RLS + separate GUC    │
│    Visibility)           │ adoption drops to 0% │ user/tenant context   │
├──────────────────────────┼──────────────────────┼───────────────────────┤
│ 2. Agent Hallucination / │ Candidate discredited│ XML context fencing;  │
│    Fabricated Experience │ in interview;        │ provenance citation;  │
│                          │ institutional blowback│ zero-mock System 2   │
├──────────────────────────┼──────────────────────┼───────────────────────┤
│ 3. Accidental Autonomous │ Candidate humiliated;│ Mandatory HITL gate   │
│    Submission            │ legal liability      │ for external actions; │
│                          │ for institution      │ double-confirmation  │
├──────────────────────────┼──────────────────────┼───────────────────────┤
│ 4. Cross-Tenant Leakage  │ Critical regulatory  │ PostgreSQL RLS 42/42; │
│    in Shared Vector DB   │ fine (GDPR/FERPA);   │ tenant-scoped vectors;│
│                          │ enterprise contract  │ isolation unit tests  │
│                          │ termination          │                       │
└──────────────────────────┴──────────────────────┴───────────────────────┘
```

1. **Memory Snooping (Unconsented Advisor Visibility):**
   - _Failure:_ An advisor views a candidate's private diary entry expressing
     mental health struggles or dissatisfaction with the institution.
   - _Trust Consequence:_ Candidate feels violated; leaks to campus press;
     platform usage collapses.
   - _Mitigation:_ Hard partition between `PersonalVault` and
     `InstitutionalSharedView`. Institutional visibility requires affirmative
     candidate opt-in per document or data category.
2. **Agent Hallucination / Fabricated Experience:**
   - _Failure:_ Tailoring agent invents a non-existent technical skill or
     certification on the candidate's resume to pass an ATS screen.
   - _Trust Consequence:_ Candidate is exposed during technical interview;
     institution's reputational standing with employers is damaged.
   - _Mitigation:_ Grounded document synthesis with strict XML context fencing
     (`<document_context>`) and mandatory provenance citation back to raw
     memories.
3. **Accidental External Job Submission:**
   - _Failure:_ An agent automatically submits a preliminary draft application
     to a hiring portal without candidate review.
   - _Trust Consequence:_ Candidate loses opportunity with dream employer due to
     unpolished submission.
   - _Mitigation:_ Architecture strictly designates external submissions as
     destructive actions (`noul`), requiring explicit HITL approval and
     cryptographic transaction logging.
4. **Cross-Tenant Vector / Cache Contamination:**
   - _Failure:_ A corporate restructuring outplacement list is semantically
     retrieved into an unrelated university student's job matching context.
   - _Trust Consequence:_ Major corporate confidentiality breach; instant
     contract termination and litigation.
   - _Mitigation:_ Isolated pgvector partitions with mandatory `tenant_id` and
     `workspace_id` filter predicates enforced at the engine layer.

---

## 4. Unacceptable Outcomes (Hard Red Lines)

The following outcomes are formally designated as unacceptable failure states:

1. **Administrative Backdoor:** No administrative role, support technician, or
   superuser may access a candidate's private career memories without an
   explicit, time-bounded, cryptographically audited access token granted by the
   candidate.
2. **Deceptive Autonomous Agency:** No agent may communicate with an external
   third-party (employer, recruiter, or API) impersonating human action without
   clear transparency flags and candidate pre-approval.
3. **Vendor Lock-in of Career Data:** A candidate departing an institution or
   outplacement program must be able to export their full 22-memory career graph
   in standard open formats (JSON-LD, PDF, DOCX) or transition it seamlessly to
   a personal account with zero data loss.
4. **Unconsented Secondary AI Training:** Enterprise data may never be used for
   foundational model pre-training, fine-tuning, or public corpus indexing.

---

## 5. Stakeholder Segmentation Matrix

| Segment                       | Target Cohorts                  | Primary Regulations                  | Data Sensitivity Tier                     | Isolation Architecture            |
| :---------------------------- | :------------------------------ | :----------------------------------- | :---------------------------------------- | :-------------------------------- |
| **Higher Ed Undergrad**       | Ages 18–22; 4-year programs     | FERPA, COPPA (if <18), State Privacy | Moderate (transcripts, grades, resume)    | Multi-tenant logical RLS          |
| **Higher Ed Graduate & Exec** | Ages 23–45; MBA, PhD, MD        | FERPA, GDPR (intl students)          | High (patents, research, compensation)    | Dedicated Workspace Cell          |
| **Corporate Outplacement**    | Displaced workforce; ages 25–60 | GDPR, CCPA, Corporate NDAs           | Critical (severance, restructuring lists) | Isolated Regional Tenant Cell     |
| **Executive Search**          | C-suite / VP candidates         | Global Privacy Laws, Strict NDA      | Maximum (board compensation, background)  | Encrypted Single-Tenant Partition |

---

## 6. Deliverable Sign-Off & Traceability

- **Contract Traceability:** Satisfies
  `specs/phase-contracts/03-enterprise/ENT-P01-discovery-and-problem-definition.md`
  §11 (WS-01.1) and §22 (`DEL-ENT-P01-02`).
- **Predecessor Link:** Builds upon `DEL-ENT-P00-02` (Asset Inventory) and
  `DEL-ENT-P00-03` (Maturity Matrix).
- **Handoff Target:** Informs `DEL-ENT-P01-03` (Value & Risk Hypotheses) and
  downstream Phase `ENT-P02` (Domain Analysis).
