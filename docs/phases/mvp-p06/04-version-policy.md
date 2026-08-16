# MVP-P06 — 04. Version Policy (DEL-MVP-P06-02) — Re-Run 2026-08-15

> DEL-MVP-P06-02. Enterprise-grade version management for the Vaeloom MVP.
> Baseline: repo `master` @ `e48f547`.

## 1. Version Pinning Strategy

| Layer            | Policy                                            | Enforcement                                                | Evidence                         |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| JS/TS manifests  | Semantic ranges (`^15.0.0`)                       | `pnpm-lock.yaml` lockfileVersion 9.0 (frozen in CI/Docker) | `package.json`, `pnpm-lock.yaml` |
| Python manifests | PEP 440 ranges (`>=0.115.0,<0.116.0`)             | `uv.lock` lockfileVersion (frozen in CI/Docker)            | `pyproject.toml`, `uv.lock`      |
| Docker images    | Explicit tags (`pgvector:pg16`, `redis:7-alpine`) | No `:latest` in prod; dev may use `:latest`                | `docker-compose.yml`             |
| GitHub Actions   | Major-version pins (`@v4`, `@v5`)                 | No SHA pins yet; risk: tag mutation                        | `.github/workflows/*.yml`        |
| Node.js          | `.nvmrc` pin (`v20.14.0`)                         | Corepack + `packageManager: pnpm@9.12.0`                   | `.nvmrc`, `package.json`         |
| Python           | `.python-version` pin (`3.12`)                    | CI + dev containers aligned                                | `.python-version` (NEW)          |

## 2. Lockfile Enforcement

| Context        | Command                                                                    | Enforcement                                                             |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| CI install     | `pnpm install --frozen-lockfile`                                           | `.github/workflows/ci*.yml`                                             |
| CI backend     | `uv sync --frozen`                                                         | `.github/workflows/ci-backend.yml`                                      |
| Docker build   | `pnpm install --frozen-lockfile --filter @vaeloom/web`                     | `apps/web/Dockerfile`                                                   |
| Docker backend | `pip install . --no-build-isolation` (setuptools, no lockfile enforcement) | `apps/api/Dockerfile` — GAP: consider `uv pip install --require-hashes` |

## 3. Update Policy

| Type             | Cadence                                      | Process                                               | Gate                     |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Patch (security) | Within 7 days for CRITICAL, 30 days for HIGH | Dependabot PR + CI pass + manual review               | Security review required |
| Minor            | Monthly review (first Monday)                | Dependabot PR + CI pass + changelog                   | Maintainer approval      |
| Major            | Quarterly review; requires ADR               | ADR + migration plan + CI matrix test + release notes | Gate approval            |

## 4. End-of-Life (EOL) Watch

| Tool                  | Scope                            | Cadence                     | Config                   |
| --------------------- | -------------------------------- | --------------------------- | ------------------------ |
| Dependabot            | npm, pip, docker, github-actions | Weekly (Monday)             | `.github/dependabot.yml` |
| OSV-Scanner / depscan | All dependencies                 | CI + weekly cron            | `security-audit.yml`     |
| GitHub Advisory       | npm + pip                        | Dependabot alerts           | Built-in                 |
| pnpm audit            | JS dependencies                  | CI + manual                 | `--audit-level=high`     |
| pip-audit             | Python dependencies              | CI (fix path to `apps/api`) | `security-audit.yml`     |

## 5. SBOM & Provenance

| Artifact      | Tool                         | Format                    | Retention | Evidence                          |
| ------------- | ---------------------------- | ------------------------- | --------- | --------------------------------- |
| SBOM          | anchore/sbom-action (syft)   | SPDX 2.3 JSON             | 90 days   | `security-scan.yml`, `deploy.yml` |
| Image signing | cosign v2.2.4                | Sigstore keyless (OIDC)   | N/A       | `deploy.yml`                      |
| Attestation   | cosign attach attestation    | DSSE envelope             | 90 days   | `deploy.yml`                      |
| SLSA level    | Level 2 (build + provenance) | cosign + SBOM attestation | —         | Goal; not fully enforced          |

## 6. Release Process

| Stage          | Trigger                      | Tool                 | Notes                                      |
| -------------- | ---------------------------- | -------------------- | ------------------------------------------ |
| Version bump   | `CHANGELOG.md` + manual      | SemVer convention    | `CHANGELOG.md` exists; no semantic-release |
| Tag            | `git tag vX.Y.Z && git push` | Manual               | `docs/Engineering/Release-Process.md`      |
| Docker build   | Push to main                 | `docker-build.yml`   | Builds web + backend images                |
| Deploy staging | Docker Build success         | `deploy-staging.yml` | `kubectl set image`                        |
| Deploy prod    | Manual approval              | `deploy.yml`         | kustomize + kubectl                        |

## 7. Exit Playbooks

| Component        | Lock-in Risk | Exit Strategy                                | Effort |
| ---------------- | ------------ | -------------------------------------------- | ------ |
| Vercel/Next.js   | Medium       | Self-host Next.js (Dockerfile exists)        | Low    |
| PostgreSQL       | None         | Standard SQL; dump/restore                   | Low    |
| Redis            | None         | In-memory fallback exists                    | Low    |
| MinIO/S3         | Low          | boto3 compatible; migrate to any S3 provider | Low    |
| pgvector         | Low          | pgvector is PG extension; dump/restore       | Low    |
| OpenAI/Anthropic | Low          | Raw httpx calls; swap URL + auth header      | Low    |
| Nx               | Low          | Remove nx.json; run scripts directly         | Low    |
| Alembic          | None         | Standard PG migrations; raw SQL fallback     | Low    |

## 8. Gaps & Remediation

| Gap                                          | Owner    | Phase        | Status                 |
| -------------------------------------------- | -------- | ------------ | ---------------------- |
| No `.python-version` pin                     | Platform | P06 (Q&A-2)  | IMPLEMENTING           |
| Backend Dockerfile uses pip, not uv lockfile | Platform | P06 (config) | GAP — document for P16 |
| GitHub Actions major-pins not SHA-pins       | Security | P16          | DEFERRED               |
| No semantic-release automation               | DevOps   | P16          | DEFERRED               |
| Dependabot missing pip ecosystem             | Platform | P06 (Q&A-2)  | FIXING                 |

## 9. Evidence (EVD)

| ID              | Claim                        | Requirement | Type          | Location                                            | Result           | Date       | Verified by |
| --------------- | ---------------------------- | ----------- | ------------- | --------------------------------------------------- | ---------------- | ---------- | ----------- |
| EVD-MVP-P06-005 | Lockfile strategy documented | MVP-P06-R02 | DESIGN        | `04-version-policy.md` §2                           | PASS             | 2026-08-15 | Agent C     |
| EVD-MVP-P06-006 | EOL watch configured         | MVP-P06-R02 | REPO_VERIFIED | `.github/dependabot.yml`                            | PASS (with gaps) | 2026-08-15 | Agent C     |
| EVD-MVP-P06-007 | SBOM + provenance configured | MVP-P06-R02 | REPO_VERIFIED | `.github/workflows/security-scan.yml`, `deploy.yml` | PASS             | 2026-08-15 | Agent C     |
