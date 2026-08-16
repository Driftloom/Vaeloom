# MVP-P07 — 10. Handoff to MVP-P08 (API, Integration, and Contract Design)

> **Phase:** MVP-P07 → MVP-P08 · **Date:** 2026-08-17 · **Baseline:** repo
> `master` @ HEAD · **Gate state:** 🟡 **PHASE CONDITIONALLY APPROVED —
> RESTRICTIONS APPLY** (93.4/100, `09-gate-report.md`); **USER verdict pending**
> (sole gate authority, BQ-01). **P08 starts ONLY on user command.**

## 1. What P08 receives (validated — do not assume, re-verify)

| Item                                                                                        | Where                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| P06 predecessor audit + P06 CONDITIONAL GO (69.9/100, carried failures)                     | `../mvp-p06/10-handoff-to-p07.md`           |
| Data models/dictionary (DEL-01): 38 ORM tables + 14 microservice tables, all columns documented | `03-data-models-dictionary.md` |
| Migration/rollback plan (DEL-02): 11 Alembic migrations (0001-0011), dual system documented | `04-migration-rollback.md`                  |
| Isolation rules (DEL-03): 34-table RLS, SET LOCAL, FORCE RLS, 3 roles, CI tests             | `05-isolation-rules.md`                     |
| Provenance/lifecycle/deletion (DEL-04): supersession chain, erasure matrix, retention       | `06-provenance-lifecycle-deletion.md`       |
| Backup/query/capacity (DEL-05): production scripts, HNSW index, 34 indexes                  | `07-backup-query-capacity.md`               |
| Registers: risks, decisions, assumptions, EVD                                               | `08-registers.md`                           |
| Gate + handoff + completion response                                                        | `09-gate-report.md`, `10-handoff-to-p08.md` |
| P00–P07 chain                                                                               | `../mvp-p00/` … `../mvp-p07/`               |

## 2. Code changes delivered

| Change                   | Files                                          | Description                                                                    |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Missing tables migration | `alembic/versions/0007_missing_tables.py`      | Creates `agent_approvals`, `idempotency_records`, `gmail_watches`              |
| Schema gaps migration    | `alembic/versions/0008_schema_gaps.py`         | Adds 5 missing columns to `agent_executions` and `connectors`                  |
| Memory domain CHECK      | `alembic/versions/0009_memory_domain_check.py` | Enforces valid domain values with backfill                                     |
| FORCE RLS + roles        | `alembic/versions/0010_rls_force_and_roles.py` | FORCE on 34 tables, 3 PostgreSQL roles, BYPASSRLS revocation                   |
| HNSW index               | `alembic/versions/0011_hnsw_index.py`          | Replaces IVFFlat with HNSW for embeddings + memories                           |
| Fix broken RLS           | `alembic/versions/0012_fix_rls_policies.py`    | Drops broken policies, re-creates for correct tables, handles REVOKE BYPASSRLS |
| SET LOCAL fix            | `middleware/tenant.py:40-59`                   | PgBouncer-safe transaction-scoped GUCs                                         |
| get_db() wiring          | `database.py:23-39`                            | RLS setup on every request                                                     |
| Vector store fix         | `infrastructure/vector_store.py:44-67`         | Includes `dimensions` + `source_table` columns                                 |
| Ingestion pipeline       | `ingestion/pipeline.py`                        | Real DB writes (replaces mocked version)                                       |
| Backup script            | `scripts/backup.sh`                            | Production-grade with integrity check + S3 upload                              |
| Restore script           | `scripts/restore.sh`                           | Full restore with schema verification + smoke test                             |
| RLS isolation tests      | `tests/test_rls_isolation.py`                  | 4 tests: unset tenant, cross-tenant, own tenant, workspace isolation           |

## 3. P08 focus (API, Integration, and Contract Design)

1. **OpenAPI contract**: Define API schemas matching the actual 38-table data
   model
2. **API versioning**: Implement versioned endpoints (v1 prefix already exists)
3. **Request/response schemas**: Ensure Pydantic schemas match ORM models (27
   schema files exist)
4. **Error handling**: Standardize error responses across all 26 routers
5. **Webhook contracts**: Define event schemas for the event system (events
   table exists, handlers empty)
6. **Connector contracts**: Define integration interfaces for 6 integrations

## 4. Constraints carried

- $0 budget (DEC-P01-08); nearest-region PaaS (DEC-P05-02); 99% best-effort
- Repo truth outranks prose; single FastAPI service + worker
- Approval-gate enforcement = release-blocking (RISK-P05-02)
- RLS coverage verified at P07; full integration test at P14
- No compliance claims without legal review (P13); no production authority (P19)
- T2/T3 OFF (AUTO-02/03)

## 5. Prohibited work (P08 may NOT)

- No requirements changes outside approved change control
- No T2/T3 runtime activation without USER re-confirmation + legal review
- No compliance/security/accessibility/scale claims without evidence +
  professional review
- No scope expansion into enterprise features
- No production/dependent implementation without authority
- No weakening of constraints/tests to create a pass
