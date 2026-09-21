# Non-Functional Requirements

> **Purpose:** Define the quality attributes Vaeloom must satisfy — performance,
> scalability, availability, security, usability, accessibility, and compliance
> targets **Status:** New **Owner:** Architecture Team **Version:** 1.0 **Last
> Updated:** 2026-07-16 **Dependencies:**
> [`Functional-Requirements.md`](./Functional-Requirements.md),
> [`../../docs/architecture/Performance.md`](../../docs/architecture/Performance.md),
> [`../../docs/architecture/Scalability.md`](../../docs/architecture/Scalability.md),
> [`../security/Security-Architecture.md`](../security/Security-Architecture.md)
> **Implementation Status:** 📁‹ Spec Only

## Overview

Non-functional requirements (NFRs) define _how well_ the system must perform its
functions — the quality attributes that distinguish a production-grade product
from a prototype. This document specifies concrete, measurable targets for
performance, scalability, availability, security, usability, accessibility,
reliability, observability, and compliance.

## Goals

- Define measurable NFR targets across all quality attributes
- Specify measurement methods for each target
- Enable verification through testing and monitoring

## Format

````text
NFR-XXX | Requirement | Target metric | Measurement method
```text

## NFR Coverage

```mermaid
graph TD
 classDef nfr fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px

 PERF["Performance"]:::nfr
 SCALE["Scalability"]:::nfr
 AVAIL["Availability"]:::nfr
 SEC["Security"]:::nfr
 PRIV["Privacy"]:::nfr
 USE["Usability"]:::nfr
 A11Y["Accessibility"]:::nfr
 REL["Reliability"]:::nfr
 OBS["Observability"]:::nfr
 COMP["Compliance"]:::nfr
```text

## Performance

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-PERF-001 | API response latency (p99) | <500ms | Distributed tracing |
| NFR-PERF-002 | Page load time (LCP) | <2s | Real User Monitoring |
| NFR-PERF-003 | Document parsing (10MB file) | <60s | Processing pipeline timing |
| NFR-PERF-004 | Agent run completion (simple task) | <10s | Agent run duration |
| NFR-PERF-005 | Search query response | <2s | Search endpoint timing |
| NFR-PERF-006 | Embedding generation (per document) | <30s | Embedding pipeline timing |

## Scalability

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-SCALE-001 | Concurrent users (single tenant) | 500 | Load testing |
| NFR-SCALE-002 | Concurrent users (platform) | 50,000 | Load testing |
| NFR-SCALE-003 | Documents per user | 10,000 | Storage monitoring |
| NFR-SCALE-004 | Memory graph nodes per user | 500,000 | Graph size monitoring |
| NFR-SCALE-005 | Horizontal scaling (API pods) | 2-20 replicas (HPA) | Kubernetes metrics |
| NFR-SCALE-006 | Database read replicas | 2 minimum | RDS configuration |

### Load-evidence reconciliation 2026-09-21: UNPROVEN at platform scale

> **NFR-SCALE-002 (50,000 concurrent platform users) is UNPROVEN. The target
> is NOT lowered** — this note records what load has actually been evidenced
> so a future claim can promote it. Do not cite this spec as proving 50k.

| Proven load | Shape | Result | Evidence |
| ----------- | ----- | ------ | -------- |
| Baseline | 20 RPS, 50 VUs / 5m | p50 45ms, p95 120ms, p99 210ms, err 0.2% PASS (<200ms budget) | `evidence/phases/mvp/mvp-p21/05-test-results.md:26`, `infra/ops/load-test/k6-script.js`, `testing/performance/k6-script.js` |
| Stress | 200 RPS, 200 VUs / 6m | p50 85ms, p95 480ms, err 0.4% PASS | `evidence/phases/mvp/mvp-p21/05-test-results.md:27` |
| Agent path (LangGraph/Temporal) | 50 VUs, 639 req, ~34 RPS | p95 2.81s, 0% errors (disclosed +0.71s arch overhead) | `archive/temporal/langgraph-production-hardening-2026-08-28.md:892-896,1029-1030` |

Notes for the record:

- The task brief's shorthand "proven ~200 RPS/50 VUs" conflates two runs:
  **200 RPS was proven at 200 VUs; 50 VUs was the 20-RPS baseline shape.**
  Neither run proves 50,000 concurrent users — sustained RPS ≠ concurrent
  users, and no soak, multi-region, or scaled-replica run exists.
- Structural ceilings make 50k unplannable today: single PostgreSQL, single
  Redis, single MinIO, single API/queue-worker replica in compose —
  see `docs/operations/HA-GAPS.md` (HG-01…HG-06). NFR-SCALE-005 (2–20 pods)
  and NFR-SCALE-006 (≥2 read replicas) are themselves unmet in the shipped
  topology.
- **Promotion criteria** (all required before NFR-SCALE-002 leaves UNPROVEN):
  soak at target concurrency with p95/error budget held; per-service ceilings
  measured (PG connections, Redis, worker pools); HPA 2→20 exercised under
  load; error-budget burn within SLO; drill log attached.

## Availability

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-AVAIL-001 | Platform uptime | 99.9% (MVP), 99.99% (Enterprise) | Uptime monitoring |
| NFR-AVAIL-002 | Recovery Time Objective (RTO) | <4 hours | Disaster recovery drills |
| NFR-AVAIL-003 | Recovery Point Objective (RPO) | <1 hour | Backup verification |
| NFR-AVAIL-004 | Planned maintenance window | <2 hours/month, announced 72h ahead | Maintenance log |

## Security

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-SEC-001 | All data encrypted at rest | AES-256 | Security audit |
| NFR-SEC-002 | All data encrypted in transit | TLS 1.3 | Network scan |
| NFR-SEC-003 | Authentication required for all endpoints | 100% (no anonymous access) | API scan |
| NFR-SEC-004 | OWASP Top 10 coverage | All 10 mitigated | Penetration test |
| NFR-SEC-005 | Rate limiting on all public endpoints | Enforced per user + per IP | Rate limiter logs |
| NFR-SEC-006 | Secret rotation cadence | Every 90 days | Secrets manager audit |

## Privacy

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-PRIV-001 | GDPR compliance (right to access, delete, export) | Full compliance | Compliance audit |
| NFR-PRIV-002 | Data deletion completion | <30 days from request | Deletion verification scan |
| NFR-PRIV-003 | PII never sent to LLM providers unmasked | 100% masked | Prompt audit log |
| NFR-PRIV-004 | User data export format | Machine-readable (JSON + raw files) | Export verification |

## Usability

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-USE-001 | Time to first value (upload first document) | <2 minutes from signup | Onboarding analytics |
| NFR-USE-002 | Task success rate (core flows) | >90% | Usability testing |
| NFR-USE-003 | Error recovery (user can undo mistakes) | All destructive actions reversible | UX audit |
| NFR-USE-004 | Mobile responsive | All core flows work on mobile | Device testing |

## Accessibility

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-A11Y-001 | WCAG compliance | WCAG 2.1 AA | Automated + manual audit |
| NFR-A11Y-002 | Keyboard navigation | All interactive elements reachable | Keyboard testing |
| NFR-A11Y-003 | Screen reader compatibility | NVDA, JAWS, VoiceOver | Assistive tech testing |
| NFR-A11Y-004 | Color contrast | â‰¥4.5:1 for normal text | Contrast checker |

## Reliability

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-REL-001 | Error rate (5xx responses) | <0.1% | API monitoring |
| NFR-REL-002 | Agent run failure rate | <2% | Agent run logs |
| NFR-REL-003 | Data durability | 99.999999% (11 nines) | S3 + RDS backup verification |
| NFR-REL-004 | Failed job retry | Automatic, max 3 retries with backoff | Queue monitoring |

## Observability

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-OBS-001 | All requests traced | 100% (sampled at 10% for storage) | Trace coverage |
| NFR-OBS-002 | Metrics retention | 13 months | Metrics storage |
| NFR-OBS-003 | Log retention | 90 days (hot), 1 year (cold) | Log storage |
| NFR-OBS-004 | Alerting latency (detection to notification) | <5 minutes | Alert audit |

## Compliance

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-COMP-001 | SOC 2 Type II readiness | Certified by 2027 Q2 | External audit |
| NFR-COMP-002 | GDPR compliance | Full compliance | DPA + audit |
| NFR-COMP-003 | Audit log retention | 7 years | Audit storage |
| NFR-COMP-004 | Data residency (enterprise) | Region-configurable | Deployment config |

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | Every NFR has a measurable target | "Fast" is not a requirement; "<500ms p99" is |
| 2 | NFRs are tested continuously, not just at launch | Quality decays; continuous testing catches regressions |
| 3 | NFRs inform architecture decisions | If you need 99.99% uptime, single-AZ won't work |

## Related Documents

- [`Functional-Requirements.md`](./Functional-Requirements.md) — functional requirements
- [`../../docs/architecture/Performance.md`](../../docs/architecture/Performance.md) — performance architecture
- [`../../docs/architecture/Scalability.md`](../../docs/architecture/Scalability.md) — scalability architecture
- [`../security/Security-Architecture.md`](../security/Security-Architecture.md) — security architecture
- [`../quality/Testing-Strategy.md`](../quality/Testing-Strategy.md) — testing strategy
````
