# MVP-P05 — 08. Registers (Risks / Decisions / Assumptions / Evidence) — Re-Run 2026-08-15

> Phase snapshot at baseline `6e8a7b4`. Prior run (2026-08-07) preserved as
> `08-registers-2026-08-07.md`; this register refreshes all rows at the new
> baseline with zero-trust repo evidence (`01-source-register.md` §4).

## 1. Risks

| ID              | Risk                                                                                                                                                                                 | Sev       | Mitigation                                                                                                                  | Owner        | Status |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| RISK-MVP-P05-01 | Architecture gaps misread as implemented — code exists at HEAD but is UNVERIFIED (approval/idempotency/RLS/taxonomy/watch)                                                           | CRIT      | Zero-trust inspection (01 §4); statuses IMPLEMENTED_UNVERIFIED; verify tasks bound to P07/P11/P12                           | Architecture | OPEN   |
| RISK-MVP-P05-02 | Approval gate NOT enforced in agent loop (`application_agent/handler.py` emits string `request_approval`; manager never called); no payload-hash column; immutability not structural | CRIT      | ADR-021 verify at P07/P11; wire approval_manager; add payload_hash; immutable-decide; release blocker for send-capable path | Security     | OPEN   |
| RISK-MVP-P05-03 | Cross-tenant leak via app-level scoping only — RLS covers 4/36 tables (`memories, events, usage_records, api_keys`) and GUC `app.tenant_id` never SET                                | HIGH      | ADR-023: verify/complete policy coverage P07; isolation suite P14; NFR-15/h15                                               | Security     | OPEN   |
| RISK-MVP-P05-04 | Gmail scope/quota/watch-renewal surprises (watch added 2026; renewal/reconciliation unverified)                                                                                      | HIGH      | Polling-first (DEC-P02-01); quota pacing; watch renewal/reconciliation P07/P11; P02 quota facts                             | Integration  | OPEN   |
| RISK-MVP-P05-05 | Data residency outside India (free tiers)                                                                                                                                            | MED       | BQ-P05-02; DPDP residency risk → legal review P13                                                                           | Privacy      | OPEN   |
| RISK-MVP-P05-06 | LLM cost runaway on $0                                                                                                                                                               | MED       | circuit breaker, agent_limits/agent_costs, spend log (REPO_VERIFIED); enforce breadth P10/P11                               | FinOps       | OPEN   |
| RISK-MVP-P05-07 | Payload-bound approval UX friction (P1 persona)                                                                                                                                      | MED       | review-first flows; acceptance tests                                                                                        | Product      | OPEN   |
| RISK-MVP-P05-08 | **Dual migration systems** (`alembic/versions/` vs `src/backend/migrations/`) — drift/partial-apply risk                                                                             | HIGH      | NEW FINDING CF-P05-04; unify single migration path at P07 (ADR); migration tests P14                                        | Data/Eng     | OPEN   |
| RISK-MVP-P05-09 | `packages/contracts` empty → contract duplication between backend and web client                                                                                                     | MED       | Centralize typed contracts at P08; transformKeys carried (CF-P04-02)                                                        | API/Arch     | OPEN   |
| RISK-P03-01..05 | Docs vs runtime / scope / drift / evidence / expansion (carried)                                                                                                                     | CRIT/HIGH | Runtime evidence; pins; change control                                                                                      | per-item     | OPEN   |

## 2. Decisions

| ID                              | Decision                                                                                                                                   | Authority    | Date       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------- |
| DEC-P03-01..07 / DEC-P04-01..08 | carried (requirements baseline 76 rows; release baseline P0+P1=73; ship window scenario-based; etc.)                                       | User/Program | 2026-08-1x |
| DEC-P05-01                      | BQ-P05-01: 99% best-effort availability, no SLA, degraded modes OK                                                                         | User         | 2026-08-07 |
| DEC-P05-02                      | BQ-P05-02: nearest-region hosting; DPDP residency flagged P13                                                                              | User         | 2026-08-07 |
| DEC-P05-03                      | ADR-021..026 adopted at new baseline `6e8a7b4` (statuses reconciled: 021/022/023 IMPLEMENTED_UNVERIFIED, 025 PROPOSED-GAP, 024/026 design) | Architecture | 2026-08-15 |
| DEC-P05-04                      | Architecture baseline = repo `6e8a7b4` + refreshed gap set (01 §4); prior 2026-08-07 gap list superseded                                   | Evidence     | 2026-08-15 |
| DEC-P05-05                      | Re-run pattern: prior P05 evidence preserved as `*-2026-08-07.md`; fresh files at new baseline                                             | Program      | 2026-08-15 |

## 3. Assumptions

| ID                          | Assumption                                                                                       | Owner       | Reversible?        |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ----------- | ------------------ |
| ASP-05/06/07, ASP-P04-01/02 | carried                                                                                          | per-item    | Yes                |
| ASP-P05-01                  | 36-table schema + migration tables remain the base; ADR-021/022/023 add migrations, not rewrites | Data        | Yes                |
| ASP-P05-02                  | Single FastAPI service + worker suffices for 100/1,000 design                                    | Engineering | Yes — verified P15 |
| ASP-P05-03                  | Free-tier LLM (anthropic/openai) usable for MVP eval + cohort                                    | AI          | Yes                |
| ASP-P05-04                  | Gmail watch exists but MVP stays polling-first until >100 users or latency breach                | Integration | Yes                |

## 4. Deferred ideas (future backlog — reviewed each gate)

| Idea                                                                     | Trigger                                   | Owner       | Notes                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| Gmail push (watch → push path)                                           | >100 users or p95 deadline-latency breach | Integration | polling first (DEC-P02-01); watch machinery exists (NOT_EXECUTED push wiring) |
| RLS native enforcement (full table coverage + GUC set)                   | P07 verify / P14 suite                    | Security    | currently 4/36 tables                                                         |
| k8s/terraform prod                                                       | enterprise track                          | Cloud       | PaaS-first MVP (ADR-026); `infra/kubernetes`+`infra/terraform` = future       |
| T2 discovery / T3 autopilot                                              | legal review + flags                      | Product     | AUTO-02/03 OFF                                                                |
| Enterprise SSO UI, billing, marketplace, multi-region, cross-user memory | MVP gates                                 | Product     | never in MVP                                                                  |

## 5. Evidence (EVD)

| ID              | Claim                                                              | Requirement     | Location                             | Status   |
| --------------- | ------------------------------------------------------------------ | --------------- | ------------------------------------ | -------- |
| EVD-MVP-P05-001 | Zero-trust repo inventory at `6e8a7b4` (backend/agents/migrations) | MVP-P05-R01/R02 | `01-source-register.md` §4           | VERIFIED |
| EVD-MVP-P05-002 | Zero-trust repo inventory (web/infra/CI/tests/contracts)           | MVP-P05-R01/R02 | `01-source-register.md` §4           | VERIFIED |
| EVD-MVP-P05-003 | C4/trust/data-flow defined at HEAD reality (30 routers, 36 tables) | MVP-P05-R01     | `03-c4-trust-dataflow.md`            | VERIFIED |
| EVD-MVP-P05-004 | Service contracts mapped to HEAD routers/services                  | MVP-P05-R02/R06 | `04-service-contracts.md`            | VERIFIED |
| EVD-MVP-P05-005 | ADR-021..026 (real files in `docs/adr/`)                           | MVP-P05-R01/R03 | `05-adrs.md` + `docs/adr/ADR-02*.md` | VERIFIED |
| EVD-MVP-P05-006 | Threat mapping w/ existing-control evidence (OWASP Agentic/LLM)    | MVP-P05-R03     | `06-threat-architecture.md`          | VERIFIED |
| EVD-MVP-P05-007 | Failure/evolution + SLOs (99% best-effort)                         | MVP-P05-R04/R05 | `07-failure-evolution.md`            | VERIFIED |
| EVD-MVP-P05-008 | BQ-P05-01/02 user decisions (carried 2026-08-07)                   | MVP-P05-R03     | DEC-P05-01/02; question-tool record  | VERIFIED |
| EVD-MVP-P05-009 | P04 predecessor audit + entry decision                             | MVP-P05-R07     | `02-predecessor-audit.md`            | VERIFIED |
| EVD-MVP-P05-010 | User ratification of architecture baseline                         | MVP-P05-R08     | PENDING user verdict                 | PENDING  |
