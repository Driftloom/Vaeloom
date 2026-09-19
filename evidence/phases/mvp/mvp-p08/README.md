# MVP-P08 — API, Integration & Contract Design

> **Prompt:** `MVP-P08` (66-prompt pack) — API_DESIGN phase **Governing
> sources:** INT-02 (SHA-256 `2FA8966F…69640`) · INT-05 · INT-07/08/09 ·
> gatekeeper · **Predecessor:** MVP-P07 ✅ GO (98/100 re-audit) **Status:** ✅
> COMPLETE — re-run 2026-08-17; docs 01–11 written; gate 87.3/100 CONDITIONAL
> GO, pending user ratification; handoff to P09 ready

## Blocking questions (prompt §8) — resolved

| ID | Question | Decision | Owner |
| --------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| BQ-01..05 | carried | user; `master` @ `7a5434a`; India 18+; $0 cohort | per-item |
| BQ-P08-01 | Consumers + deprecation window | **Consumers = web app, TS/Python SDKs, MCP. Minors backward-compatible; breaking changes need one minor-cycle deprecation notice + user approval (change control)** | User |

## Key changes from prior run (2026-08-07)

| Item | Prior run | This run (2026-08-17) |
| --------------------- | ------------------ | --------------------------------------------------- |
| OpenAPI paths | 72 | **79** (+7 new endpoints) |
| Approval API | design-only | **IMPLEMENTED** (5 endpoints) |
| Gmail API | draft-only, design | **IMPLEMENTED** (6 endpoints: watch/draft/webhook) |
| P07 predecessor score | 88/100 | **98/100** (re-audited against current code) |
| Error format | RFC 9457 designed | **NOT RFC 9457** (gap documented, migration at P11) |
| Async job queue | designed | **NOT IMPLEMENTED** (gap documented, design at P11) |
| SDK coverage | unknown | **10%** (coverage analysis done) |
| Gate score | 88/100 | **87.3/100** (more honest gap documentation) |

## Evidence: OpenAPI snapshot (2026-08-17)

- Static spec: **79 paths, 70+ schemas, info v0.2.0**
 (`docs/backend/openapi.yaml`)
- Live verification: 26 routers, 38 ORM models, approval/gmail/consent
 implemented
- **Key implemented:** auth (login/signup/refresh/sso), consent
 (grant/me/revoke/scopes), gdpr (export/delete), memories CRUD + search,
 agents + execute + schedule, **approvals (5 endpoints)**, **gmail (6
 endpoints)**, documents, resumes, scheduler jobs, notifications, connectors,
 knowledge-graph, search, events + subscriptions, integrations, workspaces
 (+applications), chat, health (liveness/readiness/startup)

## Register index

| # | Document | Purpose |
| --- | --------------------------------- | ---------------------------------------------- |
| 01 | `01-source-register.md` | Sources + snapshot evidence + conflicts |
| 02 | `02-predecessor-audit.md` | Audit of P07 → entry GO (98/100) |
| 03 | `03-openapi-contracts.md` | **DEL-MVP-P08-01** — OpenAPI gap analysis |
| 04 | `04-events-webhooks-jobs.md` | **DEL-MVP-P08-02** — event/webhook/job schemas |
| 05 | `05-sdk-tool-mcp.md` | **DEL-MVP-P08-03** — SDK/tool/MCP contracts |
| 06 | `06-authn-authz-model.md` | **DEL-MVP-P08-04** — authN/authZ model |
| 07 | `07-compatibility-deprecation.md` | **DEL-MVP-P08-05** — compatibility/deprecation |
| 08 | `08-registers.md` | Risks/decisions/assumptions/evidence |
| 09 | `09-gate-report.md` | End-of-phase gate |
| 10 | `10-handoff-to-p09.md` | Next-phase handoff (UI/UX & Design System) |

## Scope note

- **In:** API/event/webhook/SDK/MCP/authN/authZ/error/idempotency/async-job
 contracts — design + gap analysis (implementation at P10–P12).
- **Out:** enterprise features; production changes; T2/T3 enablement.
- **Repo truth:** live 79-path OpenAPI surface; design targets gaps over it.
