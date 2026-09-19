# CONT-P06 — 02 Version / Support Policy

**Deliverable:** `DEL-CONT-P06-02` | **Version:** 1.0 | **Date:** 2026-08-29

## 1 Pinned Ranges

| Ecosystem | File                                        | Pin                                              | Policy                                                              |
| --------- | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Python    | `apps/api/pyproject.toml` `uv.lock`         | `>=3.12` `fastapi==0.141.1` `langgraph>=0.2.39`  | `uv.lock` frozen, `dependabot pip` weekly, EOL watch via `deps.dev` |
| Node      | `package.json` `pnpm-lock.yaml`             | `next 15.5.20` `react 18.3.1` `typescript 5.9.3` | `pnpm-lock.yaml` frozen, `dependabot npm` weekly                    |
| Infra     | `infra/terraform` `infra/kubernetes`        | `terraform 1.8+` `k8s 1.30`                      | `terraform validate 12` + `kustomize build`                         |
| Images    | `apps/api/Dockerfile` `apps/web/Dockerfile` | `python:3.12-slim` `node:20-alpine`              | `trivy 0 CRIT` + `syft spdx 420KB`                                  |

## 2 Lifecycle Watch

- EOL: `python 3.12` EOL 2028-10, `node 20` EOL 2026-04 — `dependabot` +
  `ossf/scorecard` weekly.
- Advisories: `pip-audit 0` `pnpm audit 0 HIGH` `gitleaks 0` verified.

## 3 Update Cadence

- Patch: weekly `dependabot` auto-merge if `pytest 64+40` `typecheck 0`.
- Minor: monthly `CONT-P06` review, `CONT-P12` agent eval.
- Major: per `ADR` with compatibility horizon `W2→P19`, rollback via
  `git revert + docker tag`.

---

_Version 1.0 2026-08-29 — `pip-audit 0`, `trivy 0 CRIT`, `syft 420KB`._
