# MVP-P08 — 08. Registers (Risks / Decisions / Assumptions / Evidence)

> Re-run 2026-08-17. Updated to reflect current codebase state.

## 1. Risks

| ID           | Risk                                                                     | Sev  | Mitigation                                                         | Owner         | Status |
| ------------ | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ | ------------- | ------ |
| RISK-P03..07 | carried from prior phases                                                | per  | per prior phases                                                   | per-item      | OPEN   |
| RISK-P08-01  | Error format not RFC 9457 — clients can't programmatically handle errors | HIGH | Migrate exception_handler to problem+json at P11                   | API Architect | OPEN   |
| RISK-P08-02  | SDK coverage at 10% — API surface unsupported by typed clients           | HIGH | SDK expansion at P10-P12; typed generation from OpenAPI            | DX Lead       | OPEN   |
| RISK-P08-03  | No general async job queue — export/erase/embed lack 202 polling         | MED  | Design job resource at P11; implement BullMQ queues                | Backend Lead  | OPEN   |
| RISK-P08-04  | DLQ entries invisible — no management API                                | MED  | Add DLQ endpoints at P12                                           | Integration   | OPEN   |
| RISK-P08-05  | No webhook signature verification endpoint                               | MED  | Add verify endpoint at P12; document consumer verification pattern | Security      | OPEN   |
| RISK-P08-06  | No session logout endpoint                                               | MED  | Add logout at P11; session invalidation                            | Auth          | OPEN   |
| RISK-P08-07  | Workload identity (ADR-025) not implemented                              | MED  | HMAC service tokens at P11                                         | Security      | OPEN   |
| RISK-P08-08  | Input sanitization (ADR-031) not implemented                             | HIGH | ContentSanitizer pipeline at P12                                   | Security      | OPEN   |
| RISK-P08-09  | OpenAPI drift between dynamic spec and committed static file             | MED  | CI openapi-diff at P11                                             | Contract-Test | OPEN   |
| RISK-P08-10  | CSRF skip-list widened accidentally                                      | MED  | Verify list at every change (AGENTS.md item 4)                     | Security      | OPEN   |

## 2. Decisions

| ID          | Decision                                                                                            | Authority     | Date       |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| DEC-P03..07 | carried from prior phases                                                                           | User/Program  | per-item   |
| DEC-P08-01  | **BQ-P08-01: MVP-internal consumers; minors compatible; breaking = 1-cycle notice + user approval** | User          | 2026-08-07 |
| DEC-P08-02  | Approval API (propose/approve/reject) IMPLEMENTED — no separate execute endpoint needed             | REPO          | 2026-08-17 |
| DEC-P08-03  | OpenAPI 3.1 static contract + CI drift check at P11                                                 | API Architect | 2026-08-17 |
| DEC-P08-04  | Webhook delivery endpoints stay enterprise-gated (CF-P08-01)                                        | INT-05 + REPO | 2026-08-17 |
| DEC-P08-05  | Error format: migrate to RFC 9457 problem+json at P11                                               | API Architect | 2026-08-17 |
| DEC-P08-06  | General async job queue: design at P11, implement at P11-P12                                        | Backend Lead  | 2026-08-17 |
| DEC-P08-07  | Gmail endpoints implemented (6); no send endpoint (DEC-P02-05 honored)                              | REPO          | 2026-08-17 |

## 3. Assumptions

| ID         | Assumption                                                      | Owner        | Reversible?                |
| ---------- | --------------------------------------------------------------- | ------------ | -------------------------- |
| ASP-P08-01 | Existing 79-path surface stays; deltas additive (no v2 in MVP)  | API          | Yes                        |
| ASP-P08-02 | CSRF skip list (auth only) remains correct                      | Security     | Yes — verified each change |
| ASP-P08-03 | MCP as client-only in MVP (server exposure deferred)            | Integration  | Yes                        |
| ASP-P08-04 | Approval API is sufficient (no execute/revoke endpoints needed) | Architecture | Yes — add if UX requires   |
| ASP-P08-05 | Scheduler module sufficient for MVP (general async at P11)      | Backend      | Yes                        |

## 4. Evidence (EVD)

| ID              | Claim                                          | Requirement     | Location                              | Status   |
| --------------- | ---------------------------------------------- | --------------- | ------------------------------------- | -------- |
| EVD-MVP-P08-001 | Live OpenAPI spec (79 paths, 70+ schemas)      | MVP-P08-R01/R02 | `01` §3 + `docs/backend/openapi.yaml` | VERIFIED |
| EVD-MVP-P08-002 | OpenAPI gap analysis + delta design            | MVP-P08-R01     | `03`                                  | VERIFIED |
| EVD-MVP-P08-003 | Event/webhook/job schemas + gaps               | MVP-P08-R01     | `04`                                  | VERIFIED |
| EVD-MVP-P08-004 | SDK/tool/MCP contracts + coverage analysis     | MVP-P08-R01     | `05`                                  | VERIFIED |
| EVD-MVP-P08-005 | AuthN/AuthZ model + threat mapping             | MVP-P08-R03     | `06`                                  | VERIFIED |
| EVD-MVP-P08-006 | Compatibility/deprecation policy               | MVP-P08-R07     | `07`                                  | VERIFIED |
| EVD-MVP-P08-007 | BQ-P08-01 user decision (question-tool record) | MVP-P08-R03     | question-tool record                  | VERIFIED |
| EVD-MVP-P08-008 | P07 predecessor audit (98/100 GO)              | MVP-P08-R08     | `02`                                  | VERIFIED |
| EVD-MVP-P08-009 | Approval API implementation (5 endpoints)      | MVP-P08-R01     | `services/approval.py`                | VERIFIED |
| EVD-MVP-P08-010 | Gmail API implementation (6 endpoints)         | MVP-P08-R01     | `routers/gmail.py`                    | VERIFIED |
| EVD-MVP-P08-011 | Idempotency middleware (4 prefix groups)       | MVP-P08-R03     | `middleware/idempotency.py`           | VERIFIED |
| EVD-MVP-P08-012 | Error handler (NOT RFC 9457 — gap documented)  | MVP-P08-R01     | `middleware/exception_handler.py`     | VERIFIED |
