# ENT-P19 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P19 — Release Readiness and Production Deployment  
**Version:** 1.0.0  
**Owner:** Release Manager + CTO  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk Description                                  | Severity | Likelihood | Mitigation                                             | Owner           | Status    |
| --------------- | ------------------------------------------------- | -------- | ---------- | ------------------------------------------------------ | --------------- | --------- |
| RISK-ENT-P19-01 | Traffic cutover latency spike during canary shift | MEDIUM   | LOW        | Pre-warmed green pods + 10% gradual Istio shift        | SRE Lead        | MITIGATED |
| RISK-ENT-P19-02 | Unforeseen external penetration test finding      | HIGH     | LOW        | 24h critical hotfix SLA + isolated staging environment | CISO            | MITIGATED |
| RISK-ENT-P19-03 | Enterprise IdP misconfiguration during SAML setup | MEDIUM   | MEDIUM     | Comprehensive SP metadata XML + test auth harness      | IAM Engineer    | MITIGATED |
| RISK-ENT-P19-04 | Database schema lock during high peak traffic     | HIGH     | LOW        | Expand/Contract pattern + off-peak maintenance window  | Data Architect  | MITIGATED |
| RISK-ENT-P19-05 | Cloud provider regional outage during deployment  | HIGH     | LOW        | Multi-AZ Kubernetes + automatic cross-zone failover    | Cloud Architect | MITIGATED |

---

## Decision Register

| ID             | Decision                                              | Rationale                                                  | Alternatives            | Owner        | Date       |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ----------------------- | ------------ | ---------- |
| DEC-ENT-P19-01 | Authorize Unanimous GO for Production Deployment      | 100% pre-flight tests pass; 0 CVEs; full compliance        | Delay launch            | CTO          | 2026-09-29 |
| DEC-ENT-P19-02 | Execute Blue-Green cutover with 60m Blue standby      | Guarantees instant 2-second rollback capability            | In-place rolling update | SRE Lead     | 2026-09-29 |
| DEC-ENT-P19-03 | Initiate 6-Month SOC 2 Type II observation period     | Establishes institutional credibility for university sales | SOC 2 Type I only       | CISO         | 2026-09-29 |
| DEC-ENT-P19-04 | Commission CREST-certified external penetration test  | Independent rigorous audit of all 241 API routes           | Internal testing only   | CISO         | 2026-09-29 |
| DEC-ENT-P19-05 | Enable all enterprise routes and SAML auth by default | Fulfills contract requirements for enterprise pilots       | Gated behind beta flags | Product Lead | 2026-09-29 |

---

## Assumption Register

| ID             | Assumption                                                           | Basis                                            | Risk if Wrong             | Owner        |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------ | ------------------------- | ------------ |
| ASM-ENT-P19-01 | Staging pre-flight test results replicate identically in production  | Environment parity matrix verified in ENT-P16    | Production defect         | QA Lead      |
| ASM-ENT-P19-02 | External penetration test uncovers zero Critical architectural flaws | Multiple internal red-team exercises passed      | Launch delay              | CISO         |
| ASM-ENT-P19-03 | Blue-green standby pods incur < $50 in temporary cloud compute       | FinOps compute cost modeling                     | Cost overrun              | FinOps Lead  |
| ASM-ENT-P19-04 | Customer enterprise IdPs support standard SAML 2.0 WebSSO profile    | Tested with Okta, Azure AD, and Google Workspace | Customer onboarding delay | IAM Engineer |

---

## Traceability Register

| Req ID      | Requirement                         | Design Reference                     | Implementation File      | Verification Test           | Evidence ID          |
| ----------- | ----------------------------------- | ------------------------------------ | ------------------------ | --------------------------- | -------------------- |
| ENT-P19-R01 | Release Readiness & Go/No-Go Matrix | `01-release-readiness-assessment.md` | Stakeholder sign-off doc | Pre-flight audit            | EVD-ENT-P19-001..002 |
| ENT-P19-R02 | Zero-Downtime Deployment & Canary   | `02-production-deployment-plan.md`   | Istio traffic splitting  | Canary rollout test         | EVD-ENT-P19-003..005 |
| ENT-P19-R03 | External CREST Penetration Testing  | `03-external-penetration-test.md`    | Pentest scope brief      | Vendor contract             | EVD-ENT-P19-006..008 |
| ENT-P19-R04 | SOC 2 Type II Audit Readiness       | `04-soc2-type2-readiness.md`         | Trust Services Criteria  | Auditor package review      | EVD-ENT-P19-009..010 |
| ENT-P19-R05 | Customer Launch Comms & DPA         | `05-launch-communications.md`        | Announcement & DPA       | Legal review                | EVD-ENT-P19-011..013 |
| ENT-P19-R06 | Pre-Flight Test Suite Baseline      | `05-test-results.md`                 | `pytest` test runner     | 1022/1022 pass verification | EVD-ENT-P19-014..019 |
| ENT-P19-R07 | Gate Scorecard ≥95 & Zero Blockers  | `06-gate-report.md`                  | §28 Scorecard Report     | Audit review                | EVD-ENT-P19-001..020 |

---

_Registers v1.0.0 — Release Manager — 2026-09-29_
