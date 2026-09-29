# ENT-P01 — 05 Non-Goals & Research Backlog — Governance & Scope Lock

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** `DEL-ENT-P01-05` (v1.0)  
> **Owner:** Lead Product Strategist & Enterprise Architect  
> **Reviewed By:** CISO, Legal Counsel, Program Governance Board  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Explicit Enterprise Non-Goals (Scope Boundaries)

To prevent scope creep, architectural compromise, and regulatory exposure, the
following non-goals are formally established and locked for the Enterprise
Track:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE SCOPE BOUNDARY SYSTEM                     │
├──────────────────────────┬─────────────────────────────────────────────┤
│ NON-GOAL IDENTIFIER      │ RATIONALE & BOUNDARY ENFORCEMENT            │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NG-01: Big-Bang Cutover  │ Multi-tenant migration must be progressive; │
│                          │ zero disruption to active student cohorts   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NG-02: Institutional     │ Career centers cannot browse candidate      │
│ Surveillance Backdoors   │ private vaults without explicit grants      │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NG-03: Fully Autonomous  │ External submissions require human-in-the-  │
│ Job Applications         │ loop (HITL) candidate sign-off              │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NG-04: Cross-Tenant Data │ Enterprise customer data will never train   │
│ Pooling for AI Models    │ shared foundation models                    │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NG-05: Unreviewed MCP    │ Connectors require manifests, capability    │
│ Arbitrary Code Execution │ sandboxing, and manual security reviews     │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NG-06: Self-Declared     │ Compliance (FERPA, GDPR, DPDP) requires     │
│ Regulatory Compliance    │ third-party audits and legal verifications  │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### NG-01: Big-Bang Architecture Cutover

- **Boundary:** We will **not** attempt a single, instantaneous migration from
  the single-tenant MVP database schema to multi-tenant regional cells.
- **Enforcement:** Dual-run compatibility and progressive schema evolution will
  be executed across phased migration waves (Phases `ENT-P04` through
  `ENT-P07`), maintaining backward compatibility for all active API endpoints.

### NG-02: Unconsented Institutional Surveillance or Administrative Backdoors

- **Boundary:** We will **not** build "administrative master keys" or superuser
  views allowing institutional staff to browse a student's unshared career
  memories, private notes, or off-campus application activity.
- **Enforcement:** PostgreSQL RLS policies enforce tenant and user isolation at
  the database kernel level. Software bypassing RLS is rejected by CI/CD
  security linters.

### NG-03: Fully Autonomous Job Application Submission Without Candidate Consent

- **Boundary:** Autonomous agents will **not** automatically apply to jobs or
  submit candidate resumes to employer portals without explicit, real-time human
  approval.
- **Enforcement:** In `loop.py`, all application-dispatch and email-send tools
  are classified as `APPROVAL_GATED_TOOLS`. The agent engine halts execution and
  registers a pending transaction in the `approvals` table until candidate
  confirmation.

### NG-04: Cross-Tenant Data Pooling for Model Pre-Training

- **Boundary:** We will **not** aggregate candidate resumes, advisor feedback,
  or institutional placement outcomes across tenants to train or fine-tune
  public foundation models.
- **Enforcement:** Strict tenant cell isolation in pgvector and relational
  stores. Model calls utilize zero-data-retention enterprise API contracts (e.g.
  TypeSafe AI, Ollama Cloud enterprise tier).

### NG-05: Unreviewed Third-Party MCP Arbitrary Code Execution

- **Boundary:** Users and administrators will **not** be allowed to connect
  arbitrary, unvetted MCP servers executing untrusted binaries on the host
  server.
- **Enforcement:** All Model Context Protocol (MCP) integrations must pass
  capability manifest validation, SSRF URL filtering (`url_guard.py`), process
  sandbox isolation, and cryptographic signature verification.

### NG-06: Self-Declared Regulatory Compliance Claims

- **Boundary:** We will **not** make public claims of "FERPA Certified" or "GDPR
  Approved" based solely on internal documentation.
- **Enforcement:** Formal compliance assertions require signed Data Protection
  Impact Assessments (DPIAs), professional legal counsel reviews, and accredited
  third-party SOC 2 Type II audit reports.

---

## 2. Governed Enterprise Research & Discovery Backlog

Future capabilities and innovative hypotheses are documented below with explicit
adoption triggers, validation experiments, and sunset conditions.

| ID        | Title & Concept                                                                                                                                                                                               | Target Persona                  | Dependencies                                                       | Adoption Trigger                                                                                            | Sunset / Rejection Condition                                                                                               | Owner             |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------ | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **RB-01** | **Multi-Institution Consent Federation**<br>Allowing alumni moving between undergraduate, graduate, and corporate outplacement programs to federate career memories across distinct enterprise tenants.       | Alex Chen (Alum)                | Identity federation, OIDC / SAML, Cross-Tenant RLS                 | ≥5 enterprise design partners request cross-institutional alumni tracking.                                  | If identity federation introduces cross-tenant vector contamination risks or violates FERPA data transfer restrictions.    | Identity Lead     |
| **RB-02** | **Privacy-Preserving Institutional Benchmarking**<br>Differential privacy framework enabling universities to compare cohort placement velocities against national peer averages without exposing student PII. | Dr. Eleanor Vance (Career Exec) | Aggregation engine, k-anonymity proof, OpenTelemetry               | Institutional cohort volume reaches ≥50,000 active candidates across ≥10 universities.                      | If epsilon-differential privacy noise degrades metric utility below actionable decision thresholds.                        | Data Lead         |
| **RB-03** | **Zero-Knowledge Career Credential Proofs**<br>Using cryptographic verifiable credentials (W3C VC) to prove degree completion and GPA thresholds to recruiters without revealing full transcripts.            | Sarah Jenkins (DPO)             | Cryptographic signature engine, institutional registrar connectors | ≥3 major enterprise recruiters (e.g. Google, Microsoft, Amazon) accept W3C VCs for automated ATS filtering. | If recruiting ATS standards coalesce around proprietary centralized APIs rather than decentralized verifiable credentials. | Cryptography Lead |
| **RB-04** | **Real-Time Voice Mock Interview Agent**<br>Low-latency WebRTC audio streaming agent simulating behavioral and technical interviews with live feedback.                                                       | Priya Sharma (Advisor)          | WebRTC gateway, Whisper / STT, low-latency TTS, Gemma 4 audio      | Candidate demand for interview coaching exceeds advisor capacity by >500%.                                  | If audio inference latency exceeds 800ms or speech-to-text accuracy falls below 96% on diverse accents.                    | AI Audio Lead     |
| **RB-05** | **Decentralized Candidate Career Wallets**<br>Exporting full 22-memory graphs to personal mobile devices with local encryption for offline candidate autonomy.                                                | Alex Chen (Candidate)           | SQLite mobile engine, edge embeddings, React Native client         | Mobile app MAU reaches ≥40% of total candidate platform engagement.                                         | If mobile edge compute is insufficient to run local semantic search across 5,000+ career memories.                         | Mobile Lead       |
| **RB-06** | **Automated Employer Job Feed Ingestion**<br>Direct API connectors to enterprise ATS platforms (Workday, Greenhouse, Lever) for real-time internal mobility job indexing.                                     | Marcus Sterling (Outplacement)  | ATS OAuth partner programs, webhook deduplication                  | Enterprise outplacement clients require custom internal corporate mobility portals.                         | If ATS partner API licensing costs exceed $15,000/year per connector without dedicated client funding.                     | Integration Lead  |

---

## 3. Scope Lock & Conflict Resolution

### Conflict Resolution Summary

- **Conflict C-ENT-P01-01 (Advisor vs Candidate Sovereignty):** Career center
  buyers requested default visibility into all candidate job applications.
  Resolved: **Candidate sovereignty prevails.** Advisors receive visibility
  _only_ upon candidate affirmative consent grant.
- **Conflict C-ENT-P01-02 (Agent Roster Activation):** Enterprise marketing
  requested activating all 28 agents simultaneously. Resolved: **Capability
  ceiling adopted.** Only validated agents with passing evaluation benchmarks
  and strict approval gates are activated.
- **Conflict C-ENT-P01-03 (Model Inference Architecture):** Cloud-only vs local
  models. Resolved: **Hybrid cognitive model adopted.** 30% deterministic System
  1 (TypeSafe AI) + 70% System 2 (Ollama Cloud Gemma 4 31B with local 12B
  fallback).

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Traceability:** Conforms to
  `specs/phase-contracts/03-enterprise/ENT-P01-discovery-and-problem-definition.md`
  §11 (WS-01.5) and §22 (`DEL-ENT-P01-05`).
- **Predecessor Authority:** Directly references and enforces the boundaries
  established in `DEL-ENT-P00-01` through `DEL-ENT-P00-05`.
- **Handoff Output:** Provides the non-negotiable architectural boundaries and
  research backlog for Phase `ENT-P02` (Research & Domain Analysis).
