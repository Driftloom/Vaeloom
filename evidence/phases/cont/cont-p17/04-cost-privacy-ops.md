# CONT-P17 — 04 Cost / Security / Privacy Ops (WS-17.5, DEL-05)

## Verified @ HEAD

- **Cost visibility:** per-agent/per-workspace usage (`agent_costs`) +
  enforceable budgets (Wave 1) + daily quotas + model catalog pricing —
  spend observable AND capped (beyond P17-era observe-only).
- **Telemetry privacy:** `_redact` 9 keys; SAML assertions never logged;
  OTel secret exclusion retained; metric low-cardinality (handler/method/
  status labels observed live — no high-cardinality user IDs).
- **Retention:** telemetry 30d + retention runs (P17/P21 baselines).
- **Access:** Grafana/datasource provisioning present; tenant/region
  visibility follows workspace RLS posture (carried).
