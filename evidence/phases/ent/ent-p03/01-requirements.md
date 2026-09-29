# ENT-P03 — 01 Versioned Requirements — Enterprise Baseline Specification

> **Phase:** `ENT-P03` (Requirements Engineering)  
> **Deliverable:** `DEL-ENT-P03-01` (v1.0)  
> **Owner:** Lead Product Manager & Principal Business Analyst  
> **Reviewed By:** Chief Enterprise Architect, CISO, Lead Data Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Non-Negotiable Architectural Invariants

Every requirement specified in this baseline must strictly preserve the
following platform invariants:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE ARCHITECTURAL INVARIANTS                  │
├─────────┬───────────────────────────┬──────────────────────────────────┤
│ ID      │ INVARIANT TITLE           │ ARCHITECTURAL ENFORCEMENT        │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ INV-01  │ Candidate Memory          │ Hard PostgreSQL RLS; queries for │
│         │ Sovereignty               │ personal vault require user_id   │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ INV-02  │ Cryptographic Provenance  │ Every memory node requires       │
│         │ & Temporal Windows        │ content_hash & valid_from/to     │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ INV-03  │ Deterministic HITL Gate   │ All destructive actions (`noul`) │
│         │ on External Actions       │ require affirmative human review │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ INV-04  │ Regional Cell Isolation   │ All customer data pinned to cell;│
│         │                           │ zero unapproved cross-border flow│
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ INV-05  │ Immutable Audit Trail     │ Append-only security audit log;  │
│         │                           │ tamper-evident hash chaining     │
└─────────┴───────────────────────────┴──────────────────────────────────┘
```

---

## 2. Functional Requirements (FR)

| Requirement ID | Domain             | Requirement Statement (Actor / Trigger / Behavior / Acceptance)                                                                                                                                                                                                                                                           | Priority | Owner            | Verification Test                                        |
| :------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | :--------------- | :------------------------------------------------------- |
| **REQ-FR-01**  | Identity & Tenancy | **Organization & Cohort Provisioning via SCIM v2.0 & SAML**<br>Institutional IT admins can provision enterprise organizations, sub-cohorts, and user seats via standard SCIM v2.0 endpoints (`/scim/v2/Users`, `/scim/v2/Groups`) and configure SAML 2.0 / OIDC identity providers with automated JIT seat provisioning.  |    P0    | Identity Lead    | Unit & SCIM integration suite; IdP assertion validation  |
| **REQ-FR-02**  | Advisory Ops       | **Advisor Control Plane & Intervention Workflow Queue**<br>Career advisors can access an authenticated dashboard showing assigned cohort members, filtering advisees by placement stage, review status, and ATS score; advisors can inspect only candidate-consented documents and annotate review drafts.                |    P0    | Product Lead     | E2E Playwright advisor flow; consent check integration   |
| **REQ-FR-03**  | Consent Engine     | **Granular Candidate Consent Lifecycle Management**<br>Candidates can grant, review, scope, and revoke purpose-bound sharing permissions to institutional advisors (specifying allowed document types, target roles, and expiration dates); revocation takes effect across all caches in $\le 500\text{ ms}$.             |    P0    | Privacy Lead     | `test_consent_revocation.py`; cache invalidation probe   |
| **REQ-FR-04**  | Data Architecture  | **22-Memory Taxonomy Formalization with Temporal Graph**<br>The data pipeline must ingest, extract, validate, and store career events across 22 typed Pydantic categories (`Profile`, `Skill`, `Goal`, `Task`, `Timeline`, etc.) with `valid_from` and `valid_to` temporal validity windows and pgvector HNSW embeddings. |    P0    | Data Architect   | Migration `0062+`; `test_knowledge_graph.py` (26/26)     |
| **REQ-FR-05**  | Agent Governance   | **28-Agent Governed Roster & Per-Agent Capability Manifests**<br>All 28 enterprise agents must declare a machine-readable capability manifest specifying allowed tool scopes, rate limits, token budgets, and approval policies; agents operating outside permitted scopes are terminated by the kernel.                  |    P0    | AI Product Lead  | `test_enterprise_28_agents.py`; capability linter        |
| **REQ-FR-06**  | Connector Runtime  | **Sandboxed Model Context Protocol (MCP) Runtime**<br>Connectors for Workday, Greenhouse, Lever, Canvas, and Gmail must execute via sandboxed MCP client interfaces (`mcp__*`) enforcing SSRF URL validation, process isolation, and dynamic tool approval for non-read-only actions.                                     |    P1    | Integration Lead | MCP client execution tests; SSRF guard unit suite        |
| **REQ-FR-07**  | Data Privacy       | **Right-to-be-Forgotten & Automated Cryptographic Deletion**<br>When a candidate requests profile deletion, the system executes an atomic purge: hard-deleting database records, unindexing pgvector embeddings, and cryptographically shredding MinIO resume artifacts within 60 seconds.                                |    P0    | Privacy Lead     | GDPR purge integration test; object storage verification |

---

## 3. Non-Functional Requirements (NFR)

| Requirement ID | Quality Attribute | Concrete Target Metric & Operational Boundary                                                                                                                          | Priority | Owner         | Verification Method                                      |
| :------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | :------------ | :------------------------------------------------------- |
| **REQ-NFR-01** | Performance       | **API Response Latency:** p95 latency $\le 120\text{ ms}$ across core API endpoints under 20 RPS load; p99 System 1 action routing $\le 50\text{ ms}$.                 |    P0    | SRE Lead      | k6 load test gate (`k6-script.js`); Prometheus histogram |
| **REQ-NFR-02** | Document Render   | **Playwright Headless Compilation:** p95 PDF compilation latency $\le 3,800\text{ ms}$ for multi-page resumes with zero process memory leakage.                        |    P1    | Platform Lead | Playwright worker telemetry span `compile_pdf`           |
| **REQ-NFR-03** | Availability      | **Platform Uptime:** $\ge 99.95\%$ service availability (excluding planned maintenance); RPO $\le 1\text{ hour}$, RTO $\le 15\text{ minutes}$ under disaster recovery. |    P0    | Ops Lead      | Synthetic blackbox probes; automated failover drill      |
| **REQ-NFR-04** | Security          | **Multi-Tenant Isolation:** 100% table coverage under PostgreSQL Row-Level Security (`RLS`); zero cross-tenant query execution under adversarial fuzzing.              |    P0    | Security Lead | `tests/test_rls_live_pg.py`; automated isolation fuzzing |
| **REQ-NFR-05** | Accessibility     | **WCAG 2.2 AA Compliance:** Zero serious or critical axe-core violations across all core routes in both dark and light modes down to 320px viewport.                   |    P1    | Design Lead   | Playwright a11y gate (`quality.spec.ts:131,164`)         |
| **REQ-NFR-06** | Unit Economics    | **Compute Cost Ceiling:** Total inference and headless render cost $\le \$0.38\text{ USD}$ per tailored application package.                                           |    P1    | FinOps Lead   | CloudWatch / OpenTelemetry token cost analyzer           |

---

## 4. Roles, Purposes, Entitlements & Billing Model

### Role-Based Access Control (RBAC) & Purpose Matrix:

1. **Candidate (Individual Owner):** Full read/write/delete authority over
   Sovereign Personal Vault. Can grant/revoke purpose-bound access to advisors.
2. **Advisor (Institutional Coach):** Read access to consented candidate resumes
   and application statuses. Can annotate review drafts and post feedback.
3. **Organization Admin (Campus IT / Program Director):** Manage organization
   licenses, configure SSO/SCIM, create cohorts, view aggregate outcome
   analytics. Zero access to candidate personal memories.
4. **CISO / DPO (Compliance Auditor):** Read-only access to system audit logs,
   encryption key rotations, and compliance verification reports.
5. **System Superuser (Platform Ops):** Infrastructure maintenance and cell
   health. Cryptographically barred from querying candidate PII via RLS policy.

### Entitlement & Tier Model:

- **Tier 1 (Higher Ed Standard):** SIS roster sync, automated ATS syntax
  pre-audits, core 8 agents, pooled cell.
- **Tier 2 (Higher Ed Premium):** Full 28-agent roster, custom university resume
  templates, real-time Gmail interview tracking, dedicated cohort reporting.
- **Tier 3 (Enterprise Outplacement):** Dedicated regional tenant cell, custom
  corporate NDA data retention policies, executive cheatsheet builder, 1-on-1
  advisor intervention queues.

---

## 5. Deliverable Sign-Off & Traceability

- **Contract Reference:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P03-requirements-engineering.md` §11
  (WS-03.1, WS-03.2) and §22 (`DEL-ENT-P03-01`).
- **Dependencies:** Grounded in `DEL-ENT-P01-01` (Problems), `DEL-ENT-P02-03`
  (Data Feasibility), and `DEL-ENT-P02-04` (Regulations).
- **Downstream Target:** Directly drives User Stories (`DEL-ENT-P03-02`) and
  Priority Baseline (`DEL-ENT-P03-04`).
