# MVP-P01 — 01. Source Register (phase-level)

> Sources carried from P00 (verified hashes in
> `../mvp-p00/01-source-register.md`) are authoritative unless re-verified here.
> New phase-level sources and the standards overlay are recorded below.

## 1. Governing authority order (INT-02 §0.2, DEC-P00-06)

1. **INT-02** `vaeloom-mvp-e2e-enterprise-hardened.md` — canonical for MVP
   execution (user-supplied, SHA-256 `2FA8966F…69640`)
2. **INT-01 substitute**
   `vaeloom-complete-three-track-phase-gatekeeper-deliverables.zip` (3× 22-phase
   32-section gatekeepers, validated ALL PASS 2026-08-04; template file itself
   never uploaded)
3. **INT-05** `01-vaeloom-mvp-spec.md` — canonical MVP product scope
   (`docs/01-vaeloom-mvp-spec.md`, SHA-256 `2B1264C6…21E1`)
4. **INT-07/08/09** architecture/workflow/memory intent (canonical design
   intent; repo state outranks prose for implementation truth)
5. **INT-03** `vaeloom-mvp-e2e.md` — MVP 0–21 execution baseline (subordinate to
   INT-02)
6. **MVP-P01 prompt** (this phase's execution contract) — 66-prompt pack,
   SHA-256 per `SHA256SUMS.md`

## 2. Phase execution contract

| ID                            | Source                                        | Class                  | Use                                                     | Verified                    |
| ----------------------------- | --------------------------------------------- | ---------------------- | ------------------------------------------------------- | --------------------------- |
| MVP-P01                       | `MVP-P01-discovery-and-problem-definition.md` | CANONICAL phase prompt | Mission, roles, scope, DoR/DoD, gate                    | 2026-08-07 (pack validated) |
| 05-cross-track-gate-policy.md | 66-prompt pack                                | CANONICAL gate policy  | GO ≥95/0 blockers; conditional 88–94 non-dependent only | 2026-08-07                  |

## 3. Standards overlay (prompt §overlay — verify versions at use time)

| Standard                                 | Snapshot                   | Required use                                                 | Owner         |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------ | ------------- |
| NIST AI RMF 1.0 + GenAI Profile          | official                   | Govern/Map/Measure/Manage; AI evaluation                     | AI Product    |
| OWASP Agentic Applications Top 10 (2026) | current                    | Agent/tool/memory/identity risk mapping                      | Security      |
| OWASP LLM Top 10 (2025)                  | current                    | Prompt injection, disclosure, excessive agency               | Security      |
| WCAG 2.2                                 | W3C Rec                    | AA accessibility target                                      | UX            |
| India DPDP Act 2023 + DPDP Rules 2025    | staged; re-verify in force | Notice/consent, rights, child data (India launch — BQ-03/04) | Privacy/Legal |
| EU AI Act transparency (from 2026-08-02) | official guidance          | AI disclosure, classification                                | Legal         |
| Gmail API push notifications             | verify current             | Watch renewal/reconciliation; draft-only contract            | Connector     |
| MCP spec 2026-07-28                      | pinned                     | Protocol profile, authorization                              | Architecture  |
| SLSA 1.2 / NIST SSDF 800-218             | current                    | Provenance, secure development                               | Platform      |
| OpenTelemetry                            | current                    | Trace/metric/log context                                     | Platform      |
| OpenAPI 3.2.0                            | current                    | API contracts                                                | API           |

## 4. External research sources (WS-01.1/01.2 — must be cited per claim)

- Official docs only: Google Gmail API, GitHub Apps, job platforms' official
  partner APIs (LinkedIn/Meta/Naukri — verify official programs; no scraping).
- Domain research: NACE/industry employment surveys, India employment/education
  statistics (MoSPI, AISHE), FTC/NCMEC for student-safety guidance.
- Competitive view: publicly documented capabilities of personal assistant /
  job-search AI products (marketing claims ≠ evidence; compare only what is
  observable).

## 5. Conflict resolution log

| ID        | Conflict                                                   | Resolution                                                                                                                            | Authority      |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| CF-P01-01 | Marketing/claimed features vs. repo reality                | Repo + tests outrank prose; claims require reproducible evidence                                                                      | Gate policy §4 |
| CF-P01-02 | Student-segment privacy (FERPA/COPPA) vs. India 18+ launch | BQ-03/04 approved: India, 18+, individual job seekers → FERPA/COPPA record as NOT_APPLICABLE for launch, re-check on region expansion | DEC 2026-08-07 |
