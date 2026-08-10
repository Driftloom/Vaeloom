# MVP-P08 — 08. Registers (Risks / Decisions / Assumptions)

> Phase snapshot 2026-08-07.

## 1. Risks

| ID           | Risk                                                                  | Sev      | Mitigation                                                                       | Owner         | Status |
| ------------ | --------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- | ------------- | ------ |
| RISK-P03..07 | carried                                                               | per-item | per prior phases                                                                 | per-item      | OPEN   |
| RISK-P08-01  | Existing endpoints freeze contract before hardening (approval absent) | HIGH     | additive deltas only; approval API ships before any send path (release-blocking) | API Architect | OPEN   |
| RISK-P08-02  | OpenAPI drift between dynamic spec and committed static file          | MED      | CI openapi-diff at P11                                                           | Contract-Test | OPEN   |
| RISK-P08-03  | SDK/API breaking-change friction                                      | LOW      | BQ-P08-01 policy + user approval                                                 | DX Lead       | OPEN   |
| RISK-P08-04  | Gmail watcher contract races (poll overlap)                           | MED      | unique-per-workspace job lock; pacing (P02 quota facts)                          | Integration   | OPEN   |
| RISK-P08-05  | CSRF skip-list widened accidentally                                   | MED      | verify list at every change (AGENTS.md item 4)                                   | Security      | OPEN   |

## 2. Decisions

| ID          | Decision                                                                                            | Authority     | Date       |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| DEC-P03..07 | carried                                                                                             | User/Program  | 2026-08-07 |
| DEC-P08-01  | **BQ-P08-01: MVP-internal consumers; minors compatible; breaking = 1-cycle notice + user approval** | User          | 2026-08-07 |
| DEC-P08-02  | Approval API design (propose/decide/execute/revoke) adopted — release-blocking                      | Architecture  | 2026-08-07 |
| DEC-P08-03  | OpenAPI 3.1 static contract at P11 + CI drift check                                                 | API Architect | 2026-08-07 |
| DEC-P08-04  | Webhook delivery endpoints stay enterprise-gated (CF-P08-01)                                        | INT-05 + REPO | 2026-08-07 |

## 3. Assumptions

| ID         | Assumption                                                     | Owner       | Reversible?                |
| ---------- | -------------------------------------------------------------- | ----------- | -------------------------- |
| ASP-P08-01 | Existing 72-path surface stays; deltas additive (no v2 in MVP) | API         | Yes                        |
| ASP-P08-02 | CSRF skip list (auth only) remains correct                     | Security    | Yes — verified each change |
| ASP-P08-03 | MCP as client-only in MVP (server exposure deferred)           | Integration | Yes                        |

## 4. Evidence (EVD)

| ID              | Claim                                   | Requirement     | Location                | Status   |
| --------------- | --------------------------------------- | --------------- | ----------------------- | -------- |
| EVD-MVP-P08-001 | Live OpenAPI dump (72 paths/70 schemas) | MVP-P08-R01/R02 | `01` §3 + temp snapshot | VERIFIED |
| EVD-MVP-P08-002 | OpenAPI delta design                    | MVP-P08-R01     | `03`                    | VERIFIED |
| EVD-MVP-P08-003 | Event/webhook/job schemas               | MVP-P08-R01     | `04`                    | VERIFIED |
| EVD-MVP-P08-004 | SDK/tool/MCP contracts                  | MVP-P08-R01     | `05`                    | VERIFIED |
| EVD-MVP-P08-005 | AuthN/AuthZ model                       | MVP-P08-R03     | `06`                    | VERIFIED |
| EVD-MVP-P08-006 | Compatibility policy                    | MVP-P08-R07     | `07`                    | VERIFIED |
| EVD-MVP-P08-007 | BQ-P08-01 user decision                 | MVP-P08-R03     | question-tool record    | VERIFIED |
| EVD-MVP-P08-008 | User ratification of contracts          | R08             | PENDING user            | PENDING  |
