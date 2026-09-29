# ENT-P01 — 03 Value & Risk Hypotheses — Enterprise Feasibility

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** `DEL-ENT-P01-03` (v1.0)  
> **Owner:** Lead Business Analyst & Enterprise Risk Strategist  
> **Reviewed By:** Head of AI Product, Security Lead, Legal Counsel  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Value Hypotheses (VH)

The enterprise commercial and operational model depends on five foundational
value hypotheses. Each hypothesis specifies an expected measurable impact,
verification method, and business impact.

| ID        | Value Hypothesis                                                                                                                                                                                                              | Baseline Metric                                                  | Target Enterprise Outcome                                         | Verification Method                                                                                               |
| :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **VH-01** | **Placement Velocity Acceleration**<br>Autonomous semantic ATS tailoring and multi-agent job matching reduce candidate time-to-offer by automating application asset generation.                                              | 148 days average job search duration (NACE 2025).                | **≤92 days average duration** (37.8% velocity improvement).       | Longitudinal tracking of candidate job applications from ingestion to verified offer status across pilot cohorts. |
| **VH-02** | **Advisory Capacity Expansion**<br>Automating tier-1 document audits (syntax, ATS match score, hard-skill gaps) allows advisors to manage significantly larger cohorts without sacrificing guidance quality.                  | 1 advisor per 120 active students; 4.8 days feedback turnaround. | **1 advisor per 450 active students; <12 hours turnaround**.      | Advisor time logs, intervention ticket counts, and feedback latency metrics captured in Advisor Control Plane.    |
| **VH-03** | **Institutional Attribution & Placement Verifiability**<br>Passive connector integration (Gmail interview watches, LinkedIn synchronization) automatically detects interview invitations and offers with verified provenance. | 32% survey response rate on First-Destination Surveys.           | **≥85% verified outcome tracking** for enrolled cohorts.          | Connector sync telemetry, verified webhook receipts, and deduplicated interview calendar events.                  |
| **VH-04** | **Career Memory Compounding & Alum Lifetime Value**<br>Providing sovereign, transferable career memories increases student platform engagement across multi-year academic journeys and alumni transitions.                    | 14% platform activity after first semester.                      | **≥62% multi-year retention**; 40% active alumni engagement.      | Weekly active users (WAU), total memories stored, and graduation-to-alumni workspace conversion rates.            |
| **VH-05** | **Enterprise Outplacement ROI & Brand Preservation**<br>Corporate outplacement cohorts land roles faster with tailored executive resumes, reducing corporate severance liabilities and safeguarding employer brand.           | 180 days typical outplacement placement cycle.                   | **≤105 days average placement cycle**; 92% employee satisfaction. | Corporate sponsor dashboard metrics, candidate Net Promoter Score (NPS), and corporate contract renewals.         |

---

## 2. Enterprise Risk Hypotheses & Failure Modes (RH)

Each risk hypothesis represents a potential failure mode that could disrupt
customer trust, operational viability, or regulatory standing.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE RISK HYPOTHESIS MATRIX                    │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ RISK IDENTIFIER   │  SEVERITY / IMPACT│ CORE ARCHITECTURAL MITIGATION  │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ RH-01: Agent      │ High / Reputational│ Deterministic XML fencing,     │
│ Hallucination     │                   │ raw memory citation, zero-mock │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ RH-02: Advisor    │ Critical / Legal  │ Hard cryptographic RLS,        │
│ Overreach         │ & Regulatory      │ candidate-controlled grants    │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ RH-03: Prompt     │ High / Security   │ Ingestion sanitization, SSRF   │
│ Injection / RAG   │                   │ guard, zero execution in LLM   │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ RH-04: Cognitive  │ High / Operational│ Fallback routing (Gemma 4 31B  │
│ Outage            │                   │ -> local 12B -> cached rules)  │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ RH-05: Inference  │ Medium / Financial│ Two-tier cognitive routing     │
│ Cost Explosion    │                   │ (30% System 1 / 70% System 2)  │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### RH-01: Autonomous Agent Hallucination & Skill Inflation

- **Hypothesis:** Generative LLMs modifying resumes to match job descriptions
  will subtly exaggerate technical experience or invent non-existent
  proficiencies, creating liability for candidates during technical interviews.
- **Severity:** High (Direct threat to candidate reputation and institutional
  brand).
- **Architectural Mitigation:** Document builder requires every generated bullet
  point to have an explicit provenance citation pointer (`provenance_memory_id`)
  linking to a verified memory in the database. Synthesizers operate inside
  strict XML fencing tags (`<document_context>`), with negative testing against
  hallucination payloads.

### RH-02: Institutional Advisor Surveillance & Consent Breach

- **Hypothesis:** Institutional career advisors accidentally or intentionally
  view confidential, unconsented candidate documents (e.g. personal diary
  entries, health disclosures, off-campus job pursuits), violating FERPA and
  GDPR.
- **Severity:** Critical (Regulatory violation, legal action, brand
  destruction).
- **Architectural Mitigation:** Database enforcement via PostgreSQL Row-Level
  Security (`RLS`). The `app.workspace_id` and `app.user_id` GUC session
  variables guarantee that queries cannot read unconsented records. The API
  enforces an explicit `ConsentGrant` verification middleware before returning
  any candidate data to institutional tokens.

### RH-03: Indirect Prompt Injection via Malicious Job Postings / Resumes

- **Hypothesis:** Adversarial actors place invisible prompt injection
  instructions (e.g., zero-font text, markdown payloads) inside external job
  postings or candidate resume PDFs to hijack the agent reasoning loop, leak
  system instructions, or initiate unauthorized outbound HTTP requests.
- **Severity:** High (System integrity and data exfiltration risk).
- **Architectural Mitigation:** Multi-stage content sanitization via
  `url_guard.py` (strict SSRF filter, RFC 1918 block) and text normalization
  before LLM ingestion. Tools are executed in an isolated sandbox with
  capability boundaries (`loop.py`). Destructive actions are hard-blocked by
  human approval gates.

### RH-04: Cognitive Provider Outages & API Rate Limiting

- **Hypothesis:** Upstream cloud LLM endpoints (Ollama Cloud, TypeSafe AI)
  experience downtime or latency spikes (>5,000ms), causing agent loops to hang,
  timeouts on resume generation, and user frustration.
- **Severity:** High (Service degradation and SLO breach).
- **Architectural Mitigation:** Resilient multi-tiered fallback architecture.
  System 1 decisions fall back from TypeSafe AI to fast local deterministic rule
  trees; System 2 generative synthesis falls back from Ollama Cloud `gemma4:31b`
  to local Ollama `gemma4:12b` or cached model endpoints with circuit breakers
  (`circuit_breaker.py`).

### RH-05: Inference Cost & Compute Resource Exhaustion

- **Hypothesis:** Heavy generative agent loops and high-volume Playwright
  headless browser PDF compilation saturate server memory and drive inference
  API costs beyond commercial viability ($>2.50 per resume tailored).
- **Severity:** Medium (Margin erosion and scalability limit).
- **Architectural Mitigation:** Two-tier cognitive routing: 30% lightweight
  System 1 deterministic routing (<50ms, negligible cost) + 70% System 2
  generative synthesis. Headless browser rendering is strictly rate-limited and
  throttled per workspace (`SCRAPE_QUOTA_PER_HOUR`). Document templates compile
  HTML/CSS with Playwright resource pooling and process recycling.

---

## 3. Explicit Stop / Pivot Criteria (Overlay §144)

In alignment with Section 144 of the governing phase contract, the following
falsifiable stop/pivot triggers and leading indicators are established. If any
trigger is breached, enterprise expansion is paused for executive remediation:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STOP / PIVOT CRITERIA & LEADING INDICATORS           │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│ TRIGGER CONDITION    │ LEADING INDICATOR    │ MANDATED ACTION          │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ 1. Candidate Consent │ >15% of candidates   │ STOP: Halt institutional │
│    Refusal > 25%     │ reject institutional │ sharing; redesign        │
│                      │ sharing requests     │ granular consent UI      │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ 2. Hallucination     │ >1.5% generated      │ STOP: Freeze autonomous  │
│    Rate > 2.0%       │ bullets contain      │ tailoring; restrict to   │
│                      │ ungrounded claims    │ human-authored bullets   │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ 3. Cross-Tenant      │ Single detected      │ HARD STOP: Terminate     │
│    Leakage > 0       │ instance of multi-   │ affected tenant; trigger │
│                      │ tenant leakage       │ SEV-1 forensic audit     │
├──────────────────────┼──────────────────────┼──────────────────────────┤
│ 4. Unit Cost         │ Cloud compute &      │ PIVOT: Enforce local     │
│    > $1.20 / Tailor  │ tokens exceed        │ quantized models or      │
│                      │ financial ceiling    │ strict user token quotas │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

1. **Candidate Consent Boycott Trigger:**
   - _Condition:_ If more than 25% of candidates actively reject the
     institutional advisory consent grant upon joining an enterprise
     organization.
   - _Action:_ **STOP.** Suspend onboarding new institutions. Conduct emergency
     UX research to re-architect consent granularity and student privacy
     assurances.
2. **AI Provenance Failure Trigger:**
   - _Condition:_ If automated evaluation detects that >2.0% of tailored resume
     bullet points contain facts, skills, or dates not grounded in the
     candidate's verified memory graph.
   - _Action:_ **STOP.** Roll back tailoring agent autonomy; enforce strict
     deterministic template extraction where LLM is restricted to formatting
     existing verified text.
3. **Multi-Tenant Isolation Failure Trigger:**
   - _Condition:_ A single automated test or production audit log reveals
     cross-tenant data leakage (e.g. Workspace A reading Workspace B data).
   - _Action:_ **IMMEDIATE HARD STOP.** Evacuate running processes, invoke
     incident response plan, and block all deployments until database RLS and
     cell boundaries are mathematically re-verified.
4. **Economic Viability Trigger:**
   - _Condition:_ Average cost per tailored application package (including LLM
     token calls, embeddings, vector queries, and headless rendering) exceeds
     $1.20 USD.
   - _Action:_ **PIVOT.** Shift default generative synthesis to local
     open-weights models (`gemma4:12b` via Ollama) and enforce sliding-window
     context compression.

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Traceability:** Fulfills
  `specs/phase-contracts/03-enterprise/ENT-P01-discovery-and-problem-definition.md`
  §11 (WS-01.3) and §22 (`DEL-ENT-P01-03`).
- **Dependencies:** Consumes `DEL-ENT-P01-01` (Problem Statements) and
  `DEL-ENT-P01-02` (Personas & JTBD).
- **Handoff Output:** Provides the quantitative thresholds for `DEL-ENT-P01-04`
  (Success Metrics) and scope boundaries for `DEL-ENT-P01-05` (Non-Goals).
