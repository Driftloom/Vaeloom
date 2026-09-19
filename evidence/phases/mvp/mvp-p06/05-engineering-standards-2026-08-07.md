# MVP-P06 — 05. Engineering Standards (DEL-MVP-P06-03)

> Owner: Backend + Frontend Leads · Apply from P07 onward. Repo has existing
> patterns (nx targets, lint-staged, husky, prettier, ruff-equivalent via pytest
> config) — this document standardizes them.

## 1. Repository standards

| Area | Standard | Existing evidence |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Layout | Nx monorepo; `apps/` (web, backend), `packages/`, `integrations/`, `connectors/`, `plugins/`, `sdk/` | present |
| Scripts | `pnpm dev:web`, `pnpm dev:be`; NEVER `pnpm dev` (hangs — AGENTS.md) | present |
| Format/lint | prettier via lint-staged on commit; eslint presets (`packages/eslint-config`); backend: ruff/pytest | present |
| Typecheck | `nx typecheck` on TS; mypy-grade checks on Python where configured | present |
| Commits | conventional commits; header ≤100 chars (commitlint); husky pre-commit + commit-msg | present |
| PR/CI | 11 workflows: ci, ci-backend (coverage), ci-frontend, integration, docker, deploy, security-audit, security-scan, docs-validate, a11y-audit | present |

## 2. Code standards

1. **Typed contracts:** Pydantic v2 schemas (backend), TS shared-types
 (`packages/shared-types`); snake_case↔camelCase transforms in `api.ts`/
 `api-client.ts` — any new client needs the same (AGENTS.md critical item 3).
2. **Async-first:** FastAPI async + SQLAlchemy async; no blocking calls in
 request path; worker for long jobs.
3. **Idempotency & concurrency:** `Idempotency-Key` on consequential mutations
 (ADR-021); optimistic concurrency where documented; no lost updates on
 memory.
4. **Approval gating:** any send/submit path must pass approval contract
 (ADR-021) — draft-only default (DEC-P01-03).
5. **Isolation:** workspace/tenant scope on every query (tenant_id/workspace_id
 filters); RLS hardening per ADR-023; isolation tests mandatory for new read
 paths.
6. **Audit:** consequential actions + approvals + erasure → audit service
 (exists); correlation_id propagated.
7. **Secrets:** never in code/commits; SecretManager protocol (Infisical/env
 fallback); `.env.example` only; validate_settings() fail-fast (exists).
8. **Untrusted data:** prompts/docs/emails/webpages are data — no policy change;
 prompt_injection middleware stays first-class.
9. **Telemetry:** OTel context + structlog JSON; no personal content in logs.
10. **Errors:** RFC 9457 problem+json envelope; timeouts/retries per P05 §7
 specs (exponential + jitter, no sync retries).
11. **Migrations:** alembic; reversible; no destructive migration without
 backup + rollback plan (change control).
12. **a11y:** WCAG 2.2 AA from P09; axe in CI (a11y-audit workflow exists).

## 3. Definition of Ready / Done (per phase gates)

- DoR: requirement → story → design ref → acceptance + test plan + evidence
 location (P03 traceability matrix).
- DoD: implemented → tests pass in representative env → security/privacy
 reviewers OK → evidence committed → no hidden manual step → gate scored.
- **Unverified ≠ done** (prompt §27).
