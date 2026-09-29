# ENT-P05 — 01 C4 Architecture, Trust Boundaries & Data Flow Models

> **Phase:** `ENT-P05` (Solution Architecture)  
> **Deliverable:** `DEL-ENT-P05-01` (v1.0)  
> **Owner:** Principal Enterprise Architect & Systems Design Board  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. C4 Context Architecture Diagram (System in Scope)

The Vaeloom Enterprise Platform bridges individual candidates with educational
institutions and corporate employers while maintaining cryptographic candidate
data sovereignty.

```mermaid
C4Context
    title System Context Diagram - Vaeloom Enterprise Platform

    Person(candidate, "Candidate / Student", "Individual owning their career memory vault, resumes, and consent grants.")
    Person(advisor, "Career Advisor / Coach", "University counselor reviewing cohorts and intervening on high-stakes applications.")
    Person(admin, "Institutional Admin", "Manages organization hierarchy, SCIM provisioning, and billing entitlements.")

    System(vaeloom, "Vaeloom Enterprise Platform", "Multi-tenant autonomous career intelligence platform with two-tier cognitive routing and sovereign vaults.")

    System_Ext(idp, "Enterprise IdP", "Okta, Microsoft Entra ID, PingFederate (SAML 2.0 / SCIM v2.0).")
    System_Ext(sis, "Student Information Systems", "Ellucian Banner, Workday Student, Canvas (LTI 1.3).")
    System_Ext(ats, "Applicant Tracking Systems", "Workday, Greenhouse, Lever, Taleo, iCIMS (MCP / REST).")
    System_Ext(ai_cloud, "Cloud Cognitive APIs", "TypeSafe AI Jev (System 1) & Ollama Cloud Gemma 4 (System 2).")

    Rel(candidate, vaeloom, "Manages career vault, tailor requests, and grants consent via", "HTTPS / Web Browser")
    Rel(advisor, vaeloom, "Reviews intervention queues and approves ATS diffs via", "HTTPS / Advisor Portal")
    Rel(admin, vaeloom, "Configures SSO, user sync, and tenant policies via", "HTTPS / Admin Control Plane")

    Rel(vaeloom, idp, "Authenticates users and syncs directory rosters via", "SAML 2.0 / SCIM v2.0")
    Rel(vaeloom, sis, "Syncs cohort enrollments and graduation status via", "LTI 1.3 / REST")
    Rel(vaeloom, ats, "Audits job descriptions and compiles formatted resumes via", "MCP Protocol / REST")
    Rel(vaeloom, ai_cloud, "Routes sub-50ms actions and grounded synthesis via", "Secure TLS REST API")
```

---

## 2. C4 Container Diagram (Distributed Cell Architecture)

The system decomposes into a lightweight **Global Control Plane** and isolated
**Regional Tenant Cells** (US, EU, India).

```mermaid
graph TB
    subgraph ClientTier["Client Tier"]
        CandidateBrowser["Candidate Browser (Next.js PWA)"]
        AdvisorBrowser["Advisor Browser (Next.js Dashboard)"]
    end

    subgraph GlobalControlPlane["Global Control Plane (Cloudflare / Edge)"]
        GlobalDNS["Anycast Edge DNS & WAF"]
        TenantRouter["Zero-PII Tenant Directory Resolver"]
        AuthBroker["OIDC / SAML Identity Broker"]
    end

    subgraph RegionalCell["Regional Tenant Cell (e.g. US-East / EU-Central)"]
        IngressGW["Cell Ingress Gateway & Rate Limiter (Envoy / Traefik)"]
        WebSSR["Frontend Web Cluster (Next.js 15 App Router)"]
        APIService["Backend API Microservice (FastAPI Python 3.12)"]
        QueueBroker["Redis BullMQ Message & Task Broker"]
        Workers["Asynchronous Task Workers & Playwright PDF Pool"]
        LocalLLM["Local Ollama Container (Gemma 4 12B Fallback)"]
        PostgresDB[("Dedicated Supabase PostgreSQL 16\n42/42 RLS Tables + pgvector HNSW")]
        ObjectStorage[("Encrypted MinIO / S3 Artifact Vault")]
    end

    ClientTier -->|HTTPS / WSS| GlobalDNS
    GlobalDNS --> TenantRouter
    GlobalDNS --> AuthBroker
    TenantRouter -->|Route by Tenant Header| IngressGW

    IngressGW --> WebSSR
    IngressGW --> APIService
    APIService --> QueueBroker
    APIService --> PostgresDB
    QueueBroker --> Workers
    Workers --> PostgresDB
    Workers --> ObjectStorage
    Workers --> LocalLLM
```

---

## 3. C4 Component Diagram (Backend API & Cognitive Engine)

Inside the FastAPI backend service (`apps/api`), requests flow through strict
security and cognitive filters:

```mermaid
graph LR
    subgraph RequestPipeline["FastAPI Request Pipeline"]
        CORS["CORS & Security Headers Middleware"]
        Auth["JWT & Session Auth Middleware"]
        TenantScoping["TenantMiddleware (RLS GUC Injection)"]
        RateLimiter["Sliding Window Rate Limiter"]
    end

    subgraph CognitiveEngine["Two-Tier Cognitive Subsystem"]
        Router["Cognitive Router Service"]
        Sys1["System 1: TypeSafe AI Jev (Sub-50ms Routing)"]
        Sys2["System 2: Ollama Cloud Gemma 4 31B (Synthesis)"]
        CircuitBreaker["Resilience Circuit Breaker"]
        LocalFallback["Local Ollama Gemma 4 12B Container"]
    end

    subgraph StorageLayer["Data & Memory Layer"]
        ConsentCheck{"Active Consent Grant?"}
        VectorDB["pgvector HNSW Semantic Search"]
        VaultDB["Candidate Sovereign Memory Vault"]
    end

    CORS --> Auth --> TenantScoping --> RateLimiter
    RateLimiter --> Router
    Router -->|Deterministic Action| Sys1
    Router -->|Grounded Synthesis| Sys2
    Sys2 -.->|On Timeout / Failure| CircuitBreaker
    CircuitBreaker --> LocalFallback
    Router --> ConsentCheck
    ConsentCheck -->|Yes| VectorDB
    ConsentCheck -->|Yes| VaultDB
    ConsentCheck -->|No| Reject["HTTP 403 Forbidden: Missing Consent"]
```

---

## 4. Trust Boundaries & Security Enclaves

Security is architected around five concentric security enclaves:

| Enclave Level | Enclave Name                          | Components Included                          | Security Controls Enforced                                                                                                            |
| :-----------: | :------------------------------------ | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
|  **Level 0**  | **Public Edge Enclave**               | Cloudflare Edge, Anycast DNS, Global WAF     | DDoS mitigation, TLS 1.3 termination, bot protection, zero PII retention.                                                             |
|  **Level 1**  | **DMZ Ingress Enclave**               | Cell Ingress Gateways, Next.js Web SSR       | Strict CORS, CSRF double-submit cookies, CSP headers, rate-limiting tokens.                                                           |
|  **Level 2**  | **Regional Application Enclave**      | FastAPI Services, BullMQ Workers             | Mutual TLS (mTLS) workload identity, non-root containers, read-only root filesystems.                                                 |
|  **Level 3**  | **Data & Memory Enclave**             | PostgreSQL 16 DB, pgvector, MinIO            | Database-level FORCE Row-Level Security (42/42 tables), AES-256 encryption at rest.                                                   |
|  **Level 4**  | **Candidate Sovereign Vault Enclave** | Candidate personal memories, resume raw text | **Candidate Sovereign Vault**: Encrypted per-user DEK (Data Encryption Key); zero institutional access without active `ConsentGrant`. |

---

## 5. End-to-End Data Flow Models

### Data Flow 1: Candidate Resume Tailoring & Consent Verification

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate / Student
    participant Web as Next.js Web App
    participant API as FastAPI Backend
    participant DB as PostgreSQL (RLS)
    participant Jev as TypeSafe AI (S1)
    participant Gemma as Ollama Gemma 4 (S2)
    participant S3 as MinIO S3 Vault

    Candidate->>Web: Clicks "Tailor Resume for Job X"
    Web->>API: POST /resumes/{id}/tailor (Bearer Token + CSRF)
    API->>DB: Set GUC (app.user_id, app.tenant_id)
    API->>DB: Query candidate sovereign memories (RLS filtered)
    DB-->>API: Returns verified memories with provenance
    API->>Jev: POST /systemone (Classify job domain & skills)
    Jev-->>API: Returns action route & required skills (38ms)
    API->>Gemma: POST /v1/chat (Prompt with <document_context> XML fencing)
    Gemma-->>API: Returns tailored bullet points with citations
    API->>S3: Compile and upload PDF artifact
    API->>DB: Insert record into resume_artifacts table
    API-->>Web: HTTP 200 OK (Artifact ID & Preview URL)
    Web-->>Candidate: Renders visual diff and download buttons
```

### Data Flow 2: GDPR Article 17 Cryptographic Erasure

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant API as FastAPI Backend
    participant DB as PostgreSQL 16
    participant KMS as Key Management Service
    participant S3 as MinIO Vault
    participant Audit as Immutable Audit Log

    Candidate->>API: POST /account/gdpr-purge (Confirm Password)
    API->>KMS: Permanently destroy Candidate DEK (Data Encryption Key)
    API->>DB: Hard delete rows in personal_memories, resumes, artifacts
    API->>S3: Purge candidate object prefix from bucket
    API->>Audit: Append anonymized purge event (Purged User Hash, Timestamp)
    API-->>Candidate: HTTP 200 OK (Cryptographic Erasure Certified)
```

_Signed: Principal Enterprise Architect & Systems Design Board — 2026-09-29_
