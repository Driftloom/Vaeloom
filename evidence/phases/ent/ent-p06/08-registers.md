# ENT-P06 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P06` (Technology Stack and Engineering Standards)  
> **Deliverable:** `DEL-ENT-P06-08` — Consolidated Governance Registers  
> **Owner:** Engineering Standards Custodian & Risk Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                            | Severity |           Impact           | Mitigation Strategy                                                                                         | Owner         |     Status     |
| :------------------ | :---------------------------------------------------------------------------------------------------------- | :------: | :------------------------: | :---------------------------------------------------------------------------------------------------------- | :------------ | :------------: |
| **RISK-ENT-P06-01** | Upstream Python or Node library updates introduce breaking syntax or security vulnerabilities.              |   High   |     CI build failures      | Exact version pinning; automated Dependabot scans; staging build verification before merging.               | Platform Lead | **CONTROLLED** |
| **RISK-ENT-P06-02** | Contagious copyleft licenses (AGPL-3.0) inadvertently introduced via transitively pulled npm/PyPI packages. | Critical | Intellectual property risk | Automated CI license scanner (`license-checker`, `pip-licenses`) fails build on GPL/AGPL presence.          | AppSec Lead   | **CONTROLLED** |
| **RISK-ENT-P06-03** | Playwright Chromium base image vulnerability disclosures block production container deployments.            |   High   |      Deployment delay      | Hermetic multi-stage Docker builds; automated daily Trivy vulnerability alerts with automated patching.     | SecOps Lead   | **CONTROLLED** |
| **RISK-ENT-P06-04** | Monorepo package count growth degrades TypeScript compilation and test collection times.                    |  Medium  |  Developer velocity drop   | Isolated Nx build caching; scoped commands (`pnpm dev:web`, `pnpm dev:be`); strict package boundary rules.  | Tech Lead     | **CONTROLLED** |
| **RISK-ENT-P06-05** | Cloud provider deprecates specific PostgreSQL or Redis managed cluster versions unexpectedly.               |   Low    |  Forced database upgrade   | Pinning to long-term LTS releases (PG 16 supported through Nov 2028; Redis 7.2 supported through Dec 2026). | DBA Lead      | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                              | Context & Alternatives                                                                                                          | Chosen Rationale                                                                                         |    Status    |
| :----------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P06-01** | **Hermetic Version Pinning Standard**       | Alt A: Semantic version floating ranges (`^`, `~`).<br>Alt B: Exact semantic version pinning across all packages and lockfiles. | Chose Alt B. Eliminates non-deterministic builds and guarantees environment consistency.                 | **APPROVED** |
| **DEC-ENT-P06-02** | **Full Monorepo TypeScript Strict Mode**    | Alt A: Loose TypeScript configuration.<br>Alt B: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.               | Chose Alt B. Prevents runtime `TypeError: undefined is not a function` bugs across frontend components.  | **APPROVED** |
| **DEC-ENT-P06-03** | **Python 3.12 + Mypy Strict Enforcement**   | Alt A: Optional Python type hints.<br>Alt B: Mandated 100% type annotations with `mypy --strict` and `ruff`.                    | Chose Alt B. Ensures enterprise-grade runtime reliability and robust Pydantic v2 serialization.          | **APPROVED** |
| **DEC-ENT-P06-04** | **SLSA Build Level 3 Provenance & Cosign**  | Alt A: Unsigned container images.<br>Alt B: Cryptographically signed container images via Sigstore Cosign.                      | Chose Alt B. Prevents supply chain tampering and satisfies enterprise SOC 2 / FedRAMP requirements.      | **APPROVED** |
| **DEC-ENT-P06-05** | **Copyleft License Elimination (AGPL/GPL)** | Alt A: Case-by-case copyleft exceptions.<br>Alt B: Strict ban on all AGPL/GPL/SSPL licenses in production code.                 | Chose Alt B. Protects proprietary intellectual property and prevents legal contamination.                | **APPROVED** |
| **DEC-ENT-P06-06** | **Open Source Vendor Exit Feasibility**     | Alt A: Proprietary cloud lock-in.<br>Alt B: Open standards (vanilla PostgreSQL, Redis, Kubernetes, generic LLM adapters).       | Chose Alt B. Guarantees $<4\text{ hour}$ database migration and $<1\text{ hour}$ LLM provider migration. | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                    | Validation Method                                                          | Invalidation Action                                                                                            |    Status     |
| :----------------- | :--------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P06-01** | Python 3.12.13 and Node.js 20.17.0 LTS runtimes remain actively supported by cloud providers through 2026. | Review of official Python PEP 693 and Node.js LTS release schedules.       | Accelerate migration to Node 22 LTS or Python 3.13 if vendor support ends prematurely.                         | **VALIDATED** |
| **ASM-ENT-P06-02** | `pnpm` and `uv` package managers sustain sub-3-second dependency resolution on enterprise CI builders.     | CI benchmark runs across 50 consecutive pipeline executions.               | Cache local `.pnpm-store` and `uv` cache directories on persistent CI runner volumes.                          | **VALIDATED** |
| **ASM-ENT-P06-03** | PostgreSQL `pgvector` extension v0.7.4 maintains binary compatibility across future Supabase PG updates.   | Compatibility testing of pgvector dumps against PostgreSQL 16.4.           | Pin explicit extension version in database initialization scripts (`CREATE EXTENSION vector VERSION '0.7.4'`). | **VALIDATED** |
| **ASM-ENT-P06-04** | Sigstore Cosign keyless signing operates reliably without external OIDC federation throttling.             | Benchmark 100 consecutive container signing operations via GitHub Actions. | Fall back to private KMS-backed hardware security keys for offline container signing.                          | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category         | Primary Deliverable    | Implementing Spec / Policy                          | Verification                         |    Status    |
| :------------------- | :--------------- | :--------------------- | :-------------------------------------------------- | :----------------------------------- | :----------: |
| **ENT-P06-R01**      | Scope            | `DEL-ENT-P06-01`, `02` | `01-technology-decision.md`, `02-version-policy.md` | Tech matrix & Version baseline       | **VERIFIED** |
| **ENT-P06-R02**      | Evidence         | `DEL-ENT-P06-07`       | `05-test-results.md`, `07-evidence-bundle.md`       | 731 verified live tests              | **VERIFIED** |
| **ENT-P06-R03**      | Security/Privacy | `DEL-ENT-P06-04`       | `04-dependency-governance-sbom.md`                  | SLSA Level 3 & license checks        | **VERIFIED** |
| **ENT-P06-R04**      | Quality          | `DEL-ENT-P06-03`, `06` | `03-engineering-standards.md`, `quality.spec.ts`    | Strict typing & zero lint warnings   | **VERIFIED** |
| **ENT-P06-R05**      | Operations       | `DEL-ENT-P06-05`       | `05-cost-operability-exit-strategy.md`              | Sub-second local DX & exit playbooks | **VERIFIED** |
| **ENT-P06-R06**      | Data/AI          | `DEL-ENT-P06-01`       | `01-technology-decision-matrix.md`                  | Two-tier AI + pgvector HNSW          | **VERIFIED** |
| **ENT-P06-R07**      | Traceability     | `DEL-ENT-P06-08`       | `08-registers.md`                                   | Bidirectional link verification      | **VERIFIED** |
| **ENT-P06-R08**      | Gate             | `DEL-ENT-P06-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p07.md`     | Score: 98.97 / 100 (Full GO)         | **VERIFIED** |

_Signed: Engineering Standards Custodian & Risk Lead — 2026-09-29_
