# EU AI Act — Vaeloom Classification and Compliance

| Metadata          | Value                                               |
| ----------------- | --------------------------------------------------- |
| **Status**        | Accepted                                            |
| **Date**          | 2026-08-16                                          |
| **Owner**         | Legal/Compliance Team                               |
| **Framework**     | EU AI Act (Regulation 2024/1689)                    |
| **Applicability** | All AI agents, memory system, RAG pipeline          |
| **Note**          | Transparency obligations applicable from 2026-08-02 |

## Overview

The EU AI Act classifies AI systems into risk categories: Unacceptable, High,
Limited, and Minimal. This document classifies Vaeloom's AI components and maps
compliance requirements.

## Risk Classification

### Vaeloom AI Components

| Component              | EU AI Act Category | Risk Level | Justification                                      |
| ---------------------- | ------------------ | ---------- | -------------------------------------------------- |
| **Orchestrator Agent** | Limited Risk       | Medium     | Routes requests, no autonomous decision-making     |
| **Memory Agent**       | Limited Risk       | Medium     | Stores/retrieves user data, no high-risk decisions |
| **Resume Agent**       | Minimal Risk       | Low        | Generates resume content, user reviews before use  |
| **ATS Agent**          | Minimal Risk       | Low        | Scores resume-job match, advisory only             |
| **Job Search Agent**   | Minimal Risk       | Low        | Searches and ranks jobs, no application submission |
| **Application Agent**  | Limited Risk       | Medium     | Prepares applications, requires user approval      |
| **Gmail Agent**        | Limited Risk       | Medium     | Drafts emails, never sends autonomously            |
| **Scheduler Agent**    | Minimal Risk       | Low        | Checks conflicts, suggests events                  |
| **RAG Pipeline**       | Limited Risk       | Medium     | Retrieves and reranks content for LLM context      |
| **Knowledge Graph**    | Minimal Risk       | Low        | Stores entity relationships, no decision-making    |

### Overall Classification

**Vaeloom is NOT a high-risk AI system under the EU AI Act.**

Justification:

1. **No autonomous consequential decisions**: All consequential actions (email
   sending, job application) require explicit user approval.
2. **No employment/hiring decisions**: The ATS agent is advisory only; humans
   make hiring decisions.
3. **No credit/insurance scoring**: No financial risk assessment.
4. **No law enforcement**: Not applicable.
5. **No critical infrastructure**: Personal productivity tool.

## Compliance Requirements (Transparency Obligations)

Even as a limited-risk system, Vaeloom must comply with transparency obligations
from 2026-08-02:

| Requirement                                                                      | Vaeloom Implementation                                      | Status                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------- |
| **AI Disclosure**: Users must be informed they are interacting with an AI system | Onboarding flow explains AI assistance                      | ✅ Implemented              |
| **AI-Generated Content**: AI-generated content must be labeled                   | Agent responses include source attribution                  | ⚠️ Partial                  |
| **Data for Training**: Training data must be lawfully obtained                   | No model fine-tuning; using API-only models                 | ✅ Not Applicable           |
| **Human Oversight**: Users must be able to override AI decisions                 | Suggest-mode-first; approval gate for consequential actions | ⚠️ Partial (gate not wired) |
| **Technical Documentation**: System design must be documented                    | 256+ docs, 26 ADRs, threat model                            | ✅ Implemented              |
| **Record-Keeping**: AI system actions must be logged                             | Audit logging (append-only)                                 | ✅ Implemented              |
| **Risk Management**: Risks must be identified and mitigated                      | Threat model, OWASP mapping (ADR-027)                       | ✅ Implemented              |

## Transparency Obligations Checklist

| Obligation                       | Article    | Implementation              | Status |
| -------------------------------- | ---------- | --------------------------- | ------ |
| Inform users of AI interaction   | Article 50 | Onboarding, UI labels       | ✅     |
| Label AI-generated content       | Article 50 | Agent response metadata     | ⚠️     |
| Maintain technical documentation | Article 11 | docs/, ADRs, threat model   | ✅     |
| Log system operations            | Article 12 | Audit logging               | ✅     |
| Human oversight capability       | Article 14 | Suggest-mode, approval gate | ⚠️     |
| Risk management system           | Article 9  | Threat model, OWASP mapping | ✅     |

## High-Risk AI Assessment (If Scope Expands)

If Vaeloom expands to enterprise hiring/employment decisions, reclassify:

| Scenario                           | New Classification       | Required Compliance        |
| ---------------------------------- | ------------------------ | -------------------------- |
| Automated hiring recommendations   | High Risk (Annex III, 4) | Full conformity assessment |
| Credit scoring for education loans | High Risk (Annex III, 5) | Full conformity assessment |
| Autonomous job submission          | High Risk (Annex III, 4) | Full conformity assessment |

## Remediation Priority

1. **AI-Generated Content Labeling**: Add explicit metadata to all agent
   responses indicating AI origin
2. **Human Oversight**: Wire approval gate (Critical gap, see `loop.py:82-83`)
3. **Technical Documentation Review**: Ensure all AI system components are
   documented per Article 11

## Related Documents

- `docs/security/Threat-Model.md` — Risk management system
- `docs/adr/ADR-027-owasp-llm-agentic-security-posture.md` — OWASP mapping
- `docs/phases/mvp-p05/06-threat-architecture.md` — Threat-informed architecture
