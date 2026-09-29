# DEL-ENT-P13-01 — Enterprise Threat Model & STRIDE Analysis

**Deliverable ID:** DEL-ENT-P13-01  
**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** Security Architect  
**Reviewer:** Application Security Engineer + AI Safety Lead  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable path:** `evidence/phases/ent/ent-p13/01-threat-model-stride.md`

---

## 1. Scope and Trust Boundaries

### System Context

Vaeloom is a multi-tenant SaaS platform with:

- **Global control plane** — tenant provisioning, billing, policy, SSO/SCIM
- **Region-pinned tenant cells** — EU-WEST-1 (GDPR), AP-SOUTH-1 (DPDP),
  US-EAST-1 (FERPA/COPPA)
- **28 governed agents** across 8 architectural planes
- **22 memory types** with individual ownership and consent gating
- **Plugin/MCP ecosystem** — marketplace, manifests, sandbox, kill switches
- **Admin control plane** — institutional admins, break-glass, audit

### Trust Boundary Inventory

| TB-ID | Boundary                      | From            | To                             | Controls                                               |
| ----- | ----------------------------- | --------------- | ------------------------------ | ------------------------------------------------------ |
| TB-01 | Public internet ↔ API gateway | External actors | FastAPI (port 8000)            | TLS 1.3; CORS; rate-limit; WAF                         |
| TB-02 | API ↔ Database                | API workers     | PostgreSQL 16.4                | TLS; RLS 42/42 FORCE; GUC-gated                        |
| TB-03 | API ↔ Object store            | API workers     | MinIO S3 (:9000)               | Pre-signed URLs (15-min TTL); workspace scoping        |
| TB-04 | API ↔ Agent runtime           | API → loop.py   | Agent execution pool           | Typed tool contracts; HITL gating; Tier 4 HMAC token   |
| TB-05 | Agent ↔ External LLM          | Agent pool      | TypeSafe AI Jev + Ollama Cloud | API key; [UNTRUSTED_DATA] fencing; 4,000-char limit    |
| TB-06 | Agent ↔ Plugin/MCP            | Agent executor  | MCP server (stdio/http)        | Signed manifest; scoped identity; 30s timeout; sandbox |
| TB-07 | Institution admin ↔ User data | Admin role      | User workspace/memories        | ConsentGrant required; purpose-bound; audited          |
| TB-08 | CI/CD ↔ Repository            | GitHub Actions  | main branch                    | SLSA provenance; branch protection; signed commits     |
| TB-09 | Frontend ↔ API                | Next.js SSR     | API workers                    | HttpOnly CSRF token; SameSite=Strict; HTTPS            |
| TB-10 | Break-glass ↔ Tenant data     | SRE on-call     | Any tenant cell                | PAM; dual-approval; immutable audit log; 4h TTL        |

---

## 2. Asset Inventory

| Asset-ID | Asset                               | Classification | Owner               | Residency          | Sensitivity |
| -------- | ----------------------------------- | -------------- | ------------------- | ------------------ | ----------- |
| A-01     | User memory records (22 types)      | SOVEREIGN      | Individual user     | Region-pinned cell | CRITICAL    |
| A-02     | JWT / refresh tokens                | AUTH           | IAM service         | Control plane      | CRITICAL    |
| A-03     | Workspace knowledge graph           | CONFIDENTIAL   | Workspace admin     | Region-pinned cell | HIGH        |
| A-04     | Agent execution traces + tool calls | OPERATIONAL    | AI Safety Lead      | OTel collector     | HIGH        |
| A-05     | Billing / entitlement records       | FINANCIAL      | Finance + Legal     | Control plane      | HIGH        |
| A-06     | Institution roster + SSO config     | ORGANIZATIONAL | Institutional admin | Control plane      | HIGH        |
| A-07     | Plugin/MCP manifests + secrets      | OPERATIONAL    | Plugin owner        | Control plane      | HIGH        |
| A-08     | Encryption DEKs (per-workspace)     | KEY_MATERIAL   | KMS service         | HSM / KMS          | CRITICAL    |
| A-09     | System 1 Jev API key                | SECRET         | AI Safety Lead      | Infisical vault    | CRITICAL    |
| A-10     | System 2 Ollama Cloud API key       | SECRET         | AI Safety Lead      | Infisical vault    | CRITICAL    |
| A-11     | Audit log stream                    | COMPLIANCE     | CISO                | Immutable S3       | HIGH        |
| A-12     | SCIM provisioning tokens            | AUTH           | IAM service         | Control plane      | HIGH        |

---

## 3. Attacker Profiles

| Profile                             | Capability                   | Goal                                     | Vectors                                                   |
| ----------------------------------- | ---------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| AP-01 — Unauthenticated external    | Internet access; OWASP tools | Data exfiltration; DoS                   | Auth bypass; injection; enumeration                       |
| AP-02 — Authenticated user (self)   | Valid JWT; workspace scope   | Privilege escalation; data hoarding      | IDOR; path traversal; scope creep                         |
| AP-03 — Authenticated cross-tenant  | Valid JWT; own workspace     | Cross-tenant data leakage                | RLS bypass; tenant_id spoofing; shared resource collision |
| AP-04 — Malicious institution admin | Admin role; ConsentGrant     | Access user memory without consent       | Role abuse; ConsentGrant forgery; audit suppression       |
| AP-05 — Compromised agent           | Agent JWT; tool access       | Goal hijack; uncontrolled tool execution | Prompt injection; memory poisoning; approval bypass       |
| AP-06 — Malicious plugin author     | Marketplace access           | Supply-chain attack; data exfiltration   | Unsigned manifest; sandbox escape; secret exfiltration    |
| AP-07 — Insider SRE                 | Break-glass access           | Data exfiltration; cover-up              | Unapproved access; audit log tampering                    |
| AP-08 — LLM prompt injector         | User-provided content        | Goal redirection; policy bypass          | Prompt injection via docs/emails/web pages                |

---

## 4. STRIDE Threat Matrix

### 4.1 Spoofing

| TH-ID  | Threat                         | Component        | Likelihood | Impact   | Severity | Mitigation                                                                       | Status    |
| ------ | ------------------------------ | ---------------- | ---------- | -------- | -------- | -------------------------------------------------------------------------------- | --------- |
| TH-S01 | JWT token forged or replayed   | Auth middleware  | LOW        | CRITICAL | HIGH     | RS256 JWKS rotation; `validate_settings()` fail-fast; 15-min access TTL          | MITIGATED |
| TH-S02 | tenant_id spoofed in request   | TenantMiddleware | LOW        | CRITICAL | HIGH     | Server-derived from JWT claim; GUC `set_rls_session_vars()` before every query   | MITIGATED |
| TH-S03 | SCIM provisioning token stolen | SCIM endpoint    | MEDIUM     | HIGH     | HIGH     | Per-org rotating tokens; IP allowlist; audit log                                 | MITIGATED |
| TH-S04 | Agent identity impersonation   | Agent JWT        | LOW        | HIGH     | MEDIUM   | Agent-scoped JWT (`iss=vaeloom-agent`); scope restriction; no user-scope overlap | MITIGATED |
| TH-S05 | MCP server identity spoofing   | Plugin connector | LOW        | HIGH     | MEDIUM   | Signed manifest; version pinning; TLS peer verification                          | MITIGATED |

### 4.2 Tampering

| TH-ID  | Threat                               | Component        | Likelihood | Impact   | Severity | Mitigation                                                                  | Status                               |
| ------ | ------------------------------------ | ---------------- | ---------- | -------- | -------- | --------------------------------------------------------------------------- | ------------------------------------ |
| TH-T01 | Memory record tampered post-write    | PostgreSQL       | LOW        | CRITICAL | HIGH     | `supersedes_id` immutable chain; SHA-256 content hash; RLS write-owner only | MITIGATED                            |
| TH-T02 | Audit log suppressed or modified     | S3 audit stream  | LOW        | CRITICAL | HIGH     | Append-only S3 object lock; WORM retention; hash chaining                   | MITIGATED                            |
| TH-T03 | Agent HITL approval token forged     | Approval gate    | LOW        | CRITICAL | HIGH     | HMAC-SHA256 signed; 15-min TTL; one-time-use; signed by user JWT            | MITIGATED                            |
| TH-T04 | OpenAPI spec modified in transit     | Serving pipeline | LOW        | MEDIUM   | LOW      | HTTPS; integrity hash in CI                                                 | MITIGATED                            |
| TH-T05 | Prompt injection modifies agent goal | LLM input        | HIGH       | HIGH     | CRITICAL | `[UNTRUSTED_DATA]` XML fencing; 4,000-char limit; S1 triage before S2       | PARTIAL — enhanced detection backlog |

### 4.3 Repudiation

| TH-ID  | Threat                           | Component      | Likelihood | Impact | Severity | Mitigation                                                                 | Status    |
| ------ | -------------------------------- | -------------- | ---------- | ------ | -------- | -------------------------------------------------------------------------- | --------- |
| TH-R01 | User denies memory creation      | Memory service | LOW        | MEDIUM | MEDIUM   | Immutable `created_at`, `user_id`, provenance in record                    | MITIGATED |
| TH-R02 | Admin denies accessing user data | Admin routes   | LOW        | HIGH   | HIGH     | Append-only audit log; `actor_id` + `target_id` + `purpose_code` per entry | MITIGATED |
| TH-R03 | Agent denies tool execution      | Tool executor  | LOW        | HIGH   | HIGH     | OTel GenAI span with `tool.name`, `agent.id`, `user.id`, `workspace.id`    | MITIGATED |

### 4.4 Information Disclosure

| TH-ID  | Threat                            | Component              | Likelihood | Impact   | Severity | Mitigation                                                                | Status    |
| ------ | --------------------------------- | ---------------------- | ---------- | -------- | -------- | ------------------------------------------------------------------------- | --------- |
| TH-I01 | Cross-tenant data leak via SQL    | PostgreSQL             | MEDIUM     | CRITICAL | CRITICAL | RLS 42/42 FORCE; GUC fail-closed; independent test `test_rls_live_pg.py`  | MITIGATED |
| TH-I02 | Memory exposed in LLM context     | Agent memory retrieval | MEDIUM     | HIGH     | HIGH     | Workspace-scoped retrieval; ConsentGrant check for cross-user access      | MITIGATED |
| TH-I03 | API key leaked in logs            | Logging                | MEDIUM     | CRITICAL | HIGH     | Scrubbing middleware masks `Authorization`, `X-API-Key`, `token` fields   | MITIGATED |
| TH-I04 | Personal data in OTel spans       | OTel collector         | MEDIUM     | HIGH     | HIGH     | PII scrubbing filter; no raw user content in span attributes              | MITIGATED |
| TH-I05 | Plugin exfiltrates workspace data | MCP sandbox            | MEDIUM     | HIGH     | HIGH     | Per-connector scope; egress allow-list; 30s timeout; read-only by default | MITIGATED |
| TH-I06 | Error messages reveal internals   | API exception handlers | HIGH       | MEDIUM   | MEDIUM   | Generic 500 body; detail only in OTel trace (internal access)             | MITIGATED |

### 4.5 Denial of Service

| TH-ID  | Threat                         | Component        | Likelihood | Impact | Severity | Mitigation                                                         | Status    |
| ------ | ------------------------------ | ---------------- | ---------- | ------ | -------- | ------------------------------------------------------------------ | --------- |
| TH-D01 | Unauthenticated API flood      | Rate limiter     | HIGH       | HIGH   | HIGH     | Sliding window per-IP + per-user; Retry-After header; 429 response | MITIGATED |
| TH-D02 | LLM compute exhaustion         | Agent runtime    | MEDIUM     | HIGH   | HIGH     | Per-workspace token budget; per-agent step limit; kill switch      | MITIGATED |
| TH-D03 | Unbounded memory queries       | pgvector HNSW    | MEDIUM     | MEDIUM | MEDIUM   | `LIMIT` enforced server-side; workspace quota; `ef_search` cap     | MITIGATED |
| TH-D04 | Plugin infinite loop           | MCP executor     | LOW        | MEDIUM | MEDIUM   | 30s timeout; circuit breaker; retries capped at 3                  | MITIGATED |
| TH-D05 | Chromium PDF render exhaustion | Document builder | MEDIUM     | MEDIUM | MEDIUM   | Compile-endpoint rate limit; queue depth limit; timeout 60s        | MITIGATED |

### 4.6 Elevation of Privilege

| TH-ID  | Threat                                 | Component       | Likelihood | Impact   | Severity | Mitigation                                                         | Status    |
| ------ | -------------------------------------- | --------------- | ---------- | -------- | -------- | ------------------------------------------------------------------ | --------- |
| TH-E01 | User escalates to workspace admin      | RBAC middleware | LOW        | HIGH     | HIGH     | JWT role immutable; RBAC dependency injection checked per endpoint | MITIGATED |
| TH-E02 | Agent escalates to Tier 4 without HITL | Approval gate   | LOW        | CRITICAL | CRITICAL | `approval_gated_tools()` checked in loop.py; unsigned = DENY       | MITIGATED |
| TH-E03 | Institution admin accesses user memory | Admin routes    | MEDIUM     | HIGH     | HIGH     | ConsentGrant required; purpose-bound; minimum-necessary filter     | MITIGATED |
| TH-E04 | Plugin escalates beyond declared scope | MCP connector   | LOW        | HIGH     | HIGH     | Signed manifest; scope validation at execute time; connector auth  | MITIGATED |
| TH-E05 | Break-glass used without dual approval | PAM system      | LOW        | CRITICAL | HIGH     | Dual-approver workflow; 4h TTL; immutable audit entry              | MITIGATED |

---

## 5. AI-Specific Threat Overlay (OWASP Agentic Top 10)

| OWASP Risk                     | Threat Description                                  | Vaeloom Exposure                         | Control                                                          | Status    |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | --------- |
| AA-01 Goal Hijacking           | Adversarial prompt redirects agent to attacker goal | S2 Gemma 4 via injected document content | [UNTRUSTED_DATA] fencing; S1 Jev triage; system prompt immutable | PARTIAL   |
| AA-02 Tool Misuse              | Agent calls privileged tool outside intent          | Tier 3/4 tools in uncontrolled context   | Tool trust tier; HITL gating; signed approval token              | MITIGATED |
| AA-03 Identity/Privilege Abuse | Agent acquires user-level scope                     | Agent JWT cross-scope bleed              | Agent JWT scoped `iss=vaeloom-agent`; no overlap with user scope | MITIGATED |
| AA-04 Supply Chain             | Malicious plugin/model update                       | Marketplace/MCP connector                | Signed manifest; version pinning; security review queue          | PARTIAL   |
| AA-05 Unexpected Execution     | Consequential action without user knowledge         | Tier 4 tool without approval             | HMAC-signed HITL token required; approval_gated_tools()          | MITIGATED |
| AA-06 Memory/Context Poisoning | Injected false memory retrieved later               | Memory write endpoint                    | Input sanitization; [UNTRUSTED_DATA] markers; source provenance  | PARTIAL   |
| AA-07 Inter-Agent Trust        | Sub-agent blindly trusts orchestrator claim         | Multi-agent orchestration                | Typed AgentCard; no implicit trust; each agent verifies JWT      | MITIGATED |
| AA-08 Cascading Risks          | Failure propagates across agent chain               | 28-agent pipeline                        | Circuit breakers; step budget; kill switch per agent plane       | MITIGATED |

---

## 6. Residual Risk Summary

| Risk                                       | Severity | Residual | Owner              | Target                                |
| ------------------------------------------ | -------- | -------- | ------------------ | ------------------------------------- |
| TH-T05 Prompt injection detection depth    | HIGH     | PARTIAL  | AI Safety Lead     | ENT-P14 — enhanced classifier backlog |
| AA-01 Goal hijacking in adversarial corpus | HIGH     | PARTIAL  | AI Safety Lead     | ENT-P14 — red-team harness            |
| AA-04 Plugin supply chain                  | HIGH     | PARTIAL  | Security Architect | ENT-P19 — marketplace security review |
| AA-06 Memory context poisoning             | MEDIUM   | PARTIAL  | AI Safety Lead     | ENT-P14 — memory audit trail          |

---

_Deliverable DEL-ENT-P13-01 v1.0.0 — Security Architect — 2026-09-29_
