# MVP-P07 — 08. Registers (Risks / Decisions / Assumptions)

> Phase snapshot 2026-08-07. Burndown at each gate.

## 1. Risks

| ID           | Risk                                                            | Sev      | Mitigation                                                       | Owner    | Status |
| ------------ | --------------------------------------------------------------- | -------- | ---------------------------------------------------------------- | -------- | ------ |
| RISK-P03..06 | carried                                                         | per-item | per prior phases                                                 | per-item | OPEN   |
| RISK-P07-01  | Backfill mapping (free-form → 6 domains) misclassifies memories | MED      | reviewed mapping table + tests; default `document` + flagged     | Data     | OPEN   |
| RISK-P07-02  | RLS breaks existing app queries (SQLite tests ≠ Postgres)       | HIGH     | CI integration on real Postgres; downgrade path; invariant suite | Security | OPEN   |
| RISK-P07-03  | Embedding dim change cascades (CF-P07-02)                       | MED      | guarded 0007 + rebuild; provider pin at P12                      | Data     | OPEN   |
| RISK-P07-04  | create_all in prod startup bypasses alembic                     | MED      | gate behind ENV!=prod at P11                                     | Backend  | OPEN   |
| RISK-P07-05  | Erasure incomplete across projections/backups                   | HIGH     | erasure matrix + receipt; P14 tests                              | Privacy  | OPEN   |

## 2. Decisions

| ID          | Decision                                                                                           | Authority        | Date       |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| DEC-P03..06 | carried                                                                                            | User/Program     | 2026-08-07 |
| DEC-P07-01  | **BQ-P07-01: user-driven retention; indefinite grace; backups 30d; legal hold only when required** | User             | 2026-08-07 |
| DEC-P07-02  | **BQ-P07-02: RPO ≤24h daily backup; RTO ≤24h best-effort**                                         | User             | 2026-08-07 |
| DEC-P07-03  | Migrations 0003..0007 design adopted (approval, taxonomy, RLS, provenance, vector)                 | Data Architect   | 2026-08-07 |
| DEC-P07-04  | 6-memory taxonomy via domain enum + supersession (no table split)                                  | INT-02 §4 + REPO | 2026-08-07 |

## 3. Assumptions

| ID         | Assumption                                                              | Owner    | Reversible?      |
| ---------- | ----------------------------------------------------------------------- | -------- | ---------------- |
| ASP-P07-01 | Existing 33-table schema is migration base (no rewrite)                 | Data     | Yes              |
| ASP-P07-02 | Composite (tenant, workspace) NOT NULL enforceable on all scoped tables | Database | Yes              |
| ASP-P07-03 | Free-tier Postgres supports RLS + pgvector (Neon/Supabase-class)        | Platform | Yes — verify P15 |
| ASP-P07-04 | Daily backup within free-tier storage budget                            | FinOps   | Yes              |

## 4. Evidence (EVD)

| ID              | Claim                               | Requirement     | Location             | Status   |
| --------------- | ----------------------------------- | --------------- | -------------------- | -------- |
| EVD-MVP-P07-001 | Schema truth read (33 tables, gaps) | MVP-P07-R01/R02 | `01` §3              | VERIFIED |
| EVD-MVP-P07-002 | Data models + dictionary            | MVP-P07-R06     | `03`                 | VERIFIED |
| EVD-MVP-P07-003 | Migration/rollback plan             | MVP-P07-R04/R05 | `04`                 | VERIFIED |
| EVD-MVP-P07-004 | Isolation rules                     | MVP-P07-R03     | `05`                 | VERIFIED |
| EVD-MVP-P07-005 | Provenance/lifecycle/erasure        | MVP-P07-R06     | `06`                 | VERIFIED |
| EVD-MVP-P07-006 | Backup/query/capacity               | MVP-P07-R05     | `07`                 | VERIFIED |
| EVD-MVP-P07-007 | BQ-P07-01/02 user decisions         | MVP-P07-R03     | question-tool record | VERIFIED |
| EVD-MVP-P07-008 | User ratification of data design    | R08             | PENDING user         | PENDING  |
