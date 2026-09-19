# CONT-P16 — 02 Secure CI + Deployment / Rollback (WS-16.2/16.3, DEL-02/04)

## Kustomize builds @ HEAD (all exit 0 via `kubectl kustomize`)

| Target | Resources | Notes |
| --- | --- | --- |
| `base/` | 98 | deploy pipeline path (`apply -k base`) |
| `overlays/dev` | builds | ConfigMap patch (debug/200) verified in output |
| `overlays/staging` | builds | dead generator removed (was base-value duplicate) |
| `overlays/prod` | 100 | base + HPA + prod patches |

## Additional fixes (this phase)

- **DEF-P16-02 (High, FIXED):** `configMapGenerator behavior: merge` in base
  + dev + staging failed every build (`ResId vaeloom-config does not exist`
  — pre-namespace lookup). Base: generator removed (`./infra/configmap.yaml`
  already carries all keys; single source of truth). Dev: replaced with
  strategic ConfigMap patch (LOG_LEVEL=debug, API_RATE_LIMIT=200 — intent
  preserved, output-verified). Staging: removed (pure base-value duplicate).
- Residual note: file sets `API_RATE_LIMIT=5000`/`RATE_LIMIT_REQUESTS=5000`
  vs code default 100 — kept as operator intent (not silently aligned);
  flagged for SRE review, non-blocking.

## CI / supply chain (verified by inspection @ HEAD)

- `security-scan.yml`: gitleaks action + trivy-action (SARIF upload) + Syft
  SBOM steps present. `deploy.yml`: terraform-plan job + cosign steps +
  k6 gate (per P16 baseline). Binaries absent locally → execution evidence
  is CI-authoritative (carried P16-era: gitleaks 0, trivy 0 CRIT).
- Rollback: `kubectl rollout undo` step in deploy job; app rollback =
  revert-by-commit (no stateful change in P16 delta).
