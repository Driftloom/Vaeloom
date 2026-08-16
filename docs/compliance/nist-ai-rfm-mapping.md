# NIST AI Risk Management Framework — Vaeloom Mapping

| Metadata          | Value                                                |
| ----------------- | ---------------------------------------------------- |
| **Status**        | Accepted                                             |
| **Date**          | 2026-08-16                                           |
| **Owner**         | Compliance Team                                      |
| **Framework**     | NIST AI RMF 1.0 + NIST IR 8596 Generative AI Profile |
| **Applicability** | All AI agents, memory system, RAG pipeline           |

## Overview

The NIST AI Risk Management Framework (AI RMF 1.0) provides four functions:
**GOVERN, MAP, MEASURE, MANAGE**. This document maps Vaeloom's implementation to
each function and identifies gaps.

## GOVERN Function

**Purpose:** Establish risk management practices, culture, and accountability.

| Subcategory                               | Vaeloom Implementation                                        | Status         |
| ----------------------------------------- | ------------------------------------------------------------- | -------------- |
| GOVERN 1: Legal and regulatory compliance | GDPR consent (consent.py), EU AI Act awareness (P13)          | ⚠️ Partial     |
| GOVERN 2: Accountability structures       | RACI matrix in P04, ADR process (26 ADRs)                     | ✅ Implemented |
| GOVERN 3: Risk management integration     | Threat model (STRIDE), ADR-027 OWASP mapping                  | ✅ Implemented |
| GOVERN 4: Organizational practices        | Agent contract (mission/tools/permissions), permission engine | ✅ Implemented |
| GOVERN 5: Culture and awareness           | Security training (documented), responsible AI guidelines     | ⚠️ Partial     |

## MAP Function

**Purpose:** Contextualize AI system risks, impacts, and intended use.

| Subcategory                                | Vaeloom Implementation                                     | Status         |
| ------------------------------------------ | ---------------------------------------------------------- | -------------- |
| MAP 1: Intended purpose and context        | MVP spec (01-vaeloom-mvp-spec.md), agent scope definitions | ✅ Implemented |
| MAP 2: Potential impacts                   | Threat model, OWASP mapping (ADR-027)                      | ✅ Implemented |
| MAP 3: Benefits and costs                  | Cost analysis in P04, unit cost tracking (agent_costs.py)  | ⚠️ Partial     |
| MAP 4: Data requirements                   | Data classification in P05, 6 memory types defined         | ✅ Implemented |
| MAP 5: System capabilities and limitations | SLO definitions (99% best-effort), no SLA                  | ✅ Implemented |

## MEASURE Function

**Purpose:** Assess, monitor, and track AI system performance and risks.

| Subcategory                           | Vaeloom Implementation                             | Status                      |
| ------------------------------------- | -------------------------------------------------- | --------------------------- |
| MEASURE 1: Performance metrics        | QA Agent validation, confidence thresholds         | ✅ Implemented              |
| MEASURE 2: Fairness and bias          | Not implemented (single-user product, low risk)    | 🚫 Not Applicable           |
| MEASURE 3: Reliability and robustness | Circuit breaker (ADR-017), retry logic             | ⚠️ Partial                  |
| MEASURE 4: Security                   | OWASP mapping (ADR-027), permission engine         | ⚠️ Partial                  |
| MEASURE 5: Privacy                    | AES-256 encryption, tenant isolation, GDPR consent | ⚠️ Partial                  |
| MEASURE 6: Transparency               | Audit logging, agent explainability                | ✅ Implemented              |
| MEASURE 7: Human oversight            | Suggest-mode-first, approval gate (schema exists)  | ⚠️ Partial (gate not wired) |

## MANAGE Function

**Purpose:** Manage risks, respond to incidents, and improve continuously.

| Subcategory                         | Vaeloom Implementation                        | Status         |
| ----------------------------------- | --------------------------------------------- | -------------- |
| MANAGE 1: Risk response             | Circuit breaker, kill switches, feature flags | ⚠️ Partial     |
| MANAGE 2: Incident response         | SOC 2 ready audit logging, postmortem process | ⚠️ Partial     |
| MANAGE 3: Continuous improvement    | ADR process, quarterly reviews                | ✅ Implemented |
| MANAGE 4: Stakeholder communication | Documentation site, onboarding guide          | ✅ Implemented |

## Gap Summary

| Category  | Implemented | Partial | Not Implemented | Not Applicable |
| --------- | ----------- | ------- | --------------- | -------------- |
| GOVERN    | 3           | 2       | 0               | 0              |
| MAP       | 4           | 1       | 0               | 0              |
| MEASURE   | 3           | 4       | 0               | 1              |
| MANAGE    | 2           | 2       | 0               | 0              |
| **Total** | **12**      | **9**   | **0**           | **1**          |

## Remediation Priority

1. **MEASURE 7: Human oversight** — Wire approval gate (Critical gap, see
   `loop.py:82-83`)
2. **GOVERN 1: Legal compliance** — Complete EU AI Act classification (P13)
3. **MEASURE 4: Security** — Implement input sanitization (ADR-031)
4. **MEASURE 5: Privacy** — Complete RLS coverage (4/36 → 36/36 tables)

## Related Documents

- `docs/security/Threat-Model.md` — STRIDE threat model
- `docs/adr/ADR-027-owasp-llm-agentic-security-posture.md` — OWASP mapping
- `docs/phases/mvp-p05/06-threat-architecture.md` — Threat-informed architecture
