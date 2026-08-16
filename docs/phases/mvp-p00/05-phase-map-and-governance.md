# MVP-P00 — 05. Phase Map and Governance

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Purpose:** map
> current artifacts to the MVP phase plan (MVP-P00…P21), identify
> missing/unverified items, define governance (roles, gate authority, entry
> criteria, prohibited work). **Re-audited 2026-08-16** — P06/P07 now show
> in-flight (uncommitted) evidence; P00 pin `3ad6bca` immutable. **Register
> root:** `docs/phases/mvp-p00/`

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

### 2.1 Phase execution status (corrected 2026-08-16 audit)

| Phase | Name                                      | Status                                  | Evidence                                                                  |
| ----- | ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| P00   | Intake & existing-state assessment        | **COMPLETE** (accepted with conditions) | 2335 tests, 574 docs, 26 ADRs, full re-audit 2026-08-16                   |
| P01   | Discovery & problem definition            | **COMPLETE** (accepted with conditions) | Problem statement + user cohort research                                  |
| P02   | Research, domain & data discovery         | **COMPLETE** (accepted with conditions) | Job/market/legal research delivered                                       |
| P03   | Requirements engineering                  | **COMPLETE** (accepted with conditions) | Traceable reqs from INT-05                                                |
| P04   | Project planning & governance             | **COMPLETE** (accepted with conditions) | Budget/cohort/ship window documented                                      |
| P05   | Solution architecture                     | **COMPLETE** (accepted with conditions) | 8-agent + 6-memory canonical map reconciled                               |
| P06   | Tech stack & engineering standards        | **CONDITIONALLY APPROVED**              | Conflicts resolved, carried failures (RISK-P00-11/12: format:check, ruff) |
| P07   | Data architecture & DB design             | **Has evidence, status TBD**            | New alembic 0003–0006, erasure/export/provenance services                 |
| P08   | API, integration & contract design        | **Has evidence, status TBD**            | 24 routers, OpenAPI present                                               |
| P09   | UI/UX & design system                     | **Has evidence, status TBD**            | ui-kit, routes implemented                                                |
| P10   | Frontend implementation                   | **Has evidence, status TBD**            | jest 37/37, e2e 39/39                                                     |
| P11   | Backend implementation                    | **Has evidence, status TBD**            | 2333 pass / 0 fail / 2 xfailed                                            |
| P12   | AI, agent, memory & data pipeline         | **Has evidence, status TBD**            | 21 agents, 6 memory types                                                 |
| P13   | Security, privacy & compliance            | **Has evidence, status TBD**            | Security suite 172/172                                                    |
| P14   | Testing & quality engineering             | **Has evidence, status TBD**            | 10 suites on disk, e2e live                                               |
| P15   | Performance, reliability, scalability     | **NOT STARTED**                         | No SLOs, no load runs                                                     |
| P16   | DevOps, infra, CI/CD                      | **Has evidence, status TBD**            | 11 workflows, infra present                                               |
| P17   | Observability & operations                | **NOT STARTED**                         | OTel partial, Prometheus commented out                                    |
| P18   | Documentation & knowledge transfer        | **Has evidence, status TBD**            | 574 docs                                                                  |
| P19   | Release readiness & production deployment | **NOT STARTED**                         | No deploy, no prod env                                                    |
| P20   | Post-deployment validation                | **NOT STARTED**                         | No deployment exists                                                      |
| P21   | Maintenance & continuous improvement      | **NOT STARTED**                         | No retro process                                                          |

### 2.2 Blocking items (must resolve before GO)

| Blocker                                                      | Severity                    | Owning phase |
| ------------------------------------------------------------ | --------------------------- | ------------ |
| Approval gate inert (`has_approval=False` hardcoded)         | Critical — release blocker  | P11          |
| RLS covers 4/36 tables, GUC never SET                        | Critical — security blocker | P07          |
| 3 middleware layers not mounted (IP allowlist, tenant, SCIM) | High                        | P07/P16      |
| 7 frontend pages use hardcoded mock data                     | Medium                      | P10/P11      |
| Dual migration systems (alembic + runner)                    | Medium                      | P07          |

### 2.3 Detailed phase states (preserved from previous audit)

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
