# MVP-P06 — 06. Dependency Governance (DEL-MVP-P06-04) — Re-Run 2026-08-15

> DEL-MVP-P06-04. Supply-chain security: license policy, vulnerability
> management, secrets scanning, provenance, and EOL governance. Baseline: repo
> `master` @ `e48f547`.

## 1. License Policy

| Category                       | Allowed Licenses                                       | Enforcement                         |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------- |
| **Core**                       | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD | Automated check at CI               |
| **Documentation**              | CC-BY-4.0, CC0-1.0                                     | Automated check at CI               |
| **Copyleft (REQUIRES REVIEW)** | GPL-2.0, GPL-3.0, LGPL                                 | Manual legal review before adoption |
| **Prohibited**                 | AGPL, SSPL, BSL, custom non-OSS                        | BLOCKED — never approved            |

| Current license | MIT | `LICENSE` at repo root |
| --------------- | --- | ---------------------- |

**Current state:** License allowlist is policy-only (this document). No
automated enforcement exists. GAP → add license-check step in CI (Q&A-2:
deferred to P16 but policy defined now).

## 2. Vulnerability Management

| Severity | SLA      | Process                     | Escalation                        |
| -------- | -------- | --------------------------- | --------------------------------- |
| CRITICAL | 24 hours | Emergency patch + hotfix    | Immediate maintainer notification |
| HIGH     | 7 days   | Dependabot PR + CI + review | Weekly review meeting             |
| MEDIUM   | 30 days  | Dependabot PR + CI          | Monthly review                    |
| LOW      | 90 days  | Batch update                | Quarterly review                  |

**Scanning tools:**

| Tool              | Scope                         | Cadence                  | Config                           | Status                           |
| ----------------- | ----------------------------- | ------------------------ | -------------------------------- | -------------------------------- |
| pnpm audit        | JS/TS deps                    | CI + weekly cron         | `--audit-level=high` + allowlist | ACTIVE (continue-on-error: true) |
| pip-audit         | Python deps                   | CI                       | FIXING path to `apps/backend`    | FIXING                           |
| trivy             | Container images + filesystem | CI (`security-scan.yml`) | `--severity CRITICAL,HIGH`       | ACTIVE                           |
| CodeQL            | JS/TS + Python SAST           | CI + weekly              | `security-scan.yml`              | ACTIVE                           |
| gitleaks          | Secrets in git history        | CI + weekly              | Default config                   | ACTIVE                           |
| Dependabot alerts | npm + pip                     | Continuous               | GitHub built-in                  | ACTIVE                           |

## 3. Secrets Management

| Secret Type        | Storage                      | Rotation                | Access       |
| ------------------ | ---------------------------- | ----------------------- | ------------ |
| JWT_SECRET         | env / SecretManager          | On compromise           | Backend only |
| ENCRYPTION_KEY     | env / SecretManager          | Quarterly               | Backend only |
| LLM_API_KEY        | env / SecretManager          | Per provider policy     | Backend only |
| DATABASE_URL       | env / SecretManager          | On DB password rotation | Backend only |
| STORAGE_ACCESS_KEY | env / SecretManager          | Quarterly               | Backend only |
| GOOGLE_CLIENT_*    | env / SecretManager          | Per Google policy       | Backend only |
| POSTGRES_PASSWORD  | docker-compose / k8s secrets | Quarterly               | Infra        |
| REDIS_PASSWORD     | docker-compose / k8s secrets | Quarterly               | Infra        |

**Rules:**

- No secrets in code, commits, or logs
- `.env` / `*.pem` in `.gitignore`
- Only `.env.example` and `.env.production.template` tracked
- SecretManager protocol: `EnvSecretManager` (default) →
  `InfisicalSecretManager` (when `INFISICAL_ENABLED=true`)
- `validate_settings()` fails fast on default JWT / short encryption key

## 4. SBOM Policy

| Requirement           | Standard      | Tool                       | Evidence                          |
| --------------------- | ------------- | -------------------------- | --------------------------------- |
| SBOM generation       | SPDX 2.3      | anchore/sbom-action (syft) | `security-scan.yml`, `deploy.yml` |
| SBOM attestation      | DSSE envelope | cosign attach attestation  | `deploy.yml`                      |
| SBOM retention        | 90 days       | GitHub artifact retention  | CI config                         |
| Dependency provenance | SLSA Level 2  | cosign keyless + SBOM      | `deploy.yml`                      |

## 5. Provenance & Signing

| Artifact         | Method            | Key                               | Config               |
| ---------------- | ----------------- | --------------------------------- | -------------------- |
| Docker images    | cosign v2.2.4     | Keyless (OIDC via GitHub Actions) | `deploy.yml`         |
| SBOM attestation | cosign attach     | Attached to image digest          | `deploy.yml`         |
| Git commits      | Signed (optional) | GPG/SSH                           | Per-developer config |
| npm packages     | N/A (private)     | —                                 | —                    |

## 6. Dependency Review

| Check                 | Tool                                   | Scope              | Config               |
| --------------------- | -------------------------------------- | ------------------ | -------------------- |
| New dependency review | GitHub dependency-review-action        | PR diffs           | DEFERRED to P16      |
| Outdated deps         | `pnpm outdated` → `dependency-diff.js` | JS/TS              | `security-audit.yml` |
| License audit         | Manual review                          | All deps           | Policy in this doc   |
| Security audit        | pnpm audit + trivy                     | JS/TS + containers | CI                   |

## 7. Supply-Chain Threat Map (OWASP LLM03)

| Threat                     | Mitigation                                              | Status   |
| -------------------------- | ------------------------------------------------------- | -------- |
| Compromised dependency     | Frozen lockfiles + Dependabot + pnpm audit              | PARTIAL  |
| Typosquatting              | pnpm audit + manual review                              | PARTIAL  |
| Malicious package          | npm provenance (not applicable; private)                | DEFERRED |
| Build-time injection       | CI pinning + Docker build isolation                     | ACTIVE   |
| Model supply-chain (LLM)   | Provider choice + eval + mock fallback                  | ACTIVE   |
| Prompt injection via tools | PromptInjectionMiddleware + untrusted content treatment | ACTIVE   |

## 8. Gaps & Remediation

| Gap                                             | Risk                          | Owner    | Phase       | Status   |
| ----------------------------------------------- | ----------------------------- | -------- | ----------- | -------- |
| No automated license check                      | Unknown license adoption      | Security | P16         | DEFERRED |
| pip-audit targets nonexistent `apps/ai-service` | Python vulns unscanned        | Security | P06 (Q&A-2) | FIXING   |
| No `.gitleaks.toml` config                      | Gitleaks uses defaults only   | Security | P16         | DEFERRED |
| `pnpm audit` continue-on-error: true            | Audit failures don't block CI | Security | P16         | DEFERRED |
| No dependency-review-action                     | New deps not auto-reviewed    | Security | P16         | DEFERRED |
| No osv-scanner                                  | Only implicit via pip-audit   | Security | P16         | DEFERRED |

## 9. Evidence (EVD)

| ID              | Claim                        | Requirement | Type          | Location                                            | Result | Date       | Verified by |
| --------------- | ---------------------------- | ----------- | ------------- | --------------------------------------------------- | ------ | ---------- | ----------- |
| EVD-MVP-P06-011 | License policy defined       | MVP-P06-R03 | DESIGN        | `06-dependency-governance.md` §1                    | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-012 | Vulnerability SLA defined    | MVP-P06-R03 | DESIGN        | `06-dependency-governance.md` §2                    | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-013 | SBOM + provenance configured | MVP-P06-R03 | REPO_VERIFIED | `.github/workflows/security-scan.yml`, `deploy.yml` | PASS   | 2026-08-15 | Agent E     |
| EVD-MVP-P06-014 | Supply-chain threats mapped  | MVP-P06-R03 | DESIGN        | `06-dependency-governance.md` §7                    | PASS   | 2026-08-15 | Agent E     |
