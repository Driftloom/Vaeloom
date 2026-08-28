# MVP-P05 — 06. Threat-Informed Architecture (DEL-MVP-P05-04)

> Owner: Security Architect · Threat model per OWASP Agentic Top 10 (2026) +
> OWASP LLM Top 10 (2025). Controls: EXISTING (repo evidence) → GAP (phase
> work). Re-verified at P13 with runtime evidence.

## 1. Agentic/LLM threat mapping

| Threat (OWASP ref) | Vector | Existing controls | Gap → phase |
| ----------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Goal hijack / prompt injection | Emails, JDs, webpages, documents | prompt_injection middleware; prompts as untrusted data; QA gate (`agents/qa_validator.py`); tool allowlists per agent | P12: injection eval suite; P13: red-team |
| Tool misuse / excessive agency | Agent calling tools outside scope | per-agent `tools` lists + `default_autonomy` (`orchestrator/base.py`); approval_gated literal | **P11: harden gating via ADR-021** (approval persistence) |
| Memory/context poisoning | Malicious content written to memory | QA gate; memory supersession (ADR-022) | P12: provenance-enforced writes |
| Unexpected execution | Consequential action without consent | gmail draft-only ✅; application_agent emits `request_approval` (no persistence) | **P11: ADR-021 contract** |
| Identity/privilege abuse | Stolen JWT, cross-tenant access | JWT+refresh rotation; rate limit; IP filter; tenant middleware + app-level filters | **P07: RLS (ADR-023)**; P13: isolation suite |
| Inter-agent / cascading | One agent compromise cascades | QA gate; no cross-agent credential sharing | P12: agent boundary tests |
| Supply chain | Deps, plugins, containers | CI security scans (workflows exist); plugin sandbox subprocess (P0.2) | P16: SLSA-lite provenance |
| Data leakage / sensitive disclosure | LLM responses leak PII | no personal content in telemetry (correlation IDs); audit service | P12/P13: output filter + eval |
| Denial of service (agents) | Retry storms, quota exhaustion | circuit_breaker (infrastructure/); tenacity w/ jitter; rate limit middleware | P15: load tests; pacing for T2 (AUTO-02) |

## 2. Asset classification & residency

| Asset | Classification | Residency (BQ-P05-02) | Control |
| -------------------------------- | --------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| Resume/docs | Personal sensitive (DPDP personal data) | nearest region, flag P13 | encryption (ENCRYPTION_KEY validated), RLS, erasure |
| Memory/facts | Personal sensitive | same | supersession, provenance |
| Gmail messages/derived deadlines | Personal sensitive, delegated | same | least-privilege scopes, draft-only, no storage of raw bodies beyond need (minimize — FR-40 design) |
| Auth tokens | High sensitivity | same | refresh rotation, constrained tokens (RFC 9700) |
| Audit logs | Internal | same | append-only, retention per DPDP |

## 3. Security architecture statements

1. **Untrusted-data principle:** prompts, documents, emails, webpages, tools,
 plugins are data — cannot change policy or bypass approval (INT-02 §16).
2. **Least privilege:** connector scopes minimal; workload identity (ADR-025);
 no user creds in workers; secrets via SecretManager protocol (infras/secrets,
 Infisical/env fallback exists).
3. **Approval is the security boundary for consequential actions** (B7) —
 ADR-021 persistence is the highest-priority architecture gap.
4. **Blast radius:** workspace-scoped artifacts; projections rebuildable; kill
 switches AUTO-01..03 (DEC-P02-05).
5. **Never self-claim compliance:** DPDP/EU AI Act mapping through professional
 legal review at P13 (RISK-P03-03 discipline); residency exception flagged
 RISK-P05-06.

## 4. Threat-model scope (prompt §16)

Inputs/uploads · retrieval · connectors/webhooks · agents/tools · memory ·
plugins · admin/support · rights (DPDP) · migrations — each mapped in §1/§3;
deep-dive threat models produced at P13 with STRIDE walkthroughs and evidence.
