# 12 — Observability & Tracing (Enterprise upgrade)

## Read first
`mvp/12-observability-tracing.md`.

## Objective
Extend MVP's tracing/logging/audit foundation to SOC2-grade retention and add anomaly detection for the Security Agent (`enterprise/08`) to act on.

## Requirements
- **SOC2-grade audit retention:** define and implement a formal retention policy for `agent_actions` and access logs (typically multi-year for compliance purposes), with tamper-evidence (append-only storage or equivalent) — MVP's audit log was functionally complete but not built for compliance-grade retention guarantees.
- **Anomaly detection:** build the detection logic the Security Agent consumes — unusual access patterns (a sudden spike in one workspace's memory reads, an agent action rate far outside its historical baseline, access attempts outside a tenant's configured policy) — surfaced as alerts, not silently logged.
- **Cross-tenant isolation monitoring:** a continuous, automated check (not just the one-time test suite from `enterprise/02`) that watches for any query pattern that could indicate cross-tenant data exposure in production — this is a running system, not a pre-launch test.
- **Expanded dashboards:** per-tenant observability views (latency, cost, agent activity, **and MVP's feedback/approval-rate signal, now trended per-tenant and feeding the Self-Improvement Agent, `enterprise/05`, directly**) for enterprise customers who want visibility into their own usage, surfaced via the Admin console (`enterprise/14`).

## Out of scope
Changing the tracing instrumentation approach (OpenTelemetry) from MVP — this upgrade is about retention, monitoring, and surfacing, not re-instrumenting.

## Acceptance criteria
- [ ] Audit log retention meets the documented policy and is verifiably tamper-evident (a test attempting to alter a historical record fails or is detected).
- [ ] A simulated anomalous access pattern (e.g. a scripted burst of unusual memory reads) triggers a Security Agent alert within a defined time window.
- [ ] The continuous cross-tenant isolation monitor catches a deliberately-injected test case simulating a cross-tenant query attempt in a staging environment.
- [ ] A tenant admin can view their own tenant's usage dashboard without any visibility into other tenants' data.
