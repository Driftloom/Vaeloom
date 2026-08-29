# CONT-P01 — 02 Persona / JTBD Evidence — Segmented

**Deliverable:** `DEL-CONT-P01-02` | **Owner:** UX Researcher |
**Contributors:** Product, Privacy Engineer (`BQ-03` entity→region→use→age) |
**Date:** 2026-08-28

## 1. Segmentation (not one generic student)

| Segment             | Age   | Region                  | Institution Relationship                        | Data Sensitivity                      | Persona Source               | Enterprise Role      |
| ------------------- | ----- | ----------------------- | ----------------------------------------------- | ------------------------------------- | ---------------------------- | -------------------- |
| Student wedge       | 18-24 | India (DPDP), EU (GDPR) | self-serve B2C                                  | PII + career docs                     | `User-Personas:44`           | User                 |
| Job seeker          | 22-30 | India/EU/US             | self-serve                                      | Career + ATS gaps                     | `User-Personas:54`           | User                 |
| Early-career        | 25-35 | India/EU                | self-serve                                      | Timeline 1k-10k entities              | `User-Personas:63`           | User                 |
| Researcher          | —     | EU/US                   | self-serve                                      | Papers/citations                      | secondary                    | User                 |
| Developer           | —     | Global                  | GitHub App perms fine-grained `EXT-13`          | Code/projects                         | secondary                    | User                 |
| Enterprise employee | —     | `tenant cell`           | Institution-provisioned `tenant_id` pooled→cell | Consented aggregated only             | `06:341`                     | User (tenant-scoped) |
| Institutional admin | —     | `regional residency`    | University/bootcamp/company provisioning `EFR`  | `Aggregated consented cohort` not raw | `vaeloom-enterprise-e2e EFR` | Admin                |
| Operator / SRE      | —     | —                       | Platform                                        | Audit + SLO 99.9%                     | `operations`                 | Operator             |

**BQ-03 answer (preliminary, requires professional review for FERPA/COPPA):**

| Entity                      | In Scope?                                          | Age | Region   | Use Case                            | Basis                                                           |
| --------------------------- | -------------------------------------------------- | --- | -------- | ----------------------------------- | --------------------------------------------------------------- |
| Student (adult)             | YES                                                | 18+ | India/EU | MVP → enterprise migration baseline | Consent + legitimate interest                                   |
| Under-13                    | **EXCLUDED** or separately reviewed child-directed | <13 | US COPPA | `NOT_APPLICABLE` per overlay 144    | Age gate `REQUIRES_STAKEHOLDER_DECISION` for COPPA revised rule |
| Institution records (FERPA) | `BLOCKED` until `CONT-P13` uplift                  | —   | US       | Tenant admin aggregated only        | `CONT-P13` SAML workload identity                               |

## 2. JTBD / Trust Boundaries / Unacceptable Outcomes

| JTBD                                                                                                              | Trust Boundary                                                                 | Unacceptable Outcome                        | Test Counterexample                                             |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| As student, I want `find me backend internships` to use only my `workspace` memories, so my transcript not leaked | Workspace `SET LOCAL app.workspace_id` + `validate_workspace_binding`          | Cross-workspace leak `test_J` must be `404` | `test_J SecretSkill NOT in ws_b` `PASS 7.5s`                    |
| As job seeker, I want ATS `78% +2 edits` diff never auto-applied                                                  | `approval_gated` `create_github_issue` gated                                   | Silent `merge_entities` without approval    | `policy_check forged→pending` `test_F`                          |
| As user, I want wrong memory (`React` mis-extracted) to be correctable, not compounding                           | `Memory supersedes_id` `persist_version`                                       | Undeletable / no deletion                   | `docs/database Backups` + `mvp-p07` provenance lifecycle        |
| As admin, I see `62% applied ≥1` but never raw `SecretSkill` raw record                                           | Consent + tenant `tenant_id` isolation pooled→cell `isolation: pooled vs cell` | Individual raw leaked                       | `Multi-Tenancy.md` tenant cells deferred `CONT-P07`             |
| As operator, I need `kill-switch` + `REJECT_DUPLICATE` + `SETNX EX120` + `rollback`                               | `AGENT_REACT_ENABLED=false` default `LANGGRAPH_ENABLED=false`                  | Permanent dual-run estate                   | `CONT-P00 0 mandatory blocker` expand-contract bounded per wave |

**Design-partner evidence plan (overlay 146):** Anecdotal feedback never
overrides `test_product_closure_e2e 10` measured + `k6 10/20/50` +
`temporal workflow count 1251` + `WorkflowEnvironment 83` — `CONT-P02` will pin
partners.

---

_Evidence: `User-Personas 214 lines` + `User-Journey 231` + `User-Stories 42` +
`test_J 404` + `mvp-p13 DPIA All Regions 3` → `CONT-P01-R02`._
