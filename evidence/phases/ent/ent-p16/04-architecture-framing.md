# ENT-P16 Architecture Framing — DevOps, Infrastructure, and CI/CD

**Phase:** ENT-P16 — DevOps, Infrastructure, and CI/CD  
**Version:** 1.0.0  
**Owner:** DevOps Lead  
**Reviewer:** Security Architect + SRE  
**Date:** 2026-09-29

---

## 1. Enterprise Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE INFRASTRUCTURE TOPOLOGY                   │
│                                                                         │
│  [ AWS Route 53 / Cloudflare DNS ]                                      │
│               │                                                         │
│  ┌────────────▼────────────────────────────────────────────────────┐   │
│  │ AWS ALB / Ingress Controller (TLS 1.3 Termination, WAF)         │   │
│  └────────────┬────────────────────────────────────────────────────┘   │
│               │                                                         │
│  ┌────────────▼────────────────────────────────────────────────────┐   │
│  │ Kubernetes Cluster (Amazon EKS / Multi-AZ)                      │   │
│  │   • Namespace: vaeloom-prod                                     │   │
│  │   • Next.js Web Deployment (HPA: 2-8 pods)                      │   │
│  │   • FastAPI API Deployment (HPA: 4-32 pods)                     │   │
│  │   • PgBouncer Connection Pooler Deployment (100-500 pool)       │   │
│  │   • Infisical Secret Agent Sidecar                              │   │
│  └────────────┬────────────────────────────────────────────────────┘   │
│               │                                                         │
│  ┌────────────▼────────────────────────────────────────────────────┐   │
│  │ Managed Data Layer                                               │   │
│  │   • AWS RDS PostgreSQL 16.4 (Multi-AZ, Primary + 2 Replicas)    │   │
│  │   • Continuous WAL Archiving to S3 (RPO 14.8s)                  │   │
│  │   • AWS S3 Bucket (Object Lock WORM, 90-day Glacier lifecycle)  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five DevOps and Infrastructure Invariants

### INV-DEVOPS-01: Immutable Infrastructure & Zero SSH

> **All production compute nodes are immutable containers. Direct SSH access to
> production containers or database instances is strictly prohibited. All
> changes must originate from version-controlled IaC and CI/CD pipelines.**

### INV-DEVOPS-02: Cryptographic Provenance (SLSA Level 3)

> **Every production artifact deployed to Kubernetes must possess a verifiable
> Cosign signature, Rekor transparency log proof, and SPDX SBOM attestation.**

### INV-DEVOPS-03: Zero-Downtime Migration Safety

> **No database migration may lock critical tables or drop active columns in a
> single release. All schema changes must follow the 3-step expand/contract
> lifecycle.**

### INV-DEVOPS-04: Automated Rollback on SLI Breach

> **Any deployment exhibiting an error rate >0.5% or P95 latency >150ms during
> the initial canary window is automatically reverted without human
> intervention.**

### INV-DEVOPS-05: Strict Environment Parity

> **Dev, Staging, and Production environments must share identical container
> images, configuration schemas, RLS policies, and database migration levels.**

---

_Architecture Framing v1.0.0 — DevOps Lead — 2026-09-29_
