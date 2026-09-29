# ENT-P15 Architecture Framing — Performance, Reliability, and Scalability

**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** Performance Engineer  
**Reviewer:** SRE + Security Architect  
**Date:** 2026-09-29

---

## 1. Performance Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VAELOOM PERFORMANCE ARCHITECTURE                     │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    EDGE / CDN LAYER                             │    │
│  │  Static assets cached globally; HTML revalidation on demand    │    │
│  └─────────────────────────┬──────────────────────────────────────┘    │
│                             │                                           │
│  ┌──────────────────────────▼─────────────────────────────────────┐    │
│  │                 LOAD BALANCER + TLS TERMINATION                 │    │
│  │  Strict HTTPS; HSTS; max-age=31536000; SSL session reuse       │    │
│  └──────────────────────────┬─────────────────────────────────────┘    │
│                             │                                           │
│  ┌──────────────────────────▼─────────────────────────────────────┐    │
│  │        RATE LIMITER + AUTH MIDDLEWARE LAYER (≤5ms)             │    │
│  │  Sliding window; JWT RS256 verify; GUC injection               │    │
│  └──────────┬─────────────────────────────────────────────────────┘    │
│             │                                                           │
│    ┌────────▼────────┐                     ┌───────────────────────┐   │
│    │ FastAPI API      │                     │ Next.js SSR Server    │   │
│    │ (N replicas)     │                     │ (React streaming)     │   │
│    │ 2-4 vCPU / 4GB  │                     │ SWR client-side cache │   │
│    └────────┬─────────┘                     └───────────────────────┘   │
│             │                                                           │
│    ┌────────▼────────────────────────────────────────────────────┐     │
│    │                  DATA LAYER                                  │     │
│    │                                                              │     │
│    │  PostgreSQL 16.4 (HNSW, pgvector, 42/42 RLS)               │     │
│    │   └─ pgBouncer (pool) ─ PG Primary ─ 2 Read Replicas       │     │
│    │                                                              │     │
│    │  MinIO / S3  (Object storage; WORM audit; resume artifacts) │     │
│    └────────────────────────────────────────────────────────────┘     │
│                                                                         │
│    ┌────────────────────────────────────────────────────────────┐      │
│    │               COGNITIVE LAYER                               │      │
│    │  System 1 (Jev): 32ms p95 routing; queue-backed HITL       │      │
│    │  System 2 (Gemma 4 31B): 3.2s p95 synthesis; streaming SSE │      │
│    └────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Performance Invariants

### INV-PERF-01: Latency Budgets Enforced by Layer

> **Each layer has an explicit latency budget: Auth ≤5ms; DB read ≤15ms; S1
> routing ≤50ms; S2 synthesis ≤5,000ms. Any layer exceeding its budget triggers
> auto-scaling or circuit break.**

### INV-PERF-02: No Synchronized Retries

> **Retry logic must use exponential backoff with jitter. Synchronized retries
> on provider failures are banned. Agent loop retries are bounded by
> `max_steps`.**

### INV-PERF-03: Cost Attribution on Every Request

> **Every API request is tagged with `tenant_id`, `workspace_id`, and
> `operation_type` in OTel spans. Cost is measurable per tenant, per operation
> type.**

### INV-PERF-04: Fail-Closed on RLS GUC

> **If `set_rls_session_vars()` fails or GUC is unset, the result is 0 rows —
> not an error that reveals the existence of data. This is a performance AND
> security invariant.**

### INV-PERF-05: Graceful Degradation Over Hard Failure

> **If S1 or S2 is unavailable, the agent loop degrades to available components.
> If both fail, the loop returns a structured error message. No unhandled
> exceptions should reach the user.**

---

## 3. Scalability Design Decisions

| Decision                              | Rationale                                                | Scale-out mechanism                     |
| ------------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| Stateless FastAPI workers             | JWT auth; no server-side session                         | Horizontal pod autoscaler (HPA)         |
| RLS via GUC (not application filter)  | Isolation guaranteed at DB level                         | Read replicas inherit RLS policy        |
| pgvector HNSW vs IVFFlat              | HNSW: consistent latency; IVFFlat: lower memory at scale | `ef_search` tuning; eventual index swap |
| MinIO → managed S3 (production)       | Managed service scales independently                     | Provider-managed; no ops overhead       |
| Jev S1 + Gemma 4 (external APIs)      | GPU-agnostic; scale via API quota                        | Additional API keys; queue              |
| Async agent execution (SSE streaming) | Non-blocking; response time UX                           | Server-Sent Events; no long-poll        |

---

_Architecture framing v1.0.0 — Performance Engineer — 2026-09-29_
