# DEL-ENT-P16-04 — Deployment and Rollback Strategy

**Deliverable ID:** DEL-ENT-P16-04  
**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** SRE + Release Engineer  
**Reviewer:** DevOps Lead + Data Architect  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p16/04-deployment-and-rollback.md`

---

## 1. Zero-Downtime Blue-Green Deployment Architecture

Vaeloom utilizes a Kubernetes-native blue-green rollout model coupled with Istio
traffic splitting.

```
                  ┌───────────────────────────────┐
                  │      Istio Ingress Gateway    │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │    VirtualService Router      │
                  └───────┬───────────────┬───────┘
          100% Traffic    │               │  0% (Canary 10%)
                  ┌───────▼───────┐       ┌───────▼───────┐
                  │  BLUE (Active)│       │ GREEN (Target)│
                  │   v0.2.0 API  │       │   v0.2.1 API  │
                  │  (4 Replicas) │       │  (4 Replicas) │
                  └───────────────┘       └───────────────┘
```

### Rollout Lifecycle Steps:

1. **Deploy Green:** New release is deployed with 0% public traffic.
2. **Synthetic Smoke Probe:** Internal health and E2E smoke tests run directly
   against Green ingress.
3. **Canary Shift (10%):** 10% of workspace traffic routed to Green for 10
   minutes; error rate & latency monitored.
4. **Full Promotion (100%):** Traffic cut over entirely to Green upon zero SLI
   degradation.
5. **Blue Standby:** Blue kept warm for 30 minutes before decommissioning.

---

## 2. Database Migration Safety (Expand/Contract Pattern)

To ensure zero downtime during relational schema evolution, all migrations
adhere strictly to the **Expand/Contract Pattern**:

```
Step 1: EXPAND (Additive Only)
  • Add new column/table nullable or with default (e.g. migration 0062..0064).
  • Application code writes to BOTH old and new schemas.

Step 2: BACKFILL & DUAL-READ
  • Async background worker backfills historical data.
  • Application reads from new schema with fallback to old.

Step 3: CONTRACT (Subtractive)
  • Migration 0065..0066 drops deprecated columns after full verification.
```

---

## 3. Automated Rollback Triggers & Runbook

### Automatic Rollback Triggers (Within 5 minutes of release):

- API Error Rate > 0.5% (HTTP 5xx responses).
- P95 Latency > 150ms on critical API endpoints.
- Any failure in RLS isolation smoke tests.

### Rollback Runbook:

```bash
# Instant traffic shift back to Blue (takes < 2 seconds)
kubectl apply -f infra/k8s/traffic-split-blue.yaml

# Rollback Helm / Deployment release
helm rollback vaeloom-api-prod

# Database point-in-time recovery if schema corruption occurs
# Trigger RDS automated PITR to snapshot prior to migration
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vaeloom-pg-primary \
  --target-db-instance-identifier vaeloom-pg-recovery \
  --restore-time "2026-09-29T22:00:00Z"
```

---

_Deliverable DEL-ENT-P16-04 v1.0.0 — SRE — 2026-09-29_
