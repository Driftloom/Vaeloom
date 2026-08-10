# MVP-P07 — 01. Source Register

> Prompt §4 + §15. Schema read live 2026-08-07 (`0c4f73a`).

## 1. Internal sources

| ID         | Source                                                                 | Use             | Status    |
| ---------- | ---------------------------------------------------------------------- | --------------- | --------- |
| INT-01..10 | gatekeeper, INT-02 (SHA-256 `2FA8966F…69640`), INT-03/05/07/08/09      | as prior phases | Available |
| REPO       | `master` @ `0c4f73a`; `apps/backend/src/backend/models/schema.py` read | Schema truth    | Available |

## 2. External standards — verified at phase start

| ID           | Standard                       | Applicability                                 |
| ------------ | ------------------------------ | --------------------------------------------- |
| EXT-06       | RFC 9700 OAuth                 | P08 (token data)                              |
| EXT-08       | OpenAPI 3.1                    | P08 contracts                                 |
| EXT-11       | NIST SSDF 800-218              | P06 standards; applies to migrations          |
| EXT-12       | Gmail API                      | connector data (polling state)                |
| EXT-16       | DPDP Rules 2025                | retention/erasure/consent design (this phase) |
| EXT-14/15/17 | GDPR / EU AI Act / FERPA+COPPA | NOT_APPLICABLE (India; 18+; re-check P13)     |

## 3. Schema truth (live read)

| Table                                                                 | Existing columns (evidence)                                                                                                                                                                                                                                                       | Gap → this phase                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `memories`                                                            | id, type (free String(50)), status, title, summary, content, content_hash, size, embedding Vector(1536), metadata, tags, tenant_id/user_id/workspace_id, source_type/uri/label, connector_id, vector_id, graph_node_id, timestamps; idx (tenant,type),(tenant,status),(workspace) | 6-memory domain enum + CHECK; supersedes_id; deleted_at (ADR-022) |
| `memory_records`                                                      | workspace_id NOT NULL, type, content JSON, confidence, importance, freshness_at, source_document_id                                                                                                                                                                               | domain sync; supersession                                         |
| `embeddings`                                                          | (inventory) source refs                                                                                                                                                                                                                                                           | model_version/dim columns (ADR-024)                               |
| `applications`, `agent_actions`, `documents`, `schedule_events`, etc. | id + workspace/tenant scope                                                                                                                                                                                                                                                       | idempotency_key on consequential tables (ADR-021)                 |
| —                                                                     | **NO approval tables**                                                                                                                                                                                                                                                            | NEW `approval_request`, `approval_decision` (ADR-021)             |
| —                                                                     | **NO RLS policies**                                                                                                                                                                                                                                                               | RLS + composite constraints (ADR-023)                             |
| —                                                                     | 2 alembic migrations only                                                                                                                                                                                                                                                         | 0003..0006 plan (`04`)                                            |

## 4. Conflict log

| ID        | Conflict                                                                                          | Resolution                                                                                        | Authority        | Date       |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| CF-P07-01 | INT-09 memory intent (6 stores as separate stores) vs single `memories` table with free-form type | ADR-022 (P05): domain-typed rows + supersession; no table split; migrations only                  | INT-02 §4 + REPO | 2026-08-07 |
| CF-P07-02 | Embedding Vector(1536) (OpenAI) vs BQ-P06-02 local/free embeddings                                | Dimension made configurable; migration 0007 guarded re-embed (ADR-024); final provider pinned P12 | User BQ-P06-02   | 2026-08-07 |

Evidence: `EVD-MVP-P07-001` (schema read, this register).
