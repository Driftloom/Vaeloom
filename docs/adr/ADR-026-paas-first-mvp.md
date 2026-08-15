# ADR-026: PaaS-First MVP Target, Nearest Region

| Metadata     | Value                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Status**   | ADOPTED — design-only target (PaaS-first MVP; infra manifests exist but k8s/terraform are not MVP critical path) |
| **Date**     | 2026-08-15 (design re-run); first documented 2026-08-07                                                          |
| **Deciders** | Engineering Team + User (BQ-P05-02)                                                                              |
| **Owner**    | Cloud Architect                                                                                                  |

## Context

MVP budget is **$0** (DEC-P01-08). Launch is India with DPDP residency
obligations (EXT-16, CF-P05-03), but free-tier PaaS regions are not in India.
BQ-P05-02 (user, 2026-08-07): **nearest-region hosting**, residency risk
explicitly flagged. Repo already has dev/prod topologies and enterprise IaC that
must be positioned for MVP.

## Decision

**PaaS-first MVP** on a Render/Fly-class provider, nearest region
(Singapore-class), with docker-compose as the dev/parity harness.

- `docker-compose.yml` (dev, verified at HEAD): postgres, redis, web, backend,
  minio, pgbouncer, pgadmin.
- `docker-compose.prod.yml` (verified at HEAD): nginx, web, backend, postgres,
  redis, pgbouncer, minio.
- `infra/kubernetes` and `infra/terraform` (incl. `infra/ops/terraform`) remain
  the **future enterprise path** (ADR-020), not the MVP critical path.
- Residency risk recorded as **RISK-MVP-P05-05** → P13 legal review (BQ-P05-02;
  CF-P05-03).

## Consequences

**Positive:** $0 budget honored (DEC-P01-08); fastest time-to-value; no k8s ops
burden; dev/prod parity; containers keep the k8s/terraform path open.

**Negative:** Residency outside India (nearest region) — flagged risk
(RISK-MVP-P05-05) pending P13 legal review; PaaS free-tier limits constrain
load; pgbouncer/pgadmin/minio are dev-parity, not MVP-managed.

## Reversibility / Rollback

Yes — stateless containers are portable to k8s/terraform without redesign;
portability is the point of compose + PaaS-first.

## Verification (P13)

Re-confirm region/residency after DPDP legal review (BQ-P05-02,
RISK-MVP-P05-05); keep k8s/terraform gated to the enterprise track
(`08-registers.md` §4 deferred ideas).
