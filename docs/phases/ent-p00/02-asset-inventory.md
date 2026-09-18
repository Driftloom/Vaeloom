# ENT-P00 — 02 Asset, Repository, Environment & Access Inventory

> **Phase:** `ENT-P00` (Intake and Existing-State Assessment)  
> **Deliverable:** `DEL-ENT-P00-02` (v1.0)  
> **Status:** APPROVED BASELINE  
> **Commit:** `74a7550` | **Date:** 2026-09-19  
> **Authoritative Owner:** Platform Lead & SRE Architect

---

## 1. Monorepo Package Inventory (25 Packages)

```
c:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom/
├── apps/
│   ├── api/                    # FastAPI Backend, Python 3.12 (uv managed), 36 routers, 254 endpoints
│   └── web/                    # Next.js 15 App Router, React 19, Tailwind CSS, SWR, SSE Chat
├── packages/
│   ├── ui-kit/                 # Shared design system components (Radix, Lucide, Tailwind)
│   ├── shared-types/           # Shared TypeScript interfaces & API schemas
│   ├── eslint-config/          # Shared ESLint governance rules
│   ├── tsconfig/               # Strict TypeScript compiler options
│   └── observability/          # Client-side tracing & telemetry helpers
├── integrations/
│   ├── calendar/               # Google Calendar / CalDAV event management
│   ├── email/                  # Gmail OAuth & SMTP notification bridge
│   ├── github/                 # GitHub API & PR automation connector
│   ├── google-drive/           # Google Drive resume export & storage sync
│   ├── notion/                 # Notion workspace knowledge capture
│   └── slack/                  # Slack notification & webhook integration
├── connectors/
│   ├── graphql/                # Generic GraphQL downstream connector
│   ├── mcp/                    # Model Context Protocol v2 integration layer
│   └── rest/                   # Generic authenticated REST client
├── sdk/
│   └── typescript/             # Vaeloom programmatic TypeScript SDK client
└── plugins/
    ├── tag-generator/          # Semantic skill tagging plugin
    ├── word-count/             # Resume length analysis plugin
    ├── sentiment/              # Communication tone analysis plugin
    ├── summarizer/             # Document executive summarizer plugin
    └── translator/             # Multi-lingual resume translation plugin
```

---

## 2. Infrastructure, Container & Runtime Services

| Service Name    | Technology / Image         | Port / Bind     | Purpose & Scope                                     | Health Check                       |
| :-------------- | :------------------------- | :-------------- | :-------------------------------------------------- | :--------------------------------- |
| **vaeloom-api** | Python 3.12.13 (FastAPI)   | `8000`          | Core REST API, agent loop engine, tool executor     | `GET /health` -> 200 OK            |
| **vaeloom-web** | Node.js 22 / Next.js 15    | `3000`          | Web application UI, resume preview, chat streaming  | `GET /` -> 200 OK                  |
| **postgres**    | PostgreSQL 16 + `pgvector` | `5432`          | Relational store, 42 RLS tables, dense vector index | `pg_isready -h localhost`          |
| **redis**       | Redis 7.2 (Alpine)         | `6379`          | Distributed session cache, rate limiter, BullMQ     | `redis-cli ping` -> PONG           |
| **qdrant**      | Qdrant v1.11               | `6333`          | Specialized vector search cluster (optional)        | `GET /healthz` -> 200 OK           |
| **minio**       | MinIO S3-Compatible        | `9000` / `9001` | S3 document object store (PDF, DOCX binaries)       | `GET /minio/health/live`           |
| **temporal**    | Temporal Server v1.24      | `7233`          | Durable workflow orchestration engine               | `temporal operator cluster health` |
| **prometheus**  | Prometheus v2.54           | `9090`          | Time-series metrics scraper (`/metrics`)            | `GET /-/healthy` -> 200 OK         |

---

## 3. Data Store & Schema Inventory

### Database Tables & RLS Policies (42/42 Verified)

- **Core Entities (12)**: `tenants`, `workspaces`, `users`, `memberships`,
  `roles`, `permissions`, `invitations`, `api_keys`, `audit_logs`, `settings`,
  `feature_flags`, `webhooks`.
- **Career & Resume Entities (8)**: `resumes`, `resume_sections`,
  `resume_artifacts`, `skills`, `experiences`, `educations`, `certifications`,
  `projects`.
- **Job Application Entities (7)**: `job_opportunities`, `job_searches`,
  `applications`, `application_events`, `interviews`, `contacts`, `notes`.
- **Memory & Knowledge Graph Entities (9)**: `memories`, `memory_embeddings`,
  `memory_lineage`, `kg_nodes`, `kg_edges`, `kg_entities`, `kg_relations`,
  `kg_workspaces`, `semantic_caches`.
- **Agentic & Connector Entities (6)**: `agent_sessions`, `agent_steps`,
  `agent_schedules`, `connectors`, `connector_credentials`, `tool_executions`.

_Every table above has active PostgreSQL Row-Level Security enabled with
fail-closed GUC verification._

---

## 4. Test Suite Inventory

```text
┌────────────────────────────────────────────────────────┬─────────────┬──────────┐
│ Test Suite Category                                    │ Count       │ Engine   │
├────────────────────────────────────────────────────────┼─────────────┼──────────┤
│ Backend Security & Middleware Tests                    │ 233 Tests   │ pytest   │
│ Backend Ingestion & OCR Tests                          │ 36 Tests    │ pytest   │
│ Backend Knowledge Graph & Lineage Tests                │ 26 Tests    │ pytest   │
│ Backend Tool Executor & Self-Healing Tests             │ 90 Tests    │ pytest   │
│ Backend 28 Enterprise Agents Tests                     │ 28 Tests    │ pytest   │
│ Backend Hardened Zero-Trust Tests                      │ 14 Tests    │ pytest   │
│ Total Collected Backend Pytest Tests                   │ 3,640 Tests │ uv/pytest│
│ Frontend Jest Unit & Component Tests                   │ 41 Tests    │ jest     │
│ Playwright E2E Integration Tests (6 Spec Files)        │ 73 Tests    │ pw       │
└────────────────────────────────────────────────────────┴─────────────┴──────────┘
```

---

## 5. Security & Access Boundary Verification

1. **Production Secret Management**: Infisical SecretManager protocol
   implemented with local env fallback (`SecretManager` ABC in
   `api/services/secrets.py`).
2. **Database Authentication**: Dynamic IAM auth supported for AWS RDS / GCP
   Cloud SQL; password auth uses SCRAM-SHA-256.
3. **Internal Network Boundaries**: Containers communicate over isolated Docker
   overlay network; only ports 3000 (web) and 8000 (api) exposed to ingress
   reverse proxy.
