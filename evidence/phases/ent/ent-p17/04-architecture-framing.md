# ENT-P17 Architecture Framing — Observability and Operations

**Phase:** ENT-P17 — Observability and Operations  
**Version:** 1.0.0  
**Owner:** Observability Lead + SRE  
**Reviewer:** Security Architect + CTO  
**Date:** 2026-09-29

---

## 1. Observability Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE OBSERVABILITY TOPOLOGY                    │
│                                                                         │
│  [ FastAPI & Next.js Pods ] ──(OTLP gRPC)──► [ OpenTelemetry Collector ]│
│                                                       │                 │
│              ┌────────────────────────────────────────┼──────────────┐  │
│              │                                        │              │  │
│      ┌───────▼────────┐                       ┌───────▼───────┐  ┌───▼──┐
│      │ Prometheus     │                       │ Grafana Loki  │  │Tempo │
│      │ (SLO Metrics)  │                       │ (Audit Logs)  │  │Traces│
│      └───────┬────────┘                       └───────┬───────┘  └───┬──┘
│              │                                        │              │  │
│              └─────────────────┬──────────────────────┴──────────────┘  │
│                                │                                        │
│                      ┌─────────▼──────────┐                             │
│                      │ Grafana Dashboards │                             │
│                      └─────────┬──────────┘                             │
│                                │ (Breach)                               │
│                      ┌─────────▼──────────┐                             │
│                      │ PagerDuty & Slack  │                             │
│                      └────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Observability and Operations Invariants

### INV-OBS-01: Zero PII in Telemetry Spans

> **OpenTelemetry traces, Prometheus metric labels, and application log lines
> must NEVER contain personal data (PII), email addresses, raw resume text, or
> unhashed user identifiers. All telemetry is sanitized at the instrumentation
> layer.**

### INV-OBS-02: Mandatory Correlation ID Propagation

> **Every HTTP request, background worker task, and agent execution step must
> carry a unique `X-Correlation-ID` propagated end-to-end through HTTP headers
> and distributed trace contexts.**

### INV-OBS-03: Multi-Window SLO Burn Alerting

> **All critical SLO alerts must implement Google SRE multi-window,
> multi-burn-rate logic (2% budget burn in 1h, 5% in 6h) to eliminate alert
> fatigue while guaranteeing immediate notification on rapid degradation.**

### INV-OBS-04: Blameless Postmortem Requirement

> **Every P0 or P1 incident requires a documented blameless postmortem published
> within 48 hours, containing a timeline, root cause analysis, and JIRA
> remediation tickets assigned with due dates.**

### INV-OBS-05: AI System Transparency Compliance

> **All AI-generated recommendations, agent actions, and resume synthesis
> outputs must maintain explicit provenance metadata and present clear
> disclosure banners compliant with EU AI Act Article 50.**

---

_Architecture Framing v1.0.0 — Observability Lead — 2026-09-29_
