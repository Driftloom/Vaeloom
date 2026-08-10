# MVP-P08 — API, Integration & Contract Design

> **Prompt:** `MVP-P08` (66-prompt pack) — API_DESIGN phase **Governing
> sources:** INT-02 (SHA-256 `2FA8966F…69640`) · INT-05 · INT-07/08/09 ·
> gatekeeper · **Predecessor:** MVP-P07 ✅ CONDITIONAL GO 88/100, ratified
> 2026-08-07 **Status:** ✅ COMPLETE — docs 01–10 written 2026-08-07; gate
> 88/100 CONDITIONAL GO, pending user ratification; handoff to P09 ready

## Blocking questions (prompt §8) — resolved

| ID        | Question                       | Decision                                                                                                                                                            | Owner    |
| --------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| BQ-01..05 | carried                        | user; `master` @ `7a21a28`; India 18+; $0 cohort                                                                                                                    | per-item |
| BQ-P08-01 | Consumers + deprecation window | **Consumers = web app, TS/Python SDKs, MCP. Minors backward-compatible; breaking changes need one minor-cycle deprecation notice + user approval (change control)** | User     |

## Evidence: live OpenAPI snapshot (2026-08-07)

- Dumped from running app: **72 paths, 70 schemas, info v0.2.0** ("Vaeloom
  Backend").
- Already present: auth (login/signup/refresh/sso), consent
  (grant/me/revoke/scopes), **gdpr export/delete**, memories CRUD + search,
  agents + execute + schedule, documents, resumes (+generate), scheduler jobs,
  notifications, connectors, knowledge-graph, search, events + subscriptions,
  integrations, workspaces (+applications GET/POST, outcome PATCH), chat,
  health.
- **Absent (design deltas → `03`):** approval endpoints, idempotency headers,
  memory domain/supersession semantics, Gmail polling watcher, static OpenAPI
  file.

## Register index

| #   | Document                          | Purpose                                        |
| --- | --------------------------------- | ---------------------------------------------- |
| 01  | `01-source-register.md`           | Sources + snapshot evidence + conflicts        |
| 02  | `02-predecessor-audit.md`         | Audit of P07 → entry GO                        |
| 03  | `03-openapi-contracts.md`         | **DEL-MVP-P08-01** — OpenAPI delta design      |
| 04  | `04-events-webhooks-jobs.md`      | **DEL-MVP-P08-02** — event/webhook/job schemas |
| 05  | `05-sdk-tool-mcp.md`              | **DEL-MVP-P08-03** — SDK/tool/MCP contracts    |
| 06  | `06-authn-authz-model.md`         | **DEL-MVP-P08-04** — authN/authZ model         |
| 07  | `07-compatibility-deprecation.md` | **DEL-MVP-P08-05** — compatibility/deprecation |
| 08  | `08-registers.md`                 | Risks/decisions/assumptions/evidence           |
| 09  | `09-gate-report.md`               | End-of-phase gate                              |
| 10  | `10-handoff-to-p09.md`            | Next-phase handoff (UI/UX & Design System)     |

## Scope note

- **In:** API/event/webhook/SDK/MCP/authN/authZ/error/idempotency/async-job
  contracts — design only (implementation at P10–P12).
- **Out:** enterprise features; production changes; T2/T3 enablement.
- **Repo truth:** dynamic OpenAPI exists (72 paths); design targets deltas over
  it; static contract file lands at P11.
