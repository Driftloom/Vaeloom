# DEL-ENT-P17-02: Alerting and SLO Monitoring

**Deliverable ID:** DEL-ENT-P17-02 **Phase:** ENT-P17 — Observability and
Operations **Version:** 1.0.0 **Date:** 2026-09-29 **Owner:** SRE Lead
**Reviewer:** Observability Engineer + CISO **Status:** VERIFIED

---

## 1. Overview

This deliverable specifies:

- Prometheus SLO definitions and recording rules
- Multi-window error budget burn alerts
- PagerDuty/Slack integration and severity routing
- pgvector p95 latency SLO burn alert (mandatory — 0.8ms headroom)
- On-call runbooks for each alert class
- Severity matrix

---

## 2. SLO Definitions

SLOs are inherited from ENT-P15 (7 SLOs verified) and extended with
observability-specific SLOs.

### 2.1 SLO Catalogue

| SLO ID | SLI name                               | Target  | Window | Error budget (30d) | Status                   |
| ------ | -------------------------------------- | ------- | ------ | ------------------ | ------------------------ |
| SLO-01 | API availability                       | 99.9%   | 30d    | 43.8 min/month     | ACTIVE                   |
| SLO-02 | API p95 latency ≤ 500ms                | 99.5%   | 30d    | 3.6 hr/month       | ACTIVE                   |
| SLO-03 | Cognitive pipeline p95 ≤ 2,000ms       | 99.0%   | 30d    | 7.2 hr/month       | ACTIVE                   |
| SLO-04 | pgvector ANN search p95 ≤ 15ms         | 99.5%   | 30d    | 3.6 hr/month       | **BURN ALERT MANDATORY** |
| SLO-05 | Auth success rate ≥ 99.95%             | 99.95%  | 30d    | 21.9 min/month     | ACTIVE                   |
| SLO-06 | Memory write durability (no data loss) | 99.999% | 30d    | 26 sec/month       | ACTIVE                   |
| SLO-07 | Multi-region DR — RTO ≤ 15 min         | 99.9%   | 90d    | N/A — per-event    | ACTIVE                   |
| SLO-08 | OTel pipeline availability             | 99.5%   | 30d    | 3.6 hr/month       | ACTIVE (new P17)         |
| SLO-09 | Alerting delivery latency ≤ 2 min      | 99.0%   | 30d    | 7.2 hr/month       | ACTIVE (new P17)         |

---

## 3. Prometheus Recording Rules

```yaml
# infra/prometheus/rules/vaeloom-slo.yaml
# Version: 1.0.0 — ENT-P17 DEL-02
groups:
  - name: vaeloom_slo_burn
    interval: 30s
    rules:
      # ── SLO-01: API Availability ──────────────────────────────────────────
      - record: vaeloom:slo01_availability:error_rate5m
        expr: |
          sum(rate(vaeloom_http_requests_total{status_code=~"5.."}[5m]))
          /
          sum(rate(vaeloom_http_requests_total[5m]))

      - record: vaeloom:slo01_availability:error_rate1h
        expr: |
          sum(rate(vaeloom_http_requests_total{status_code=~"5.."}[1h]))
          /
          sum(rate(vaeloom_http_requests_total[1h]))

      - record: vaeloom:slo01_availability:error_rate6h
        expr: |
          sum(rate(vaeloom_http_requests_total{status_code=~"5.."}[6h]))
          /
          sum(rate(vaeloom_http_requests_total[6h]))

      - record: vaeloom:slo01_availability:error_rate24h
        expr: |
          sum(rate(vaeloom_http_requests_total{status_code=~"5.."}[24h]))
          /
          sum(rate(vaeloom_http_requests_total[24h]))

      # ── SLO-02: API p95 Latency ───────────────────────────────────────────
      - record: vaeloom:slo02_latency:p95_5m
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(vaeloom_http_request_duration_seconds_bucket[5m]))
          )

      - record: vaeloom:slo02_latency:violation_rate5m
        expr: |
          sum(rate(vaeloom_http_request_duration_seconds_bucket{le="0.5"}[5m]))
          /
          sum(rate(vaeloom_http_request_duration_seconds_count[5m]))
        # A "good" request is one that completed in ≤ 500ms

      # ── SLO-04: pgvector ANN Search p95 ≤ 15ms — CRITICAL HEADROOM ───────
      # Current measured: 14.2ms p95 — only 0.8ms headroom
      - record: vaeloom:slo04_pgvector:p95_5m
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(vaeloom_vector_search_duration_seconds_bucket[5m]))
          )

      - record: vaeloom:slo04_pgvector:violation_rate5m
        expr: |
          1 - (
            sum(rate(vaeloom_vector_search_duration_seconds_bucket{le="0.015"}[5m]))
            /
            sum(rate(vaeloom_vector_search_duration_seconds_count[5m]))
          )

      - record: vaeloom:slo04_pgvector:violation_rate1h
        expr: |
          1 - (
            sum(rate(vaeloom_vector_search_duration_seconds_bucket{le="0.015"}[1h]))
            /
            sum(rate(vaeloom_vector_search_duration_seconds_count[1h]))
          )

      # ── SLO-03: Cognitive Pipeline p95 ───────────────────────────────────
      - record: vaeloom:slo03_cognitive:p95_5m
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(vaeloom_cognitive_pipeline_duration_seconds_bucket[5m]))
          )
```

---

## 4. Multi-Window Error Budget Burn Alerts

Multi-window burn alerts use the Google SRE Workbook methodology: fast burn
(1h/5m windows) catches sudden outages; slow burn (6h/1h windows) catches
gradual degradation.

```yaml
# infra/prometheus/rules/vaeloom-alerts.yaml
# Version: 1.0.0 — ENT-P17 DEL-02
groups:
  - name: vaeloom_burn_alerts
    rules:
      # ═══════════════════════════════════════════════════════════════════════
      # SLO-01: API Availability — 99.9% target
      # Error budget = 0.1% = 0.001
      # Fast burn: 14.4x rate exhausts budget in 1h/5m → 0.001 * 14.4 = 0.0144
      # Slow burn: 6x rate over 6h/1h → 0.001 * 6 = 0.006
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_SLO01_FastBurn
        expr: |
          vaeloom:slo01_availability:error_rate5m > (14.4 * 0.001)
          and
          vaeloom:slo01_availability:error_rate1h > (14.4 * 0.001)
        for: 2m
        labels:
          severity: critical
          team: sre
          slo: SLO-01
          pagerduty: 'true'
        annotations:
          summary:
            'SLO-01 API availability FAST BURN — exhausting error budget in <1h'
          description: |
            5m error rate: {{ $value | humanizePercentage }}
            Expected ≤ {{ 14.4 * 0.001 | humanizePercentage }}
            Runbook: https://runbooks.vaeloom.internal/slo01-fast-burn
          runbook_url: 'https://runbooks.vaeloom.internal/slo01-fast-burn'

      - alert: VaeBlaze_SLO01_SlowBurn
        expr: |
          vaeloom:slo01_availability:error_rate1h > (6 * 0.001)
          and
          vaeloom:slo01_availability:error_rate6h > (6 * 0.001)
        for: 15m
        labels:
          severity: high
          team: sre
          slo: SLO-01
          slack_channel: '#ops-alerts'
        annotations:
          summary:
            'SLO-01 API availability SLOW BURN — gradual error budget drain'
          runbook_url: 'https://runbooks.vaeloom.internal/slo01-slow-burn'

      # ═══════════════════════════════════════════════════════════════════════
      # SLO-04: pgvector ANN Search p95 ≤ 15ms
      # MANDATORY — 0.8ms headroom makes this HIGHEST SENSITIVITY alert
      # Error budget = 0.5% = 0.005
      # Fast burn multiplier = 14.4 → threshold = 0.072
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_SLO04_PgVector_FastBurn
        expr: |
          vaeloom:slo04_pgvector:violation_rate5m > (14.4 * 0.005)
          and
          vaeloom:slo04_pgvector:violation_rate1h > (14.4 * 0.005)
        for: 2m
        labels:
          severity: critical
          team: sre
          slo: SLO-04
          pagerduty: 'true'
          component: pgvector
        annotations:
          summary: 'SLO-04 pgvector p95 FAST BURN — latency exceeding 15ms'
          description: |
            WARNING: Only 0.8ms headroom from SLO ceiling.
            Current 5m violation rate: {{ $value | humanizePercentage }}
            Immediate HNSW probe tuning or index rebuild may be required.
            Runbook: https://runbooks.vaeloom.internal/slo04-pgvector
          runbook_url: 'https://runbooks.vaeloom.internal/slo04-pgvector'

      - alert: VaeBlaze_SLO04_PgVector_Headroom_Warning
        # Fires when p95 exceeds 13ms — early warning with 2ms buffer before SLO breach
        expr: vaeloom:slo04_pgvector:p95_5m > 0.013
        for: 5m
        labels:
          severity: warning
          team: sre
          slo: SLO-04
          slack_channel: '#ops-pgvector'
        annotations:
          summary: 'SLO-04 pgvector p95 approaching SLO ceiling (>13ms)'
          description: |
            Current p95: {{ $value * 1000 | humanize }}ms (SLO ceiling: 15ms)
            HNSW ef_search may need tuning.
            Runbook: https://runbooks.vaeloom.internal/slo04-headroom

      - alert: VaeBlaze_SLO04_PgVector_SlowBurn
        expr: |
          vaeloom:slo04_pgvector:violation_rate1h > (6 * 0.005)
          and
          vaeloom:slo04_pgvector:violation_rate6h > (6 * 0.005)
        for: 15m
        labels:
          severity: high
          team: sre
          slo: SLO-04
          pagerduty: 'true'
        annotations:
          summary: 'SLO-04 pgvector slow burn — sustained latency pressure'
          runbook_url: 'https://runbooks.vaeloom.internal/slo04-slow-burn'

      # ═══════════════════════════════════════════════════════════════════════
      # SLO-03: Cognitive Pipeline p95 ≤ 2,000ms
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_SLO03_CognitivePipeline_FastBurn
        expr: vaeloom:slo03_cognitive:p95_5m > 2.0
        for: 3m
        labels:
          severity: high
          team: ai-ops
          slo: SLO-03
          pagerduty: 'true'
        annotations:
          summary: 'SLO-03 cognitive pipeline p95 exceeds 2s'
          runbook_url: 'https://runbooks.vaeloom.internal/slo03-cognitive'

      # ═══════════════════════════════════════════════════════════════════════
      # RLS Violations — must always be zero
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_RLS_Violation
        expr: increase(vaeloom_rls_violations_total[5m]) > 0
        labels:
          severity: critical
          team: security
          pagerduty: 'true'
          security: 'true'
        annotations:
          summary: 'CRITICAL: RLS isolation violation detected'
          description:
            'Cross-tenant data leak possible. Immediate investigation required.'
          runbook_url: 'https://runbooks.vaeloom.internal/security/rls-violation'

      # ═══════════════════════════════════════════════════════════════════════
      # Auth anomalies
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_Auth_FailureSpike
        expr: |
          sum(rate(vaeloom_auth_attempts_total{result="fail"}[5m])) by (region)
          /
          sum(rate(vaeloom_auth_attempts_total[5m])) by (region)
          > 0.1
        for: 3m
        labels:
          severity: high
          team: security
          pagerduty: 'true'
        annotations:
          summary: 'Auth failure rate >10% in region {{ $labels.region }}'
          runbook_url: 'https://runbooks.vaeloom.internal/security/auth-spike'

      # ═══════════════════════════════════════════════════════════════════════
      # OTel Collector health
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_OTelCollector_Down
        expr: up{job="otel-collector"} == 0
        for: 2m
        labels:
          severity: high
          team: sre
          pagerduty: 'true'
        annotations:
          summary: 'OTel Collector is down — observability blind spot'
          runbook_url: 'https://runbooks.vaeloom.internal/otel-collector-down'

      - alert: VaeBlaze_OTelCollector_DroppedSpans
        expr: |
          rate(otelcol_exporter_send_failed_spans_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
          team: sre
          slack_channel: '#ops-telemetry'
        annotations:
          summary: 'OTel Collector dropping >10 spans/s — telemetry degraded'

      # ═══════════════════════════════════════════════════════════════════════
      # Quota saturation
      # ═══════════════════════════════════════════════════════════════════════
      - alert: VaeBlaze_Tenant_QuotaExceeded
        expr: vaeloom_tenant_quota_usage_ratio > 0.95
        for: 1m
        labels:
          severity: warning
          team: platform
          slack_channel: '#ops-tenant'
        annotations:
          summary:
            'Tenant {{ $labels.tenant_id }} at >95% quota for {{
            $labels.resource_type }}'
          runbook_url: 'https://runbooks.vaeloom.internal/tenant-quota'
```

---

## 5. PagerDuty / Slack Routing Matrix

| Severity | Label                | PagerDuty                    | Slack           | Response SLA       | Escalation                             |
| -------- | -------------------- | ---------------------------- | --------------- | ------------------ | -------------------------------------- |
| CRITICAL | `severity: critical` | Immediate page → on-call SRE | `#incidents-p0` | 5 min acknowledge  | Auto-escalate to P0 if no ack in 5 min |
| HIGH     | `severity: high`     | Page → on-call SRE           | `#ops-alerts`   | 15 min acknowledge | Escalate to P1 if no ack in 15 min     |
| WARNING  | `severity: warning`  | No page                      | `#ops-alerts`   | Next business day  | Create Jira ticket                     |
| INFO     | `severity: info`     | No page                      | `#ops-info`     | Weekly review      | Backlog                                |

### PagerDuty Service Config

```yaml
# PagerDuty alertmanager integration
# infra/prometheus/alertmanager.yaml
global:
  resolve_timeout: 5m
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

templates:
  - '/etc/alertmanager/templates/*.tmpl'

route:
  group_by: ['alertname', 'slo', 'region']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default-slack'

  routes:
    # Critical → PagerDuty + Slack
    - match:
        severity: critical
      receiver: pagerduty-critical
      continue: true

    # Security alerts → CISO + Security Slack
    - match:
        security: 'true'
      receiver: security-critical
      continue: false

    # High → PagerDuty
    - match:
        severity: high
      receiver: pagerduty-high

receivers:
  - name: pagerduty-critical
    pagerduty_configs:
      - routing_key: '${PAGERDUTY_INTEGRATION_KEY_P0}'
        severity: critical
        description: '{{ template "pagerduty.default.description" . }}'
        details:
          runbook: '{{ .Annotations.runbook_url }}'
          slo: '{{ .Labels.slo }}'
    slack_configs:
      - channel: '#incidents-p0'
        api_url: '${SLACK_WEBHOOK_URL}'
        title: '🔴 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ template "slack.vaeloom.text" . }}'

  - name: pagerduty-high
    pagerduty_configs:
      - routing_key: '${PAGERDUTY_INTEGRATION_KEY_P1}'
        severity: error
    slack_configs:
      - channel: '#ops-alerts'
        title: '🟠 HIGH: {{ .GroupLabels.alertname }}'

  - name: security-critical
    pagerduty_configs:
      - routing_key: '${PAGERDUTY_INTEGRATION_KEY_SECURITY}'
        severity: critical
    slack_configs:
      - channel: '#security-incidents'
        api_url: '${SLACK_WEBHOOK_SECURITY_URL}'

  - name: default-slack
    slack_configs:
      - channel: '#ops-alerts'
        api_url: '${SLACK_WEBHOOK_URL}'
```

---

## 6. Severity Matrix

| Severity           | Definition                                                  | Examples                                       | Response time  | Action                                        |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------- | -------------- | --------------------------------------------- |
| P0 — Critical      | Complete service unavailability; security breach; data loss | API 5xx >5%; RLS violation; auth bypass        | 5 min          | War room; customer comms; CISO paged          |
| P1 — High          | Significant degradation; SLO burn >6x; feature unavailable  | pgvector p95 >15ms; cognitive pipeline down    | 15 min         | On-call SRE; incident channel; hourly updates |
| P2 — Medium        | Partial degradation; SLO slow burn; increased error rate    | Auth failure >5%; OTel Collector dropped spans | 1 hour         | SRE on next shift; Jira ticket                |
| P3 — Low           | Minor issue; no customer impact; approaching thresholds     | pgvector p95 >13ms (warning); quota 95%        | 1 business day | Backlog; weekly review                        |
| P4 — Informational | Trend observation; capacity planning signal                 | Throughput growing 20% week-over-week          | Next sprint    | Capacity planning                             |

---

## 7. On-Call Runbooks

### Runbook: SLO-04 pgvector p95 Burn

**Alert:** `VaeBlaze_SLO04_PgVector_FastBurn` or
`VaeBlaze_SLO04_PgVector_Headroom_Warning`

```markdown
## pgvector p95 Latency SLO Burn Runbook

Version: 1.0.0 | Owner: SRE | SLO: SLO-04 (p95 ≤ 15ms) CONTEXT: Current measured
p95 = 14.2ms — only 0.8ms headroom.

### Immediate (0–5 min)

1. Confirm alert: `vaeloom:slo04_pgvector:p95_5m` in Prometheus
2. Check current vector count: SELECT COUNT(*) FROM memory_vectors;
3. Check index bloat: VACUUM ANALYZE memory_vectors;
4. Check concurrent queries: SELECT * FROM pg_stat_activity WHERE query LIKE
   '%<->'%;

### Diagnosis (5–15 min)

5. Review EXPLAIN ANALYZE on representative ANN query: EXPLAIN (ANALYZE,
   BUFFERS) SELECT ... ORDER BY embedding <=> $1 LIMIT 10;
6. Check HNSW parameters: SELECT indexname, reloptions FROM pg_indexes WHERE
   indexname LIKE '%hnsw%'; -- ef_search should be 64; m should be 16
7. Check pgBouncer pool saturation: vaeloom_pg_pool_connections{state="waiting"}
8. Check bloated tables: SELECT * FROM pgstattuple('memory_vectors');

### Mitigation (15–60 min)

9. Temporarily reduce ef_search if headroom exhausted: SET hnsw.ef_search = 48;
   -- reduces recall slightly; buy time
10. If index rebuild needed (30+ min downtime): CREATE INDEX CONCURRENTLY
    memory_vectors_embedding_hnsw_new ... DROP INDEX CONCURRENTLY
    memory_vectors_embedding_hnsw;
11. Escalate to P1 if >30 min at breach.

### Recovery

12. Confirm p95 returns below 14ms (with 1ms buffer).
13. File postmortem if breach >5 min.
```

### Runbook: RLS Violation

**Alert:** `VaeBlaze_RLS_Violation`

```markdown
## RLS Isolation Violation Runbook

Version: 1.0.0 | Owner: Security + SRE | Severity: ALWAYS P0

### Immediate (0–2 min)

1. PAGE CISO immediately
2. Enable emergency read-only mode: POST /admin/circuit-breakers/readonly-mode
   {"enabled": true}
3. Capture snapshot: pg_dump --table=audit_log (immediately)
4. Record: which table, which tenant_id, timestamp

### Preservation (2–10 min)

5. Freeze affected tenant: POST /admin/tenants/{id}/freeze
6. Capture pg_stat_activity at time of violation
7. Pull OTel traces for span_id from same time window

### Investigation (10–60 min)

8. Review RLS policies: SELECT * FROM pg_policies WHERE tablename = '<table>';
9. Check GUC was set: app.tenant_id, app.workspace_id in pg_stat_activity
10. Identify if caused by migration, config change, or code regression

### Escalation

11. File P0 incident; war room in <5 min
12. Customer notification within 1 hour (GDPR 72-hour breach notification clock
    starts)
13. No service resume until root cause confirmed and isolated
```

---

## 8. Error Budget Policy

| Burn threshold                            | Action                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| >50% monthly budget consumed by day 15    | SRE sprint re-prioritization; reliability work takes priority over feature work                                   |
| >75% budget consumed                      | Feature freeze for affected service until budget recovers                                                         |
| Budget exhausted                          | Service enters "error budget holiday" — all changes require SRE + VP Engineering sign-off                         |
| Budget exhausted for 2 consecutive months | SLO review — either reliability investment required or SLO target revision (not a downgrade without board review) |
