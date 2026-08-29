# CONT-P08 — 05 Compatibility / Deprecation Policy

**Deliverable:** `DEL-CONT-P05-05` | **Version:** 1.0 | **Date:** 2026-08-29

## Compatibility

- Additive `v1→v1.1` — `openapi 110` superset of `99`, `graph/contracts v1`
  additive, `tolerant readers` via `TypedDict total=False`.
- Schema registry `docs/backend/openapi.yaml` `3.1.0` `version:0.2.0` generated
  from `api/routers 27` (`scripts/docs_audit_phase10.py`), `rg openapi 110`.
- Consumer inventory `apps/web` 18+ pages `api`/`fetch`/`swr` typed,
  `sdk/typescript` — `shadow traffic` via `LANGGRAPH_SHADOW_MODE` `20` parity
  (`activities.py`).

## Deprecation & Telemetry

- `Sunset` header + `Deprecation` `2024-12-11` style, `X-API-Version 1`
  (`middleware/api_version`), `deprecation telemetry` `metrics`
  `langgraph_run_failed_total` `reason` + `approval_gated` 13.
- Horizon `W2→P19` per `ADR-040→043`, migration owner `Enterprise Architect`,
  reconciliation `lag <5m`, cutover `flag 1%→100%` per tenant, rollback
  `lag>15m`, retirement `0 traffic + drill + archived + owner approval`.

## Versioning

- `config.py:11` `service_version 0.2.0` → `openapi 0.2.0` → `docker tag 0.2.0`
  `kustomization 0.2.0` — `rg 0.2.0 3` (`config, openapi, pyproject`).

---

_Version 1.0 2026-08-29 — `rg "0.2.0" 3`._
