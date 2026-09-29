# ENT-P20 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P20 — Post-Deployment Validation  
**Version:** 1.0.0  
**Owner:** SRE Lead + CTO  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk Description                                     | Severity | Likelihood | Mitigation                                           | Owner          | Status    |
| --------------- | ---------------------------------------------------- | -------- | ---------- | ---------------------------------------------------- | -------------- | --------- |
| RISK-ENT-P20-01 | Latency spike under unexpected traffic surges        | MEDIUM   | LOW        | Kubernetes HPA pod autoscaling triggered at >70% CPU | SRE Lead       | MITIGATED |
| RISK-ENT-P20-02 | Cognitive API rate limits from third-party providers | HIGH     | LOW        | Multi-key round-robin pool + graceful fallback to S1 | AI Safety Lead | MITIGATED |
| RISK-ENT-P20-03 | pgvector memory pressure on high index growth        | MEDIUM   | LOW        | Monitored RSS; scheduled automated vacuum & reindex  | Data Architect | MITIGATED |
| RISK-ENT-P20-04 | User error during ConsentGrant issuance              | LOW      | MEDIUM     | Interactive confirmation dialog with scope breakdown | UX Lead        | MITIGATED |
| RISK-ENT-P20-05 | Cloud infrastructure cost drift over time            | LOW      | LOW        | Monthly FinOps cost anomaly alerts via AWS Budgets   | FinOps Lead    | MITIGATED |

---

## Decision Register

| ID             | Decision                                       | Rationale                                          | Alternatives                  | Owner          | Date       |
| -------------- | ---------------------------------------------- | -------------------------------------------------- | ----------------------------- | -------------- | ---------- |
| DEC-ENT-P20-01 | Certify 72h observation window as successful   | 99.98% uptime, 0 P0/P1 incidents, 0 RLS leaks      | Extend observation to 14 days | CTO            | 2026-09-29 |
| DEC-ENT-P20-02 | Retain ef_search=40 for pgvector in production | Delivers 13.8ms P95 with 100% recall on pilot      | Increase to 50                | Data Architect | 2026-09-29 |
| DEC-ENT-P20-03 | Maintain HPA minimum replica count at 4 pods   | Guarantees instant burst capacity for API          | Scale down to 2               | SRE Lead       | 2026-09-29 |
| DEC-ENT-P20-04 | Transition Blue standby pods to decommissioned | Production stability proven; eliminates idle cost  | Keep Blue warm indefinitely   | DevOps Lead    | 2026-09-29 |
| DEC-ENT-P20-05 | Authorize progression to ENT-P21 (Maintenance) | Production validation complete; criteria satisfied | Hold in validation            | CTO            | 2026-09-29 |

---

## Assumption Register

| ID             | Assumption                                                 | Basis                                    | Risk if Wrong            | Owner                |
| -------------- | ---------------------------------------------------------- | ---------------------------------------- | ------------------------ | -------------------- |
| ASM-ENT-P20-01 | Pilot user traffic patterns represent full enterprise load | 3,850 pilot users across 14 institutions | Latency changes at scale | Performance Engineer |
| ASM-ENT-P20-02 | Third-party LLM providers sustain current uptime           | 99.9% uptime during 72h window           | Cognitive degradation    | AI Safety Lead       |
| ASM-ENT-P20-03 | Unit economics ($0.0762/doc) scale linearly with volume    | FinOps actuals vs. model correlation     | Gross margin compression | FinOps Lead          |
| ASM-ENT-P20-04 | Customer satisfaction (CSAT 4.8) remains stable            | Pilot feedback survey results            | User churn               | VP Product           |

---

## Traceability Register

| Req ID      | Requirement                        | Design Reference                    | Implementation File       | Verification Test           | Evidence ID          |
| ----------- | ---------------------------------- | ----------------------------------- | ------------------------- | --------------------------- | -------------------- |
| ENT-P20-R01 | Live Smoke Verification & Journeys | `01-production-smoke-tests.md`      | Smoke probe script        | 241/241 route checks        | EVD-ENT-P20-001..004 |
| ENT-P20-R02 | 72-Hour Production Telemetry       | `02-post-launch-monitoring.md`      | Prometheus / Grafana      | 99.98% uptime log           | EVD-ENT-P20-005..010 |
| ENT-P20-R03 | User Acceptance & Cohort CSAT      | `03-user-acceptance-validation.md`  | CSAT survey analytics     | 4.8/5.0 CSAT score          | EVD-ENT-P20-011..012 |
| ENT-P20-R04 | Live Security & Consent Audits     | `04-security-validation-report.md`  | SQL RLS penetration drill | 0 cross-tenant leaks        | EVD-ENT-P20-013..016 |
| ENT-P20-R05 | Production Performance Baselines   | `05-performance-baseline-report.md` | OTel latency metrics      | P95 14.2ms baseline         | EVD-ENT-P20-017..019 |
| ENT-P20-R06 | Full Test Suite Verification       | `05-test-results.md`                | `pytest` test runner      | 1022/1022 pass verification | EVD-ENT-P20-001..020 |
| ENT-P20-R07 | Gate Scorecard ≥95 & Zero Blockers | `06-gate-report.md`                 | §28 Scorecard Report      | Audit review                | EVD-ENT-P20-001..020 |

---

_Registers v1.0.0 — SRE Lead — 2026-09-29_
