# MVP-P07 — 06. Provenance / Lifecycle / Deletion (DEL-MVP-P07-04)

> Owner: Privacy Engineer · DPDP Rules 2025 (§5 notice, §6 consent, rights);
> BQ-P07-01 retention; FR-60/61/62, NFR-20, NFR-23.

## 1. Provenance (INT-02 §5)

| Element                 | Carried by                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Source                  | `source_type`, `source_uri`, `source_label`, `connector_id` (exists)                                                              |
| Version                 | `content_hash` + `updated_at` (exists); model/prompt/tool/retrieval/chunking/embedding/policy versions (INT-02 §4) → registry P12 |
| Correction/supersession | `supersedes_id` (new 0004) + `status` (SUPERSEDED) — old row retained, never silently overwritten (FR-68)                         |
| Projection lineage      | `embeddings.model_version/source_table/source_id` (0006); search index `schema_version`                                           |
| AI output               | QA gate record (`agent_executions`), extraction confidence (`memory_records.confidence`)                                          |
| Action                  | `agent_actions` + `approval_request/decision` (immutable)                                                                         |

## 2. Lifecycle states (per artifact)

```text
PROCESSING → ACTIVE → (correction → ACTIVE w/ supersedes) / SUPERSEDED
          → PENDING_DELETION → DELETED
Legal hold: HOLDLOCK set → deletion blocked until released
```

- `deleted_at` marks PENDING_DELETION (grace indefinite per BQ-P07-01; user
  action completes erasure).
- Backups: restore-source only; rows expire with backup (30 days, BQ-P07-01); a
  deletion is complete when primary + backup-expiry elapse — receipt states this
  (FR-62).

## 3. Erasure matrix (100% deletion — BQ-P02-03)

| Store                                 | Primary deletion                                                                        | Backup expiry              | Legal hold         |
| ------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- | ------------------ |
| Postgres (authoritative)              | hard delete on user action (erasure job)                                                | backup < 30d (RPO 24h)     | blocked while hold |
| Object storage (documents)            | delete objects (versioned)                                                              | S3 version purge after 30d | version locked     |
| Projections (pgvector, graph, search) | rebuild from relational truth (ADR-024) after delete                                    | n/a (derived)              | n/a                |
| Redis/queue                           | job purge + DLQ cleanup                                                                 | ephemeral                  | n/a                |
| Telemetry/audit                       | audit retained per DPDP §8 duty (anonymized where possible); telemetry no personal data | policy at P17              | per hold           |
| LLM provider                          | no raw personal data retained by policy; mock-first; provider DPA question → P13 legal  | —                          | —                  |

## 4. Export (NFR-23)

- User-triggered export job → JSON archive (memories, documents metadata,
  applications, schedule, approvals) + receipts; download signed URL (object
  storage); export availability recorded in audit.

## 5. Retention decisions (BQ-P07-01, user 2026-08-07)

1. Data kept until user deletes or closes account; **indefinite grace** — no
   auto-purge time limit.
2. Backups expire after 30 days; erasure receipt distinguishes primary deletion
   vs backup expiry (FR-62).
3. Legal hold only when lawfully required; deletion blocked while hold active.
4. Audit logs retained per DPDP §8 (breach/safety duties) with retention aligned
   at P13 legal review.
5. Consent records (consent_version, granted_at) kept for the life of the
   account + DPDP-required period after closure.
