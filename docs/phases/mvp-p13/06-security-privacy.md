# MVP-P13 — 06. Security, Privacy, and Governance

> **Phase:** MVP-P13 — Security, Privacy, and Compliance  
> **Date:** 2026-08-22 · **Baseline:** `0feb7ff`

## Security Architecture

Validated against `docs/security/Security-Architecture.md` (versioned
2026-07-13, owned Security Team).

### Defense-in-Depth Layers

```
Internet → Load Balancer → CORS (outermost) → IPAllowlist (conditional) → RateLimit → Idempotency
  → PromptInjection → APIVersion → RequestLogging → CorrelationID → SecurityHeaders → CSRF → Auth (JWT) → Tenant (RLS) → Router → Service (encryption, consent, GDPR, approval) → DB (RLS) → Redis/MinIO
```

Middleware order verified in `apps/api/src/api/main.py:170` — CORS outermost
(last added), Tenant inner than Auth (protects RLS).

### Controls by STRIDE

- **Spoofing** — JWT `exp/sub` required (`auth.py`), short-lived 3600s,
  `validate_settings()` rejects weak secret
- **Tampering** — CSRF HMAC-SHA256 double-submit, approval payload HMAC +
  expiry, vector DB provenance
- **Repudiation** — Immutable audit `audit_service` (actor, action, target,
  timestamp, correlation ID)
- **Info Disclosure** — RLS workspace-scoping, BYOK/connector Fernet, `Mask`
  hints, never in logs, CORS restricted origins/methods
- **DoS** — Rate limiter sliding window 100rpm, per-agent token bucket 30rpm,
  queue backpressure
- **Elevation** — Least privilege per endpoint, RBAC `require_role`, GitHub
  fine-grained perms, Gmail draft-only

## Privacy Impact Assessment (DPIA)

`DEL-MVP-P13-02` part 1 — full doc `docs/security/DPIA.md` v1.0 (2026-08-21,
owner Privacy Engineer).

| Aspect       | Detail                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | ingest→organize→remember→assist; 8 agents memory-first, suggest-mode-first                                                                                                          |
| Categories   | Identity (email), Auth (hash, JWT), Professional (resume), Behavioral (agent, search), Communications (email via integration), Financial (billing/API keys), System (audit, tenant) |
| Subjects     | Platform users, job applicants (resume parsing), contacts (email/calendar)                                                                                                          |
| Lawful basis | Consent (data_processing, agent_access), contract, legitimate interest (job matching until withdrawn)                                                                               |
| Retention    | 90 days operational default, tenant-configurable per `Data-Retention-Policy.md`                                                                                                     |
| Residency    | Deployment region (no cross-border default), EU/US/India options via `Compliance.md`                                                                                                |
| Cross-border | None by default; BYOK memory→provider per user choice (provider DPA applies, consent-language review per RISK-P12-10)                                                               |
| Rights       | Export 12 tables (`gdpr.py`), delete anonymize, rectify via Memory Graph editor, restrict via per-agent autonomy, portability JSON                                                  |

## AI Governance

`DEL-MVP-P13-02` part 2 — `docs/security/AI-Governance.md` v1.0.

| Area               | Control                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| System description | 8 agents orchestrated via LLM, memory/knowledge graph, document ingest, chat                                                       |
| Providers          | Anthropic Claude Sonnet 4/Opus 4 (reasoning), OpenAI GPT-4o/mini + embeddings, Ollama local dev                                    |
| Config             | temperature 0.7, max_tokens 4096, top_p 1.0, per-agent model selection                                                             |
| NIST AI RMF        | Govern (oversight, residual-risk owner), Map (context), Measure (evals 12 cases), Manage (kill switches, fallback) — mapped in doc |
| Prohibited         | Fabrication via `llm_validator.py` adversarial detection; unlawful protected-attribute inference blocked                           |
| Classification     | EU AI Act NOT high-risk (productivity tool, not hiring decision), transparency from 2026-08-02 via disclosure                      |
| Human oversight    | Suggest-mode-first, consequential actions require immutable payload-bound expiring approval + idempotency                          |
| Residual risk      | Regex-only adversarial (P14 LLM classifier), BYOK provider policy leakage (documented, consent review)                             |

## Compliance Mapping

`DEL-MVP-P13-04` — `docs/security/Compliance.md`, `GDPR.md`, `SOC2.md`,
`Privacy.md` + phase-specific overlay below.

| Regulation                           | Scope                                                                          | Status                                                                     | Evidence                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| **GDPR**                             | EU users, data subject rights (access, erasure, portability, restrict, object) | Designed-in, not self-certified (REQUIRES_PROFESSIONAL_REVIEW)             | `GDPR.md` + `services/gdpr.py` export/delete + `DPIA.md` |
| **India DPDP Act 2023 + Rules 2025** | Notice/consent, rights, children's data, breach duties — staged commencement   | Designed-in, verify provisions in force                                    | `Compliance.md`, `DPIA.md`, `Privacy.md`                 |
| **FERPA**                            | Institution-controlled education records                                       | Planned Phase 7, not MVP — excluded scope                                  | `Compliance.md` — institution roles not in MVP           |
| **COPPA**                            | Under-13 exclusion or separately reviewed child-directed design                | Excluded unless separately reviewed child service approved (§3 truth rule) | `Compliance.md`, age policy in `Privacy.md`              |
| **EU AI Act**                        | Transparency obligations from 2026-08-02, other timelines re-verify            | Transparency met via AI disclosure; no high-risk classification for MVP    | `AI-Governance.md`, `Compliance.md`                      |
| **SOC 2**                            | Enterprise customers                                                           | Planned V2/V3 — MVP no formal certification                                | `SOC2.md` roadmap                                        |
| **CCPA**                             | California users                                                               | Compatible via GDPR-ready design                                           | `Compliance.md`                                          |

**Never self-claim compliance** — all mappings are `professional-review inputs`
per §16.

## Identity, Consent, Data Rights

`DEL-MVP-P13-03` — detailed in WS-13.3.

- **Identity:** Single-user product but every artifact workspace-scoped;
  `get_current_user` derives `user_id`/`tenant_id` from JWT; `workspace_id` from
  token or path param validated against ownership.
- **Consent:** 3 scopes, `consent_records` table (`id`, `user_id`, `tenant_id`,
  `scope`, `granted_at`, `revoked_at`, `ip_address`), endpoints
  `GET /consent/scopes` (public), `POST /consent/grant`, `POST /consent/revoke`,
  `GET /consent/list` (private). Added to `auth.py:PUBLIC_PATHS`.
- **Data rights:** `POST /gdpr/export` → `DataExportResponse` (12 tables,
  workspace-aware for connectors), `POST /gdpr/delete` → anonymize + cascade,
  `GET /consent/list` → proof of basis. Tests `test_privacy_flows.py:11`.
- **Processor mapping:** Auth provider (JWT), Anthropic/OpenAI (BYOK, user's
  DPA), Google Gmail (push-watch 7-day), GitHub (fine-grained) — `Compliance.md`
  register.

## Key/Secrets Lifecycle

`docs/security/Secrets.md` + `Encryption.md`.

- **Key types:** JWT secret (HS256, ≥32 chars), Fernet key (SHA256-derived
  32-byte), provider keys (BYOK Fernet), OAuth tokens (access+refresh)
- **Rotation:** BYOK `rotate` endpoint rotates Fernet payload, audit logs
  rotation; `ENCRYPTION_KEY` via Infisical rotation path exercised in tests
- **Break-glass:** `admin_console` + `audit` trail, not CSRF-bypass; RLS
  fail-closed on missing context
- **Storage:** Infisical SecretManager or env, never in code/logs,
  `communication.py` masks `sk-*`, `ghp_*`, etc.

## Threat-Specific Deep Dive (§13 phase rule)

| Threat               | Modeling                                           | Control                                                                                                                 | Test                                           |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Injection**        | `Threat-Model.md` STRIDE Tampering + OWASP A03     | `prompt_injection.py` 14 patterns + base64 + override; `llm_validator.py` adversarial                                   | `test_prompt_injection.py:29`                  |
| **Memory poisoning** | Retrieval poisoning via untrusted documents/emails | Workspace-scoped RAG, provenance `provenance_service.py`, no cross-tenant context                                       | `test_tenant_isolation.py:6` + retrieval tests |
| **Connector tokens** | OAuth token leakage, replay                        | `secrets.py` encrypted at rest, `google-auth` PKCE + state, not in logs                                                 | `test_auth.py`, secrets masking review         |
| **Replay**           | JWT replay, approval replay, SAML auth-code replay | JWT `exp` 3600s + `jti` (if present), approval `expires_at` + idempotency key, SAML assertion expiry (signxml enforced) | `approval.py` expiry, `test_csrf.py`           |
| **Isolation**        | Cross-workspace access, confused deputy            | RLS `SET LOCAL` + service-layer `workspace_id` check on every query                                                     | `test_tenant_isolation.py`                     |
| **Deletion**         | Retention, legal hold, backup expiry               | Primary delete vs backup expiry distinction, correction/supersession history, `Data-Retention-Policy.md`                | `test_gdpr.py` delete + re-export              |

## Maturity and Coverage

- **Total security tests:** 233/233 pass (172 pre-P13 + 61 new) — de-duplicated
  170 unique (middleware duplicates security F-02)
- **Docs:** 17 files under `docs/security/` enterprise quality (all upgraded,
  file counts verified) — `DPIA.md` status now DRAFT pending DPO (F-10),
  Threat-Model assets now include BYOK provider_keys + document_chunks (F-17)
- **Coverage:** 94% total per `AGENTS.md` (2555 tests, 2459 pass — was stale
  2527 fixed F-01, debug_test removed)
- **Gaps carried:** RLS 37/42 tables (5 via service filters:
  `users, agents, permissions, provider_keys, document_actions` not RLS — was
  stale 4/36 fixed F-04; 0019 now fail-closed F-05), IP allowlist ALWAYS mounted
  conditional no-op when empty (was stale NOT MOUNTED fixed F-18), starlette CVE
  (must-fix pre-prod), input sanitization ADR-031 designed but not fully wired
  (F-11: 0019 docstring corrected to honest "Middleware deferred to P14; service
  coverage NOT verified"), CSRF multi-worker in-memory (F-06 EXC-P13-07), GDPR
  12→30 tables expanding (F-09), prompt injection JSON-only + ingestion bypass
  (F-08)
