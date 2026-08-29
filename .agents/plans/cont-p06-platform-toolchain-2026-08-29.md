# CONT-P06 — Platform, Toolchain, and Engineering-Standard Evolution — Plan (2026-08-29)

> **Status:** DRAFT FOR USER APPROVAL | **Phase:** `CONT-P06`
> TECHNOLOGY_SELECTION | **Predecessor:** `CONT-P05 96.16 APPROVED` `3f61cfa` |
> **Baseline:** `3f61cfa` + LangGraph closure `bd7adc6` | **Owners:** Solution
> Architect + Platform/Backend/Frontend/AI/Security/FinOps

## 1. Entry — GO

- **Predecessor:** `CONT-P05 96.16 APPROVED — PROCEED` (`06-gate-report.md:30`
  96.16, 0 blocker) re-audited at `3f61cfa` — 5 DELs
  `01 C4 +02 contracts 110 paths +03 ADRs 040-043 +04 threat +05 failure` all
  `v1.0` owned, `64 graph +40 temporal` pass, no waiver, additive delta
  `adr 36→37` (040-043) + `C4` Mermaid — **Score 97/100 GO**.

- **Baseline:** `apps/api` `3.12` `fastapi 0.141.1` `langgraph 0.2.39`
  `temporal 1.26`, `apps/web` `next 15.5`, `pgvector` cosine, `42/42 RLS`, `k6`
  p95 120ms, `terraform 12` `kustomize 60`, `110 OpenAPI`.

- **BQ-06** mandated/prohibited tech correctly `REQUIRES_STAKEHOLDER_DECISION`
  not invented — P06 will pin with evidence, not procurement.

## 2. Scope

**In:** technology evaluation, version/support policy, engineering/repository
standards, supply-chain governance, cost/operability/exit — each needs
benchmark/compatibility/training/rollback/exit.

**Out:** big-bang rewrite, silent permission expansion, unverified dual writes,
all-tenant cutover, production changes without
authority/backup/rollback/monitoring.

**Fixed:** strangler/expand-contract, adapters, control plane, per-tenant/cell
flags, dual-run measurable, reconciliation, rollback, retirement.

## 3. Workstreams & Evidence Plan

| WS      | Title                            | Inputs                                                         | Acceptance                                                                      | Tests                                       | Evidence                                  | File |
| ------- | -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- | ---- |
| WS-06.1 | Technology evaluation            | `apps/*` `infra/*` `graph 64`                                  | Pin `frontend/backend/AI/data/queue/search/observability/deployment` with score | compatibility + perf spikes                 | `01-technology-decision-matrix.md` DEL-01 |
| WS-06.2 | Version/support policy           | `pyproject.toml` `package.json` `uv.lock` `pnpm-lock.yaml`     | Frozen ranges + EOL watch + update policy                                       | `pip-audit 0` `trivy 0 CRIT` + `dependabot` | `02-version-policy.md` DEL-02             |
| WS-06.3 | Engineering/repository standards | `ruff/mypy` `tsconfig` `.nvmrc`                                | Layout/ownership/style/type/test/migration/deprecation                          | `ruff/mypy/typecheck 0` + `nx`              | `03-engineering-standards.md` DEL-03      |
| WS-06.4 | Supply-chain governance          | `gitleaks 0` `syft spdx 420KB` `cosign KMS` SLSA L2            | License/ vuln/ secrets/ SBOM/ provenance                                        | `gitleaks 0` + `syft` + `pip-audit`         | `04-dependency-governance.md` DEL-04      |
| WS-06.5 | Cost/operability/exit            | `infra/terraform` 12 modules s3+DDB, `k6` p95 120ms, `HPA 2→8` | PaaS-first deferred + exit playbooks per tech                                   | `cost per 1k` + `k6` + `terraform`          | `05-cost-exit-strategy.md` DEL-05         |

Trace `source → R01..R08 → DEL-01..05 → EVD → risk → gate → handoff`.

## 4. Tasks (6)

1. Inventory and pin versions/support windows (`WS-06.1/06.2`).
2. Score choices frontend/backend/AI/data/queue/search/observability/deployment.
3. Run compatibility/perf/security/operability spikes.
4. Define layout/ownership/style/type/test/migration/update/deprecation
   (`WS-06.3`).
5. Add license/vuln/secrets/SBOM/provenance + exit (`WS-06.4/06.5`).
6. For every changed artifact capture
   compatibility/owner/evidence/rollback/retirement.

Status each `NOT_STARTED→VERIFIED` via `rg` + `pytest` + `terraform validate`.

## 5. Next Steps (authorized)

1. Approve plan.
2. Scaffold `docs/phases/cont-p06/` `00-predecessor-audit.md` `01→05` +
   `06-gate` + `09-handoff`.
3. Execute small commits: `01` (pin matrix) + `02` (version policy) + `03`
   (standards) + `04` (supply-chain) + `05` (cost/exit).
4. Validate
   `matrix strict + graph 64 + temporal 40 + typecheck 0 + gitleaks 0 + pip-audit 0 + terraform validate + kustomize`
   → gate 95+.

_Prepared 2026-08-29 — predecessor 96.16 GO re-audited, baseline 3f61cfa, BQ-06
deferred, no invented procurement._
