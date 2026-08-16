# MVP-P05 — 01. Source Register

> Prompt §4 + §15. Live inspection evidence outranks design prose (INT-02 truth
> rule). All sources verified at phase start 2026-08-07.

## 1. Internal sources (INT)

| ID     | Source                                                              | Use                                 | Status                                    |
| ------ | ------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| INT-01 | Gatekeeper compendium (substitute for original)                     | Governing 32-section contract       | Available                                 |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md` (SHA-256 `2FA8966F…69640`) | Authoritative corrections/hardening | Available, re-verified                    |
| INT-03 | `vaeloom-mvp-e2e.md`                                                | MVP baseline                        | Available                                 |
| INT-05 | `docs/01-vaeloom-mvp-spec.md`                                       | Canonical MVP scope                 | Available                                 |
| INT-07 | `docs/02-system-architecture.md`                                    | Architecture intent                 | Available                                 |
| INT-08 | `docs/03-agent-workflow.md`                                         | Agent/approval flow intent          | Available                                 |
| INT-09 | `docs/04-memory-knowledge-graph.md`                                 | Memory/RAG intent                   | Available                                 |
| REPO   | `master` @ `662052e` — **live inspected 2026-08-07**                | Implementation truth                | Available; two inventory reports recorded |

## 2. External standards (EXT) — verified at phase start

| ID           | Standard                       | Snapshot            | Applicability                                    |
| ------------ | ------------------------------ | ------------------- | ------------------------------------------------ |
| EXT-01       | MCP Spec                       | 2026-07-28          | APPLICABLE — connectors/mcp                      |
| EXT-02       | OWASP Agentic Top 10           | 2026                | APPLICABLE — mapped in `06`                      |
| EXT-03       | OWASP LLM Top 10               | 2025                | APPLICABLE — mapped in `06`                      |
| EXT-04       | NIST AI RMF + GenAI profile    | current             | APPLICABLE                                       |
| EXT-05       | WCAG 2.2                       | W3C Rec             | APPLICABLE — P09                                 |
| EXT-06       | RFC 9700 OAuth BCP             | IETF                | APPLICABLE — P08                                 |
| EXT-08       | OpenAPI 3.x                    | current             | APPLICABLE — pin at P08                          |
| EXT-09       | OpenTelemetry                  | latest              | APPLICABLE — repo has OTel                       |
| EXT-10       | SLSA v1.2                      | current             | DEFER — P16/P19                                  |
| EXT-11       | NIST SSDF 800-218              | v1.1                | APPLICABLE — P06/P13                             |
| EXT-12       | Gmail API push/quotas          | current             | APPLICABLE — DEC-P02-01 polling MVP              |
| EXT-16       | DPDP Act + Rules 2025          | 2025-11-13 notified | APPLICABLE — P13; residency flag CF-P05-02       |
| EXT-15/14/17 | EU AI Act / GDPR / FERPA+COPPA | current             | NOT_APPLICABLE (India launch; 18+; re-check P13) |

## 3. Conflict log

| ID        | Conflict                                                                                                                      | Resolution                                                                                                                                                       | Authority                                            | Date       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| CF-P05-01 | Prompt §3 architecture lists NestJS + `apps/core-api` + `apps/ai-service`; repo has FastAPI unified `apps/api`, no NestJS app | **Repo truth** (live inspection): single FastAPI service + worker; TS packages (service-auth, observability, queue) are NestJS-style libs, not deployed services | REPO > INT-05 > prompt (carried CF-P03-02/CF-P04-01) | 2026-08-07 |
| CF-P05-02 | INT-02 memory intent (Profile/Document/Career/Episodic/Preference/Working) vs repo single entity-typed `Memory` table         | ADR-022: 6-memory taxonomy as typed rows + supersession on existing tables (no premature schema split)                                                           | INT-02 §4 + REPO                                     | 2026-08-07 |
| CF-P05-03 | Data residency: India launch vs $0 free tiers (no India region)                                                               | BQ-P05-02 (user): nearest region; DPDP residency risk → RISK-P05-06, legal review at P13                                                                         | User decision                                        | 2026-08-07 |

## 4. Repo inspection evidence (truth rule — prompt §14)

| Check              | Command/artifact                           | Result                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HEAD + tree        | `git rev-parse HEAD`, `git status --short` | `662052e`, clean                                                                                                                                                                                                                                                              |
| Backend structure  | `apps/api/src/backend/`                    | main, config, agents/ (21), orchestrator/, routers/ (24), services/ (45), models/schema.py (33 tables), clients/ (gmail, calendar, drive, job_board), infrastructure/ (vector_store, search, secrets, otelemetry, circuit_breaker), middleware/ (10), workers/queue_worker.py |
| Frontend structure | `apps/web/src/`                            | app router (workspace/* 17 routes), middleware.ts (auth + security headers), lib/api.ts + api-client.ts (transformKeys)                                                                                                                                                       |
| Infra              | `infra/`, root compose                     | terraform (AWS), k8s manifests (20 services), docker-compose (postgres+redis+web+backend+minio+pgbouncer), 4 runbooks, monitoring compose                                                                                                                                     |
| CI/CD              | `.github/workflows/`                       | 11 workflows (ci, ci-backend w/ coverage, ci-frontend, integration, docker, deploy, staging, security-audit, security-scan, docs-validate, a11y-audit)                                                                                                                        |
| Explicit gaps      | grep/site inspection                       | NO approval_request/idempotency tables · NO RLS policies · NO Gmail watch/historyId · NO profile/career/episodic/preference/working stores · NO static openapi file · sdk/rest-api empty                                                                                      |

Evidence: `EVD-MVP-P05-001/002` (inventory reports, this phase).
