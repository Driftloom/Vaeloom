# ENT-P11 — 04 Architecture Framing — Enterprise Backend Architecture Synthesis

> **Phase:** `ENT-P11` (Backend Implementation)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Enterprise Backend Architect & Distributed Systems Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified Backend Architecture Topology

The Vaeloom enterprise backend architecture unites high-throughput asynchronous
API gateways, PostgreSQL row-level security enforcement, distributed
asynchronous background task processing, sandboxed MCP tool connectors, and a
two-tier cognitive intelligence engine:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI ASYNCHRONOUS GATEWAY                    │
│  - Python 3.12.13 pinned runtime with Uvicorn ASGI event loop          │
│  - OpenAPI 3.2.0 contract covering 241 paths / 294 operations          │
│  - Outermost CORS Middleware, CSRF Double-Submit & Sliding-Window Rate │
│  - OpenTelemetry auto-instrumentation & /metrics Prometheus exposition │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   SECURITY & MULTI-TENANT ISOLATION TIER               │
│  - TenantMiddleware extracts tenant, workspace, and sovereign user IDs │
│  - Session GUC injection via set_rls_session_vars() per connection     │
│  - 42 / 42 PostgreSQL tables with FORCE ROW LEVEL SECURITY             │
│  - Fail-closed database transactions (zero leakage on unset GUCs)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│     STORAGE & PERSISTENCE TIER    │       │     TWO-TIER COGNITIVE ENGINE     │
│ - PostgreSQL 16.4 (Head 0061)     │       │ - System 1 (TypeSafe AI Jev):     │
│ - pgvector HNSW semantic indexing │       │   Sub-50ms routing & HITL triage  │
│ - MinIO S3 Encrypted Document Enc │       │ - System 2 (Ollama Gemma 4 31B):  │
│ - Redis 7.2 Job & Cache Broker    │       │   Document synthesis & XML fencing│
└───────────────────────────────────┘       └───────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                BACKGROUND WORKERS & MCP EXTENSION ECOSYSTEM            │
│  - Celery / BullMQ workers with dead-letter queue retries              │
│  - Playwright headless Chromium document renderer (PDF page-fit loop)  │
│  - Model Context Protocol (MCP v2) client service (stdio/SSE transport)│
│  - SSRF URL Guard validating HTTPS-only & public IPv4/IPv6 destinations│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Backend Architecture Invariants

### Invariant 1: Zero-Bypass Transaction-Local Session GUCs (INV-BE-01)

- Every single database transaction originating from the API gateway or worker
  pool must execute `set_rls_session_vars(db, tenant_id, workspace_id, user_id)`
  before evaluating any data query or mutation.
- When session GUCs are unset or null, PostgreSQL row-level security defaults to
  deny-all, returning zero rows. Service role policies (`USING (true)`) are
  strictly isolated and never accessible by tenant API callers.

### Invariant 2: Complete 42/42 Table `FORCE ROW LEVEL SECURITY` (INV-BE-02)

- All 42 tables across candidate sovereign, institutional enterprise, and
  telemetry domains maintain
  `ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY`.
- Table owners and superusers cannot bypass RLS policies in tenant-scoped
  database sessions.

### Invariant 3: Two-Tier Cognitive Architecture Separation (INV-BE-03)

- **Tier 1 (System 1):** Real-time, deterministic action classification, tool
  permission gating, and destructive action triage executed via TypeSafe AI Jev
  System One native endpoints (`/v1/systemone`) in $< 50\text{ ms}$.
- **Tier 2 (System 2):** Generative resume tailoring, contextual reasoning, and
  cover letter synthesis executed via Ollama Cloud Gemma 4 31B (with local 12B
  container fallback).
- All generative inputs and outputs enforce strict structural XML context
  fencing (`<document_context>`) to neutralize prompt injection and boundary
  escape attacks.

### Invariant 4: SSRF-Guarded Outbound Scraping & Webhook Dispatch (INV-BE-04)

- Outbound HTTP requests from browser tools (`browse_job_page`,
  `scrape_company_insights`, `verify_application_link`) and webhook dispatches
  must traverse `utils/url_guard.py`.
- Enforces HTTPS scheme, denies loopback (`127.0.0.0/8`, `::1`), link-local
  (`169.254.0.0/16`), private RFC 1918 subnets, and cloud metadata IP endpoints
  (`169.254.169.254`).

### Invariant 5: Cryptographic Provenance & GDPR Art. 17 Erasure (INV-BE-05)

- Every candidate document mutation generates an immutable SHA-256 content
  digest linked to parent versions and source citations in `agent_audit_logs`.
- Right-to-be-forgotten requests execute KMS Data Encryption Key (DEK)
  destruction, rendering ciphertext irreversibly unrecoverable across PostgreSQL
  backups and MinIO S3 vaults within 60 seconds of verification.

---

_Signed: Principal Enterprise Backend Architect & Distributed Systems Lead —
2026-09-29_
