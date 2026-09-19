# ENT-P00 — 01 Source Register & Conflict Resolution

> **Phase:** `ENT-P00` (Intake and Existing-State Assessment)  
> **Deliverable:** `DEL-ENT-P00-01` (v1.0)  
> **Status:** APPROVED BASELINE  
> **Commit:** `74a7550` | **Date:** 2026-09-19  
> **Authoritative Owner:** Enterprise Architect & Program Governance

---

## 1. Canonical Authority Hierarchy

When conflicts arise between documentation artifacts, the following order of
precedence strictly governs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Runtime Implementation Truth (Tested Source Code, Schemas, Migrations)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Universal Enterprise Phase Prompt Generator & Gatekeeper                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. 66 Independent End-to-End Phase Prompts (EXECUTION-STATUS.md)           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Active Architectural Decision Records (ADR-001 through ADR-044)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Canonical Enterprise Vision & Specifications (01-spec.md, 06-paper.md)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. Historical Design Papers & Completion Reports (Contextual Only)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Internal Source Corpus Register

| ID         | Title / Path                                                    | Authority / Role                                          | Classification      | Version / Hash       |
| :--------- | :-------------------------------------------------------------- | :-------------------------------------------------------- | :------------------ | :------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Governing gatekeeper & 32-section execution rules         | CANONICAL_GOVERNING | `v2.4` / `74a7550`   |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Authoritative MVP corrections & verified release evidence | CANONICAL_EVIDENCE  | `v1.0` / `74a7550`   |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Baseline MVP Phase 0–21 execution records                 | CANONICAL_BASELINE  | `v1.0` / `74a7550`   |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Baseline Enterprise Phase 0–21 targets                    | CANONICAL_TARGET    | `v1.0` / `74a7550`   |
| **INT-05** | `docs/prompts/01-vaeloom-mvp-spec.md`                           | Canonical MVP product scope & feature boundaries          | CANONICAL_SPEC      | `v1.0` / `74a7550`   |
| **INT-06** | `docs/prompts/06-vaeloom-enterprise-paper.md`                   | Canonical enterprise target vision                        | CANONICAL_VISION    | `v1.0` / `74a7550`   |
| **INT-07** | `docs/prompts/02-system-architecture.md`                        | Memory-first system architecture specification            | CANONICAL_ARCH      | `v1.0` / `74a7550`   |
| **INT-08** | `docs/prompts/03-agent-workflow.md`                             | Multi-agent collaboration & approval gate topologies      | CANONICAL_WORKFLOW  | `v1.0` / `74a7550`   |
| **INT-09** | `docs/prompts/04-memory-knowledge-graph.md`                     | Memory taxonomy & knowledge graph architecture            | CANONICAL_DATA      | `v1.0` / `74a7550`   |
| **INT-10** | `docs/phases/cont-p21/09-handoff-to-ent-p00.md`                 | Direct predecessor handoff & entry authorization          | PREDECESSOR_HANDOFF | `96.76 APPROVED`     |
| **INT-11** | `docs/Audits/vaeloom-master-gap-register.md`                    | Live engineering gap register (G-01 through G-42)         | CANONICAL_AUDIT     | `100% COMPLETE`      |
| **INT-12** | `docs/Audits/vaeloom-release-readiness.md`                      | Platform release readiness scorecard                      | CANONICAL_AUDIT     | `v1.2` / `74a7550`   |
| **INT-13** | `docs/backend/openapi.yaml`                                     | Machine-readable API contracts (162 paths / 203 ops)      | CANONICAL_CONTRACT  | `v0.2.0` / `74a7550` |
| **INT-14** | `docs/adr/ADR-001..044`                                         | Enterprise architectural decision record series           | CANONICAL_DECISIONS | `44 ADRs`            |

---

## 3. External Standards & Regulatory Mappings

| Standard ID | Authority & Version                   | Application Scope                                | Vaeloom Enforcement Mechanism                                      |
| :---------- | :------------------------------------ | :----------------------------------------------- | :----------------------------------------------------------------- |
| **EXT-01**  | **Model Context Protocol (v2)**       | Dynamic tool bridging & connector execution      | `services/mcp_client_service.py` with 30s timeout & approval gates |
| **EXT-02**  | **OWASP Agentic Top 10 (2026)**       | Autonomous agent loops & tool hijacking defense  | Loop budgets, hash tracking, and human-in-the-loop approvals       |
| **EXT-03**  | **OWASP LLM Top 10 (2025)**           | Prompt injection, sensitive data leakage, agency | Strict Pydantic parsing, Fernet encryption, and rate limiting      |
| **EXT-04**  | **NIST AI RMF 1.0 + GenAI**           | AI governance, trustworthiness, and evaluation   | Deterministic test harnesses and RAG faithfulness scoring          |
| **EXT-05**  | **WCAG 2.2 Level AA**                 | Accessible web user interfaces                   | Automated `axe-core` in Playwright (`landing.spec.ts`)             |
| **EXT-06**  | **OAuth 2.0 Security BCP (RFC 9700)** | Identity delegation & redirect validation        | Exact URI matching, PKCE, state nonce validation                   |
| **EXT-07**  | **OpenAPI Specification 3.1**         | API schema validation & client generation        | FastAPI auto-generation and Pydantic v2 strict models              |
| **EXT-08**  | **OpenTelemetry Spec**                | Distributed tracing and context propagation      | `X-Correlation-ID` ASGI middleware and OTel spans                  |
| **EXT-09**  | **GDPR (Regulation EU 2016/679)**     | Articles 15 (Portability) and 17 (Erasure)       | Dedicated `/api/v1/gdpr/export` and `/delete` endpoints            |
| **EXT-10**  | **India DPDP Act 2023**               | Notice, consent, and user data governance        | Tenant isolation and explicit consent audit logs                   |

---

## 4. Conflict Resolution & Supersession Ledger

| Conflict ID  | Sources Involved                       | Nature of Discrepancy                                             | Authoritative Resolution                                                                      |
| :----------- | :------------------------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **C-ENT-01** | `01-spec.md` vs `05-spec.md`           | Legacy `05-spec.md` contained deprecated desktop companion scope. | `01-vaeloom-mvp-spec.md` is CANONICAL. Desktop companion classified as post-MVP Phase 2.      |
| **C-ENT-02** | `06-paper.md` vs `enterprise-paper.md` | Unversioned draft had informal RLS notes.                         | `06-vaeloom-enterprise-paper.md` is CANONICAL. RLS across 42/42 tables is mandatory.          |
| **C-ENT-03** | `AGENTS.md` vs `openapi.yaml`          | AGENTS.md historically claimed 110 endpoints.                     | `openapi.yaml` v0.2.0 reflects runtime truth: **162 paths / 203 operations** (254 endpoints). |
| **C-ENT-04** | `MVP Gate Report` vs `e2e/`            | Previous report claimed 29 spec files / 68 tests.                 | Forensic code audit proved **6 active spec files / 73 runtime tests** in `apps/web/e2e/`.     |

---

## 5. Sign-Off & Source Baseline Approval

- **Source Integrity**: 100% Verified. All references resolve to existing
  repository files or verified external standards.
- **Predecessor Validation**: Handoff from `CONT-P21` is verified on disk
  (`docs/phases/cont-p21/09-handoff-to-ent-p00.md`).
- **Verdict**: Source register accepted as the official baseline for the
  Enterprise Track.
