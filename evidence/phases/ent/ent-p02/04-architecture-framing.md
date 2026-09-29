# ENT-P02 — 04 Architecture Framing — Research & Domain Technical Topology

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** Architectural Framing & System Boundary Specification  
> **Owner:** Chief Architect & Platform Security Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Technical Architectural Topology

Phase `ENT-P02` establishes the technical topology required to satisfy both
higher education and enterprise outplacement domain requirements:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL CONTROL PLANE                            │
│  - Multi-Tenant Organization Directory & SSO / SCIM Provisioning       │
│  - Central Entitlements & Billing Engine                               │
│  - Regional Routing Gateway (Resolves Tenant ID -> Assigned Cell)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────┴───────────────────────────┐
       │                                                        │
       ▼                                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│      US REGIONAL CELL        │        │      EU REGIONAL CELL        │
│ - Dedicated PostgreSQL 16    │        │ - Dedicated PostgreSQL 16    │
│   (42/42 RLS Tables)         │        │   (42/42 RLS Tables)         │
│ - HNSW pgvector Partitions   │        │ - HNSW pgvector Partitions   │
│ - Candidate Sovereign Vault  │        │ - Candidate Sovereign Vault  │
│ - MinIO Object Storage       │        │ - MinIO Object Storage       │
│ - Redis BullMQ Queue Worker  │        │ - Redis BullMQ Queue Worker  │
│ - Headless Playwright Pool   │        │ - Headless Playwright Pool   │
└──────────────────────────────┘        └──────────────────────────────┘
```

---

## 2. Temporal Career Memory Invariants

The 22-memory type taxonomy introduces temporal validity windows (`valid_from`,
`valid_to`) to prevent historical skills from overriding current proficiencies:

1. **Temporal Decay & Evolution:** When a candidate's skill or role updates
   (e.g. transitioning from Junior to Senior Engineer), the previous memory
   record's `valid_to` is stamped with the transition timestamp rather than
   deleted, preserving full career progression history.
2. **Provenance Traceability:** Every memory node references a
   `provenance_source_id` (pointing to a verified resume upload, GitHub commit,
   or verified credential), guaranteeing 100% auditable provenance.
3. **Cryptographic Integrity:** Each memory record calculates
   `content_hash = SHA256(normalized_content)`, enabling instant tamper
   detection and idempotency deduplication.

---

## 3. Protocol Adapter Pattern for Enterprise MCP Connectors

To eliminate vendor lock-in and decouple internal agent logic from external API
shifts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                 MCP PROTOCOL ADAPTER ARCHITECTURE                      │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ EXTERNAL SOURCE   │ PROTOCOL ADAPTER  │ INTERNAL AGENT RUNTIME         │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ Workday REST API  │ `mcp__workday`    │ Normalized Job Match           │
│ Greenhouse API    │ `mcp__greenhouse` │ Standard Application Payload   │
│ Canvas / Banner   │ `mcp__lms`        │ Verified Student Transcript    │
│ Gmail Push API    │ `mcp__gmail`      │ Calendar Interview Event       │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

- External systems interface exclusively via sandboxed Model Context Protocol
  (MCP) clients.
- The agent reasoning kernel interacts only with normalized, typed Pydantic
  payloads, ensuring that external API changes never require rewriting core
  agent loops.

---

## 4. Hardware, Network & Runtime Invariants

1. **Live Backend API:** FastAPI 0.141+ running under Python 3.12.13 on
   `http://127.0.0.1:8000`.
2. **Live Frontend SSR:** Next.js 15.1+ running on `http://localhost:3000` with
   clean rewrite proxies to port 8000.
3. **Database Engine:** PostgreSQL 16 with pgvector extension enabled; Row-Level
   Security (`RLS`) active across 42/42 relational tables.
4. **Queue & Background Daemon:** Redis BullMQ queue worker executing
   asynchronous resume compilation and scheduled agent tasks.
5. **Headless Browser Runtime:** Containerized Playwright Chromium (`1,024MB`
   RAM cap) rendering PDF and DOCX artifacts.

_Signed: Chief Architect & Platform Security Lead — 2026-09-29_
