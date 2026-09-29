# ENT-P20 Evidence Bundle

**Phase:** ENT-P20 — Post-Deployment Validation  
**Version:** 1.0.0  
**Owner:** SRE Lead + CTO  
**Date:** 2026-09-29  
**Total Evidence Items:** 20

---

| EVD-ID          | Claim                                                   | Requirement | Type          | Location                               | Result   | Date       | Verified by          |
| --------------- | ------------------------------------------------------- | ----------- | ------------- | -------------------------------------- | -------- | ---------- | -------------------- |
| EVD-ENT-P20-001 | Synthetic smoke verification on 241 live routes         | ENT-P20-R01 | Smoke Log     | `01-production-smoke-tests.md` §1      | VERIFIED | 2026-09-29 | QA Lead              |
| EVD-ENT-P20-002 | Candidate onboarding journey verified live in 4.8s      | ENT-P20-R01 | User Journey  | `01-production-smoke-tests.md` §2      | VERIFIED | 2026-09-29 | SRE Lead             |
| EVD-ENT-P20-003 | Governed job search journey verified with 0 errors      | ENT-P20-R01 | User Journey  | `01-production-smoke-tests.md` §2      | VERIFIED | 2026-09-29 | Product Lead         |
| EVD-ENT-P20-004 | ConsentGrant workflow verified on live production       | ENT-P20-R01 | User Journey  | `01-production-smoke-tests.md` §2      | VERIFIED | 2026-09-29 | Privacy Counsel      |
| EVD-ENT-P20-005 | 1.42M transactions processed with 99.98% uptime         | ENT-P20-R02 | Telemetry Log | `02-post-launch-monitoring.md` §1      | VERIFIED | 2026-09-29 | SRE Lead             |
| EVD-ENT-P20-006 | Aggregate 5xx error rate at 0.012%                      | ENT-P20-R02 | Telemetry Log | `02-post-launch-monitoring.md` §1      | VERIFIED | 2026-09-29 | SRE Lead             |
| EVD-ENT-P20-007 | TypeSafe AI Jev S1 production P95 at 31.2ms (≤50ms)     | ENT-P20-R02 | Telemetry Log | `02-post-launch-monitoring.md` §2      | VERIFIED | 2026-09-29 | AI Safety Lead       |
| EVD-ENT-P20-008 | Ollama Gemma 4 S2 production P95 at 3,180ms (≤5s)       | ENT-P20-R02 | Telemetry Log | `02-post-launch-monitoring.md` §2      | VERIFIED | 2026-09-29 | AI Safety Lead       |
| EVD-ENT-P20-009 | pgvector HNSW production P95 at 13.8ms (≤15ms)          | ENT-P20-R02 | Telemetry Log | `02-post-launch-monitoring.md` §2      | VERIFIED | 2026-09-29 | Data Architect       |
| EVD-ENT-P20-010 | Zero P0/P1 incidents recorded during 72h window         | ENT-P20-R02 | Incident Log  | `02-post-launch-monitoring.md` §3      | VERIFIED | 2026-09-29 | SRE Lead             |
| EVD-ENT-P20-011 | Pilot cohort CSAT average of 4.8 / 5.0                  | ENT-P20-R03 | Survey Output | `03-user-acceptance-validation.md` §1  | VERIFIED | 2026-09-29 | VP Product           |
| EVD-ENT-P20-012 | 3,850 users active with 100% login success              | ENT-P20-R03 | Analytics Doc | `03-user-acceptance-validation.md` §2  | VERIFIED | 2026-09-29 | Customer Success     |
| EVD-ENT-P20-013 | Live production cross-tenant RLS drill: 0 leaks         | ENT-P20-R04 | SQL Audit Log | `04-security-validation-report.md` §1  | VERIFIED | 2026-09-29 | CISO                 |
| EVD-ENT-P20-014 | Unset GUC session fail-closed drill: 0 rows             | ENT-P20-R04 | SQL Audit Log | `04-security-validation-report.md` §1  | VERIFIED | 2026-09-29 | Security Architect   |
| EVD-ENT-P20-015 | ConsentGrant real-time revocation returns instant 403   | ENT-P20-R04 | API Audit Log | `04-security-validation-report.md` §2  | VERIFIED | 2026-09-29 | AppSec Engineer      |
| EVD-ENT-P20-016 | Live cryptographic erasure (DEK destroyed) verified     | ENT-P20-R04 | KMS Audit Log | `04-security-validation-report.md` §3  | VERIFIED | 2026-09-29 | CISO                 |
| EVD-ENT-P20-017 | Production latency baselines established across routes  | ENT-P20-R05 | Baseline Spec | `05-performance-baseline-report.md` §1 | VERIFIED | 2026-09-29 | Performance Engineer |
| EVD-ENT-P20-018 | Production run rate $224.30/mo (-2.5% under budget)     | ENT-P20-R05 | FinOps Report | `05-performance-baseline-report.md` §2 | VERIFIED | 2026-09-29 | FinOps Lead          |
| EVD-ENT-P20-019 | Unit cost per document compiled: $0.0762 (-3.2% better) | ENT-P20-R05 | FinOps Report | `05-performance-baseline-report.md` §2 | VERIFIED | 2026-09-29 | FinOps Lead          |
| EVD-ENT-P20-020 | Five post-deployment validation invariants enforced     | ENT-P20-R02 | Architecture  | `04-architecture-framing.md` §2        | VERIFIED | 2026-09-29 | SRE Lead             |

---

_Evidence Bundle v1.0.0 — SRE Lead — 2026-09-29_
