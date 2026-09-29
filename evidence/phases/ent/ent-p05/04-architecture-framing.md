# ENT-P05 — 04 Architecture Framing — System Synthesis & Invariants

> **Phase:** `ENT-P05` (Solution Architecture)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Chief Enterprise Architect & Platform Infrastructure Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. System Architecture Synthesis

The Vaeloom Enterprise Platform combines distributed regional tenant cells with
a centralized edge control plane to deliver zero-trust security, candidate data
sovereignty, sub-50ms deterministic action routing, and compliant data residency
across the US, EU, and India.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL CONTROL PLANE                            │
│  - Edge Anycast DNS & WAF (Cloudflare)                                 │
│  - Zero-PII Tenant Directory Resolver                                  │
│  - OIDC / SAML Identity Federation Broker                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ mTLS Header-Based Routing
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────────────┐┌─────────────────────────┐┌─────────────────────────┐
│     US TENANT CELL      ││     EU TENANT CELL      ││    INDIA TENANT CELL    │
│  - Next.js SSR Web      ││  - Next.js SSR Web      ││  - Next.js SSR Web      │
│  - FastAPI Backend      ││  - FastAPI Backend      ││  - FastAPI Backend      │
│  - Redis BullMQ Queues  ││  - Redis BullMQ Queues  ││  - Redis BullMQ Queues  │
│  - PostgreSQL 16 DB     ││  - PostgreSQL 16 DB     ││  - PostgreSQL 16 DB     │
│    (42 RLS Tables)      ││    (42 RLS Tables)      ││    (42 RLS Tables)      │
│  - MinIO / S3 Storage   ││  - MinIO / S3 Storage   ││  - MinIO / S3 Storage   │
│  - Local Ollama LLM     ││  - Local Ollama LLM     ││  - Local Ollama LLM     │
└─────────────────────────┘└─────────────────────────┘└─────────────────────────┘
```

---

## 2. Core Architectural Invariants

### Invariant 1: Candidate Sovereign Vault Isolation (INV-01)

- Candidate personal career memories and raw portfolio artifacts belong
  exclusively to the candidate.
- University advisors and institutional administrators cannot view candidate
  records without an active, cryptographically signed, time-bounded
  `ConsentGrant` record.
- In absence of an active grant, backend queries return HTTP 403 Forbidden, and
  database RLS evaluates to 0 rows.

### Invariant 2: Zero-Trust Row-Level Security Enforcement (INV-02)

- All 42 relational tables in PostgreSQL 16 enforce native
  `FORCE ROW LEVEL SECURITY`.
- `TenantMiddleware` in FastAPI extracts server-derived tenant and user IDs from
  verified JWT tokens and injects session GUCs (`app.tenant_id`, `app.user_id`,
  `app.workspace_id`) before query execution.
- Missing or malformed session variables trigger immediate fail-closed query
  termination.

### Invariant 3: Cognitive Router Latency & Safety Budget (INV-03)

- System 1 (TypeSafe AI Jev native API) enforces a sub-50ms deterministic action
  routing ceiling.
- Destructive or external actions (`noul`) are intercepted by
  `approval_gated_tools()` and require human-in-the-loop (HITL) approval.
- System 2 (Ollama Cloud Gemma 4 31B) synthesizes documents using
  `<document_context>` XML fencing to neutralize indirect prompt injections.
- Failures or timeouts trigger automatic circuit-breaker failover to the local
  containerized Ollama (`gemma4:12b`) instance within 500ms.

### Invariant 4: Zero Cross-Border PII Egress (INV-04)

- Personal data, student records, resumes, and embeddings remain strictly
  confined within the regional cell where the tenant is provisioned (US in
  `us-east-1`, EU in `eu-central-1`, India in `ap-south-1`).
- Global cross-cell reporting utilizes differential privacy ($\epsilon = 0.5$)
  and $k$-anonymity ($k \ge 50$); zero raw candidate records leave the regional
  cell boundary.

_Signed: Chief Enterprise Architect & Platform Infrastructure Lead — 2026-09-29_
