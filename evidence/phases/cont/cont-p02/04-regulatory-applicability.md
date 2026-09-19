# CONT-P02 — 04 Regulatory Applicability — GDPR / DPDP / FERPA / COPPA / EU AI Act

**Deliverable:** `DEL-CONT-P02-04` | **Owner:** Compliance Reviewer + Privacy
Engineer | **Date:** 2026-08-28 | **Requires professional review:**
`REQUIRES_PROFESSIONAL_REVIEW` (never self-claim)

## Map (entity→region→use→age → obligation)

| Entity                        | Region                                   | Use Case                                                                           | Age | Obligations (`EXT 14-17` verified)                                            | Professional Review | Applicability                                            |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | --- | ----------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| Student 18-24                 | EU/India `GDPR + DPDP Rules 2025 staged` | MVP memory 6 types `01`                                                            | 18+ | Notice/consent, rights, breach `DPDP 2025`, `DPIA v1.2 All Regions 3 DPA 5.2` | Privacy             | **APPLICABLE** `mvp-p13 95.4` covers                     |
| Enterprise employee           | EU `tenant cell`                         | `06 341` internal mobility consented aggregated                                    | 18+ | Consent granular revocable `EFR-03` aggregated cohort only                    | Legal/Privacy       | **APPLICABLE** `CONT-P13 Uplift` deferred                |
| Under-13                      | US COPPA                                 | `NOT APPLICABLE` per overlay 144 — exclusion or separately reviewed child-directed | <13 | Age gate `REQUIRES_STAKEHOLDER_DECISION` for COPPA revised rule               | Privacy             | **EXCLUDED** (gate blocked if attempted)                 |
| Institution education records | US FERPA                                 | `06 341` university provisioning `EFR`                                             | —   | `FERPA institution-controlled roles` contracts                                | Legal               | **BLOCKED** until `CONT-P13` workload identity `ADR-025` |

## Controls per Obligation (not self-claim)

| Obligation                                           | Control                                                             | Location / Evidence                                    | Owner                                                                                               | Status                             |
| ---------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **GDPR** rights/consent/retention                    | `consent grant/revoke` `POST /consent/me                            | scopes` `gdpr export/delete` `retention_runs 0021 30d` | `docs/security/DPIA v1.2` `docs/phases/mvp-p13` `privacy tests 233` `170 unique` `services/gdpr 31` | Privacy                            | `IMPLEMENTED_WITH_EVIDENCE` 95.4 |
| **India DPDP** staged notice/consent/children's data | `DPDP Act Rules 2025` verify provisions in force                    | `docs/compliance/india-dpdp-act-mapping.md`            | Privacy                                                                                             | `TO_BE_VERIFIED` per snapshot      |
| **EU AI Act** transparency `2026-08-02`              | Disclosure `06 disclosure, use-case classification, documentation`  | `docs/compliance/eu-ai-act-classification.md`          | Legal                                                                                               | `TO_BE_VERIFIED` per snapshot      |
| **WCAG 2.2 AA** `complete-process`                   | `ThemeProvider` `Sidebar md:` `ErrorBoundary` `jest-axe 0 critical` | `docs/frontend/Accessibility.md` `mvp-p15 93.1`        | UX                                                                                                  | `IMPLEMENTED_WITH_EVIDENCE` `P15`  |
| **OAuth BCP RFC9700/BCP 240**                        | `exact redirect, PKCE, least privilege`                             | `middleware.ts CSP` `api.ts CSRF double-submit`        | SecArch                                                                                             | `IMPLEMENTED` `02-asset 8 healthy` |
| **AI RMF** `Govern/Map/Measure/Manage`               | Eval 12 cases `qa_agent 3 retries` `detect_adversarial`             | `docs/ai/Evaluation` `hardening 1210` `rag_status`     | AI                                                                                                  | `IMPLEMENTED` `CONT-P12`           |

**Never self-claim compliance** — professional legal review required per
`GDPIA v1.2 All Regions` `DPIA 5.2` precedent.

---

_Evidence: `docs/compliance/* 4 files` +
`docs/phases/mvp-p13 01-source-register 13 INT+19 EXT` + `security 316`
`privacy tests 233`._
