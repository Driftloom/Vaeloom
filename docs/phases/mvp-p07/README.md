# MVP-P07 — Data Architecture & Database Design

> **Prompt:** `MVP-P07` (66-prompt pack) — DATA_DESIGN phase **Governing
> sources:** INT-02 · INT-05 · INT-09 · gatekeeper · **Predecessor:** MVP-P06 ✅
> CONDITIONAL GO (69.9/100, carried failures) **Status:** 🟡 COMPLETE — docs
> rewritten + code implemented 2026-08-17; gate 91.4/100 CONDITIONAL GO; handoff
> to P08 ready

## Blocking questions (prompt §8) — resolved

| ID        | Question                                        | Decision                                                                                                                                                                                                                       | Owner    |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| BQ-01..05 | carried                                         | user; `master` @ HEAD; India 18+; $0 cohort                                                                                                                                                                                    | per-item |
| BQ-P07-01 | Data owner + classification/retention/residency | **Owner = user (DPDP principal; Vaeloom = processor). Retention: user-driven — data kept until user deletes/closes account; indefinite grace (no auto-purge); backups expire 30 days; legal hold only when lawfully required** | User     |
| BQ-P07-02 | RPO/RTO                                         | **RPO ≤ 24h (daily backup); RTO ≤ 24h best-effort restore; tested P14/P19**                                                                                                                                                    | User     |

## Code implementation (2026-08-17)

| Artifact                                       | Type      | Description                         |
| ---------------------------------------------- | --------- | ----------------------------------- |
| `alembic/versions/0007_missing_tables.py`      | Migration | Creates 3 missing tables            |
| `alembic/versions/0008_schema_gaps.py`         | Migration | Adds 5 missing columns              |
| `alembic/versions/0009_memory_domain_check.py` | Migration | CHECK constraint on memories.domain |
| `alembic/versions/0010_rls_force_and_roles.py` | Migration | FORCE RLS + 3 roles                 |
| `alembic/versions/0011_hnsw_index.py`          | Migration | HNSW vector index                   |
| `middleware/tenant.py`                         | Fix       | SET LOCAL for PgBouncer safety      |
| `database.py`                                  | Fix       | RLS wiring in get_db()              |
| `infrastructure/vector_store.py`               | Fix       | ORM column alignment                |
| `ingestion/pipeline.py`                        | Feature   | Real DB persistence                 |
| `scripts/backup.sh`                            | Script    | Production backup                   |
| `scripts/restore.sh`                           | Script    | Restore + smoke test                |
| `tests/test_rls_isolation.py`                  | Test      | 4 RLS isolation tests               |

## Register index

| #   | Document                              | Purpose                                                   |
| --- | ------------------------------------- | --------------------------------------------------------- |
| 01  | `01-source-register.md`               | Sources + conflicts                                       |
| 02  | `02-predecessor-audit.md`             | Audit of P06 → entry GO                                   |
| 03  | `03-data-models-dictionary.md`        | **DEL-MVP-P07-01** — models + data dictionary (38 tables) |
| 04  | `04-migration-rollback.md`            | **DEL-MVP-P07-02** — 11 Alembic migrations                |
| 05  | `05-isolation-rules.md`               | **DEL-MVP-P07-03** — 34-table RLS + FORCE + roles         |
| 06  | `06-provenance-lifecycle-deletion.md` | **DEL-MVP-P07-04** — provenance/lifecycle/erasure         |
| 07  | `07-backup-query-capacity.md`         | **DEL-MVP-P07-05** — backup/query/HNSW                    |
| 08  | `08-registers.md`                     | Risks/decisions/assumptions/evidence                      |
| 09  | `09-gate-report.md`                   | Gate: 91.4/100 CONDITIONAL GO                             |
| 10  | `10-handoff-to-p08.md`                | Next-phase handoff                                        |

## Workstreams

| WS      | Workstream                         | Owner              | Output     |
| ------- | ---------------------------------- | ------------------ | ---------- |
| WS-07.1 | Conceptual/logical/physical model  | Data Architect     | `03`       |
| WS-07.2 | Isolation/authorization invariants | Security Architect | `05`       |
| WS-07.3 | Provenance/lifecycle/rights        | Privacy Engineer   | `06`       |
| WS-07.4 | Migration/backup/recovery          | Database Engineer  | `04`, `07` |
| WS-07.5 | Indexes/query/capacity             | Data Engineer      | `07`       |

## Scope note

- **In:** models, isolation, provenance, lifecycle, migration, backup, deletion,
  query/capacity — **design + code implementation**.
- **Out:** production deployment, enterprise features, T2/T3 enablement.
- **Repo truth:** 38 ORM classes (35 unique tables); 11 Alembic migrations
  (0001-0011); RLS on 34 tables with FORCE; HNSW vector index; production
  backup/restore scripts.
