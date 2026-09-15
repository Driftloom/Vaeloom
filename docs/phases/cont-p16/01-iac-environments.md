# CONT-P16 — 01 IaC / Environments (WS-16.1, DEL-01)

## Verified @ HEAD

- **Terraform:** 39 `.tf` files (`infra/terraform/`), pinned `1.8.0` via
  `hashicorp/setup-terraform@v3` in `deploy.yml` (`terraform init/validate`
  steps). Local binary absent → `validate` runs in CI (authoritative);
  recorded, not claimed locally.
- **Compose:** dev `config --quiet` exit 0 (obsolete-`version` warning only);
  prod `config --quiet` exit 0 with template env-file + dummy secrets, and
  fail-closed exit 1 without `.env.production` (correct: secrets never
  committed; `.env.production` gitignored line 70).
- **Kustomize (FIXED this phase — was fully broken):** see 02.

## Finding → fix (this phase)

- **DEF-P16-01 (High, FIXED):** `base/kustomization.yaml` referenced
  `../../apps/*` → `infra/apps/*` (never existed; broken since `1d0adb28`)
  plus `../../infra/*` → `infra/infra/*` (also nonexistent). No overlay ever
  built. Fix: `git mv infra/kubernetes/apps → base/apps`,
  `infra/kubernetes/infra → base/infra` (kustomize load-restrictor requires
  resources below the build root used by `kubectl apply -k base`); refs now
  `./apps/*`, `./infra/*`. Verified: `kubectl kustomize base` exit 0.
