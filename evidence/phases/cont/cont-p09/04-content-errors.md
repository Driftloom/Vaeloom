# CONT-P09 — 04 Content & Errors

**Deliverable:** `DEL-CONT-P09-04` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Content Design

## Provenance / Confidence / Correction (memory)

| Surface | Source | Rendering |
|---------|--------|-----------|
| Memory detail | `GET /memories/{id}/lineage` `GET /memories/{id}/history` `GET /memories/{id}/chunks` | `ProvenanceBadge` list + `ConfidenceMeter value` `ApprovalCard.tsx:116` + chunk view |
| Correction | `services/memory_service.py supersedes_id` | `superseded` badge + link to new version; `history` shows `previous_content` |
| Scopes / Rights | `GET /consent/scopes` `GET /consent/me` | `Scopes: data_processing agent_access` chips `ApprovalCard.tsx:126`; `gmail.send` gate `t3Warning` |

## Error Vocabulary (typed)

| Code | UI | Transport | Re-try |
|------|----|-----------|--------|
| `400 validation` | `ErrorState` field `message[]` | `HTTPValidationError` `openapi.yaml` | Fix form, no retry |
| `401 expired` | `session-expired/page.tsx` | `ApiError 401` `api.ts:154` refreshQueue | `POST /auth/refresh` then replay |
| `403 CSRF/tenant` | `forbidden` + toast | `ApiError 403` `resetCsrfToken()` `api.ts:144` | fresh `GET /csrf-token` once |
| `409 idempotency` | `already submitted` | `IdempotencyMiddleware` `UNIQUE(ws,key)` `schema.py:648` | show existing result |
| `413 body too large` | `file too large 25MB` | `BodySizeLimitMiddleware 25*1024*1024` `main.py:256` | compress/split |
| `415 unsupported` | `UnsupportedFormatError` `parsers.py:363` | now only via `unknown` fallback | upload `pdf/docx/.../svg` per `PARSERS 17` |

## Copy Style

- Sentence case, no jargon. Every agent message labels `agentName suggests` `ApprovalCard.tsx:84` not `agent acted`.
- Personal/institution labels: "Proposed — not yet executed" `ApprovalCard.tsx:94` + `decide before expiry` `ApprovalCard.tsx:99` + undo hint `ApprovalCard.tsx:152`.

---
_Version 1.0 2026-08-31 — `rg "UnsupportedFormatError" apps/api/src/api/ingestion/parsers.py 363`._
