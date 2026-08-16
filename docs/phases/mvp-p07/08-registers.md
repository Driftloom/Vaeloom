# MVP-P07 — 08. Registers (Risks / Decisions / Assumptions)

> Phase snapshot 2026-08-13 (comprehensive rewrite). Burndown at each gate.

## 1. Risks

| ID           | Risk                                                                           | Sev      | Mitigation                                                             | Owner    | Status |
| ------------ | ------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------- | -------- | ------ |
| RISK-P03..06 | carried                                                                        | per-item | per prior phases                                                       | per-item | OPEN   |
| RISK-P07-01  | Backfill mapping (free-form → 6 domains) misclassifies memories                | MED      | reviewed mapping table + tests; default `document` + flagged           | Data     | OPEN   |
| RISK-P07-02  | RLS breaks existing app queries (SQLite tests ≠ Postgres)                      | HIGH     | CI integration on real Postgres; downgrade path; invariant suite       | Security | OPEN   |
| RISK-P07-03  | Embedding dim change cascades (CF-P07-02)                                      | MED      | guarded 0007 + rebuild; provider pin at P12                            | Data     | OPEN   |
| RISK-P07-04  | create_all in prod startup bypasses alembic                                    | MED      | gate behind ENV!=prod at P11                                           | Backend  | OPEN   |
| RISK-P07-05  | Erasure incomplete across projections/backups                                  | HIGH     | gdpr.py misses 15+ tables; erasure matrix updated; P14 tests + receipt | Privacy  | OPEN   |
| RISK-P07-06  | RLS policies are inert without SET app.* session variables                     | HIGH     | design session GUC in 05; implement at P11                             | Security | OPEN   |
| RISK-P07-07  | Dual migration system (Alembic 0001-0002 vs custom 0002-0007) causes conflicts | MED      | Alembic is canonical authority; custom runner dev-only (DEC-P07-04)    | Data     | OPEN   |
| RISK-P07-08  | retention.py auto-deletes contradict BQ-P07-01 "indefinite grace"              | MED      | reconcile at P11; BQ-P07-01 overrides auto-purge                       | Privacy  | OPEN   |
| RISK-P07-09  | No HNSW index on embeddings for vector search                                  | LOW      | add HNSW at P11 when real Postgres available                           | Data     | OPEN   |
| RISK-P07-10  | approval_request / approval_decision ORM models exist but have no migration    | HIGH     | Alembic migration required at P11; current ORM models are orphaned     | Data     | OPEN   |

## 2. Decisions

| ID          | Decision                                                                                           | Authority      | Date       |
| ----------- | -------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| DEC-P03..06 | carried                                                                                            | User/Program   | 2026-08-07 |
| DEC-P07-01  | **BQ-P07-01: user-driven retention; indefinite grace; backups 30d; legal hold only when required** | User           | 2026-08-07 |
| DEC-P07-02  | **BQ-P07-02: RPO ≤24h daily backup; RTO ≤24h best-effort**                                         | User           | 2026-08-07 |
| DEC-P07-03  | 6-memory taxonomy via domain enum + supersession (no table split)                                  | Data Architect | 2026-08-13 |
| DEC-P07-04  | Alembic is canonical migration authority; custom runner is dev-only                                | Data Architect | 2026-08-13 |
| DEC-P07-05  | RLS scope-key model: workspace_id + tenant_id composite filter                                     | Security       | 2026-08-13 |
| DEC-P07-06  | Session GUC setup via SET app.tenant_id / SET app.workspace_id per request                         | Security       | 2026-08-13 |

## 3. Assumptions

| ID         | Assumption                                                              | Owner    | Reversible?      |
| ---------- | ----------------------------------------------------------------------- | -------- | ---------------- |
| ASP-P07-01 | Existing 35-table schema is migration base (no rewrite)                 | Data     | Yes              |
| ASP-P07-02 | Composite (tenant, workspace) NOT NULL enforceable on all scoped tables | Database | Yes              |
| ASP-P07-03 | Free-tier Postgres supports RLS + pgvector (Neon/Supabase-class)        | Platform | Yes — verify P15 |
| ASP-P07-04 | Daily backup within free-tier storage budget                            | FinOps   | Yes              |

## 4. Evidence (EVD)

| ID              | Claim                                                         | Requirement     | Location             | Status   |
| --------------- | ------------------------------------------------------------- | --------------- | -------------------- | -------- |
| EVD-MVP-P07-001 | Schema truth read (35 tables, gaps)                           | MVP-P07-R01/R02 | `01` §3              | VERIFIED |
| EVD-MVP-P07-002 | Data models + dictionary (all 35 tables, per-column metadata) | MVP-P07-R06     | `03`                 | VERIFIED |
| EVD-MVP-P07-003 | Migration/rollback plan (dual system documented)              | MVP-P07-R04/R05 | `04`                 | VERIFIED |
| EVD-MVP-P07-004 | Isolation rules (4-table RLS, target state designed)          | MVP-P07-R03     | `05`                 | VERIFIED |
| EVD-MVP-P07-005 | Provenance/lifecycle/erasure (gaps identified)                | MVP-P07-R06     | `06`                 | VERIFIED |
| EVD-MVP-P07-006 | Backup/query/capacity (33 indexes documented)                 | MVP-P07-R05     | `07`                 | VERIFIED |
| EVD-MVP-P07-007 | BQ-P07-01/02 user decisions                                   | MVP-P07-R03     | question-tool record | VERIFIED |
| EVD-MVP-P07-008 | User ratification of data design                              | R08             | PENDING user         | PENDING  |
