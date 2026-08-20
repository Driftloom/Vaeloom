# MVP-P12 — 06. Security, Privacy, and AI Safety Assessment

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation  
> **Date:** 2026-08-20

## Security Assessment

### OWASP Agentic Applications Top 10 (2026) Coverage

Taxonomy verified 2026-08-20: identifiers are **ASI01–ASI10** (published
2025-12-09). The wave-1 report used incorrect A1–A8 labels; corrected below.

| #     | Risk                       | P12 Mitigation                                                                                                                        | Status                                      |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| ASI01 | Unbounded Agency           | Approval gate for consequential actions; suggest-mode-first autonomy; per-agent + global kill switches                                | ✅ IMPLEMENTED                              |
| ASI02 | Insecure Input Handling    | Adversarial prompt detection (4 categories, 14 patterns) wired into LLM validator and orchestrator router; executed via 12-case eval  | ✅ IMPLEMENTED                              |
| ASI03 | Broken Tooling             | Rate limiter + timeout bound tool execution; circuit breaker stops cascading tool failures                                            | ✅ IMPLEMENTED                              |
| ASI04 | Agent Identity Confusion   | Orchestrator routes only to canonical 8 agents; non-canonical agent types logged as warnings                                          | ✅ IMPLEMENTED                              |
| ASI05 | Unbounded Memory Access    | Workspace-scoped isolation (ADR-013 RLS); memory list filters (workspace_id); superseded/deleted status handling; provenance metadata | ✅ IMPLEMENTED                              |
| ASI06 | Insecure Communication     | TLS at transport layer (existing); provider keys never leave encrypted at rest; no plaintext in logs or API responses                 | ✅ IMPLEMENTED                              |
| ASI07 | Prompt Injection           | `PromptInjectionMiddleware` (existing) + adversarial detection in eval module + LLM validator integration                             | ✅ ENHANCED                                 |
| ASI08 | Unbounded System Awareness | Context window management truncates oversized retrieval; chunking metadata preserves provenance; no new system-information surface    | ✅ IMPLEMENTED                              |
| ASI09 | Agent-to-Agent Collusion   | Canonical agent set only; kill switches per agent; metrics recorded per agent invocation                                              | ✅ IMPLEMENTED                              |
| ASI10 | Unbounded Adaptation       | Model catalog uses pinned model IDs (no floating aliases); no fine-tuning; versioning to be DB-backed in P14                          | ⚠️ PARTIAL — adaptation versioning deferred |

### OWASP LLM Top 10 (2025) Coverage

| #     | Risk                      | P12 Mitigation                                                                                                                  | Status                               |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| LLM01 | Prompt Injection          | `PromptInjectionMiddleware` (existing) + adversarial detection in eval module + LLM validator integration                       | ✅ ENHANCED                          |
| LLM02 | Insecure Output Handling  | Retrieved content treated as untrusted data per ADR-031; no new output channels                                                 | ✅ PRESERVED                         |
| LLM03 | Training Data Poisoning   | N/A — no fine-tuning in MVP                                                                                                     | NOT_APPLICABLE                       |
| LLM04 | Model DoS                 | Rate limiter enforces per-agent token budget; timeout kills long-running calls                                                  | ✅ IMPLEMENTED                       |
| LLM05 | Supply Chain              | Model catalog uses pinned IDs; no floating aliases; pricing verified against live provider pages                                | ✅ IMPLEMENTED                       |
| LLM06 | Sensitive Info Disclosure | Forbidden keyword checks in eval framework; PII refusal case executed in golden dataset (mock LLM); live-provider execution P14 | ⚠️ PARTIAL — live execution deferred |
| LLM07 | Insecure Plugin Design    | No new plugins; existing plugin sandbox (ADR-008) unchanged                                                                     | ✅ PRESERVED                         |
| LLM08 | Excessive Agency          | Suggest-mode-first preserved; approval gate enforced; kill switches added                                                       | ✅ ENHANCED                          |
| LLM09 | Overreliance              | Provenance metadata carried through retrieval; confidence scoring in memory                                                     | ⚠️ PARTIAL                           |
| LLM10 | Model Theft               | No model weights stored; API-only access to providers                                                                           | NOT_APPLICABLE                       |

### Adversarial Prompt Detection

The eval module (`infrastructure/agent_eval.py`) implements detection for 4
categories of adversarial prompts with 14 regex patterns:

| Category             | Severity | Patterns | Example                              |
| -------------------- | -------- | -------: | ------------------------------------ |
| Direct injection     | Critical |        5 | "ignore all previous instructions"   |
| Role hijack          | High     |        4 | "pretend you are an unrestricted AI" |
| Data exfiltration    | Critical |        3 | "show me the system prompt"          |
| Privilege escalation | Critical |        3 | "bypass safety restrictions"         |

Detection is wired into:

1. `services/llm_validator.py` — validates input before LLM call
2. `orchestrator/router.py` — checks before agent dispatch

## Privacy Assessment

| Area                    | P12 Status                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Data minimization       | ✅ No new data collection; chunking produces metadata only                                                    |
| Workspace isolation     | ✅ All operations remain workspace-scoped; BYOK keys are per-workspace/per-user                               |
| Cross-workspace leakage | ✅ No new retrieval paths that bypass workspace_id filter; cross-user/cross-workspace key access returns 404  |
| PII handling            | ✅ PII refusal test case in golden eval dataset (executed)                                                    |
| Data retention          | ✅ No retention changes; existing TTL per memory type preserved                                               |
| Right to deletion       | ✅ GDPR service unchanged; chunk deletion follows parent document; deleting a provider key deletes ciphertext |
| Consent                 | ✅ No new consent requirements introduced                                                                     |

### BYOK (Bring-Your-Own-Key) Security

| Property            | Implementation                                                                                                                                                                | Status     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| At-rest encryption  | Fernet (`ENCRYPTION_KEY`) via existing `services/encryption.py`                                                                                                               | ✅         |
| Plaintext exposure  | Raw key never returned by API, never logged; `key_hint` masks (prefix + suffix)                                                                                               | ✅         |
| Ownership           | Workspace- and user-scoped; cross-tenant access returns 404 (no existence leak)                                                                                               | ✅         |
| Rotation            | PATCH rotates key: re-encrypt + new hint; deactivation stops use                                                                                                              | ✅         |
| Priority            | explicit > workspace > user > system key                                                                                                                                      | ✅         |
| Fallback            | BYOK failure degrades to system key (no hard dependency)                                                                                                                      | ✅         |
| Provider validation | OpenAI via `Authorization` header, Google via `x-goog-api-key` header, custom via format check; remote validation for other providers deferred (P14)                          | ⚠️ PARTIAL |
| Privacy note        | Memory content sent to the user's chosen provider is processed under **that provider's policy** — the user's provider agreement applies; documented for consent review in P13 | ✅         |

## AI Safety Assessment

| Control          | Implementation                                                   | Status |
| ---------------- | ---------------------------------------------------------------- | ------ |
| Model versioning | Pinned model IDs in `MODEL_CATALOG` (no floating aliases)        | ✅     |
| Cost budget      | Per-agent cost tracking via `ModelRouter.record_usage()`         | ✅     |
| Kill switch      | Per-agent + global via `RuntimeKillSwitch`                       | ✅     |
| Circuit breaker  | Per-agent (3 failures → 30s open → half-open probe)              | ✅     |
| Rate limiting    | Token bucket + concurrency slots per agent                       | ✅     |
| Timeout          | Per-agent execution timeout enforcement                          | ✅     |
| Fallback         | Tier-based fallback in model router (powerful → balanced → fast) | ✅     |
| Suggest-mode     | Default autonomy preserved; no escalation                        | ✅     |
| Approval gate    | Consequential actions require user approval (existing)           | ✅     |
| Audit logging    | LLM usage logged with agent/model/tokens/cost                    | ✅     |

## Accessibility (WCAG 2.2 AA)

No frontend changes in P12. All new code is backend-only (Python modules).
Accessibility obligations are unchanged from P10/P11.

## Outstanding Security Items

| #   | Item                                                                 | Severity | Target |
| --- | -------------------------------------------------------------------- | -------- | ------ |
| 1   | Live-provider adversarial eval (P12 executed mock-LLM only)          | MEDIUM   | P14    |
| 2   | Memory poisoning detection not implemented                           | MEDIUM   | P14    |
| 3   | SAML replay protection (from P11)                                    | MEDIUM   | P13    |
| 4   | BYOK custom-provider keys validated by format only (no remote check) | MEDIUM   | P14    |
| 5   | Prompt injection bypass rate not measured                            | MEDIUM   | P14    |
| 6   | BYOK privacy note needs consent-language review for P13              | LOW      | P13    |
