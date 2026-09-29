# DEL-ENT-P21-02 — Maintenance Schedule, Patching SLAs, and Lifecycle Calendar

**Deliverable ID:** DEL-ENT-P21-02  
**Phase:** ENT-P21 — Maintenance and Continuous Improvement  
**Version:** 1.0.0  
**Owner:** SRE Lead + DevOps Lead  
**Reviewer:** CISO + CTO  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p21/02-maintenance-schedule-sla.md`

---

## 1. Security Vulnerability Patching SLAs

In compliance with SOC 2 CC7 and enterprise customer contractual commitments:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SECURITY VULNERABILITY PATCHING SLAs                 │
│                                                                         │
│  CVSS SEVERITY   SEVERITY DESCRIPTION       PATCH SLA   DEPLOY METHOD   │
│  ─────────────   ────────────────────────   ─────────   ─────────────   │
│  Critical (9.0+) Remote Code Execution,     ≤ 24 Hours  Emergency OOB   │
│                  Auth Bypass, SQLi                      Hotfix Deploy   │
│                                                                         │
│  High (7.0-8.9)  Privilege Escalation,      ≤ 72 Hours  Expedited Canary│
│                  Base Image CVE                         Pipeline Deploy │
│                                                                         │
│  Medium(4.0-6.9) XSS, CSRF, Non-critical    ≤ 14 Days   Bi-Weekly Sprint│
│                  dependency update                      Release         │
│                                                                         │
│  Low (0.1-3.9)   Informational findings,    ≤ 30 Days   Quarterly Cadence│
│                  minor cosmetic bugs                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Platform Maintenance & Certificate Renewal Calendar

| Maintenance Activity                   | Frequency            | Execution Window        | Customer Impact                     |
| -------------------------------------- | -------------------- | ----------------------- | ----------------------------------- |
| **PostgreSQL Minor Patching & Vacuum** | Monthly (1st Sunday) | 02:00 - 04:00 UTC       | Zero Downtime (Failover to Replica) |
| **Kubernetes Node OS Updates**         | Monthly (2nd Sunday) | 02:00 - 04:00 UTC       | Zero Downtime (Rolling Node Drain)  |
| **Dependency Lockfile Updates**        | Bi-Weekly            | CI Sprint Cycle         | Zero Downtime (Blue-Green Deploy)   |
| **TLS / SSL Certificate Renewal**      | Automated (60 Days)  | Automated Let's Encrypt | Zero Downtime                       |
| **KMS Master Key Rotation**            | Annual (Scheduled)   | Automated AWS KMS       | Zero Downtime                       |
| **Disaster Recovery Failover Drill**   | Semi-Annual          | Scheduled Off-Peak      | Staging Cluster Simulation          |

---

_Deliverable DEL-ENT-P21-02 v1.0.0 — SRE Lead — 2026-09-29_
