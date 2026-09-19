# ENT-P00 — 04 Risk, Unknowns & Assumptions Register

> **Phase:** `ENT-P00` (Intake and Existing-State Assessment)  
> **Deliverable:** `DEL-ENT-P00-04` (v1.0)  
> **Status:** APPROVED BASELINE  
> **Commit:** `74a7550` | **Date:** 2026-09-19  
> **Authoritative Owner:** CISO & Risk Governance Lead

---

## 1. Enterprise Risk Register

| Risk ID         | Description & Potential Impact                            | Likelihood |  Impact  | Mitigating Technical Controls                                                                                           |      Status      |
| :-------------- | :-------------------------------------------------------- | :--------: | :------: | :---------------------------------------------------------------------------------------------------------------------- | :--------------: |
| **RISK-ENT-01** | Multi-tenant cross-talk in dense shared databases.        |    Low     | Critical | PostgreSQL Row-Level Security enforced across all 42 tables with GUC session fail-closed guarantees.                    | **MITIGATED ✅** |
| **RISK-ENT-02** | Runaway LLM agent loops inflating cloud token costs.      |   Medium   |   High   | ReAct loop engineering bounds execution to 15 iterations and 30,000 tokens per goal, with SHA-256 action hash tracking. | **MITIGATED ✅** |
| **RISK-ENT-03** | Downstream vector store outage hanging agent queries.     |    Low     |   High   | `FallbackVectorStore` provides in-memory cosine fallback and emits `VECTOR_STORE_DEGRADED` telemetry.                   | **MITIGATED ✅** |
| **RISK-ENT-04** | Malicious prompt injection via untrusted job postings.    |   Medium   |   High   | Ingestion sanitization, strict URL guard (global IP only), and approval gates on destructive tools.                     | **MITIGATED ✅** |
| **RISK-ENT-05** | Distributed state loss during rolling Kubernetes updates. |    Low     |   High   | `STATE_STORE_EPHEMERAL_FALLBACK` warning emitted in production; Redis and Postgres state stores available.              | **MITIGATED ✅** |

---

## 2. Classified Material Unknowns

| Unknown ID     | Description                                               | Affected Area        | Resolution Strategy                                               | Owner           |   Blocking?   |
| :------------- | :-------------------------------------------------------- | :------------------- | :---------------------------------------------------------------- | :-------------- | :-----------: |
| **UNK-ENT-01** | Pilot enterprise tenant sizing & concurrent agent quotas. | ENT-P02 (Research)   | Benchmark load testing with k6 up to 500 concurrent candidates.   | Performance Eng | No (Phase 02) |
| **UNK-ENT-02** | External SAML IdP metadata auto-refresh intervals.        | ENT-P08 (Connectors) | Implement dynamic XML metadata caching with 24-hour TTL.          | Auth Engineer   | No (Phase 08) |
| **UNK-ENT-03** | European regional cell data residency constraints.        | ENT-P07 (Data Arch)  | Configure isolated AWS Frankfurt / GCP Belgium tenant partitions. | SRE Architect   | No (Phase 07) |

---

## 3. Explicit Assumptions Ledger

| Assumption ID  | Statement of Assumption                                                                        | Validation Check                                      | Invalidation Consequence                                |
| :------------- | :--------------------------------------------------------------------------------------------- | :---------------------------------------------------- | :------------------------------------------------------ |
| **ASM-ENT-01** | Production deployments run in Kubernetes or Docker with Playwright Chromium pre-baked.         | Multi-stage Dockerfile bakes in Chromium.             | Resume PDF export falls back to Typst or HTML download. |
| **ASM-ENT-02** | Enterprise customers authenticate via SAML 2.0 (Okta/Azure AD) or Google Workspace.            | Tested in `test_saml_endpoints.py` and OAuth routers. | Fall back to email/password with mandatory 2FA.         |
| **ASM-ENT-03** | Individual candidate memory remains private and cannot be mined by enterprise employer admins. | RLS tenant isolation & privacy policy pledge.         | Legal liability and enterprise trust violation.         |
