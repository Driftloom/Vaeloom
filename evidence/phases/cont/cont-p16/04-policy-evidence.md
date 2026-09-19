# CONT-P16 — 04 Policy / Evidence (WS-16.5, DEL-03/05)

## SBOM / provenance / signatures (DEL-03)

- Steps present in CI (`security-scan.yml`: Syft SBOM; `deploy.yml`: cosign).
  Local execution impossible (binaries absent, offline env) — evidence is
  CI-authoritative; no local forgery attempted (per §131-equivalent honesty
  rule: never manufacture evidence).
- Provenance in-repo: prompt sha256 lineage (`prompt_registry.py`), migration
  chain (42 files), commit-signed phase evidence (`docs/phases/`).

## Environment evidence (DEL-05)

- Dev compose valid; prod compose valid + fail-closed; kustomize 4/4 builds;
  `.env.production.template` documents REQUIRED/SECRET semantics with
  gitignore enforcement. Terraform 39 files, CI-validated (pinned 1.8.0).
