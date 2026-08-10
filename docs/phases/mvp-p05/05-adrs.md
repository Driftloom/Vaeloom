# MVP-P05 — 05. ADRs (DEL-MVP-P05-03)

> Owner: AI Architect · ADR-001..020 exist in `docs/adr/`. P05 adds ADR-021..026
> (versioned, owned, reversible). One-line summary per ADR with decision,
> consequences, reversibility, owner.

| ID      | Title                                        | Decision                                                                                                                                                       | Consequences                                                                                                                | Reversible?              | Owner              |
| ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------ |
| ADR-021 | Approval + idempotency persistence           | Add `approval_request`, `approval_decision`, idempotency-key columns on consequential tables; Gmail stays draft-only until per-user T3 enablement (DEC-P02-05) | Immutable payload-bound expiring approvals (FR-50/51); replay-safe actions; new migration at P07                            | Yes — flag-gated removal | Security Architect |
| ADR-022 | 6-memory taxonomy on existing schema         | Implement Profile/Document/Career/Episodic/Preference/Working as domain-typed `Memory` rows + supersession (FR-68), not new tables                             | No premature schema split; existing memory service evolves; retrieval uses type scopes (CF-P05-02)                          | Yes                      | Data Architect     |
| ADR-023 | Workspace isolation hardening                | Keep app-level scoping; add Postgres RLS policies + composite constraints (tenant, workspace) at P07; isolation suite at P14                                   | Defense-in-depth for NFR-15/h15; migration risk manageable                                                                  | Yes                      | Security Architect |
| ADR-024 | Projections rebuildable, never authoritative | Embeddings/graph/search rebuild from relational rows; provenance columns; rebuild jobs                                                                         | Data consistency guarantee (INT-02 §5); rebuild cost bounded by workspace                                                   | Yes                      | Data Architect     |
| ADR-025 | Workload identity for FastAPI                | HMAC service tokens for worker↔API and API↔connectors (extends TS service-auth pattern to Python)                                                              | No user creds in workers (NFR-16); no shared secrets in code                                                                | Yes                      | Security Architect |
| ADR-026 | PaaS-first MVP target, nearest region        | docker-compose for dev; Render/Fly-class PaaS for MVP; Singapore-region class; DPDP residency risk → RISK-P05-06, P13 legal review (BQ-P05-02)                 | $0 budget honored; residency flag documented; k8s/terraform (existing) remain future enterprise path, not MVP critical path | Yes                      | Cloud Architect    |

## Evolution & future readiness (prompt §overlay)

Deferred ideas are recorded in `08-registers.md` §4 (problem/evidence, target
users, deps, security/data/cost, migration impact, validation experiment,
adoption trigger, owner, sunset condition). Enterprise-only runtime capabilities
(SSO/SCIM UI, billing, marketplace, multi-region, cross-user memory) remain
unimplemented and disabled (INT-02 future boundary). Strangler adapter pattern
used where migration likely (connectors, projections — ADR-024).
