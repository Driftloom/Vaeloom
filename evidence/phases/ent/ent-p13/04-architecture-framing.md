# ENT-P13 Architecture Framing — Security, Privacy, and Compliance

**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** Security Architect  
**Reviewer:** CISO + Privacy Engineer  
**Date:** 2026-09-29

---

## 1. Security Architecture Topology

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          VAELOOM ENTERPRISE SECURITY TOPOLOGY                    │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                          PERIMETER LAYER                                   │  │
│  │  WAF (rate-limit + IP reputation) → TLS 1.3 → CORS (origin whitelist)     │  │
│  └──────────────────────────────┬─────────────────────────────────────────────┘  │
│                                 │                                                │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐  │
│  │                       AUTHENTICATION LAYER                                  │  │
│  │  JWT RS256 (validate → exp → iss → aud → nonce)                            │  │
│  │  PKCE OAuth 2.0 → Google / Microsoft OIDC → SAML 2.0 (ENT-P16)            │  │
│  │  SCIM 2.0 → per-org rotating bearer token                                  │  │
│  └──────────────────────────────┬─────────────────────────────────────────────┘  │
│                                 │                                                │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐  │
│  │                    AUTHORIZATION LAYER                                      │  │
│  │  RBAC (5 roles) → ABAC (purpose_code + region + time_bound)                │  │
│  │  ConsentGrant check → TenantMiddleware → set_rls_session_vars()            │  │
│  └──────────────────────────────┬─────────────────────────────────────────────┘  │
│                                 │                                                │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐  │
│  │                     DATA ISOLATION LAYER                                   │  │
│  │  PostgreSQL RLS 42/42 FORCE → GUC fail-closed                              │  │
│  │  Region-pinned cell routing → no cross-cell query                          │  │
│  │  AES-256-GCM per-workspace DEK → KMS lifecycle                             │  │
│  └──────────────────────────────┬─────────────────────────────────────────────┘  │
│                                 │                                                │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐  │
│  │                       AI SAFETY LAYER                                      │  │
│  │  S1 Jev triage → [UNTRUSTED_DATA] fencing → S2 Gemma 4                    │  │
│  │  HITL HMAC-SHA256 approval → Tier 4 gating                                 │  │
│  │  4 kill switches → agent registry enforcement                              │  │
│  └──────────────────────────────┬─────────────────────────────────────────────┘  │
│                                 │                                                │
│  ┌──────────────────────────────▼─────────────────────────────────────────────┐  │
│  │                      AUDIT & COMPLIANCE LAYER                              │  │
│  │  Append-only S3 WORM audit log → hash chaining                            │  │
│  │  OTel GenAI spans → SIEM correlation                                       │  │
│  │  Privacy rights API → DPIA v2.0 → breach response 72h                     │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Security Invariants

These invariants are the non-negotiable security guarantees that must hold at
every layer. Violation of any invariant is a CRITICAL blocker and must trigger
immediate remediation.

### INV-SEC-01: Zero Implicit Trust

> **Every API request — regardless of source — must present a valid JWT,
> validated by the auth middleware chain (CORS → CSRF → rate-limit → JWT →
> Tenant → RLS), before any resource access is granted. Internal
> service-to-service calls are not exempt.**

**Enforcement:** Auth middleware covers 100% of private routes;
`test_noauth_private.py` verifies 241 routes return 401 without valid JWT.

### INV-SEC-02: Tenant Isolation is Absolute

> **No query path may return data from a tenant other than the authenticated
> tenant, regardless of user role or privilege level. PostgreSQL RLS with GUC
> fail-closed (`set_rls_session_vars()`) is the enforcement mechanism. Failure
> to set GUCs returns zero rows.**

**Enforcement:** 42/42 FORCE RLS; `test_rls_live_pg.py` proves cross-tenant
isolation on real PostgreSQL.

### INV-SEC-03: Individual Memory Sovereignty

> **User memories are owned by the individual. No institutional admin, platform
> admin, or agent may read user memory without an active, explicit,
> purpose-bound ConsentGrant. ConsentGrant revocation takes effect immediately
> and triggers DEK rotation within 30 days.**

**Enforcement:** `ConsentGrant` model; `routes/consent.py`; memory retrieval
pipeline checks grant before serving.

### INV-SEC-04: Consequential Actions Require Human Approval

> **No Tier 4 (consequential) tool — job application, financial transaction,
> data deletion, external communication — may be executed without a valid
> HMAC-SHA256 signed approval token issued by an authenticated user. Unsigned =
> DENY.**

**Enforcement:** `approval_gated_tools()` in `services/loop.py`;
`test_approval_gate.py` verifies denial.

### INV-SEC-05: Cryptographic Erasure Guarantees Inaccessibility

> **When a user exercises their right to erasure, the workspace DEK is rotated
> within 30 days. After DEK destruction, all data encrypted under the old DEK —
> including backups — is permanently inaccessible. This is the only mechanism
> that satisfies GDPR Art.17 and DPDP erasure obligations.**

**Enforcement:** `04-crypto-erasure-kms.md` DEK lifecycle;
`test_crypto_erasure.py` verifies inaccessibility.

---

## 3. Defense-in-Depth Matrix

| Threat                 | Layer 1 (Perimeter) | Layer 2 (Auth)       | Layer 3 (AuthZ)  | Layer 4 (Data)         | Layer 5 (AI)      |
| ---------------------- | ------------------- | -------------------- | ---------------- | ---------------------- | ----------------- |
| Unauthenticated access | Rate-limit + WAF    | JWT validation → 401 | —                | —                      | —                 |
| Cross-tenant access    | CORS origin         | JWT tenant claim     | RLS GUC          | FORCE RLS              | —                 |
| Prompt injection       | Input sanitization  | —                    | —                | [UNTRUSTED_DATA] fence | S1 triage         |
| Goal hijacking         | —                   | —                    | HITL gate        | —                      | Tier 4 deny       |
| Data exfiltration      | Egress allow-list   | Workspace scope      | ConsentGrant     | DEK encryption         | Plugin scope      |
| Memory poisoning       | Input length limit  | —                    | Write owner-only | SHA-256 hash           | Source provenance |

---

## 4. Compliance Readiness Summary

| Framework              | Readiness                                        | Professional Review           | Notes                           |
| ---------------------- | ------------------------------------------------ | ----------------------------- | ------------------------------- |
| GDPR (EU)              | HIGH — controls designed and implemented         | Required before certification | DPA with sub-processors needed  |
| India DPDP 2025        | MEDIUM — core controls; data nominee TBD         | Required                      | ENT-P15 backlog                 |
| FERPA                  | HIGH — institution-record tagging; ConsentGrant  | Required                      | Education record identification |
| COPPA                  | LOW — age gate designed; not implemented         | Required                      | ENT-P16 backlog                 |
| EU AI Act              | MEDIUM — classification done; disclosure TBD     | Required                      | Legal review pending            |
| NIST AI RMF            | HIGH — Govern/Map/Measure/Manage mapped          | Informational                 | No certification needed         |
| OWASP Agentic Top 10   | HIGH — 5/8 MITIGATED; 3 PARTIAL                  | Informational                 | Residual tracked                |
| SOC 2 Type II (target) | LOW — controls designed; no audit                | Required for enterprise sales | External audit ENT-P19          |
| SLSA v1.2              | MEDIUM — CI/CD pipeline in place; provenance TBD | Informational                 | ENT-P16                         |

> [!WARNING] No compliance framework listed above is self-declared as certified.
> Professional legal and audit review is mandatory before any certification
> claim.

---

_Architecture framing v1.0.0 — Security Architect — 2026-09-29_
