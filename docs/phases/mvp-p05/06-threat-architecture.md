# MVP-P05 — 06. Threat-Informed Architecture (DEL-MVP-P05-04)

> Maps OWASP Agentic Top 10 (2026) and OWASP LLM/GenAI Top 10 against ACTUAL
> repo controls at `master` @ `6e8a7b4` (live-inspected 2026-08-15). Evidence
> labels: **REPO_VERIFIED** (`file:line`), **SOURCE_DERIVED**, **NEW_DESIGN**,
> **STAKEHOLDER_DECISION**, **NOT_EXECUTED**. No fabricated mitigations;
> anything not verified is **UNVERIFIED**. Design-only phase — no code changed.
> Authority: REPO > INT-02 > compendium (01-source-register §1).

## 1. Threat-model scope (first-class paths)

| Path                        | In scope (MVP)                                                                | Primary attacker surface                                        |
| --------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Input / uploads / retrieval | Yes — documents, job descriptions, connector API results                      | Content that can carry injected instructions (INT-02 §8.3 list) |
| Connectors / webhooks       | Yes — `gmail/webhook` is PUBLIC (`middleware/auth.py:21`); connectors/mcp pkg | Unauthenticated webhook payloads; connector result content      |
| Agents / tools              | Yes — 22 agent handlers + orchestrator                                        | Goal hijack via retrieved/tool content; tool misuse             |
| Memory writes               | Yes — `memories`/`memory_records` (ADR-022)                                   | Poisoned content persisted then re-read (LLM06 analogue)        |
| Approval flows              | Yes — `agent_approvals` + `services/approval.py`                              | Decision forgery, payload tampering, expired reuse              |
| Export / deletion           | Yes — gdpr + audit export routers (01-source-register §4)                     | Data exfiltration through authorized export                     |
| Admin / support             | MVP-limited — RBAC + IP allowlist only                                        | Privilege escalation via stolen JWT                             |
| Migrations                  | Yes — DUAL paths (CF-P05-04)                                                  | Migration tampering / RLS misconfiguration                      |

**Trust rule (SOURCE_DERIVED, INT-02 §8.3):** untrusted content never changes
policy. Wraps content in data boundaries; tool authorization only from signed
policy; ignore in-content instructions to change secrets/policy/tool access.

## 2. OWASP Agentic Top 10 (2026) mapping

| Threat                            | Repo control (REPO_VERIFIED path or GAP)                                                                                                                                           | Residual risk                                                                                                                             | Owning phase           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| AAG-01 Agent Goal Hijack          | `middleware/prompt_injection.py:22-40,67-71` regex+base64 filter, 400 + `X-Injection-Detected`; wired `main.py:112`                                                                | Filter evadable; INT-02 §8.3 rules 1–4 (data boundaries, signed policy) not fully enforced                                                | P12                    |
| AAG-02 Tool Misuse                | Per-agent `tools` lists + `default_autonomy="approval_gated"` (`agents/application_agent/handler.py:26-34`)                                                                        | No strict tool-arg schema validation against policy (INT-02 §8.3 rule 5)                                                                  | P11                    |
| AAG-03 Identity / Privilege Abuse | JWT Bearer (`middleware/auth.py:41-54`), RBAC (`middleware/rbac.py`), `require_workspace_access` (`middleware/tenant.py:82-117`)                                                   | `X-Tenant-ID` header is client-supplied, not bound to JWT claim (`tenant.py:42-50`)                                                       | P07 (RLS) / P14        |
| AAG-04 Supply Chain               | **GAP** — no pinned-dependency/integrity gate at MVP baseline (01-source-register §1 P06/P08 pinned versions = NEW_DESIGN)                                                         | Compromised package → arbitrary code in worker                                                                                            | P06 / P08              |
| AAG-05 Unexpected Execution       | Gmail draft-only (`clients/gmail_client.py:129-145` no send); idempotency replay guard (`middleware/idempotency.py:95-99`); approval service exists (`services/approval.py:21-56`) | Approval NOT enforced in agent loop — `request_approval` is a literal string (`handler.py:83`), `approval_manager` never called by agents | P07 / P11              |
| AAG-06 Memory / Context Poisoning | `middleware/prompt_injection.py` input filter only                                                                                                                                 | No output validation before memory writes (INT-02 §8.3 rule 6)                                                                            | P12                    |
| AAG-07 Inter-Agent / Cascading    | Orchestrator module; `infrastructure/circuit_breaker.py:16-97`; `infrastructure/agent_limits.py:53-93`                                                                             | No global quota across subagent chains; cascading failures not bounded                                                                    | P11 / P14              |
| AAG-08 Memory Theft               | App-level scoping (`tenant.py:82-117`) + RLS (`migrations/0005_rls.py:16` — 4 tables)                                                                                              | RLS breadth UNVERIFIED → cross-workspace memory read risk                                                                                 | P07 verify / P14 suite |
| AAG-09 Exfiltration               | CSP/HSTS/nosniff (`middleware/security_headers.py:11-18`), IP allowlist (`middleware/ip_filter.py:42-66`)                                                                          | No egress allowlist / connector DLP; export APIs in-scope                                                                                 | P13                    |
| AAG-10 Jailbreak / Probes         | `prompt_injection.py:22-40,92-100` (incl. base64) + warning log telemetry; INT-02 §8.3 rule 7 (record detection)                                                                   | Evadable probes; red-team coverage not executed                                                                                           | P12                    |

## 3. OWASP LLM/GenAI mapping

| Threat                            | Repo control                                                                               | Status / gap                                            | Owning phase |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------ |
| LLM01 Prompt Injection            | `middleware/prompt_injection.py:22-40,67-71` wired `main.py:112`                           | **REPO_VERIFIED** — filter present; evadable residual   | P12 red-team |
| LLM02 Sensitive Info Disclosure   | App-level scoping + RLS (4 tables) + gdpr/consent routers                                  | Breadth UNVERIFIED; disclosure via retrieval residual   | P07 / P13    |
| LLM03 Supply Chain                | **GAP** — pinned versions = NEW_DESIGN                                                     | NOT_EXECUTED                                            | P06 / P08    |
| LLM05 Improper Output Handling    | **GAP** — no sanitization/validation before render or memory write                         | NOT_EXECUTED (INT-02 §8.3 rule 6)                       | P12          |
| LLM06 Excessive Agency            | Approval contract ADR-021 (design) + `default_autonomy="approval_gated"` (`handler.py:34`) | Service exists but agent-loop enforcement GAP           | P07 / P11    |
| LLM10 Unbounded Consumption / DoS | `agent_limits.py` (RPM=30, concurrency=5) + `agent_costs.py` + `circuit_breaker.py`        | **REPO_VERIFIED** infra; enforcement breadth UNVERIFIED | P10 / P11    |

## 3b. Control verification log (2026-08-15, live inspection)

**REPO_VERIFIED** (exist at HEAD, path cited): prompt-injection filter
(`middleware/prompt_injection.py`), JWT auth + public-path set
(`auth.py:9-25,41-54`), CSRF skip-prefix design (`csrf.py:15`), tenant
middleware + workspace access (`tenant.py:42-50,82-117`), rate limiting w/
Retry-After (`rate_limit.py:20-28,105,155,175`), IP allowlist
(`ip_filter.py:42-66`), security headers (`security_headers.py:11-18`), API
version header (`api_version.py:10`), idempotency + sha256 request hash
(`idempotency.py:37-46,95-99`), agent rate/concurrency limits
(`agent_limits.py:53-117`), per-agent timeouts
(`agent_timeout.py:15-40,92-103`), fallback/retry/cache
(`agent_fallback.py:26-133`), circuit breaker (`circuit_breaker.py:16-97`),
SecretManager protocol + ENCRYPTION_KEY gate (`secrets.py:7-14,65-82`;
`config.py:84,107-108`), approval service w/ expiry (60 min default) + 409
re-decision guard (`services/approval.py:21-56,150-189`), agent cost tracker
(`services/agent_costs.py:53+`), Gmail draft-only (no send)
(`clients/gmail_client.py:129-145`).

**UNVERIFIED / ABSENT (flagged as such, no claim made):** RLS policy breadth
(`0005_rls.py:16` 4 tables; GUC `app.tenant_id` never SET — grep found no
`set_config`/`SET app` outside the migration), approval payload-hash binding (no
`payload_hash` column in `0003_approvals.py:12-27`), approval enforcement in
agent loop (no `approval_manager` caller outside `services/approval.py`),
idempotency coverage breadth, audit hash-chain immutability, field-level
encryption usage, workload identity service tokens (ADR-025), tool-arg schema
validation (INT-02 §8.3 rule 5), output validation before memory writes (INT-02
§8.3 rule 6).

## 4. Trust & isolation threats

- **Cross-workspace leak (app-level scoping + RLS):** app-level
  `require_workspace_access` REPO_VERIFIED (`tenant.py:82-117`). RLS policy
  breadth **UNVERIFIED**: `0005_rls.py:16` covers only
  `memories/events/usage_records/api_keys`; GUC `app.tenant_id` is referenced in
  policy text (`0005_rls.py:29-30`) but **never `SET` anywhere** (grep found no
  `set_config`/`SET app` outside migration) → on Postgres the policy is
  deny-all-if-unset or never exercised (SQLite dev). → **P07 verify + P14
  isolation suite** (ADR-023).
- **Workload identity:** no service-token/HMAC mechanism found — ADR-025 is
  design-only (NEW_DESIGN); worker↔API auth residual. → P07 / P11.
- **Secrets:** `SecretManager` protocol REPO_VERIFIED
  (`infrastructure/secrets.py:7-14`, `:65-82`); `ENCRYPTION_KEY` fetched via
  `get_secret` + length≥32 gate (`config.py:84,107-108`). Field-level encryption
  usage UNVERIFIED. → P07/P13.
- **Audit immutability:** `audit_service.record_event` REPO_VERIFIED
  (`services/audit_service.py:12`), but no hash-chain/WORM; approval decisions
  are `UPDATE` in place (`services/approval.py:162-177`, 409 blocks
  re-decision). → P07 / P11 (ADR-021 immutable decision rows).

## 5. Consequential-action threats

| Threat                          | Evidence                                                                                                                                    | Gap / guard                                                             | Owning phase |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ |
| Unapproved job submission       | `application_agent/handler.py:66-91` — `has_approval=True` flips status to `submitted` directly; `approval_manager` never invoked by agents | Approval gate not enforced → GAP                                        | P07 / P11    |
| Gmail send escalation           | `gmail_client.py:129-145` create_draft/list_drafts only — **no send**                                                                       | Draft-only guard REPO_VERIFIED (DEC-P01-03); send gated on T3 (ADR-021) | P07 / P11    |
| Credential replay               | Idempotency replay guard (`idempotency.py:95-99` 422 on diff payload) + `agent_approvals` 409                                               | Idempotency breadth UNVERIFIED                                          | P07          |
| Unsupported scraping / anti-bot | Gmail start_watch polling (DEC-P02-01); no scraping endpoints                                                                               | Policy S-02/S-03 (SOURCE_DERIVED) — compliance, not code                | P13          |
| Payload tampering               | `agent_approvals.payload` stored raw (`0003_approvals.py:12-27` — **no `payload_hash` column**)                                             | Payload-hash binding UNVERIFIED / ABSENT → GAP                          | P07 / P11    |

## 6. Residual risk register

| #    | Threat                                        | Sev  | Current mitigation                                                  | Owner    | Phase            | Status |
| ---- | --------------------------------------------- | ---- | ------------------------------------------------------------------- | -------- | ---------------- | ------ |
| R-01 | Approval gate bypass on consequential actions | CRIT | Draft-only Gmail + approval_gated literal (UNVERIFIED enforcement)  | Security | P07/P11          | OPEN   |
| R-02 | Cross-workspace memory leak                   | HIGH | App-level scoping; RLS 4 tables, GUC never SET                      | Security | P07 verify / P14 | OPEN   |
| R-03 | Workload identity absent (ADR-025)            | HIGH | None in repo (NEW_DESIGN)                                           | Security | P07/P11          | OPEN   |
| R-04 | Prompt-injection filter evadable              | MED  | `prompt_injection.py` + telemetry                                   | Security | P12              | OPEN   |
| R-05 | Payload tampering / decision immutability     | MED  | 409 re-decision; no hash binding                                    | Security | P07/P11          | OPEN   |
| R-06 | Supply chain (unpinned deps)                  | MED  | None (NEW_DESIGN)                                                   | DevEx    | P06/P08          | OPEN   |
| R-07 | Model cost / DoS enforcement breadth          | MED  | `agent_limits`/`agent_costs`/`circuit_breaker` (UNVERIFIED breadth) | Platform | P10/P11          | OPEN   |
| R-08 | Audit immutability (no hash-chain)            | MED  | `audit_service.record_event`                                        | Security | P07/P11          | OPEN   |
| R-09 | Tool-arg schema validation absent             | MED  | Per-agent tool lists                                                | Security | P11              | OPEN   |
| R-10 | RLS migrations dual-path drift (CF-P05-04)    | LOW  | Single path P07                                                     | Platform | P07              | OPEN   |

No fabricated mitigations: every mitigation above is REPO_VERIFIED,
UNVERIFIED-flagged, or NEW_DESIGN. MVP scope only; enterprise controls deferred.
