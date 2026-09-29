# ENT-P02 — 04 Regulatory Applicability & Regional AI Risk Classification

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** `DEL-ENT-P02-04` (v1.0)  
> **Owner:** Lead Compliance Reviewer & Data Privacy Officer  
> **Reviewed By:** Legal Counsel, Enterprise Security Lead, Chief Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Education vs Employment Regulatory Disaggregation

Per the mandatory phase-specific directive (_"Research education and employment
use cases separately and classify regional AI/privacy risk"_), legal obligations
are mapped into distinct operational profiles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   REGULATORY REGIME DISAGGREGATION                     │
├───────────────────────────────────┬────────────────────────────────────┤
│ EDUCATION JURISDICTIONS           │ EMPLOYMENT & CORPORATE TRANSITIONS │
├───────────────────────────────────┼────────────────────────────────────┤
│ - FERPA (34 CFR Part 99)          │ - GDPR (Regulation 2016/679)       │
│ - COPPA (16 CFR Part 312)         │ - India DPDP Act 2023 & Rules 2025 │
│ - State Student Privacy Acts      │ - CCPA / CPRA (California)         │
│ - Institutional SIS Data Treaties │ - Corporate Severance & NDA Regs   │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

### Vertical A: Higher Education & Student Career Development

1. **FERPA (Family Educational Rights and Privacy Act — 34 CFR Part 99):**
   - _Classification:_ Academic transcripts, advisor meeting notes, and
     institutional student profiles constitute protected "Education Records."
   - _School Official Exception:_ Vaeloom operates as a contracted "School
     Official" under institutional control, with a legitimate educational
     interest in facilitating career readiness.
   - _Candidate Vault Boundary:_ Personal career memories, private notes, and
     external job applications created voluntarily by the student outside
     institutional assignments are owned exclusively by the student and do _not_
     constitute institutional records subject to university discovery without a
     court order or student subpoena.
2. **COPPA (Children's Online Privacy Protection Act — 16 CFR Part 312):**
   - _Scope:_ Under-13 exclusion.
   - _Platform Policy:_ Vaeloom Enterprise is strictly gated to individuals aged
     **16 and above** (secondary vocational, higher education, and corporate
     workforce). Hard age-verification gate enforced upon initial signup.

---

### Vertical B: Corporate Employment, Outplacement & Talent Transition

1. **EU GDPR (General Data Protection Regulation — Regulation 2016/679):**
   - _Lawful Basis (Art. 6):_ Performance of contract (user terms) for
     individual career tooling; legitimate interest for aggregated placement
     telemetry.
   - _Purpose Limitation (Art. 5(1)(b)):_ Data collected for resume tailoring
     cannot be repurposed for recruiter marketing or automated employer
     screening without distinct consent.
   - _International Transfers (Chapter V):_ European tenant data is strictly
     pinned to EU Regional Cells (Frankfurt / Dublin). Cross-border transfers
     require Standard Contractual Clauses (SCCs).
2. **India Digital Personal Data Protection (DPDP) Act 2023 & Rules 2025:**
   - _Consent Notice:_ Clear, granular, bilingual consent notices with explicit
     purpose specification.
   - _Children's Data (§9):_ Prohibits tracking, behavioral monitoring, or
     targeted advertising directed at individuals under 18.
   - _Breach Reporting:_ Mandatory notification to the Data Protection Board and
     affected users within regulatory reporting windows.

---

## 2. Regional AI Risk Classification & EU AI Act Compliance

Under the European Union Artificial Intelligence Act (enforceable 2026), AI
systems utilized in employment and education are subject to stringent
categorization:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EU AI ACT CLASSIFICATION MATRIX                      │
├──────────────────────────┬──────────────────────┬──────────────────────┤
│ CAPABILITY DOMAIN        │ RISK CLASSIFICATION  │ MANDATORY OVERSIGHT  │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ 1. Resume Tailoring &    │ Low Risk /           │ Transparency notice: │
│    Grammar Optimization  │ Permitted            │ AI-assisted drafting │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ 2. ATS Match Scoring     │ Annex III:           │ Human-in-the-loop;   │
│    & Job Recommendation  │ High Risk (Recruitment│ algorithmic audit;   │
│                          │ & Candidate Screening│ bias documentation   │
├──────────────────────────┼──────────────────────┼──────────────────────┤
│ 3. Automated External    │ Unacceptable Risk /  │ BANNED: Platform     │
│    Job Submissions       │ Non-Compliant        │ enforces strict HITL │
└──────────────────────────┴──────────────────────┴──────────────────────┘
```

### High-Risk AI Requirements for ATS Match & Scoring:

1. **Human-in-the-Loop Oversight (Art. 14):** Autonomous agents cannot
   disqualify candidates or make consequential employment decisions. Every
   recommendation is presented as advisory advice requiring candidate and
   advisor sign-off.
2. **Technical Documentation & Logging (Art. 11 & 12):** System 1 and System 2
   cognitive decision paths maintain immutable audit logs recording model
   version, prompt hash, context tokens, and similarity scores.
3. **Data Quality & Bias Mitigation (Art. 10):** ATS scoring models are
   evaluated against standardized demographic test splits to verify zero adverse
   impact across gender, ethnicity, or non-traditional educational backgrounds.

---

## 3. Regional Data Residency & Tenant Cell Matrix

| Legal Jurisdiction | Applicable Regimes         | Primary Regional Cell      | In-Cell Compute & Storage                 | Cross-Border Transfer Controls                   |
| :----------------- | :------------------------- | :------------------------- | :---------------------------------------- | :----------------------------------------------- |
| **United States**  | FERPA, COPPA, CCPA         | `us-east-1` (Virginia)     | PostgreSQL, S3, TypeSafe AI, Ollama Cloud | US-only processing; no unapproved foreign egress |
| **European Union** | GDPR, EU AI Act            | `eu-central-1` (Frankfurt) | Dedicated PG Cell, MinIO, Local Gemma 4   | Zero US data egress; local inference required    |
| **India**          | DPDP Act 2023 / Rules 2025 | `ap-south-1` (Mumbai)      | Dedicated PG Cell, MinIO, Local Gemma 4   | Data residency compliant; CERT-In logging active |

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Reference:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P02-research-domain-analysis-and-data-discovery.md`
  §11 (WS-02.4) and §22 (`DEL-ENT-P02-04`).
- **Predecessor Link:** Operationalizes the regulatory commitments documented in
  `DEL-ENT-P01-01` (Scope) and `DEL-ENT-P01-03` (Risk Hypotheses).
- **Downstream Impact:** Forms the legal and compliance boundary for Phase
  `ENT-P13` (Security, Privacy, and Compliance).
