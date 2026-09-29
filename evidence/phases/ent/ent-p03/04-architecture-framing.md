# ENT-P03 — 04 Architecture Framing — Requirements Enforcement Topology

> **Phase:** `ENT-P03` (Requirements Engineering)  
> **Deliverable:** Architectural Framing & System Boundary Specification  
> **Owner:** Chief Architect & Platform Security Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. System Boundary & Consent Enforcement Topology

The Vaeloom Enterprise architecture enforces multi-layered defense-in-depth
across every inbound request, ensuring that unconsented data access is
impossible at both the application and database layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INBOUND REQUEST ENFORCEMENT PIPELINE                 │
├────────────────────────────────────────────────────────────────────────┤
│ 1. TLS Ingress Gateway -> Host / Tenant Header Routing                 │
│ 2. JWT Authentication Middleware -> Extracts user_id, tenant_id, role  │
│ 3. TenantMiddleware -> Sets app.tenant_id, app.user_id, app.ws_id GUCs │
│ 4. ConsentEnforcementMiddleware -> Evaluates active ConsentGrant table │
│ 5. PostgreSQL Row-Level Security (RLS) -> Enforced at Kernel Layer     │
│ 6. Response Marshaling -> Sensitive candidate fields filtered          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Two-Tier Cognitive Architecture Invariants

Building on Module 05 production verification, the cognitive reasoning pipeline
enforces strict separation of responsibilities:

1. **System 1 (TypeSafe AI Jev System One):**
   - High-throughput, sub-50ms deterministic action router.
   - Evaluates user intent, tool permissions, rate-limiting, and
     prompt-injection threat scores.
   - Designates destructive actions (`noul`) requiring human approval before
     dispatch.
2. **System 2 (Ollama Cloud Gemma 4 31B with Local 12B Fallback):**
   - High-capacity generative model at `https://ollama.com/v1`.
   - Synthesizes tailored resumes and cover letters inside strict XML context
     fences (`<document_context>`).
   - Appends verified provenance pointers (`provenance_memory_id`) to all output
     claims.
   - Automatic circuit breaker fallback to local `gemma4:12b`
     (`http://localhost:11434/v1`) after 3 timeouts.

---

## 3. Hardware, Network & Runtime Invariants

1. **Backend API:** FastAPI 0.141+ running under Python 3.12.13 on
   `http://127.0.0.1:8000`.
2. **Frontend Web SSR:** Next.js 15.1+ running on `http://localhost:3000` with
   rewrite proxies routing `/api/v1/*` to port 8000.
3. **Database Engine:** PostgreSQL 16 with pgvector extension; 42/42 tables
   strictly enforcing RLS with fail-closed GUC session variables.
4. **Queue Worker:** Redis BullMQ queue worker executing asynchronous document
   rendering and agent schedules.
5. **Headless Browser Pool:** Containerized Playwright Chromium (`1,024MB` RAM
   cap) rendering PDF/DOCX artifacts.

_Signed: Chief Architect & Platform Security Lead — 2026-09-29_
