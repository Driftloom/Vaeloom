# ENT-P03 — 03 Traceability Matrix — Requirements Verification Chain

> **Phase:** `ENT-P03` (Requirements Engineering)  
> **Deliverable:** `DEL-ENT-P03-03` (v1.0)  
> **Owner:** Lead Quality Assurance Architect & Business Analyst  
> **Reviewed By:** Chief Architect, Product Operations Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Bidirectional Traceability Architecture

The Vaeloom Enterprise Requirements Baseline maintains an unbroken bidirectional
traceability chain connecting canonical sources to runtime verification suites:

$$\text{Canonical Sources} \longrightarrow \text{Problem Statements} \longrightarrow \text{Requirements} \longrightarrow \text{User Stories} \longrightarrow \text{Automated Tests} \longrightarrow \text{Gate Categories}$$

---

## 2. Master Requirements Traceability Matrix

| Requirement ID | Domain           | Upstream Source & Problem      | User Story / Acceptance  | Implementing Architecture / File         | Verification Test Suite                  | Gate Scorecard Category        |
| :------------- | :--------------- | :----------------------------- | :----------------------- | :--------------------------------------- | :--------------------------------------- | :----------------------------- |
| **REQ-FR-01**  | Tenancy / SCIM   | `INT-04`, `EXT-06` / `EPS-01`  | `US-ENT-01`              | `src/api/routers/scim.py`                | SCIM unit & contract suite               | Scope & Acceptance (12)        |
| **REQ-FR-02**  | Advisory Ops     | `INT-06`, `EXT-17` / `EPS-02`  | `US-ENT-02`              | `apps/web/src/app/workspace/*/advisor`   | Playwright E2E advisor flow              | Technical Correctness (12)     |
| **REQ-FR-03**  | Consent Engine   | `INT-01`, `EXT-14` / `EPS-01`  | `US-ENT-03`, `ABUSE-01`  | `src/api/middleware/consent.py`          | `test_consent_revocation.py`             | Security & Privacy (12)        |
| **REQ-FR-04**  | Data Schema      | `INT-07`, `INT-09` / `EPS-04`  | `US-ENT-04`              | `src/api/models/enterprise_memory.py`    | `test_knowledge_graph.py` (26/26)        | Data Quality & Lifecycle (8)   |
| **REQ-FR-05**  | Agent Governance | `INT-08`, `EXT-02` / `EPS-03`  | `US-ENT-04`, `ABUSE-03`  | `src/api/agents/definitions.py`          | `test_enterprise_28_agents.py`           | Architecture & Integration (8) |
| **REQ-FR-06**  | Connectors       | `EXT-01`, `EXT-12` / `EPS-06`  | `US-ENT-04`              | `src/api/services/mcp_client_service.py` | MCP client execution tests               | Architecture & Integration (8) |
| **REQ-FR-07**  | Privacy / Purge  | `EXT-14`, `EXT-16` / `EPS-01`  | `PRIV-01`                | `src/api/services/gdpr_service.py`       | GDPR purge suite; MinIO shred            | Security & Privacy (12)        |
| **REQ-NFR-01** | Performance      | `INT-02`, `EXT-09` / `EPS-02`  | `US-ENT-02`, `US-ENT-04` | `src/api/middleware/rate_limit.py`       | k6 load test gate (p95 <120ms)           | Performance & Capacity (6)     |
| **REQ-NFR-02** | PDF Render       | `INT-02`, `INT-07` / `EPS-02`  | `US-ENT-04`              | `src/api/services/document_builder.py`   | Playwright PDF compile telemetry         | Performance & Capacity (6)     |
| **REQ-NFR-03** | Availability     | `INT-04`, `EXT-04` / `EPS-05`  | `RES-01`                 | `src/api/utils/circuit_breaker.py`       | Synthetic blackbox probes (30s)          | Reliability & Resilience (8)   |
| **REQ-NFR-04** | RLS Isolation    | `INT-02`, `EXT-02` / `EPS-05`  | `ABUSE-01`               | `src/api/database.py:30` (GUC session)   | `tests/test_rls_live_pg.py` (5/5)        | Security & Privacy (12)        |
| **REQ-NFR-05** | Accessibility    | `EXT-05` (WCAG 2.2) / `EPS-01` | `US-ENT-02`, `US-ENT-03` | `apps/web/src/components/*`              | Playwright a11y gate (`quality.spec.ts`) | Testing & Validation (12)      |
| **REQ-NFR-06** | Unit Economics   | `INT-06`, `EXT-04` / `EPS-02`  | `US-ENT-04`, `RES-01`    | `src/api/services/cognitive_router.py`   | OpenTelemetry token billing analyzer     | Maintainability & Cost (3)     |

---

## 3. Gap Analysis & Completeness Verification

- **Orphan Requirements Count:** **0** (Every requirement maps upstream to an
  authorized canonical source and problem statement).
- **Untested Acceptance Criteria:** **0** (Every user story maps downstream to
  an executable test suite or telemetry probe).
- **Mandatory Standards Coverage:** 100% coverage of applicable standards
  (`EXT-01` through `EXT-17`).

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Reference:** Fulfills
  `specs/phase-contracts/03-enterprise/ENT-P03-requirements-engineering.md` §11
  (WS-03.4) and §22 (`DEL-ENT-P03-03`).
- **Predecessor Chain:** Validated against `DEL-ENT-P03-01` (Requirements) and
  `DEL-ENT-P03-02` (Stories).
- **Handoff Output:** Provides the immutable traceability baseline for Phase
  `ENT-P04` (Project Planning and Delivery Governance).
