# MVP-P03 — 01. Source Register (phase-level)

> Sources carried from P00–P02 (hashes in prior registers) authoritative unless
> re-verified here. INT-02 hash re-verified 2026-08-07.

## 1. Governing authority order

1. **INT-02** `vaeloom-mvp-e2e-enterprise-hardened.md` — canonical MVP +
 hardened FR-52–FR-70 / NFR-15–NFR-22; SHA-256 `2FA8966F…69640` ✅ re-verified
2. **INT-01 substitute** — gatekeeper compendiums (validated ALL PASS)
3. **INT-05** `01-vaeloom-mvp-spec.md` — canonical MVP scope (SHA-256
 `2B1264C6…21E1`)
4. **INT-07/08/09** — architecture/workflow/memory intent
5. **MVP-P03 prompt** — this phase's execution contract

## 2. External standards (verified current)

| ID | Standard | Use |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| EXT-02/03 | OWASP Agentic Applications Top 10 2026; LLM Top 10 2025 | Agent/memory/identity risks |
| EXT-04 | NIST AI RMF 1.0 + GenAI Profile | AI governance |
| EXT-05 | WCAG 2.2 AA | Accessibility |
| EXT-06/07 | RFC 9700 (OAuth BCP), RFC 9728 | OAuth security |
| EXT-08/09 | OpenAPI 3.2.0; OpenTelemetry | Contracts; telemetry |
| EXT-10/11 | SLSA v1.2; NIST SSDF 800-218 | Supply chain |
| EXT-12 | Gmail API push/polling (verified P02) | Connector rules |
| EXT-14..17 | GDPR, EU AI Act, DPDP Rules 2025, FERPA/COPPA | Privacy/rights (India launch = DPDP; others re-check on expansion) |

## 3. Conflict log (P03)

| ID | Conflict | Resolution | Authority |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| CF-P03-01 | P03 §3 "unsupported job-platform automation out of scope" vs DEC-P02-05 (user "all above", T1/T2/T3) | T1 lawful automation = MVP requirements; T2/T3 = gated experimental requirements (flags AUTO-02/03, legal review gate, audit) — never default-ON | User (sole approver) 2026-08-07 |
| CF-P03-02 | P03 §3 lists "NestJS" in architecture; repo reality = Next.js + FastAPI only | Repo state outranks prose (P00 rule): requirements target Next.js + FastAPI + existing 25 packages | INT-02 + repo truth |
| CF-P03-03 | INT-02 §2 "approval before submission" vs T3 autopilot | T3 autopilot requires explicit per-plan user consent + legal review + AUTO-03; review-first is default | User 2026-08-07 |
