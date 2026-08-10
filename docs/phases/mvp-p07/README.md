# MVP-P07 — Data Architecture & Database Design

> **Prompt:** `MVP-P07` (66-prompt pack) — DATA_DESIGN phase **Governing
> sources:** INT-02 (SHA-256 `2FA8966F…69640`) · INT-05 · INT-09 · gatekeeper ·
> **Predecessor:** MVP-P06 ✅ CONDITIONAL GO 88/100, ratified 2026-08-07
> **Status:** ✅ COMPLETE — docs 01–10 written 2026-08-07; gate 88/100
> CONDITIONAL GO, pending user ratification; handoff to P08 ready

## Blocking questions (prompt §8) — resolved

| ID        | Question                                        | Decision                                                                                                                                                                                                                       | Owner    |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| BQ-01..05 | carried                                         | user; `master` @ `0c4f73a`; India 18+; $0 cohort                                                                                                                                                                               | per-item |
| BQ-P07-01 | Data owner + classification/retention/residency | **Owner = user (DPDP principal; Vaeloom = processor). Retention: user-driven — data kept until user deletes/closes account; indefinite grace (no auto-purge); backups expire 30 days; legal hold only when lawfully required** | User     |
| BQ-P07-02 | RPO/RTO                                         | **RPO ≤ 24h (daily backup); RTO ≤ 24h best-effort restore; tested P14/P19**                                                                                                                                                    | User     |

## Register index

| #   | Document                              | Purpose                                           |
| --- | ------------------------------------- | ------------------------------------------------- |
| 01  | `01-source-register.md`               | Sources + conflicts (CF-P07-01)                   |
| 02  | `02-predecessor-audit.md`             | Audit of P06 → entry GO                           |
| 03  | `03-data-models-dictionary.md`        | **DEL-MVP-P07-01** — models + data dictionary     |
| 04  | `04-migration-rollback.md`            | **DEL-MVP-P07-02** — migration/rollback plan      |
| 05  | `05-isolation-rules.md`               | **DEL-MVP-P07-03** — isolation/RLS rules          |
| 06  | `06-provenance-lifecycle-deletion.md` | **DEL-MVP-P07-04** — provenance/lifecycle/erasure |
| 07  | `07-backup-query-capacity.md`         | **DEL-MVP-P07-05** — backup/query/capacity        |
| 08  | `08-registers.md`                     | Risks/decisions/assumptions/evidence              |
| 09  | `09-gate-report.md`                   | End-of-phase gate                                 |
| 10  | `10-handoff-to-p08.md`                | Next-phase handoff (API & Contract Design)        |

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
  query/capacity — design only.
- **Out:** implementation (migrations executed at P11, RLS verified P13/P14),
  production changes, enterprise features, T2/T3 enablement.
- **Repo truth:** 33 ORM tables (`models/schema.py`); 2 alembic migrations;
  `Memory.type` free-form; `MemoryRecord` exists; provenance fields partially
  present; no approval tables, no RLS, no supersession column. Design =
  migrations on existing schema (ASP-P05-01), not rewrites.
