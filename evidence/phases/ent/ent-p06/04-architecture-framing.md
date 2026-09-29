# ENT-P06 — 04 Architecture Framing — Technology Stack Synthesis

> **Phase:** `ENT-P06` (Technology Stack and Engineering Standards)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Enterprise Architect & Platform Tooling Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified Technology Stack Topology

The Vaeloom Enterprise Platform combines proven, high-performance open standards
across language runtimes, data storage, message brokers, and developer tooling:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CLIENT & PRESENTATION LAYER                       │
│  - Next.js 15 App Router (React 19, TypeScript strict mode)            │
│  - Accessible UI Primitives (@vaeloom/ui-kit, Tailwind CSS, Radix UI)   │
│  - SWR Data Hydration + Server-Sent Events (SSE) / WebSockets          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / TLS 1.3 / OpenAPI 3.2.0
┌───────────────────────────────────▼────────────────────────────────────┐
│                       SERVICES & API CORE LAYER                        │
│  - FastAPI Microservices (Python 3.12.13, Pydantic v2 validation)      │
│  - Uvicorn Async Server + OpenTelemetry Distributed Tracing            │
│  - TenantMiddleware (PostgreSQL RLS GUC Session Variable Injection)    │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐┌───────────────────────────────┐
│       COGNITIVE & AI SUBSYSTEM        ││   STORAGE & TASK BROKER TIER  │
│  - System 1: TypeSafe AI Jev Native   ││  - Supabase PostgreSQL 16.4   │
│    (Sub-50ms deterministic routing)   ││    (42 RLS Tables + pgvector) │
│  - System 2: Ollama Gemma 4 31B       ││  - Redis 7.2.5 + BullMQ 5.12  │
│    (Grounded XML-fenced synthesis)    ││  - Encrypted MinIO S3 Vault   │
│  - Local Ollama Gemma 4 12B Fallback  ││  - Headless Playwright Pool   │
└───────────────────────────────────────┘└───────────────────────────────┘
```

---

## 2. Technology Stack Invariants

### Invariant 1: Hermetic Dependency Pinning (INV-STK-01)

- 100% of runtime dependencies across `apps/api` and `apps/web` are pinned to
  exact semantic versions.
- Lockfiles (`uv.lock` and `pnpm-lock.yaml`) are immutable in CI; uncommitted
  lockfile drift triggers immediate build failure.

### Invariant 2: Static Type Safety Floor (INV-STK-02)

- Zero untyped code: TypeScript compiler runs with `strict: true`,
  `noImplicitAny: true`, and `strictNullChecks: true`.
- Python codebase enforces 100% type annotation coverage validated via
  `mypy --strict` and `ruff`.

### Invariant 3: SLSA Level 3 Supply Chain Attestation (INV-STK-03)

- All production container images are signed using Sigstore Cosign with
  cryptographic build provenance.
- Production Kubernetes admission controllers reject unsigned container images
  or images lacking machine-readable CycloneDX SBOMs.

### Invariant 4: Zero-Friction Developer Ergonomics (INV-STK-04)

- Developer commands are isolated: `pnpm dev:web` starts Next.js in 2–5 seconds;
  `pnpm dev:be` starts FastAPI instantly.
- Slow repository-wide dev scripts (`pnpm dev`) remain disabled at the root to
  prevent monorepo process deadlocks.

_Signed: Principal Enterprise Architect & Platform Tooling Lead — 2026-09-29_
