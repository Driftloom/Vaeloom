# MVP-P07 — 10. Handoff to MVP-P08 (API, Integration & Contract Design)

> **Phase:** MVP-P07 → MVP-P08 · **Date:** 2026-08-13 (comprehensive rewrite) ·
> **Gate:** ✅ CONDITIONAL GO (95/100) — pending user ratification. P08 must
> validate, not assume.

## 1. What P08 receives

| Item                                                                   | Where                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| Complete data dictionary for all 35+ tables (per-column metadata)      | `03-data-models-dictionary.md`                    |
| Migration plan with dual system documented (Alembic + custom runner)   | `04-migration-rollback.md`, `03`                  |
| Isolation rules with scope-key model and session GUC design            | `05-isolation-rules.md`                           |
| Provenance/lifecycle with erasure matrix and gaps (15+ tables missing) | `06-provenance-lifecycle-deletion.md`             |
| Backup/query/capacity with index inventory (33 indexes)                | `07-backup-query-capacity.md`                     |
| Approval contract schema (FR-50/51)                                    | `03` §2 + `../mvp-p05/04-service-contracts.md` §3 |
| Requirements + traceability                                            | `../mvp-p03/03/04/05`                             |

## 2. P08 focus (API, Integration & Contract Design)

1. **Static OpenAPI 3.1 contract** (EXT-08; repo has dynamic spec only) with
   compatibility test; RFC 9457 error envelope; versioning.
2. **Approval API:** propose → decide → execute (idempotent) endpoints over the
   `approval_request/decision` tables; payload hash verification; expiry; replay
   guard; audit.
3. **Memory API:** domain-typed CRUD + supersession semantics + retrieval
   (≥80%); RAG endpoints for agents.
4. **Gmail connector API design:** polling watcher (FR-40, DEC-P02-01), scopes
   per RFC 9700 (PKCE, constrained tokens), quota pacing; deadline extraction
   contract (FR-41 ≥90%).
5. **Erasure/export/consent endpoints:** DPDP rights (access, correction,
   erasure), export (NFR-23), consent record (NFR-17).
6. **Events/queue contracts** per P05 §4 (job types, DLQ, correlation).
7. AuthN/AuthZ contracts: JWT claims ↔ workspace scope keys (P07 §05), CSRF
   skip-list verification, refresh rotation.
8. **RLS scope keys** (workspace_id + tenant_id) for authz contracts — must
   align with session GUC setup.
9. **Erasure matrix gaps** (15+ tables missing from gdpr.py) — P11 must fix
   before P08 API surface is production-ready.

## 3. Constraints carried

- $0; nearest region (BQ-P05-02, P13 flag); 99% best-effort (BQ-P05-01);
  retention user-driven (BQ-P07-01); RPO/RTO 24h (BQ-P07-02).
- Approval persistence = release-blocking (P05 restriction 2); draft-only Gmail
  (DEC-P01-03); T2/T3 gated (AUTO-02/03).
- Local/free LLM + embeddings (BQ-P06-02) — embedding dimension configurable
  (0007 guarded).
- No compliance claims without legal review (P13); no production (P19).
- RLS on 4 tables only (not 30+) — P11 must expand coverage.
- gdpr.py misses 15+ tables — P11 must fix before production.
- No SET app.* session variable mechanism — P11 must implement before RLS can
  function.
- Dual migration system — Alembic is canonical, custom runner is dev-only
  (DEC-P07-04).
- retention.py auto-delete conflicts with BQ-P07-01 — must reconcile at P11.
- approval_request / approval_decision ORM models exist without migration —
  Alembic migration required at P11.
