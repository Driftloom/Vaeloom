# MVP-P08 — 01. Source Register

> Prompt §4 + §15. OpenAPI dumped live 2026-08-07 (real execution evidence).

## 1. Internal sources

| ID         | Source                                                              | Use             | Status    |
| ---------- | ------------------------------------------------------------------- | --------------- | --------- |
| INT-01..10 | gatekeeper, INT-02 (SHA-256 `2FA8966F…69640`), INT-03/05/07/08/09   | as prior phases | Available |
| REPO       | `master` @ `7a21a28`; backend app imported + `/openapi.json` dumped | Contract truth  | Available |

## 2. External standards — verified at phase start

| ID     | Standard                                    | Applicability                            |
| ------ | ------------------------------------------- | ---------------------------------------- |
| EXT-06 | RFC 9700 OAuth BCP                          | OAuth connector + token contracts        |
| EXT-08 | OpenAPI 3.1 (pin; repo serves default spec) | Static contract + compat tests           |
| EXT-01 | MCP Spec 2026-07-28                         | connector/mcp contract                   |
| EXT-09 | OpenTelemetry                               | trace context propagation in APIs        |
| EXT-12 | Gmail API                                   | polling watcher contract                 |
| EXT-16 | DPDP Rules 2025                             | rights endpoints (export/delete/consent) |

## 3. OpenAPI snapshot evidence (EVD-MVP-P08-001)

| Fact             | Value                                                                                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command          | `python -c "import json; from backend.main import app; spec=app.openapi()"` (env: mock-key, sqlite, OTEL disabled)                                                                                                                                                         |
| Result           | paths=72, schemas=70, info=`Vaeloom Backend` v0.2.0                                                                                                                                                                                                                        |
| Full dump        | `C:\Users\Dell\AppData\Local\Temp\opencode\openapi-snapshot.json` (immutable snapshot; path list in README)                                                                                                                                                                |
| Notable existing | consent grant/me/revoke/scopes · gdpr export/delete · memories CRUD/search · agents execute/schedule · scheduler jobs · applications POST/outcome PATCH · events+subscriptions · notifications · connectors · knowledge-graph · chat · health (liveness/readiness/startup) |
| Notable absent   | approval endpoints · idempotency headers · memory domains/supersession · Gmail watcher · static OpenAPI file                                                                                                                                                               |

## 4. Conflict log

| ID        | Conflict                                                                                                                   | Resolution                                                                                              | Authority           | Date       |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| CF-P08-01 | Prompt phase rule lists webhooks as part of API scope; repo has webhooks + subscriptions models/routers gated (enterprise) | MVP keeps events/subscriptions; webhook delivery endpoints stay enterprise-gated (out of MVP)           | INT-05 + REPO       | 2026-08-07 |
| CF-P08-02 | Existing `/api/v1/memories` free-form CRUD vs 6-domain taxonomy (ADR-022)                                                  | Design domain param + supersession semantics on existing endpoints (additive; no breaking change to v1) | ADR-022 + INT-02 §4 | 2026-08-07 |

Evidence: EVD-MVP-P08-001 (live dump, this register).
