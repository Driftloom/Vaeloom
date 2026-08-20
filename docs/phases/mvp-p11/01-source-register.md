# MVP-P11 — 01. Source Register

> Prompt §4 + §15. Baseline `master` @ `4b17d16` (closure, includes `024151d`) ·
> P11 feature commit `5c9049d` · Predecessor baseline `2e08468` (P10).

## 1. Internal sources

| ID      | Source                                                        | Use                                                    | Status    |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------ | --------- |
| INT-01  | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | Governing prompt §1-32, gate, audit                    | Available |
| INT-02  | vaeloom-mvp-e2e-enterprise-hardened.md                        | Authoritative MVP corrections                          | Available |
| INT-03  | vaeloom-mvp-e2e.md                                            | MVP 0-21 baseline                                      | Available |
| INT-05  | 01-vaeloom-mvp-spec.md                                        | Canonical MVP scope (8 agents, 22 memory types)        | Available |
| INT-07  | 02-system-architecture.md                                     | FastAPI monolith, Postgres+pgvector, Redis, MinIO      | Available |
| INT-08  | 03-agent-workflow.md                                          | Approval-gated agent loop, draft-only Gmail            | Available |
| REPO    | `master` @ `4b17d16` (this commit)                            | Implementation canvas                                  | Available |
| HANDOFF | `docs/phases/mvp-p10/10-handoff-to-p11.md`                    | P10 restrictions + wired items (ApprovalCard, Consent) | Available |
| DESIGN  | `docs/phases/mvp-p08/*` + `mvp-p09/*`                         | Contracts (OpenAPI 79 paths), IA, tokens               | Available |

## 2. Standards applicability (P11 scope)

| ID        | Standard                             | Use in phase                                                                       |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| EXT-01    | MCP Spec 2026-07-28                  | Connector tool permissions (least-privilege, encrypted token_ref)                  |
| EXT-02/03 | OWASP Agentic + LLM Top 10 2026/2025 | SAML sig validation, prompt injection, excessive agency, memory poisoning controls |
| EXT-06    | RFC 9700 OAuth 2.0 Security BCP      | PKCE, exact redirect, constrained tokens for Gmail/GitHub connectors               |
| EXT-08    | OpenAPI 3.2.0                        | 79-path contract; consent/approval/connector schemas verified                      |
| EXT-09    | OpenTelemetry spec                   | Trace correlation IDs, structured logs (no PII in telemetry)                       |
| EXT-10    | SLSA 1.2                             | Artifact provenance for signxml dep (pip hash)                                     |
| EXT-12    | Gmail API Push                       | Draft-only, least-privilege scopes, watch renewal not in P11 scope                 |
| EXT-14/16 | GDPR + DPDP Rules 2025               | Consent grant/revoke, GDPR export/delete, backup expiry 30d                        |

## 3. Conflict log

| ID        | Conflict                                                                           | Resolution                                                                                                                       | Authority       |
| --------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| CF-P11-01 | Gate report Weighted sum 90.5 vs claimed 96.0 — arithmetic mismatch                | Recomputed as 90.5 → gate is CONDITIONAL (88-94 band), not APPROVED; handoff updated, arithmetic fix accepted by user 2026-08-20 | User 2026-08-20 |
| CF-P11-02 | SAML valid signatures rejected (stdlib ET namespace rename ns0/ns1 broke exc-c14n) | Switched saml.py to lxml parse; verified with real keypair signxml tests (14/14)                                                 | Code + tests    |
| CF-P11-03 | Handoff baseline vague ("committed P11 work + post-fix")                           | Pinned to 024151d (contains 5c9049d + fixes); 4b17d16 adds baseline pin                                                          | Repo            |
