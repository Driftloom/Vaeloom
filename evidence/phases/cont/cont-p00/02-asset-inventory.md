# CONT-P00 — 02 Asset / Access / Environment Inventory — Migration Baseline

**Phase:** `CONT-P00` | **Commit:** `78c2d71` | **Date:** 2026-08-28 |
**Environment:** `local + docker --profile temporal` (real runtime) +
`sqlite tmp_path per-test` (unit)

## 1. Repository & Branches

| Asset    | Location                                   | Value                                                                                                                                             | Status           |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| repo     | `C:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom` | `git rev-parse HEAD 78c2d71` `origin/master ahead 2` `master` clean vs hardened (2 commits: `standardize_docs.py` mojibake + `test_hardening 23`) | `VERIFIED`       |
| remote   | `origin`                                   | `git ls-remote origin/master → 78c2d71` (via status)                                                                                              | `VERIFIED`       |
| branches | local                                      | `master` only; no `cont-p00` branch (phase docs only)                                                                                             | `NOT_APPLICABLE` |
| .venv    | `apps/api/.venv` Python 3.12.13 via `uv`   | `apps/api/.python-version pin 3.12` `uv run --project apps/api python -m pytest`                                                                  | `VERIFIED`       |
| pnpm     | monorepo                                   | `pnpm install 2.2s` `pnpm dev:web` 2-5s (`AGENTS.md` warns `pnpm dev` hangs nx parallel 25 pkgs)                                                  | `VERIFIED`       |

## 2. Runtime Topology (Real Production-Like)

| Asset                    | Image / Path                                                                                  | Health                                                        | Evidence                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres`               | `pgvector/pgvector:pg16` `0.0.0.0:5432` `vaeloom-postgres`                                    | `Up 3h healthy`                                               | `docker ps` 3h, `5432`                                                                                                                                                                                                              |
| `redis`                  | `redis:7-alpine` `0.0.0.0:6379` `vaeloom-redis`                                               | `PONG`                                                        | `docker exec redis-cli ping`                                                                                                                                                                                                        |
| `temporal`               | `temporalio/auto-setup:1.26` `0.0.0.0:7233`                                                   | `healthy` `temporal:7233`                                     | `docker ps` `healthy` 7233/8233                                                                                                                                                                                                     |
| `temporal-db`            | `postgres:16-alpine` `temporal-postgres`                                                      | `healthy`                                                     | `docker ps`                                                                                                                                                                                                                         |
| `temporal-visibility-db` | `postgres:16-alpine` `temporal_visibility`                                                    | `healthy`                                                     | `docker ps`                                                                                                                                                                                                                         |
| `temporal-worker×2`      | `vaeloom-temporal-worker:latest` `python -m api.temporal.worker` `LANGGRAPH_ENABLED=true`     | `Up 3h` 8000/tcp                                              | `docker ps` 2 workers, `worker --dry-run 11`                                                                                                                                                                                        |
| `temporal-ui`            | `temporalio/ui:latest` `0.0.0.0:8234`                                                         | `Up 3h`                                                       | `docker ps`                                                                                                                                                                                                                         |
| `api` (local)            | `uv run uvicorn api.main:app --port 8000` `DATABASE__URL postgres+asyncpg` `REDIS__URL`       | `/health 200` via `temporalApi.getStatus` polling 3s          | `conftest sqlite tmp_path` vs `docker postgres`                                                                                                                                                                                     |
| `web`                    | `Next.js 15` `pnpm dev:web` `http://localhost:3000`                                           | `typecheck 0`                                                 | `AGENTS.md` 2-5s                                                                                                                                                                                                                    |
| `monitoring`             | `infra/monitoring` `prometheus :9090` + `grafana` (claim) vs `IMPLEMENTATION-GAP G6` conflict | `worker :9090/metrics HELP langgraph_*` verified via `urllib` | `PARTIAL` — code `HELP` present, `infra/monitoring/alerts` `G6` reports unimplemented (`gap 116` vs `AGENTS DONE`) -> register as `IMPLEMENTED_UNVERIFIED` until `prometheus.yml + grafana vaeloom-main.json` verified at `52d6af9` |

**Docker evidence:** `docker ps` 8 containers, `docker exec redis ping PONG`,
`docker exec worker python urllib http://localhost:9090/metrics`
`langgraph_run_started_total HELP`.

## 3. Schemas / Contracts / IaC

| Artifact  | Path                                                                          | Count / Hash                                                            | Evidence                                                          |
| --------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| OpenAPI   | `docs/backend/openapi.yaml`                                                   | `110 paths` (`AGENTS.md`) was `79→88→99→110` per CONT                   | `EXECUTED_EVIDENCE` `AGENTS.md 110`                               |
| Alembic   | `apps/api/src/api/migrations/*.py` `0023_resume_artifacts` etc.               | `>23 migrations`, `0010+0019+0020` RLS `42/42` (`787053a`)              | `IMPLEMENTED_WITH_EVIDENCE`                                       |
| K8s       | `infra/kubernetes/base` `60 yamls` + `overlays/prod 1 guard` `HPA min3 max10` | `kubectl kustomize base` fails `../../apps/web` vs `../../../` path bug | `IMPLEMENTED_UNVERIFIED` — `STATIC VERIFIED RUNTIME NOT VERIFIED` |
| Terraform | `infra/terraform 12 modules s3+DDB`                                           | `terraform validate 12` + `compose prod 239`                            | `EXECUTED_EVIDENCE` per P19                                       |
| Contracts | `packages/shared-types`, `specs/openapi.yaml`                                 | `AGENTS.md 110 paths`                                                   | `IMPLEMENTED_WITH_EVIDENCE`                                       |

## 4. Access Register

| Resource                            | Required            | Granted                                                          | Owner            | Status                                                                                           |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| GitHub repo read/write              | `push to master`    | `local .git push to origin` (ahead 2)                            | Engineering      | `GRANTED`                                                                                        |
| Postgres `5432`                     | `read/write`        | `docker pgvector` + `sqlite tmp_path per-test`                   | Data/Platform    | `GRANTED`                                                                                        |
| Redis `6379`                        | `read/write`        | `docker redis PONG`                                              | Platform         | `GRANTED`                                                                                        |
| Temporal `7233`                     | `Client.connect`    | `temporal:7233 healthy` `worker×2`                               | SRE              | `GRANTED`                                                                                        |
| Secrets (JWT/ENCRYPTION/INFISICAL)  | `via SecretManager` | `conftest ENCRYPTION_KEY test-…32-chars!!` + `JWT_SECRET test-…` | Security         | `MOCK GRANTED` (real Infisical not in local)                                                     |
| Gmail/GitHub APIs                   | `least-privilege`   | `mock_connector_test autouse` `test-connection ok`               | Integration      | `MOCK GRANTED`                                                                                   |
| Design partners / migration windows | `BQ-05`             | **UNKNOWN** — no tenant sponsor/window named                     | Business/Program | `BLOCKING_ACCESS_UNKNOWN` for Pilot/Cutover (CONT-P19/20) but **NOT BLOCKING CONT-P00 baseline** |

## 5. Data Inventory

| Dataset                                  | Location                                                          | Classification             | License           | Representative?                         | Status              |
| ---------------------------------------- | ----------------------------------------------------------------- | -------------------------- | ----------------- | --------------------------------------- | ------------------- |
| `Memory` `Entity/Relationship/Embedding` | `schema.py` `Memory embedding Vector(1536)`, `Entity` `42/42 RLS` | `User PII` tenant-isolated | Internal          | seeded via `write_memory dual-write`    | `VERIFIED`          |
| `Document` `Resume/Artifact`             | `schema Document` `ResumeArtifact bytes inline`                   | `User docs`                | Internal          | `file upload plan.txt` in E2E           | `VERIFIED`          |
| `Eval datasets`                          | `docs/ai/Eval-Datasets.md` + `tests/test_*`                       | Test only                  | MIT/Test          | mock LLM `conftest mock_llm` `0.1*1536` | `MOCK_ONLY`         |
| `models/prompts/tools`                   | `AGENT_REGISTRY 22` `tools 49+MCP` `prompts 66`                   | Non-PII                    | Internal/MCP spec | `AGENT_REACT_ENABLED=false` shadow      | `VERIFIED`          |
| `Tenant cells / residency`               | `Multi-Tenancy.md` tenant cells, regional residency               | `DPDP/FERPA`               | —                 | **NOT_APPLICABLE** MVP (single-tenant)  | `DEFERRED` CONT-P07 |

## 6. IaC / Environments

| Env       | Compose                                                                       | K8s                                         | Evidence                                       |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `local`   | `docker-compose.yml` `version obsolete` warning + `profiles: temporal` opt-in | `overlays/dev replicas 1 LOG_LEVEL debug`   | `docker compose config dev+prod valid` per P16 |
| `staging` | `docker-compose.prod.yml` `239` lines nginx 1.27                              | `overlays/staging replicas 2`               | `kubectl dry-run 60`                           |
| `prod`    | `docker-compose.prod.yml` + `HPA min3 max10 cpu70 mem80`                      | `overlays/prod replicas 3 guard temporal 1` | `EXECUTED_EVIDENCE`                            |

**SBOM/SLSA:** `syft spdx 420KB` `cosign KMS 2.2.4` `SLSA L2` (`P16 002`).

## 7. Outcome: BLOCKING_ACCESS_UNKNOWN

Only **pilot/cutover windows** (`BQ-05`) are `BLOCKING_ACCESS_UNKNOWN` for
`CONT-P19/20`; **CONT-P00 baseline GO** — no production changes without
authority (rule `allow_production_changes false`).

---

_Delivers `DEL-CONT-P00-02` — `02-asset-inventory.md` v1.0 owned (Platform),
reviewed (SecArch/Data), linked `EVD-CONT-P00-002`._
