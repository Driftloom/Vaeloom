# MVP-P13 — 03. Workstreams

> **Phase:** MVP-P13 — Security, Privacy, and Compliance  
> **Date:** 2026-08-22 · **Baseline:** `0feb7ff`

## WS-13.1: Threat/Abuse Modeling

**Owner:** Security Architect · **Status:** VERIFIED

### Objective

Create system/data/agent/plugin/tenant threat and abuse models per §12 task 1 +
§16. Cover STRIDE for Vaeloom's 4 layers (external → public services → internal
→ data stores → external deps).

### Inputs

- `docs/security/Threat-Model.md` (STRIDE, assets, attack surface, mitigations)
- `docs/security/Security-Architecture.md`, `docs/security/OWASP.md`,
  `docs/security/Secrets.md`
- Architecture `02-system-architecture.md` (Next.js 15 / FastAPI monolith /
  Postgres pgvector / Redis / MinIO)
- Agent workflow `03-agent-workflow.md` (10-step loop, approval gate)

### Deliverable

`DEL-MVP-P13-01` — threat models: versioned, owned, reviewed, linked.

| Asset                         | Sensitivity | STRIDE                               | Mitigation                                                                                 | Evidence                                                         |
| ----------------------------- | ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| User documents / Memory graph | High        | Spoofing, Tampering, Info Disclosure | `TenantMiddleware` workspace_id from JWT, RLS `SET LOCAL app.tenant_id`, Permission Engine | `middleware/tenant.py:41` `set_rls_session_vars`                 |
| OAuth tokens (Gmail, GitHub)  | Critical    | Info Disclosure, Elevation           | Secrets Manager / Fernet encryption, never in logs, `communication.py` masking             | `services/encryption.py:1`                                       |
| AI API keys (BYOK)            | Critical    | Disclosure, Tampering                | Per-workspace Fernet, masked hints, rotation, no plaintext in API/logs                     | `services/provider_key_service.py`, `0016_provider_keys_byok.py` |
| Agent action logs             | Medium      | Repudiation                          | Immutable audit `audit_service` with trail                                                 | `services/audit_service.py`                                      |
| Connector permissions         | Medium      | Elevation, Abuse                     | Least privilege, fine-grained GitHub App perms, Gmail push-watch renewal                   | `docs/security/IAM.md`                                           |

**Phase-specific threat modeling:** injection (prompt + tool), memory poisoning
(retrieval poisoning §4), connector token replay, isolation (cross-workspace),
deletion (GDPR erasure) — all mapped in `docs/security/Threat-Model.md` +
verified via tests (§5).

### Acceptance

- [x] Assets classified (CIA priority) — `docs/security/Threat-Model.md:Assets`
- [x] STRIDE mapping with cross-cutting mitigations
- [x] Phase-specific rule: injection, memory poisoning, connector tokens,
      replay, isolation, deletion all modeled
- [x] Versioned, owned (Security Team), last updated 2026-07-12/2026-08-22,
      reviewed

### Tests

- Prompt injection: `tests/security/test_prompt_injection.py:29` tests (14
  patterns + base64 + override)
- Tenant isolation: `tests/security/test_tenant_isolation.py:6` tests
- Approval replay/tampering implicitly via `approval.py` immutable payload-bound
  expiring approvals

### Risks

- RISK-MVP-P13-01 (docs mistaken for runtime) — mitigated by runtime evidence
  labels

---

## WS-13.2: IAM/Isolation/Secrets

**Owner:** IAM Engineer · **Status:** VERIFIED

### Objective

Implement least privilege, workload identity, secrets, encryption, keys and
segregation per §12 task 2 + §16.

### Inputs

- `apps/api/src/api/middleware/tenant.py` (TenantContext, set_rls_session_vars)
- `apps/api/src/api/middleware/auth.py` (JWT, PUBLIC_PATHS, SSO prefixes)
- `apps/api/src/api/middleware/rbac.py`, `ip_filter.py`
- `apps/api/src/api/services/encryption.py` (Fernet)
- `apps/api/src/api/infrastructure/secrets.py` (SecretManager / Infisical)

### Changes Verified (existing, no new code needed beyond P12)

| File                             | Control                                                                                                                                                                                   | Evidence                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `middleware/tenant.py:1`         | Workspace/tenant isolation via `tenant_context` ContextVar, `SET LOCAL app.tenant_id` (transaction-scoped for PgBouncer)                                                                  | EVD-P13-001                                                                        |
| `middleware/auth.py:1`           | AuthN via JWT `exp/sub` required, PUBLIC_PATHS (`/health`, `/csrf-token`, `/api/v1/auth/*`, `/api/v1/consent/scopes`, `/api/v1/gmail/webhook`), SSO prefix passthrough, OPTIONS preflight | EVD-P13-002                                                                        |
| `middleware/csrf.py:1`           | CSRF double-submit cookie, HMAC-signed token, 3600s TTL, mutating methods gated, SKIP_PATHS/SKIP_PREFIXES                                                                                 | EVD-P13-003                                                                        |
| `middleware/ip_filter.py:1`      | IP allowlist with CIDR parsing, bypass paths for health/auth                                                                                                                              | EVD-P13-004 — mounted conditionally `main.py:188` when `settings.ip_allowlist` set |
| `services/encryption.py:1`       | Fernet encrypt/decrypt for connector + BYOK keys, key derived from `settings.encryption_key`                                                                                              | EVD-P13-005                                                                        |
| `infrastructure/secrets.py`      | SecretManager protocol, Infisical/fallback, auto-wire via `INFISICAL_ENABLED`                                                                                                             | EVD-P13-006                                                                        |
| `config.py`                      | `validate_settings()` fails fast on default/weak `jwt_secret`/`encryption_key`                                                                                                            | EVD-P13-007                                                                        |
| `middleware/rate_limit.py`       | Sliding window, per-endpoint decorator, Retry-After                                                                                                                                       | EVD-P13-008                                                                        |
| `middleware/security_headers.py` | Security headers (CSP, HSTS, X-Frame-Options)                                                                                                                                             | EVD-P13-009                                                                        |

### Isolation Verification

- RLS on 37/42 tables enforced via `TenantMiddleware` (inner than Auth) —
  `main.py:177` ordering fixes RLS never-set bug (audit CRITICAL 2026-08-21);
  `0010` 34 + `0019` 3 =37, was stale 4/36 fixed F-04, 0019 now fail-closed
  F-05. Remaining 5 non-RLS tables
  (`users, agents, permissions, provider_keys, document_actions`) use
  service-layer workspace filters (see `08-registers.md` gap).
- `alembic/versions/0009`–`0014` enforce RLS policies with `workspace_id` GUCs.

### Acceptance

- [x] Least privilege on all endpoints (Permission Engine per-endpoint)
- [x] Workload identity via JWT `tenant_id` + `workspace_id` → RLS GUCs
- [x] Secrets encrypted at rest (Fernet) + via SecretManager
- [x] Fail-closed: missing tenant_id → zero rows (RLS)

### Tests

- `test_tenant_isolation.py:6` (cross-user, modify/delete, unauth)
- `test_noauth_private.py:90` (PUBLIC_PATHS sorted, deterministic)
- `test_auth.py`, `test_rbac.py` (existing 172 tests)

---

## WS-13.3: Privacy/Consent/Rights

**Owner:** Privacy Engineer · **Status:** VERIFIED

### Objective

Implement consent/purpose, minimization, retention, rights, age policy and
processors per §12 task 3 + §17.

### Inputs

- `services/consent.py` (ConsentManager, 3 scopes, grant/revoke/list)
- `services/gdpr.py` (GDPRService, 12 tables export + anonymize delete)
- `docs/security/DPIA.md`, `docs/security/GDPR.md`, `docs/security/Privacy.md`,
  `docs/security/Data-Retention-Policy.md`
- `models/schema.py` (`consent_records` table)

### Controls

| Control          | Implementation                                                                                                                               | Evidence                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Consent/purpose  | 3 scopes: `data_processing`, `agent_access`, `email_marketing`; `consent_records` with `granted_at`, `revoked_at`, `ip_address`, `tenant_id` | `services/consent.py:1`                     |
| Minimization     | Only 12 ALLOWED_TABLES exported; `EXPORT_COLUMNS` per table; service-layer filters                                                           | `services/gdpr.py:10`                       |
| Rights — export  | `export_user_data` iterates `USER_TABLES` with workspace-aware join for connectors                                                           | `services/gdpr.py:30`                       |
| Rights — erasure | Anonymize via `UPDATE users SET email='deleted_<id>'` + cascade delete via FK `ondelete=CASCADE` in migrations 0015/0016                     | `services/gdpr.py`, `alembic/versions/0015` |
| Retention        | `retention_policies` config, `Audit-Policy.md`, `Data-Retention-Policy.md` (90-day operational default, tenant-configurable)                 | `docs/security/Data-Retention-Policy.md`    |
| Age policy       | Under-13 excluded unless separately reviewed child-directed service approved (truth rule §3)                                                 | `docs/security/Privacy.md`                  |
| Processors       | Anthropic/OpenAI (BYOK, user's provider DPA), Google (Gmail), GitHub — mapped in `Compliance.md` processor register                          | `docs/security/Compliance.md`               |

### Acceptance

- [x] Consent grant/revoke/list with public `/consent/scopes` endpoint (added to
      `PUBLIC_PATHS` — `auth.py:13`)
- [x] GDPR export (12 tables) + delete (anonymize) verified via tests
- [x] Retention policy documented and versioned
- [x] DPIA v1.0 complete `docs/security/DPIA.md` (processing purpose,
      categories, subjects, retention, cross-border)

### Tests

- `test_privacy_flows.py:11` (consent grant/revoke/list/scopes/auth, GDPR
  export/delete, cross-user deletion)
- `test_gdpr.py` (existing suite — export + delete flows)

---

## WS-13.4: AI/Regulatory Governance

**Owner:** AI Safety Lead + Compliance Specialist · **Status:** VERIFIED

### Objective

Classify AI use cases; prohibit fabrication and unlawful protected-attribute
inference; map GDPR, DPDP, FERPA, COPPA, EU AI Act via professional-review
inputs per §12 task 4 + §16.

### Inputs

- `services/llm_validator.py` + `infrastructure/agent_eval.py` (adversarial
  detection)
- `middleware/prompt_injection.py` (14 patterns + base64 + override)
- `docs/security/AI-Governance.md`, `docs/security/Compliance.md`,
  `docs/security/SOC2.md`, `docs/security/DPIA.md`

### Controls

| Requirement                           | Map                                                                                                                                                       | Evidence                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| NIST AI RMF Govern/Map/Measure/Manage | `AI-Governance.md` §2–§5 maps each to Vaeloom controls (human oversight, residual-risk ownership)                                                         | `docs/security/AI-Governance.md`         |
| EU AI Act                             | MVP use-cases classified as **not high-risk** (productivity assistance, not hiring decision); transparency obligations from 2026-08-02 met via disclosure | `docs/security/Compliance.md`            |
| India DPDP Rules 2025                 | Notice/consent, rights, children's data, breach duties — staged commencement noted                                                                        | `docs/security/Compliance.md`, `DPIA.md` |
| FERPA/COPPA                           | Under-13 excluded, institution-controlled roles not in MVP scope                                                                                          | `docs/security/Compliance.md`            |
| Prohibited inference                  | No protected-attribute inference without approval; `llm_validator.py` blocks fabrication triggers                                                         | `services/llm_validator.py`              |
| Model/policy versioning               | `model_router.py` catalog pinned, prompt/tool versions recorded                                                                                           | P12 DEL-04                               |

### Acceptance

- [x] AI use-cases classified, documentation complete
- [x] Prohibited behaviors enumerated and blocked via validator
- [x] Never self-claim compliance — all mappings marked
      `REQUIRES_PROFESSIONAL_REVIEW` in `08-registers.md`
- [x] `AI-Governance.md` v1.0 + `Compliance.md` enterprise quality

### Tests

- `test_prompt_injection.py:29` (safe vs malicious payloads)
- `test_agent_eval_execution.py:9` (eval framework 12 cases through
  orchestrator)

---

## WS-13.5: Security Testing/Incidents

**Owner:** Application Security Engineer · **Status:** VERIFIED

### Objective

Create incident/breach/evidence/vulnerability/exception governance and
independent testing per §12 task 5 + §18.

### Inputs

- `docs/security/Penetration-Test-Procedure.md`,
  `docs/security/Audit-Policy.md`, `docs/security/Audit-Logs.md`
- `docs/security/SOC2.md` (incident response, breach notification)
- Existing SAST/SCA fixtures

### Governance

- **Vulnerability:** `bandit` SAST + `pip-audit` SCA on every gate;
  `SECURITY.md` reporting, fix SLAs
- **Incident/Breach:** `SOC2.md` § Incident Response (severity, escalation, 72h
  GDPR breach), `Audit-Logs.md` immutable trail
- **Exception:** `08-registers.md` exceptions with owner, controls, expiry,
  monitoring, prohibited downstream work
- **Independent testing:** 233 security tests + bandit + pip-audit + manual
  review (see `05-test-results.md`)

### Acceptance

- [x] Incident/breach/evidence/vulnerability/exception governance documented
- [x] Independent testing executed (see §18
      SAST/DAST/SCA/secrets/IaC/container/auth/isolation/privacy/red-team)
- [x] Evidence records command, env, commit, config, dataset/version, result,
      timestamp, owner, immutable path

### Tests

- Full security suite: `tests/security/` — 233 tests (172 pre-existing + 61 new
  in P13)
- Additional isolates: `test_sql_injection.py`, `test_xss.py`,
  `test_rate_limiting.py`

---

## Cross-WS Traceability

| Workstream | Requirement      | Deliverable                   | Evidence                                                   |
| ---------- | ---------------- | ----------------------------- | ---------------------------------------------------------- |
| WS-13.1    | MVP-P13-R03      | DEL-01 threat models          | `docs/security/Threat-Model.md` + EVD-P13-010              |
| WS-13.2    | MVP-P13-R03      | DEL-03 controls               | `apps/api/src/api/middleware/*` + EVD-P13-001..009         |
| WS-13.3    | MVP-P13-R03, R06 | DEL-02 privacy/AI IA + DEL-03 | `services/consent.py`, `gdpr.py`, `DPIA.md` + EVD-P13-011  |
| WS-13.4    | MVP-P13-R03, R06 | DEL-02 + DEL-04               | `AI-Governance.md`, `Compliance.md` + EVD-P13-012          |
| WS-13.5    | MVP-P13-R04, R05 | DEL-05 test decision          | `05-test-results.md` + bandit/pip-audit + EVD-P13-013..018 |
