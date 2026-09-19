# MVP-P05 — 05. ADRs (DEL-MVP-P05-03)

> Owner: AI Architect · ADR-001..020 live in `docs/adr/`. P05 adds ADR-021..026
> (versioned, owned, reversible). One-line summary per ADR with decision,
> consequences, reversibility, owner. **Statuses reconciled with HEAD
> (`6e8a7b4`)**: formerly-gap decisions are now partially implemented in code,
> so statuses reflect repo reality (`01-source-register.md` §4, CF-P05-05), not
> design-only. No fabrication: every REPO_VERIFIED path is cited; anything
> unverified is explicitly labelled.

| ID | Title | Decision | Consequences | Reversible? | Owner |
| ---------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------ |
| [ADR-021](../../adr/ADR-021-approval-idempotency-persistence.md) | Approval + idempotency persistence | **ADOPTED — IMPLEMENTED_UNVERIFIED.** Persist immutable, payload-bound, expiring approvals (`agent_approvals`, `migrations/0003_approvals.py`, `services/approval.py`) + replay-safe idempotent consequential actions (`middleware/idempotency.py`, `0006_idempotency.py`, SHA-256 `method\|path\|body`). Gmail draft-only until per-user T3 enablement | Immutable expiring approvals (FR-50/51); replay-safe consent/GDPR/approval routes; audit trail. Coverage breadth, hash binding, expiry enforcement, decision immutability UNVERIFIED (P07/P11) | Yes — flag-gated removal | Security Architect |
| [ADR-022](../../adr/ADR-022-memory-taxonomy.md) | 6-memory taxonomy on existing schema | **ADOPTED — IMPLEMENTED_UNVERIFIED.** Six domains (Profile/Document/Career/Episodic/Preference/Working) as typed `Memory`/`memory_records` rows + `domain` facet + supersession (`0004_memory_taxonomy.py`, `schemas/memory_types.py`, `services/memory_versioning.py`), not new tables (FR-68) | No premature schema split; retrieval scoped by type/domain. Repo registry is 22 entity types — six-domain mapping completeness + supersession UNVERIFIED (P07/P12) | Yes | Data Architect |
| [ADR-023](../../adr/ADR-023-workspace-isolation.md) | Workspace isolation hardening | **ADOPTED — IMPLEMENTED_UNVERIFIED.** Keep app-level scoping primary; add Postgres RLS defense-in-depth (`infrastructure/data_isolation.py` TenantAwareBase/RowLevelSecurityMixin, `0005_rls.py`) | Defense-in-depth for NFR-15/h15. Policy coverage currently only 4 tables (`memories/events/usage_records/api_keys`) — breadth UNVERIFIED (P07); isolation suite P14 | Yes | Security Architect |
| [ADR-024](../../adr/ADR-024-rebuildable-projections.md) | Projections rebuildable, never authoritative | **ADOPTED — design + partial impl.** Embeddings/graph/search rebuild from relational rows (`embeddings`, `relationships`, `memory_records`; `infrastructure/search.py` MeilisearchIndex); provenance columns; rebuild jobs | Consistency guarantee (INT-02 §5); rebuild bounded per workspace. Rebuild-job/orchestration + provenance columns UNVERIFIED; Meilisearch/pgvector role split to reconcile | Yes | Data Architect |
| [ADR-025](../../adr/ADR-025-workload-identity.md) | Workload identity for FastAPI | **PROPOSED — design-only, GAP (P07/P11).** HMAC service tokens for worker↔API and API↔connectors (extends TS service-auth to Python). **No mechanism found at HEAD** (grep = zero hits) — no runtime capability claimed | Satisfies NFR-16 (no user creds in workers). **Known ungoverned gap** until P07/P11 implementation; adds key-distribution machinery | Yes — greenfield | Security Architect |
| [ADR-026](../../adr/ADR-026-paas-first-mvp.md) | PaaS-first MVP target, nearest region | **ADOPTED — design-only target.** docker-compose dev parity (postgres, redis, web, backend, minio, pgbouncer, pgadmin); Render/Fly-class PaaS MVP; Singapore-class nearest region; k8s/terraform (`infra/kubernetes`, `infra/terraform`) = future enterprise path, not MVP critical | $0 budget honored (DEC-P01-08); fastest path; portability preserved. DPDP residency risk → RISK-MVP-P05-05, P13 legal review (BQ-P05-02) | Yes | Cloud Architect |

## Evolution & future readiness (prompt §overlay)

Deferred ideas are recorded in `08-registers.md` §4 (problem/evidence, target
users, deps, security/data/cost, migration impact, validation experiment,
adoption trigger, owner, sunset condition). Enterprise-only runtime capabilities
(SSO/SCIM UI, billing, marketplace, multi-region, cross-user memory, T2/T3
autopilot) remain **unimplemented and disabled** (INT-02 future boundary).
Strangler-adapter pattern used where migration is likely (connectors,
projections — ADR-024). ADR-025 is the one open design gap carried forward to
P07/P11; ADR-021/022/023 carry explicit verify tasks against existing code
(CF-P05-05).

Evidence: EVD-MVP-P05-005 (this file); REPO_VERIFIED paths cross-checked against
`01-source-register.md` §4 @ `6e8a7b4`.
