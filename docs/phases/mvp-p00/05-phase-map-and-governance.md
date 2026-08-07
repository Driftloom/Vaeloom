# MVP-P00 — 05. Phase Map and Governance

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Purpose:** map
> current artifacts to the MVP phase plan (MVP-P00…P21), identify
> missing/unverified items, define governance (roles, gate authority, entry
> criteria, prohibited work). **Register root:** `docs/phases/mvp-p00/`

## 1. Governance roles

| Role                           | Name                                                          | Authority                           |
| ------------------------------ | ------------------------------------------------------------- | ----------------------------------- |
| Accountable phase owner (gate) | Phase owner (AI-assisted execution, user = accountable human) | Issues GO / CONDITIONAL GO / NO-GO  |
| Security reviewer              | Security Architect                                            | Veto on mandatory blockers          |
| Privacy reviewer               | Privacy Engineer                                              | Veto on mandatory blockers          |
| Approver (BQ-01)               | **UNKNOWN — REQUIRES_STAKEHOLDER_DECISION**                   | Final human approval for every gate |
| Backup approver                | **UNKNOWN**                                                   | —                                   |

**Change authority:** any change to
scope/contract/permission/retention/provider/deployment/gate requires rationale,
impact, reviewers, migration, tests, rollout, rollback — recorded in the change
register (below).

## 2. Phase map — current state → MVP-P01…P21

| Phase | Name                                      | Current state from repo                       | Missing / unverified → to do                                             |
| ----- | ----------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| P00   | Intake & existing-state assessment        | ✅ THIS PHASE — complete                      | INT-01, BQ answers, baseline push                                        |
| P01   | Discovery & problem definition            | Not started                                   | Evidence-backed problem statement; user cohort; BQ-01/03/04              |
| P02   | Research, domain & data discovery         | Not started                                   | Job/market/legal research; dataset acquisition                           |
| P03   | Requirements engineering                  | SOURCE_DERIVED                                | Traceable reqs from INT-05; acceptance criteria                          |
| P04   | Project planning & governance             | Partially (COMMIT_PLAN.md)                    | Budget/cohort/ship window (BQ-05)                                        |
| P05   | Solution architecture                     | SOURCE_DERIVED (docs 02/03/04, 20 ADRs)       | Reconcile CF-01/02; 8-agent + 6-memory canonical map; kill-switch design |
| P06   | Tech stack & engineering standards        | IMPLEMENTED (repo)                            | Verify standards vs ADRs; CI quality gates                               |
| P07   | Data architecture & DB design             | IMPLEMENTED (models, alembic, memory schemas) | Verify 6 memory types; projection rebuild proofs                         |
| P08   | API, integration & contract design        | IMPLEMENTED (24 routers, OpenAPI)             | Verify contracts/versioning; MCP profile                                 |
| P09   | UI/UX & design system                     | IMPLEMENTED_UNVERIFIED (ui-kit, routes)       | a11y run; .pen design assets check                                       |
| P10   | Frontend implementation                   | IMPLEMENTED_UNVERIFIED (6 unit fails)         | Fix tests; e2e runnable                                                  |
| P11   | Backend implementation                    | IMPLEMENTED (2193 pass)                       | Fix env (protobuf); debug_test cleanup                                   |
| P12   | AI, agent, memory & data pipeline         | IMPLEMENTED_UNVERIFIED                        | 8-agent scope enforcement (CF-05); memory quality evals                  |
| P13   | Security, privacy & compliance            | IMPLEMENTED_UNVERIFIED (hardening in repo)    | Full security suite green; legal review; draft-only proof                |
| P14   | Testing & quality engineering             | Partial (10 suites on disk)                   | All suites runnable + evidence; mutation/load configs                    |
| P15   | Performance, reliability, scalability     | SOURCE_DERIVED                                | SLOs; load/chaos runs; capacity plan                                     |
| P16   | DevOps, infra, CI/CD                      | IMPLEMENTED_UNVERIFIED (infra + 11 workflows) | Deploy proof; provenance (SLSA)                                          |
| P17   | Observability & operations                | IMPLEMENTED_UNVERIFIED (OTEL in repo)         | Fix OTEL/protobuf; dashboards/alerts live                                |
| P18   | Documentation & knowledge transfer        | Docs MATURE (295 files)                       | Phase-linked docs; superseded cleanup                                    |
| P19   | Release readiness & production deployment | NOT_EXECUTED                                  | BQ-02/04; env provisioning; rollback runbook                             |
| P20   | Post-deployment validation                | NOT_EXECUTED                                  | Smoke/health verification                                                |
| P21   | Maintenance & continuous improvement      | NOT_EXECUTED                                  | Retro process; feature-flag ops                                          |

**Legend:** ✅ complete · NOT_STARTED · IMPLEMENTED_WITH_EVIDENCE ·
IMPLEMENTED_UNVERIFIED · SOURCE_DERIVED · NOT_EXECUTED · BLOCKED

## 3. Entry criteria for P01 (Definition of Ready — prompt §26)

- [ ] P00 gate issued (06-gate-report) — pending user confirmation of INT-01/BQ
      answers
- [ ] Baseline pushed / pinned (currently ahead 4 — push or record)
- [ ] BQ-01 approver named
- [ ] Scope/requirements source (INT-05) accepted
- [ ] Evidence plan + register in place
- [ ] No critical blocker makes P01 unsafe (documentation/research only — OK)

## 4. Prohibited work during MVP (enforced at every phase)

- Enterprise SSO/SCIM, institution admin, billing, marketplace, multi-region
  tenant cells, cross-user memory — **must stay disabled/unimplemented in MVP
  builds** (CF-05/06)
- Unsupported scraping, anti-bot circumvention, credential replay, unapproved
  job submission
- Production changes without authority, backup, rollback, monitoring, named
  approver
- Claims of secure/compliant/accessible/scalable/tested/production-ready without
  evidence
- Silent scope expansion or weakening of constraints/tests to create a pass

## 5. Change register (P00)

| ID         | Date       | Change                                                      | Rationale               | Approver    | Status       |
| ---------- | ---------- | ----------------------------------------------------------- | ----------------------- | ----------- | ------------ |
| CHG-P00-01 | 2026-08-06 | Deliverables at `docs/phases/mvp-p00/`                      | User decision (Q&A)     | User        | APPROVED     |
| CHG-P00-02 | 2026-08-06 | Gate restricted to CONDITIONAL GO until INT-01 + BQ answers | Missing governing input | Phase owner | PENDING user |
