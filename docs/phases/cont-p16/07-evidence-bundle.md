# CONT-P16 — 07 Evidence Bundle

| EVD | Claim | Location | Independent check |
| --- | --- | --- | --- |
| EVD-P16-01 | Dev compose valid | `docker-compose.yml` | `config --quiet` exit 0 |
| EVD-P16-02 | Prod compose valid + fail-closed | `docker-compose.prod.yml` | exit 0 w/ template+dummies; exit 1 w/o secrets |
| EVD-P16-03 | Kustomize base builds | `infra/kubernetes/base/` | exit 0, 98 resources |
| EVD-P16-04 | Overlays build | dev/staging/prod | exit 0 each (prod 100); dev patch output-verified |
| EVD-P16-05 | TF pinned + CI-validated | `infra/terraform/` (39) + `deploy.yml` | setup-terraform 1.8.0 + validate step |
| EVD-P16-06 | Supply-chain steps | `security-scan.yml` | gitleaks + trivy + syft present |
| EVD-P16-07 | Sign + rollback steps | `deploy.yml` | cosign + `rollout undo` present |
| EVD-P16-08 | Migration rollback | `test_migrations.py` | 12/12 (carried) |
| EVD-P16-09 | Predecessor valid | `cont-p15` gate + handoff | 95.72 + authorization |
| EVD-P16-10 | Fixes tracked | `git mv` + kustomization diffs | this commit |
