# ENT-P08 — 04 Architecture Framing — Enterprise API Gateway & Contract Synthesis

> **Phase:** `ENT-P08` (API Integration and Contract Design)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Enterprise API Architect & Systems Integration Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified API Gateway Architecture Topology

The Vaeloom Enterprise API layer operates as an intelligent, policy-enforcing
gateway that decouples client consumers from internal service meshes while
enforcing zero-trust identity and data isolation at every boundary:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL CLIENT CONSUMERS                       │
│  - Web Browser SSR (Next.js 15, SWR hydration, SSE trajectories)      │
│  - TypeScript & Python Client SDKs (@vaeloom/sdk-ts, vaeloom-sdk-py)  │
│  - Enterprise IdP (Microsoft Entra ID, Okta SCIM v2.0 sync)           │
│  - External MCP Clients & Third-Party ATS Integrations                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ TLS 1.3 / HTTPS / OpenAPI 3.2.0
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ENTERPRISE API GATEWAY (/v1)                     │
│  - Reverse Proxy & CORS Policy (Restricted origins & methods)          │
│  - Rate Limiter (Redis sliding-window per IP / Workspace / Tenant)     │
│  - CSRF Double-Submit Cookie Guard (Mutating POST/PUT/DELETE checks)   │
│  - JWT Verification & TenantContext Session GUC Injection              │
│  - W3C Distributed Trace Context (`traceparent` OpenTelemetry)         │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐┌───────────────────────────────┐
│     SYNCHRONOUS DOMAIN SERVICES       ││    ASYNCHRONOUS EVENT DISPATCH│
│  - /auth: Identity, MFA, Sessions     ││  - BullMQ Task Queues         │
│  - /workspaces: Multi-Tenant RBAC     ││  - Headless Playwright Pool   │
│  - /resumes: Templates & Compilations ││  - Cognitive Agent Workers    │
│  - /memories: 22-Type Vector Search   ││  - HMAC-SHA256 Webhook Engine │
│  - /scim: RFC 7644 Directory Sync     ││  - Dead Letter Queues (DLQ)   │
└───────────────────────────────────────┘└───────────────────────────────┘
```

---

## 2. Core API Architecture Invariants

### Invariant 1: OpenAPI 3.2.0 Contract Supremacy (INV-API-01)

- The machine-readable OpenAPI specification is the authoritative contract
  governing all external and internal API interactions.
- Every endpoint route, path parameter, request body, query parameter, and HTTP
  response schema must be fully typed in Pydantic v2 and validated in CI.
- Automated contract diffing (`openapi-diff`) prevents any unapproved breaking
  change on the `/v1` path.

### Invariant 2: Server-Derived Context Enforcement (INV-API-02)

- Client-supplied tenant IDs, workspace IDs, or user IDs passed in query
  parameters or request bodies are treated as untrusted hints.
- The actual authorization context (`app.tenant_id`, `app.workspace_id`,
  `app.user_id`) is strictly derived on the server from verified cryptographic
  JWT claims or authenticated session state.

### Invariant 3: Cryptographic Non-Repudiation on Webhooks & Agent Actions (INV-API-03)

- All outbound webhook notifications carry cryptographic HMAC-SHA256 signatures
  (`Vaeloom-Signature`) and anti-replay timestamps.
- Destructive agent operations require signed Human-In-The-Loop approvals logged
  to immutable partitioned audit tables.

### Invariant 4: Universal Idempotent Mutation Support (INV-API-04)

- All mutating endpoints (`POST /resumes`, `POST /agents/*/run`,
  `POST /billing/*`) accept an `Idempotency-Key` HTTP header.
- Redis-backed deduplication caches response envelopes for 24 hours,
  guaranteeing that network retries never execute duplicate billing charges,
  document compilations, or agent runs.

### Invariant 5: 12-Month Deprecation Horizon (INV-API-05)

- Breaking changes require major version increments (`/v2`) and a mandatory
  12-month deprecation lifecycle.
- Deprecated endpoints emit RFC 8594 `Sunset` and `Deprecation` response headers
  on every invocation.

---

_Signed: Principal Enterprise API Architect & Systems Integration Lead —
2026-09-29_
