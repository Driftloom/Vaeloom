# DEL-ENT-P19-02 — Production Deployment & Traffic Cutover Plan

**Deliverable ID:** DEL-ENT-P19-02  
**Phase:** ENT-P19 — Release Readiness and Production Deployment  
**Version:** 1.0.0  
**Owner:** SRE Lead + Release Engineer  
**Reviewer:** DevOps Lead + CTO  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:**
`evidence/phases/ent/ent-p19/02-production-deployment-plan.md`

---

## 1. Zero-Downtime Deployment Timeline & Sequence

The production rollout follows an orchestrated 6-phase deployment window:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ROLLOUT SEQUENCE (T-0)                    │
│                                                                         │
│  T-60 Mins: Pre-Flight Verification & Backup Freeze                     │
│    • Trigger AWS RDS automated snapshot `vaeloom-prelaunch-snap`.       │
│    • Verify pg_stat_activity has 0 active long-running locks.           │
│    • Validate Infisical production vault secrets synchronization.       │
│                                                                         │
│  T-30 Mins: Green Environment Infrastructure Deployment                 │
│    • Deploy v0.2.0 API & Web pods to `vaeloom-prod` namespace.          │
│    • Ingress routes 0% traffic to Green; 100% to Blue (Current).        │
│                                                                         │
│  T-15 Mins: Synthetic Production Smoke Testing                         │
│    • Execute automated health probes against Green internal cluster IP. │
│    • Validate RLS session variables: `set_rls_session_vars()` test.     │
│    • Confirm live S1 Jev (32ms p95) and Gemma 4 (3.2s p95) endpoints.   │
│                                                                         │
│  T-00 Mins: Canary Traffic Shift (10%)                                  │
│    • Istio VirtualService weights: Blue 90%, Green 10%.                 │
│    • Real-time error rate & latency monitoring for 15 minutes.          │
│                                                                         │
│  T+15 Mins: Incremental Shift (50% ──► 100%)                            │
│    • At T+15: Shift to 50% traffic if 0 errors.                         │
│    • At T+30: Shift to 100% traffic on Green.                           │
│                                                                         │
│  T+60 Mins: Blue Standby & Decommissioning Window                       │
│    • Keep Blue pods idle for 60 mins for instant rollback capability.   │
│    • Decommission Blue pods upon SRE Lead sign-off.                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Production Feature Flag Activation Matrix

| Feature Flag Key            | Default State | Initial Launch State | Target Audience                  | Rollback Switch     |
| --------------------------- | ------------- | -------------------- | -------------------------------- | ------------------- |
| `ENTERPRISE_ROUTES_ENABLED` | `false`       | `true`               | All Enterprise Workspaces        | Instant env var     |
| `SAML_AUTH_ENABLED`         | `false`       | `true`               | Enterprise Tenants with SAML IdP | Instant flag        |
| `BROWSER_TOOLS_ENABLED`     | `true`        | `true`               | Candidates with active search    | Agent config        |
| `SCRAPE_QUOTA_PER_HOUR`     | `20`          | `20`                 | Per-Workspace Quota              | Rate limiter config |
| `AI_TRANSPARENCY_BANNER`    | `true`        | `true`               | 100% Global Users (EU AI Act)    | UI Feature toggle   |
| `JEV_S1_HITL_TRIAGE`        | `true`        | `true`               | 100% Consequential Actions       | Emergency bypass    |

---

_Deliverable DEL-ENT-P19-02 v1.0.0 — SRE Lead — 2026-09-29_
