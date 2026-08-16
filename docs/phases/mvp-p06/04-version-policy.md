# MVP-P06 — 04. Version Policy (DEL-MVP-P06-02) — Enterprise Upgrade 2026-08-17

> DEL-MVP-P06-02. Enterprise-grade version management for the Vaeloom MVP.
> Baseline: repo `master` @ `e48f547`.

## 1. Version Pinning Strategy

| Layer            | Policy                                            | Enforcement                                                | Evidence                         |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| JS/TS manifests  | Semantic ranges (`^15.0.0`)                       | `pnpm-lock.yaml` lockfileVersion 9.0 (frozen in CI/Docker) | `package.json`, `pnpm-lock.yaml` |
| Python manifests | PEP 440 ranges (`>=0.115.0,<0.116.0`)             | `uv.lock` lockfileVersion (frozen in CI/Docker)            | `pyproject.toml`, `uv.lock`      |
| Docker images    | Explicit tags (`pgvector:pg16`, `redis:7-alpine`) | No `:latest` in prod; dev may use `:latest`                | `docker-compose.yml`             |
| GitHub Actions   | Major-version pins (`@v4`, `@v5`)                 | **GAP: No SHA pins; vulnerable to tag mutation**           | `.github/workflows/*.yml`        |
| Node.js          | `.nvmrc` pin (`v20.14.0`)                         | Corepack + `packageManager: pnpm@9.12.0`                   | `.nvmrc`, `package.json`         |
| Python           | `.python-version` pin (`3.12`)                    | CI + dev containers aligned; local dev may use 3.14 via uv | `.python-version`                |

### 1a. GitHub Actions SHA Pinning (Partial Fix — P06)

**Risk:** Tag mutation attacks. An attacker who gains write access to a GitHub
Action repo can move a tag to point to malicious code.

**Currently pinned by tag (not SHA):**

| Action                      | Current Pin | Risk                 | Recommended SHA                                                  |
| --------------------------- | ----------- | -------------------- | ---------------------------------------------------------------- |
| `actions/checkout`          | `@v4`       | Medium               | `b4ffde65f46336ab88eb53be808477a3936bae11`                       |
| `actions/setup-node`        | `@v4`       | Medium               | `60edb5dd545a775178f52524783378180af0d1f8`                       |
| `actions/upload-artifact`   | `@v4`       | Medium               | `5d5d22a31266ced268874388b861e4b58bb5c2f3`                       |
| `sigstore/cosign-installer` | `@v3.5.0`   | Low (pinned minor)   | Verify at: https://github.com/sigstore/cosign-installer/releases |
| `anchore/sbom-action`       | `@v0`       | High (v0 = unstable) | Pin to specific release SHA                                      |

**Action required:** Full SHA audit of all 11 workflows deferred to P16. For
P06, document the gap and prioritize `anchore/sbom-action@v0` (highest risk due
to v0 instability).

## 2. Lockfile Enforcement

| Context        | Command                                                                    | Enforcement                                                                   |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CI install     | `pnpm install --frozen-lockfile`                                           | `.github/workflows/ci*.yml`                                                   |
| CI backend     | `uv sync --frozen`                                                         | `.github/workflows/ci-backend.yml`                                            |
| Docker build   | `pnpm install --frozen-lockfile --filter @vaeloom/web`                     | `apps/web/Dockerfile`                                                         |
| Docker backend | `pip install . --no-build-isolation` (setuptools, no lockfile enforcement) | `apps/api/Dockerfile` — **GAP: should use `uv pip install --require-hashes`** |

### 2a. Reproducible Build Verification

**Current state:** Builds are NOT fully reproducible. The backend Dockerfile
uses `pip install` without hash verification, meaning a compromised package
could be installed even if `uv.lock` is present.

**Remediation (partial P06):**

- Document the gap (done in this file)
- Add `--require-hashes` flag to backend Dockerfile (deferred to P16 — requires
  generating hash file)
- Frontend builds ARE reproducible via frozen lockfile

## 3. Update Policy

| Type             | Cadence                                      | Process                                               | Gate                     |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Patch (security) | Within 7 days for CRITICAL, 30 days for HIGH | Dependabot PR + CI pass + manual review               | Security review required |
| Minor            | Monthly review (first Monday)                | Dependabot PR + CI pass + changelog                   | Maintainer approval      |
| Major            | Quarterly review; requires ADR               | ADR + migration plan + CI matrix test + release notes | Gate approval            |

## 4. End-of-Life (EOL) Watch

| Tool                  | Scope                            | Cadence                           | Config                   |
| --------------------- | -------------------------------- | --------------------------------- | ------------------------ |
| Dependabot            | npm, pip, docker, github-actions | Weekly (Monday)                   | `.github/dependabot.yml` |
| OSV-Scanner / depscan | All dependencies                 | CI + weekly cron                  | `security-audit.yml`     |
| GitHub Advisory       | npm + pip                        | Dependabot alerts                 | Built-in                 |
| pnpm audit            | JS dependencies                  | CI (continues on error — **GAP**) | `--audit-level=high`     |
| pip-audit             | Python dependencies              | CI (fix path to `apps/api`)       | `security-audit.yml`     |

### 4a. License Enforcement (Partial Fix — P06)

**Current state:** Policy-only. No automated license checking in CI.

**Partial remediation:** Add basic license check to `pyproject.toml`:

```toml
[tool.liccheck]
authorized_licenses = ["MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "PSF", "ISC"]
```

Full automation (CI integration, block on copyleft) deferred to P16.

## 5. SBOM & Provenance

| Artifact      | Tool                         | Format                    | Retention | Evidence                          |
| ------------- | ---------------------------- | ------------------------- | --------- | --------------------------------- |
| SBOM          | anchore/sbom-action (syft)   | SPDX 2.3 JSON             | 90 days   | `security-scan.yml`, `deploy.yml` |
| Image signing | cosign v2.2.4                | Sigstore keyless (OIDC)   | N/A       | `deploy.yml`                      |
| Attestation   | cosign attach attestation    | DSSE envelope             | 90 days   | `deploy.yml`                      |
| SLSA level    | Level 2 (build + provenance) | cosign + SBOM attestation | —         | Goal; not fully enforced          |

### 5a. SBOM Integrity Verification

**Gap:** The SBOM is generated and attached as attestation, but there is no
verification step that checks the SBOM matches the actual build contents.

**Remediation (deferred to P16):** Add `cosign verify-attestation` step in
deploy workflow to verify SBOM integrity before deployment.

## 6. Release Process

| Stage          | Trigger                      | Tool                 | Notes                                      |
| -------------- | ---------------------------- | -------------------- | ------------------------------------------ |
| Version bump   | `CHANGELOG.md` + manual      | SemVer convention    | `CHANGELOG.md` exists; no semantic-release |
| Tag            | `git tag vX.Y.Z && git push` | Manual               | `docs/Engineering/Release-Process.md`      |
| Docker build   | Push to main                 | `docker-build.yml`   | Builds web + backend images                |
| Deploy staging | Docker Build success         | `deploy-staging.yml` | `kubectl set image`                        |
| Deploy prod    | Manual approval              | `deploy.yml`         | kustomize + kubectl                        |

## 7. Exit Playbooks

| Component        | Lock-in Risk | Exit Strategy                                | Effort | Notes                              |
| ---------------- | ------------ | -------------------------------------------- | ------ | ---------------------------------- |
| Vercel/Next.js   | Medium       | Self-host Next.js (Dockerfile exists)        | Low    | Dockerfile in apps/web/            |
| PostgreSQL       | None         | Standard SQL; dump/restore                   | Low    | pg_dump / pg_restore               |
| Redis            | None         | In-memory fallback exists                    | Low    | `infrastructure/cache_fallback.py` |
| MinIO/S3         | Low          | boto3 compatible; migrate to any S3 provider | Low    | S3 API standard                    |
| pgvector         | Low          | pgvector is PG extension; dump/restore       | Low    | Extension data in PG dump          |
| OpenAI/Anthropic | Low          | Raw httpx calls; swap URL + auth header      | Low    | No SDK lock-in                     |
| Nx               | Low          | Remove nx.json; run scripts directly         | Low    | pnpm workspaces native             |
| Alembic          | None         | Standard PG migrations; raw SQL fallback     | Low    | Migration files are SQL            |

## 8. Gaps & Remediation

| Gap                                          | Owner    | Phase       | Status                   | Impact |
| -------------------------------------------- | -------- | ----------- | ------------------------ | ------ |
| `.python-version` pin                        | Platform | P06 (Q&A-2) | IMPLEMENTED              | —      |
| Backend Dockerfile uses pip, not uv lockfile | Platform | P16         | DOCUMENTED               | MEDIUM |
| GitHub Actions major-pins not SHA-pins       | Security | P16         | DOCUMENTED               | HIGH   |
| No semantic-release automation               | DevOps   | P16         | DEFERRED                 | LOW    |
| Dependabot missing pip ecosystem             | Platform | P06 (Q&A-2) | IMPLEMENTED              | —      |
| `pnpm audit` continues on error              | Security | P16         | DOCUMENTED               | MEDIUM |
| No license automation in CI                  | Security | P16         | DOCUMENTED (partial fix) | MEDIUM |
| SBOM integrity not verified                  | Security | P16         | DOCUMENTED               | MEDIUM |

## 9. Evidence (EVD)

| ID              | Claim                        | Requirement | Type          | Location                                            | Result           | Date       | Verified by |
| --------------- | ---------------------------- | ----------- | ------------- | --------------------------------------------------- | ---------------- | ---------- | ----------- |
| EVD-MVP-P06-005 | Lockfile strategy documented | MVP-P06-R02 | DESIGN        | `04-version-policy.md` §2                           | PASS             | 2026-08-15 | Agent C     |
| EVD-MVP-P06-006 | EOL watch configured         | MVP-P06-R02 | REPO_VERIFIED | `.github/dependabot.yml`                            | PASS (with gaps) | 2026-08-15 | Agent C     |
| EVD-MVP-P06-007 | SBOM + provenance configured | MVP-P06-R02 | REPO_VERIFIED | `.github/workflows/security-scan.yml`, `deploy.yml` | PASS             | 2026-08-15 | Agent C     |
| EVD-MVP-P06-008 | SHA pinning gap documented   | MVP-P06-R03 | DESIGN        | `04-version-policy.md` §1a                          | DOCUMENTED       | 2026-08-17 | Agent B     |
