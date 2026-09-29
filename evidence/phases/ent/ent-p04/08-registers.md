# ENT-P04 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P04` (Project Planning and Delivery Governance)  
> **Deliverable:** `DEL-ENT-P04-08` — Consolidated Governance Registers  
> **Owner:** Program Management Office & Risk Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                              | Severity |          Impact          | Mitigation Strategy                                                                                                | Owner       |     Status     |
| :------------------ | :-------------------------------------------------------------------------------------------- | :------: | :----------------------: | :----------------------------------------------------------------------------------------------------------------- | :---------- | :------------: |
| **RISK-ENT-P04-01** | Documentation completeness mistaken for runtime software readiness.                           | Critical | False release readiness  | Enforce Section 18 empirical testing protocol; require live test logs and probe responses before gating.           | QA Lead     | **CONTROLLED** |
| **RISK-ENT-P04-02** | Simultaneous multi-cell Kubernetes provisioning causes AWS/GCP resource quota depletion.      |   High   |     Deployment halt      | Request cloud service quota increases 4 weeks prior to Phase ENT-P16; maintain staging Terraform quotas.           | DevOps Lead | **CONTROLLED** |
| **RISK-ENT-P04-03** | Critical path delay in database migration schema impacts downstream frontend and API sprints. |   High   |    Schedule slippage     | Parallelize frontend component mock development using OpenAPI Prism mocks while schema migrates.                   | Eng Manager | **CONTROLLED** |
| **RISK-ENT-P04-04** | Cloud LLM token price volatility degrades unit economics during peak enrollment seasons.      |  Medium  |    Margin compression    | Local container fallback (`gemma4:12b`) absorbs low-stakes triage jobs; XML prompt fencing caps max token lengths. | FinOps Lead | **CONTROLLED** |
| **RISK-ENT-P04-05** | Key personnel dependency on Single Subject Matter Experts across AI and database engineering. |  Medium  | Bus factor vulnerability | Pair programming rotations, comprehensive ADR documentation, and cross-functional code review requirements.        | Tech Lead   | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                | Context & Alternatives                                                                                                                                       | Chosen Rationale                                                                                              |    Status    |
| :----------------- | :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :----------: |
| **DEC-ENT-P04-01** | **Sequential 4-Wave Enterprise Phasing**      | Alt A: Big-bang single release after ENT-P21.<br>Alt B: Four staged enterprise waves with independent milestone gates.                                       | Chose Alt B. Mitigates delivery risk and provides demonstrable progress for institutional design partners.    | **APPROVED** |
| **DEC-ENT-P04-02** | **Zero-Float Critical Path Focus**            | Alt A: Leveling resources uniformly across all phases.<br>Alt B: Ruthlessly prioritizing critical path phases (P05, P07, P08, P12, P13, P14, P15, P17, P19). | Chose Alt B. Prevents non-critical tasks from starving core architectural and security dependencies.          | **APPROVED** |
| **DEC-ENT-P04-03** | **Single 'A' RACI Accountability**            | Alt A: Joint shared accountability.<br>Alt B: Strictly one named Accountable role per phase.                                                                 | Chose Alt B. Eliminates ambiguity and ensures unequivocal ownership over quality gate scorecards.             | **APPROVED** |
| **DEC-ENT-P04-04** | **Dedicated Regional Tenant Cells**           | Alt A: Shared multi-tenant database with logical RLS only.<br>Alt B: Dedicated database clusters and storage per regional cell.                              | Chose Alt B. Satisfies strict EU GDPR and India DPDP data residency requirements without cross-border egress. | **APPROVED** |
| **DEC-ENT-P04-05** | **Zero-Downtime Blue/Green Deployment**       | Alt A: Scheduled maintenance window with downtime.<br>Alt B: Blue/Green cutover with expand/contract DB migrations.                                          | Chose Alt B. Guarantees 99.95% enterprise SLA during academic career fair operating hours.                    | **APPROVED** |
| **DEC-ENT-P04-06** | **Management Reserve Allocation (\$35k USD)** | Alt A: Fixed budget without buffer.<br>Alt B: 15% dedicated cloud management reserve for token bursts.                                                       | Chose Alt B. Shields engineering from operational budget panics during large-scale pilot onboarding.          | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                                                   | Validation Method                                                | Invalidation Action                                                                                          |    Status     |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P04-01** | Institutional IT departments require 4–6 weeks lead time to approve SAML 2.0 / SCIM enterprise metadata.                                  | Enterprise customer onboarding interviews with 5 universities.   | Provide interim CSV roster batch uploads with PGP encryption during pilot onboarding.                        | **VALIDATED** |
| **ASM-ENT-P04-02** | Production Kubernetes clusters can scale Playwright rendering workers from 2 to 20 pods in $<60\text{ seconds}$.                          | Kubernetes HPA benchmarking using CPU/Memory metrics.            | Pre-warm a static baseline pool of 5 Playwright Chromium pods during scheduled recruiting hours.             | **VALIDATED** |
| **ASM-ENT-P04-03** | Local Ollama container (`gemma4:12b`) achieves $\ge 85\%$ qualitative match on resume tailoring benchmarks compared to cloud Gemma 4 31B. | Side-by-side semantic similarity evaluation on 500 test resumes. | If local quality falls below 85%, use local model strictly for heuristic triage and queue complex synthesis. | **VALIDATED** |
| **ASM-ENT-P04-04** | Engineering velocity across Wave 2 will sustain an average of 45 Story Points per 2-week sprint across streams.                           | Historical sprint velocity tracking from MVP hardening phases.   | Adjust feeding buffers and reallocate contract engineering capacity if velocity drops below 35 SP.           | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category         | Primary Deliverable    | Implementing Spec / Model                                     | Verification                    |    Status    |
| :------------------- | :--------------- | :--------------------- | :------------------------------------------------------------ | :------------------------------ | :----------: |
| **ENT-P04-R01**      | Scope            | `DEL-ENT-P04-01`, `02` | `01-integrated-roadmap.md`, `02-wbs-work-packages.md`         | Roadmap & WBS Dictionary        | **VERIFIED** |
| **ENT-P04-R02**      | Evidence         | `DEL-ENT-P04-07`       | `05-test-results.md`, `07-evidence-bundle.md`                 | 731 verified live tests         | **VERIFIED** |
| **ENT-P04-R03**      | Security/Privacy | `DEL-ENT-P04-04`, `05` | `04-capacity-resource-allocation.md`, `05-risk-governance.md` | AppSec & DPO veto power         | **VERIFIED** |
| **ENT-P04-R04**      | Quality          | `DEL-ENT-P04-06`       | `apps/web/e2e/*.spec.ts`, `pytest tests/security`             | 46/46 E2E, 404 security         | **VERIFIED** |
| **ENT-P04-R05**      | Operations       | `DEL-ENT-P04-05`       | `04-architecture-framing.md`, `05-risk-governance.md`         | Blue/Green cutover & CCB        | **VERIFIED** |
| **ENT-P04-R06**      | Data/AI          | `DEL-ENT-P04-02`       | `02-wbs-work-packages.md` (WP-07, WP-12)                      | 22-memory & Two-tier AI         | **VERIFIED** |
| **ENT-P04-R07**      | Traceability     | `DEL-ENT-P04-08`       | `08-registers.md`                                             | Bidirectional link verification | **VERIFIED** |
| **ENT-P04-R08**      | Gate             | `DEL-ENT-P04-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p05.md`               | Score: 98.91 / 100 (Full GO)    | **VERIFIED** |

_Signed: Program Management Office & Risk Custodian — 2026-09-29_
