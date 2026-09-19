# CONT-P16 — 05 Evidence / Defects

## Defect register

| ID | Defect | Severity | Disposition |
| --- | --- | --- | --- |
| DEF-P16-01 | Kustomize base refs pointed at nonexistent `infra/apps`, `infra/infra` (broken since Jul) — no overlay ever built | High | FIXED (git mv + ref rewrite; 4/4 builds exit 0) |
| DEF-P16-02 | Dead `configMapGenerator merge` broke all 3 overlays + base | High | FIXED (removed base/staging; strategic patch in dev, output-verified) |
| DEF-P16-03 | `API_RATE_LIMIT=5000` in configmap vs code default 100 | Low | OPEN, owner SRE review (kept, not silently aligned) |
| DEF-P15-06 | Fresh-SQLite bootstrap partial (carried) | Medium | OPEN, owner Eng |
| DEF-P15-07/08 | k6 re-run + PG drill deferred (carried) | Low/Med | OPEN with triggers |

## Coverage note

P16 delta: infra YAML only (no Python) → no coverage delta; repo 94% stands.
