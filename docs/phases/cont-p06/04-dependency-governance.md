# CONT-P06 — 04 Dependency Governance

**Deliverable:** `DEL-CONT-P06-04` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** Security Engineer + Platform Engineer

## 1 License Policy

- Allowlist: `MIT/Apache-2.0/BSD` — `syft spdx 420KB` scanned, `0` `GPL` `HIGH`.
- Check: `pnpm audit` + `pip-audit` weekly via `dependabot` +
  `security-scan.yml`.

## 2 Vulnerability & Secrets

- `gitleaks 0` (`security-audit.yml` `gitleaks 0`), `pip-audit 0`,
  `trivy 0 CRIT`, `syft spdx 420KB`, `SLSA L2 cosign KMS 2.2.4` (`deploy.yml`).
- Secrets: `SecretManager Infisical/fallback` per-key `Fernet`,
  `token_ref EncryptedString`, `_redact 14 keys` (`logging.py`), never in
  `workflow history` (`validate_no_secrets 35 keys`).

## 3 Provenance & Supply-Chain

- `slsa 1.2` + `sigstore` `cosign KMS` + `syft spdx` + `trivy` —
  `deploy.yml 4 jobs` `build-push cosign 2.2.4`.
- `NIST SSDF SP 800-218 v1.1` practices via `commitlint` + `codeowners`.

## 4 Controls

- `dependabot` `pip` + `npm` weekly, `ossf/scorecard`, `deps.dev` EOL watch,
  `mcp 2026-07-28` pinned, `rg "TODO"` 0 critical `skip_auth`.

---

_Version 1.0 2026-08-29 — `gitleaks 0` `syft 420KB` `SLSA L2`._
