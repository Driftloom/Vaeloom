# CONT-P09 — 01 IA & Journeys — Migration Map

**Deliverable:** `DEL-CONT-P09-01` | **Version:** 1.0 | **Date:** 2026-08-31 | **Commit:** `18c46f2` | **Owner:** UX Architect

## Journeys (additive over MVP — no breaking change)

| Journey | Entrypoint | States (all required per §12.1) | Degradation |
|---------|------------|--------------------------------|-------------|
| **Onboard → Workspace** | `/signup → /workspace/[id]` | `loading(empty)` → `empty(0 ws)` → `success` → `offline(retry)` `denied(403)` | `TenantMiddleware` fail-closed; `workspaces` RLS 42/42 |
| **Ingest → Parse → Chunk → Embed → Graph → RAG** | `POST /documents?workspace_id` → `run_pipeline` | `loading` `empty` `partial(ocr low conf)` `conflict(409 dup)` `stale(cache)` `offline` `denied` `expired(token)` `retry` `cancelled` `success` `failure(415/413)` | `F-40` 17 parsers now `xlsx/pptx/txt/csv` covered; `BodySizeLimit 25MB` |
| **Agent chat → approve → execute** | `POST /agents/chat/stream SSE` → `ApprovalCard` | `loading(stream intent→plan→act→token)` `partial(tool_result)` `conflict(approval 409 dup)` `expired` `success/done` `failure(retry)` | `agent_circuit_breaker 3/30s` + `approval_gated_tools()` |
| **Consent grant/revoke** | `consentApi.grant(scope)` → `gdprApi.export/delete` | `loading` `empty(no scopes)` `denied` `success` `failure` + `personal vs institution` context label | DPDP scopes `data_processing/agent_access` revocable; `gmail.send` T3 disabled by default |

## Expand–Contract

- Old `mockUsers/mockServices` fallbacks in `apps/web/src/app/workspace/[workspaceId]/admin/page.tsx:42` → new `iamApi.listUsers()` `auditApi.queryEvents()` additive shadow: live data wins if reachable, fallback stays if `ENTERPRISE_ROUTES_ENABLED=false`. Flag `isEnterpriseEnabled()` controls greeting, not data path.
- `ApprovalCard` `Proposed — not yet executed` `apps/web/src/components/shared/ApprovalCard.tsx:94` stays; no silent auto-execute. `ExpiryTimer` `approvals` `expires_at` controls execution window.

## Handoff

- Next: `02-screen-state-specs` maps each state to pixel spec.
- Evidence: `docs/phases/cont-p09/07-evidence-bundle.md` `EVD-CONT-P09-001..005`.

---
_Version 1.0 2026-08-31 — `rg "workspace_id" apps/web/src/app/workspace 110`._
