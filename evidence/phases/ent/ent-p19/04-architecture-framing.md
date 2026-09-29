# ENT-P19 Architecture Framing — Release Readiness and Production Deployment

**Phase:** ENT-P19 — Release Readiness and Production Deployment  
**Version:** 1.0.0  
**Owner:** CTO + Lead Architect  
**Reviewer:** CISO + SRE Lead  
**Date:** 2026-09-29

---

## 1. Production Release Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION RELEASE ARCHITECTURE                      │
│                                                                         │
│  [ External Traffic ] ──► [ Global WAF & Cloudflare CDN ]               │
│                                     │ (mTLS / TLS 1.3)                  │
│  ┌──────────────────────────────────▼──────────────────────────────┐    │
│  │ AWS Application Load Balancer                                    │    │
│  └──────────────────┬──────────────────────────────────────────────┘    │
│                     │                                                   │
│  ┌──────────────────▼──────────────────────────────────────────────┐    │
│  │ Istio Ingress (Zero-Downtime Traffic Splitter)                  │    │
│  │   • Active Release: 100% Traffic (Green v0.2.0)                 │    │
│  │   • Standby Rollback Release: 0% Traffic (Blue v0.1.9)          │    │
│  └──────────────────┬──────────────────────────────────────────────┘    │
│                     │                                                   │
│  ┌──────────────────▼──────────────────────────────────────────────┐    │
│  │ Production Kubernetes Pods (EKS Multi-AZ)                       │    │
│  │   • Auto-instrumented via OpenTelemetry                         │    │
│  │   • Enforcing RLS Session GUCs on PostgreSQL 16.4 RDS            │    │
│  │   • Consuming Secrets via Infisical Operator                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Production Release Invariants

### INV-REL-01: Zero-Downtime Deployment Mandate

> **No production release may introduce service downtime or user-visible HTTP
> 5xx spikes. All deployments must utilize blue-green canary routing with
> automatic rollback predicates.**

### INV-REL-02: Non-Destructive Database Migrations

> **Relational database migrations executed during deployment must strictly
> follow the expand/contract methodology. Column dropping or table renaming in a
> single cutover is strictly prohibited.**

### INV-REL-03: Independent Security Clearance

> **Production deployment authorization requires explicit sign-off from the CISO
> based on clean SAST, zero Critical/High container CVEs, and an active CREST
> penetration test engagement.**

### INV-REL-04: Candidate Consent Enforcement in Production

> **Institutional customer workspaces cannot access individual candidate data
> without an active cryptographic ConsentGrant. This boundary is enforced by
> PostgreSQL RLS and cannot be overridden by administrators.**

### INV-REL-05: Instant Feature Flag Kill Switches

> **Every major functional capability (enterprise routes, SAML auth, browser
> tools, AI synthesis) must possess an instant feature flag kill switch capable
> of execution in < 60 seconds.**

---

_Architecture Framing v1.0.0 — CTO — 2026-09-29_
