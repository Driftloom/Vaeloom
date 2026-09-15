# CONT-P18 — 02 Engineering / API / Operator Docs (WS-18.2, DEL-02)

## Verified @ HEAD (currency audit, no rewrites needed)

| Doc | Currency check | Verdict |
| --- | --- | --- |
| `docs/API_REFERENCE.md` (310 lines, v0.2.0) | version matches `config.py` + server `/health`; per-endpoint truth is `openapi.yaml` (162, generator-owned) | PASS |
| `docs/DEPLOYMENT_RUNBOOK.md` | kustomize overlay-relative commands — valid after P16 restructure (overlays build 4/4) | PASS |
| `docs/DISASTER_RECOVERY.md` | RTO/RPO/backup current | PASS (P15) |
| `docs/operations/` suite | 10 docs inventoried | PASS (P17) |
| `docs/temporal/` (catalog + runbook) | durable execution current | PASS |
| `AGENTS.md` agent-session guide | 4 critical configs + server startup + test account | PASS |

No stale engineering doc found requiring rewrite; P16 deploy-path change
needs no runbook edit (relative paths unaffected).
