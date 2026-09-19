# CONT-P05 — 01 C4 / Deployment / Trust-Boundary / Data-Flow

**Deliverable:** `DEL-CONT-P05-01` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Commit:** `bd7adc6` | **Owners:** Enterprise Architect + Cloud Architect + SRE

## 1 C4 Context (L1)

```mermaid
C4Context
    title Context — Vaeloom Enterprise (tenant cells + control plane)
    Person(user, "User", "All roles, BYOK")
    Person(designPartner, "Design Partner", "Pilot tenant, region IN/EU/US, age 18+")
    System(vaeloom, "Vaeloom Platform", "Memory-first, agents, RAG, approval, provenance; MVP 787053a 99 paths → 110 paths bd7adc6")
    System_Ext(temporal, "Temporal", "Durability: workflows, 8 queues, RLS not in scope")
    System_Ext(otel, "OTel Collector", "Traces/metrics/logs, :4317/:4318")
    System_Ext(connectors, "Gmail/GitHub/Drive/Calendar/MCP", "Least-privilege connectors")
    Rel(user, vaeloom, "Uses", "HTTPS, OAuth 2.0 + PKCE, JWT 32+")
    Rel(designPartner, vaeloom, "Pilot/cutover per cell", "feature_flag per-tenant")
    Rel(vaeloom, temporal, "Durable execution", "gRPC 7233, REJECT_DUPLICATE")
    Rel(vaeloom, otel, "Emits", "OTLP")
    Rel(vaeloom, connectors, "Calls", "tool+approval, idempotency sha256")
```

## 2 C4 Container (L2)

```mermaid
flowchart TD
  LB["ALB / API Gateway<br/>CORS, rate_limit 100rpm, CSRF, _redact 14 keys"] --> API["api FastAPI 0.115<br/>27 routers, 110 OpenAPI, TenantContext 42/42 RLS"]
  API --> Temporal["Temporal Worker×2<br/>6 workers, 11 activities, 120s hb30s"]
  API --> PG["PostgreSQL 16 + pgvector<br/>42 RLS, Vector 1536, migrations 0010→0021"]
  API --> Redis["Redis 7<br/>quota Lua + ZADD sliding (future)"]
  API --> OTel["OTel Collector<br/>activity+workflow interceptors"]
  API --> Storage["Object Storage<br/>MinIO / S3 (StorageService)"]
  Temporal --> PG
  Temporal --> Redis
  API --> Connectors["Connector Ext MCP stdio/http<br/>MCP discovery 300s TTL"]
  subgraph Cell["Tenant Cell (per-tenant data plane)"]
    PG
    Redis
  end
  subgraph ControlPlane["Control Plane (global)"]
    API
    Temporal
    OTel
  end
```

## 3 C4 Component (L3) — Request Path

```mermaid
flowchart LR
  Req["User request"] --> Gateway["Gateway<br/>JWT 32+, CSRF, rate_limit"]
  Gateway --> AuthZ["TenantContext<br/>app.workspace_id/user_id<br/>42/42 RLS SET"]
  AuthZ --> Router["orchestrator.router<br/>classify_intent + MVP scope 10"]
  Router --> Super["supervisor<br/>PARALLEL_SAFE 8 CHAINS 5 DAG ≤5/8/20"]
  Super --> Graph["LangGraph StateGraph 10<br/>MemorySaver thread_id<br/>validate→retrieve→route→supervisor→agent→tool→policy→evaluate→finalize"]
  Graph --> Policy["policy_check<br/>approval_gated 13+dynamic<br/>forged→pending"]
  Policy --> Tool["tool_execute<br/>execute_tool 40+dynamic<br/>4KB/20KB truncate + secret scrub"]
  Tool --> Mem["memory_service / KG<br/>hybrid retrieval vector→LIKE→graph"]
```

## 4 Deployment

```mermaid
flowchart TB
  subgraph k8s["Kubernetes (staging/prod overlays)"]
    HPA["HPA 2→8 api<br/>cpu70 mem80"]
    API2["api 200m/512Mi→1000m/1Gi"]
    Worker["queue-worker 1→2<br/>Temporal Workers 6"]
    PGb["postgres + pgbouncer"]
    Redisb["redis"]
    Otelc["otelcol 0.102.0"]
  end
  subgraph docker["docker-compose dev"]
    APIlocal["api :8000"]
    PGlocal["postgres:16-pgvector"]
    Redislocal["redis:7"]
    TemporalLocal["temporal:7233 + ui:8234"]
  end
  API2 --> PGb
  API2 --> Redisb
  Worker --> PGb
  HPA --- API2
```

**Validated:** `terraform validate 12` `kustomize build … overlays/staging` 60
yamls, `docker-compose config` valid, `infra/terraform` 12 modules s3+DDB.

## 5 Trust Boundary

```mermaid
flowchart LR
  U["User / Browser<br/>untrusted prompts, docs"] --> Boundary1["Control Plane<br/>authN JWT + PKCE<br/>authZ RLS 42/42<br/>input sanitization ADR-031"]
  Boundary1 --> Boundary2["Cell Data Plane<br/>workspace_id FK + tenant_id<br/>SecretManager Infisical/fallback<br/>approval workflow 3600s"]
  Boundary2 --> Boundary3["Connector Boundary<br/>least-privilege scopes<br/>MCP metachar validate<br/>url_guard SSRF"]
  Boundary3 --> External["External world<br/>Gmail/GitHub/MCP"]
  style Boundary1 fill:#14532d,stroke:#4ade80,color:#fff
  style Boundary2 fill:#1e3a5f,stroke:#38bdf8,color:#fff
  style Boundary3 fill:#1e1b4b,stroke:#a78bfa,color:#fff
```

**Enforcement:** `validate_no_secrets` 35 keys recursive
(`temporal/validation` + `graph/state` single source),
`validate_workspace_binding` at graph entry + handoff + evaluate, `kill_switch`
fail-closed non-local, `[UNTRUSTED]` tagging.

## 6 Data Flow (write → projection)

```mermaid
flowchart LR
  Doc["Document upload"] --> Parse["parse_document 60s hb15s 3×"]
  Parse --> Extract["extract_entities via LLM → Entity 22 types"]
  Extract --> Write["write_memory 10s 3×<br/>canonical_name dedup 0.85<br/>Entity + Memory row + pgvector"]
  Write --> Index["index_graph 10s 2×"]
  Index --> Hybrid["hybrid retrieval<br/>vector <=> → LIKE %query% → graph traversal<br/>rerank + fit_to_context 8000"]
  Hybrid --> RAG["rag_context 8/8/5 8KB<br/>rag_status ok/empty/unavail/timeout/error"]
  RAG --> Graph["LangGraph retrieve_context 5s wait_for"]
  Graph --> Provenance["provenance memory_candidate + rag_status + evaluation_score"]
```

**Projections rebuildable:** `document_chunk` + `embedding` +
`knowledge_nodes/edges` are rebuildable via `reindex` from `Entity/Memory`
truth; never guess missing `canonical_name`.

---

_Version 1.0 2026-08-29 — validated via `terraform validate`, `kustomize`,
`rg tenant_id 42 RLS`, `graph 64` tests. Reviewers: Enterprise/Security/Data
Architects._
