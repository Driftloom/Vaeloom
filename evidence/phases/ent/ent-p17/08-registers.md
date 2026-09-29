# ENT-P17 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P17 — Observability and Operations  
**Version:** 1.0.0  
**Owner:** Observability Lead + SRE  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk Description                                 | Severity | Likelihood | Mitigation                                                  | Owner           | Status    |
| --------------- | ------------------------------------------------ | -------- | ---------- | ----------------------------------------------------------- | --------------- | --------- |
| RISK-ENT-P17-01 | Telemetry storage cost explosion under peak load | MEDIUM   | MEDIUM     | Metric downsampling + log retention policies (30d)          | FinOps Lead     | MITIGATED |
| RISK-ENT-P17-02 | Alert fatigue causing missed P0/P1 incidents     | HIGH     | LOW        | Multi-window burn-rate SLO alerting logic                   | SRE Lead        | MITIGATED |
| RISK-ENT-P17-03 | Accidental PII leakage into third-party APM      | HIGH     | LOW        | Client-side & middleware sanitization filter                | AppSec Engineer | MITIGATED |
| RISK-ENT-P17-04 | Vector search latency degradation under load     | HIGH     | MEDIUM     | Prometheus alert at 12ms p95; auto-read replica scaling     | Data Architect  | MITIGATED |
| RISK-ENT-P17-05 | EU AI Act regulatory scrutiny on transparency    | MEDIUM   | LOW        | Persistent Article 50 banner & full human-in-the-loop audit | Legal Reviewer  | MITIGATED |

---

## Decision Register

| ID             | Decision                                             | Rationale                                               | Alternatives                       | Owner              | Date       |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------- | ---------------------------------- | ------------------ | ---------- |
| DEC-ENT-P17-01 | Standardize on OpenTelemetry native protocols (OTLP) | Vendor neutrality and unified trace/metric context      | Proprietary Datadog/NewRelic SDKs  | Observability Lead | 2026-09-29 |
| DEC-ENT-P17-02 | Implement Multi-Window Multi-Burn-Rate alerting      | Prevents false alarms while catching severe degradation | Single-threshold CPU/memory alerts | SRE Lead           | 2026-09-29 |
| DEC-ENT-P17-03 | Enforce strict Zero-PII policy in span attributes    | Mandatory compliance with GDPR Art. 25 & DPDP 2023      | Post-ingestion masking             | CISO               | 2026-09-29 |
| DEC-ENT-P17-04 | Classify Vaeloom AI features as Limited/Minimal Risk | Conforms to EU AI Act Annex III criteria                | Self-declare High-Risk             | Legal Reviewer     | 2026-09-29 |
| DEC-ENT-P17-05 | Require blameless postmortems within 48h for P0/P1   | Fosters engineering excellence & continuous learning    | Punitive root-cause analysis       | CTO                | 2026-09-29 |

---

## Assumption Register

| ID             | Assumption                                                       | Basis                               | Risk if Wrong                   | Owner              |
| -------------- | ---------------------------------------------------------------- | ----------------------------------- | ------------------------------- | ------------------ |
| ASM-ENT-P17-01 | Prometheus scrape overhead is < 1% CPU on FastAPI pods           | Empirical dev/staging benchmarks    | Performance degradation         | Observability Lead |
| ASM-ENT-P17-02 | On-call engineers acknowledge P0 incidents within 5 minutes      | PagerDuty auto-escalation to backup | SLA breach on major outage      | SRE Lead           |
| ASM-ENT-P17-03 | pgvector HNSW p95 stays below 15ms with current ef_search=40     | Benchmarked in ENT-P15 at 14.2ms    | SLO burn alert triggered        | Data Architect     |
| ASM-ENT-P17-04 | EU AI Act enforcement honors current Limited Risk classification | Independent preliminary legal audit | Compliance remediation required | Legal Reviewer     |

---

## Traceability Register

| Req ID      | Requirement                        | Design Reference                   | Implementation File        | Verification Test           | Evidence ID          |
| ----------- | ---------------------------------- | ---------------------------------- | -------------------------- | --------------------------- | -------------------- |
| ENT-P17-R01 | OpenTelemetry Instrumentation      | `01-otel-observability-design.md`  | FastAPI middleware / SDK   | Trace emission check        | EVD-ENT-P17-001..004 |
| ENT-P17-R02 | Automated Alerting & SLO Burn      | `02-alerting-slo-monitoring.md`    | Alertmanager rules         | PromQL rule validation      | EVD-ENT-P17-005..008 |
| ENT-P17-R03 | Real-Time Operational Dashboards   | `03-operational-dashboards.md`     | Grafana JSON specs         | Dashboard panel review      | EVD-ENT-P17-009..012 |
| ENT-P17-R04 | Incident Response & War Room SOP   | `04-incident-response-playbook.md` | Escalation runbook         | Simulated P0 drill          | EVD-ENT-P17-013..016 |
| ENT-P17-R05 | EU AI Act Article 50 Transparency  | `05-eu-ai-act-transparency.md`     | `AITransparencyBanner.tsx` | E2E browser inspection      | EVD-ENT-P17-017..019 |
| ENT-P17-R06 | Test Suite Telemetry Integrity     | `05-test-results.md`               | `pytest` test runner       | 1022/1022 pass verification | EVD-ENT-P17-020      |
| ENT-P17-R07 | Gate Scorecard ≥95 & Zero Blockers | `06-gate-report.md`                | §28 Scorecard Report       | Audit review                | EVD-ENT-P17-001..020 |

---

_Registers v1.0.0 — Observability Lead — 2026-09-29_
