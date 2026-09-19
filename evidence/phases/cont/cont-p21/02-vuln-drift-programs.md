# CONT-P21 — 02 Vulnerability / Drift Programs (WS-21.2/21.3, DEL-02)

## Verified @ HEAD (programs present, CI-enforced)

- **Dependencies:** `pnpm audit --audit-level=high` + `pip-audit` jobs
  (`security-audit.yml`) + Dependabot config — vulnerability monitoring
  automated per-push.
- **Supply chain:** gitleaks + trivy (SARIF) + Syft SBOM + cosign
  (`security-scan.yml`, `deploy.yml`) — carried P16 verification.
- **AI drift:** judge quality gate 1.0 (CI) + red-team Tier-1 0/18 +
  approval-rate accuracy signal (`SLO.md` T4) + prompt sha256 lineage
  (drift attribution) + shadow percent rollout (safe experimentation).
- **Data drift:** memory lineage JSONB + taxonomy versions + retention
  purges + RLS isolation (leak = drift signal via isolation tests).

No new vuln/drift tooling needed; programs exist and are wired. Residual:
local execution of scanners needs binaries/network (CI-authoritative).
