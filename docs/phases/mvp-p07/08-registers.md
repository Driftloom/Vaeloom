# MVP-P07 — 08. Registers (Risks / Decisions / Assumptions)

> Phase snapshot 2026-08-17 (code implementation complete). Burndown at each
> gate.

## 1. Risks

| ID           | Risk                                                                           | Sev      | Mitigation                                                                  | Owner    | Status |
| ------------ | ------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------- | -------- | ------ |
| RISK-P03..06 | carried                                                                        | per-item | per prior phases                                                            | per-item | OPEN   |
| RISK-P07-01  | Backfill mapping (free-form → 6 domains) misclassifies memories                | MED      | ✅ 0009 backfills NULL/invalid to 'document'; CHECK enforces                | Data     | CLOSED |
| RISK-P07-02  | RLS breaks existing app queries (SQLite tests ≠ Postgres)                      | HIGH     | ✅ CI isolation tests created; 4 test cases in test_rls_isolation.py        | Security | CLOSED |
| RISK-P07-03  | Embedding dim change cascades (CF-P07-02)                                      | MED      | guarded 0007 + rebuild; provider pin at P12                                 | Data     | OPEN   |
| RISK-P07-04  | create_all in prod startup bypasses alembic                                    | MED      | gate behind ENV!=prod at P11                                                | Backend  | OPEN   |
| RISK-P07-05  | Erasure incomplete across projections/backups                                  | HIGH     | gdpr.py misses 15+ tables; erasure matrix updated; P14 tests + receipt      | Privacy  | OPEN   |
| RISK-P07-06  | RLS policies are inert without SET app.* session variables                     | HIGH     | ✅ SET LOCAL implemented in middleware/tenant.py + database.py              | Security | CLOSED |
| RISK-P07-07  | Dual migration system (Alembic 0001-0002 vs custom 0002-0007) causes conflicts | MED      | Alembic is canonical authority; custom runner dev-only (DEC-P07-04)         | Data     | CLOSED |
| RISK-P07-08  | retention.py auto-deletes contradict BQ-P07-01 "indefinite grace"              | MED      | reconcile at P11; BQ-P07-01 overrides auto-purge                            | Privacy  | OPEN   |
| RISK-P07-09  | No HNSW index on embeddings for vector search                                  | LOW      | ✅ 0011 creates HNSW index on embeddings + memories                         | Data     | CLOSED |
| RISK-P07-10  | approval_request / approval_decision ORM models exist but have no migration    | HIGH     | ✅ 0007 creates agent_approvals; 0003 already has approval_request          | Data     | CLOSED |
| RISK-P07-11  | 3 tables have ORM models but no migration (NEW 2026-08-17)                     | HIGH     | ✅ 0007 creates all 3 (agent_approvals, idempotency_records, gmail_watches) | Data     | CLOSED |
| RISK-P07-12  | 5 columns have ORM models but no migration (NEW 2026-08-17)                    | HIGH     | ✅ 0008 adds all 5 columns                                                  | Data     | CLOSED |
| RISK-P07-13  | FORCE RLS missing — table owner bypasses policies                              | HIGH     | ✅ 0010 adds FORCE on all 34 tables                                         | Security | CLOSED |
| RISK-P07-14  | No BYPASSRLS migration role — migrations fail under RLS                        | MED      | ✅ 0010 creates vaeloom_migrator with BYPASSRLS                             | Security | CLOSED |

## 2. Decisions

| ID          | Decision                                                                                              | Authority      | Date       |
| ----------- | ----------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| DEC-P03..06 | carried                                                                                               | User/Program   | 2026-08-07 |
| DEC-P07-01  | **BQ-P07-01: user-driven retention; indefinite grace; backups 30d; legal hold only when required**    | User           | 2026-08-07 |
| DEC-P07-02  | **BQ-P07-02: RPO ≤24h daily backup; RTO ≤24h best-effort**                                            | User           | 2026-08-07 |
| DEC-P07-03  | 6-memory taxonomy via domain enum + supersession (no table split)                                     | Data Architect | 2026-08-13 |
| DEC-P07-04  | Alembic is canonical migration authority; custom runner is dev-only                                   | Data Architect | 2026-08-13 |
| DEC-P07-05  | RLS scope-key model: workspace_id + tenant_id composite filter                                        | Security       | 2026-08-13 |
| DEC-P07-06  | Session GUC setup via SET LOCAL app.tenant_id / SET LOCAL app.workspace_id per transaction            | Security       | 2026-08-17 |
| DEC-P07-07  | FORCE ROW LEVEL SECURITY on all 34 RLS tables (prevents owner bypass)                                 | Security       | 2026-08-17 |
| DEC-P07-08  | Three PostgreSQL roles: vaeloom_app (app), vaeloom_migrator (BYPASSRLS), vaeloom_readonly (analytics) | Security       | 2026-08-17 |
| DEC-P07-09  | HNSW index replaces IVFFlat for embeddings (m=16, ef_construction=64)                                 | Data Engineer  | 2026-08-17 |
| DEC-P07-10  | Ingestion pipeline writes real DB rows (replaces mocked version)                                      | Backend        | 2026-08-17 |
| DEC-P07-11  | Vector store PGVectorStore aligned with ORM model (includes dimensions + source_table)                | Data Engineer  | 2026-08-17 |

## 3. Assumptions

| ID         | Assumption                                                              | Owner    | Reversible?      |
| ---------- | ----------------------------------------------------------------------- | -------- | ---------------- |
| ASP-P07-01 | Existing 35-table schema is migration base (no rewrite)                 | Data     | Yes              |
| ASP-P07-02 | Composite (tenant, workspace) NOT NULL enforceable on all scoped tables | Database | Yes              |
| ASP-P07-03 | Free-tier Postgres supports RLS + pgvector (Neon/Supabase-class)        | Platform | Yes — verify P15 |
| ASP-P07-04 | Daily backup within free-tier storage budget                            | FinOps   | Yes              |

## 4. Evidence (EVD)

| ID              | Claim                                                         | Requirement     | Location                                       | Status   |
| --------------- | ------------------------------------------------------------- | --------------- | ---------------------------------------------- | -------- |
| EVD-MVP-P07-001 | Schema truth read (35 tables, gaps identified)                | MVP-P07-R01/R02 | `01` §3                                        | VERIFIED |
| EVD-MVP-P07-002 | Data models + dictionary (38 tables, per-column metadata)     | MVP-P07-R06     | `03`                                           | VERIFIED |
| EVD-MVP-P07-003 | Migration plan: 11 Alembic migrations (0001-0011)             | MVP-P07-R04/R05 | `04`                                           | VERIFIED |
| EVD-MVP-P07-004 | Isolation: 34-table RLS + FORCE + SET LOCAL + roles           | MVP-P07-R03     | `05`                                           | VERIFIED |
| EVD-MVP-P07-005 | Provenance/lifecycle/erasure (gaps identified, fixes applied) | MVP-P07-R06     | `06`                                           | VERIFIED |
| EVD-MVP-P07-006 | Backup/query/capacity (HNSW index, production scripts)        | MVP-P07-R05     | `07`                                           | VERIFIED |
| EVD-MVP-P07-007 | BQ-P07-01/02 user decisions                                   | MVP-P07-R03     | question-tool record                           | VERIFIED |
| EVD-MVP-P07-008 | Migration 0007 creates 3 missing tables                       | MVP-P07-R01     | `alembic/versions/0007_missing_tables.py`      | VERIFIED |
| EVD-MVP-P07-009 | Migration 0008 adds 5 missing columns                         | MVP-P07-R01     | `alembic/versions/0008_schema_gaps.py`         | VERIFIED |
| EVD-MVP-P07-010 | Migration 0009 CHECK constraint on memories.domain            | MVP-P07-R03     | `alembic/versions/0009_memory_domain_check.py` | VERIFIED |
| EVD-MVP-P07-011 | Migration 0010 FORCE RLS + BYPASSRLS role                     | MVP-P07-R03     | `alembic/versions/0010_rls_force_and_roles.py` | VERIFIED |
| EVD-MVP-P07-012 | Migration 0011 HNSW vector index                              | MVP-P07-R04     | `alembic/versions/0011_hnsw_index.py`          | VERIFIED |
| EVD-MVP-P07-013 | SET LOCAL PgBouncer-safe RLS wiring                           | MVP-P07-R03     | `middleware/tenant.py:40-59`                   | VERIFIED |
| EVD-MVP-P07-014 | CI isolation tests (4 test cases)                             | MVP-P07-R04     | `tests/test_rls_isolation.py`                  | VERIFIED |
| EVD-MVP-P07-015 | Production backup + restore scripts                           | MVP-P07-R05     | `scripts/backup.sh`, `scripts/restore.sh`      | VERIFIED |
| EVD-MVP-P07-016 | Ingestion pipeline persists to DB                             | MVP-P07-R01     | `ingestion/pipeline.py`                        | VERIFIED |
