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

| Phase | Name                                      | Current state from repo                                                        | Missing / unverified → to do                                                                                  |
| ----- | ----------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| P00   | Intake & existing-state assessment        | ✅ THIS PHASE — complete (re-verified 2026-08-12 + completion pass 2026-08-12) | None — baseline pushed, hashes re-pinned, prompt paperwork closed (files 10–14); verdict pending USER (09 §8) |
| P01   | Discovery & problem definition            | Not started                                                                    | Evidence-backed problem statement; user cohort; BQ-01/03/04                                                   |
| P02   | Research, domain & data discovery         | Not started                                                                    | Job/market/legal research; dataset acquisition                                                                |
| P03   | Requirements engineering                  | SOURCE_DERIVED                                                                 | Traceable reqs from INT-05; acceptance criteria                                                               |
| P04   | Project planning & governance             | Partially (COMMIT_PLAN.md)                                                     | Budget/cohort/ship window (BQ-05)                                                                             |
| P05   | Solution architecture                     | SOURCE_DERIVED (docs 02/03/04, 20 ADRs)                                        | Reconcile CF-01/02; 8-agent + 6-memory canonical map; kill-switch design                                      |
| P06   | Tech stack & engineering standards        | IMPLEMENTED (repo)                                                             | Verify standards vs ADRs; CI quality gates                                                                    |
| P07   | Data architecture & DB design             | IMPLEMENTED (models, alembic, memory schemas)                                  | Verify 6 memory types; projection rebuild proofs                                                              |
| P08   | API, integration & contract design        | IMPLEMENTED (24 routers, OpenAPI)                                              | Verify contracts/versioning; MCP profile                                                                      |
| P09   | UI/UX & design system                     | IMPLEMENTED_UNVERIFIED (ui-kit, routes)                                        | a11y run; .pen design assets check                                                                            |
| P10   | Frontend implementation                   | IMPLEMENTED_WITH_EVIDENCE (jest 37/37; e2e 39/39)                              | Keep suites green; a11y run (P14)                                                                             |
| P11   | Backend implementation                    | IMPLEMENTED_WITH_EVIDENCE (2333 pass / 0 fail / 2 xfailed)                     | P11 gate report + handoff; ApprovalCard wiring; close consent/GDPR verification                               |
| P12   | AI, agent, memory & data pipeline         | IMPLEMENTED_UNVERIFIED                                                         | 8-agent scope enforcement (CF-05); 6-memory taxonomy enforcement; memory quality evals                        |
| P13   | Security, privacy & compliance            | IMPLEMENTED_WITH_EVIDENCE (security suite 172/172)                             | Legal review; DPDP doc; draft-only proof                                                                      |
| P14   | Testing & quality engineering             | Partial (10 suites on disk)                                                    | a11y/load/fuzz/chaos runs + evidence; mutation/load configs                                                   |
| P15   | Performance, reliability, scalability     | SOURCE_DERIVED                                                                 | SLOs; load/chaos runs; capacity plan                                                                          |
| P16   | DevOps, infra, CI/CD                      | IMPLEMENTED_UNVERIFIED (infra + 11 workflows)                                  | Fix prettier format:check + CI-scope ruff (RISK-P00-11/12); deploy proof (SLSA)                               |
| P17   | Observability & operations                | IMPLEMENTED_UNVERIFIED (OTEL in repo)                                          | Fix OTEL/protobuf on Py 3.14; dashboards/alerts live                                                          |
| P18   | Documentation & knowledge transfer        | Docs MATURE (492 files)                                                        | Phase-linked docs; superseded cleanup                                                                         |
| P19   | Release readiness & production deployment | NOT_EXECUTED                                                                   | BQ-02/04; env provisioning; rollback runbook                                                                  |
| P20   | Post-deployment validation                | NOT_EXECUTED                                                                   | Smoke/health verification                                                                                     |
| P21   | Maintenance & continuous improvement      | NOT_EXECUTED                                                                   | Retro process; feature-flag ops                                                                               |

**Legend:** ✅ complete · NOT_STARTED · IMPLEMENTED_WITH_EVIDENCE ·
IMPLEMENTED_UNVERIFIED · SOURCE_DERIVED · NOT_EXECUTED · BLOCKED

## 3. Entry criteria for P01 (Definition of Ready — prompt §26)

- [x] P00 gate issued — ✅ approved by user 2026-08-07; re-run 2026-08-12
      (73.79) + completion re-score (75.69) **awaiting user verdict** (09 §8)
- [x] Baseline pushed / pinned — `3ad6bca` 0/0 vs origin (2026-08-12)
- [x] BQ-01 approver named — USER (sole approver, 2026-08-07)
- [x] Scope/requirements source (INT-05) accepted
- [x] Evidence plan + register in place — 03/11 + P01 evidence plan
- [x] No critical blocker makes P01 unsafe (documentation/research only — OK)

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

| ID         | Date       | Change                                                                                       | Rationale                                           | Approver    | Status                                   |
| ---------- | ---------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------- | ---------------------------------------- |
| CHG-P00-01 | 2026-08-06 | Deliverables at `docs/phases/mvp-p00/`                                                       | User decision (Q&A)                                 | User        | APPROVED                                 |
| CHG-P00-02 | 2026-08-06 | Gate restricted to CONDITIONAL GO until INT-01 + BQ answers                                  | Missing governing input                             | Phase owner | PENDING user                             |
| CHG-P00-03 | 2026-08-12 | Completion pass: add deliverables 10–14 (prompt §10/§23/overlay/§26/§27/§30) + gate re-score | Close remaining P00-owned prompt items (DEC-P00-08) | User        | PENDING user (approve with gate verdict) |
