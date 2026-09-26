# Vaeloom — Memory-First Personal Intelligence Platform

> Vaeloom reads everything a student or early-career professional creates —
> documents, code, email, certificates — quietly organizes it, remembers it, and
> turns it into a living resume, a career radar, and a workspace that organizes
> itself.

## Badges

> Placeholder — wire up after first public release. Suggested: CI status,
> coverage, license, OpenAPI version, docs.

[![CI](https://img.shields.io/badge/ci-github--actions-placeholder-lightgrey)](<>)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)](<>)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](<>)
[![OpenAPI](https://img.shields.io/badge/openapi-162_paths-blue)](<>)
[![Docs](https://img.shields.io/badge/docs-1033_files-informational)](<>)

## Product Overview

Vaeloom is a second brain for students and early-career professionals. It
ingests documents, code, and communications, builds a continuously updated
structured memory (vector + relational hybrid with a knowledge graph), and runs
specialized, permission-scoped agents that:

- **Organize** files and surface what matters (deadlines, follow-ups).
- **Maintain** a living resume — AI-tailored variants, semantic ATS scoring,
  PDF/DOCX compilation from 5 industry templates.
- **Search** across everything — hybrid full-text + vector + graph traversal.
- **Apply** — job search, company insights, and application tracking agents with
  human-in-the-loop approval gates.

Enterprise track adds multi-tenancy (RLS 42/42, fail-closed), SSO
(Google/Microsoft), ABAC/RBAC, audit log with tamper detection, and SOC
2-oriented controls. See `docs/vaeloom-mvp-e2e-enterprise-hardened.md`
(governing) and the [Roadmap](docs/ROADMAP.md).

## Monorepo Map

25 packages via pnpm workspaces + Nx (`pnpm-workspace.yaml`, `nx.json`):

| Path            | What                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`      | Next.js 15 web app (18+ wired pages, SWR caching, dark/light mode)                                                                          |
| `apps/api`      | FastAPI backend (monolith-with-modules, 254 OpenAPI paths / 315 ops)                                                                        |
| `packages/`     | Shared libs: `ui-kit`, `shared-types`, `eslint-config`, `tsconfig`, `observability`, `queue`, `plugin-sdk`, `python-common`, `service-auth` |
| `integrations/` | calendar, email, github, google-drive, notion, slack                                                                                        |
| `connectors/`   | graphql, mcp, rest adapters (incl. native MCP bridge `mcp__Server__Tool`)                                                                   |
| `sdk/`          | typescript, python, rest-api clients                                                                                                        |
| `plugins/`      | tag-generator, word-count, sentiment, summarizer, translator (sandboxed)                                                                    |
| `infra/`        | kubernetes manifests, terraform modules, docker                                                                                             |
| `docs/`         | ~1033 files — start at [docs/README](docs/README.md)                                                                                        |

Backend tests: ~2731 pytest (~94% coverage, security 233/233). API spec:
`docs/backend/openapi.yaml` (v0.2.0, 254 paths / 315 ops, regen 2026-09-21).
ADRs: 44 (`docs/adr/ADR-001..ADR-044`).

## Quickstart

### 1. Install (2.2s)

```bash
pnpm install
```

> NEVER run bare `pnpm dev` — it is disabled at the root (fail-fast redirect).
> Use `pnpm dev:web` only.

### 2. Frontend

```bash
pnpm dev:web        # via Nx (2-5s) — preferred
# or: make dev-web  # direct `next dev`, fastest
```

App: `http://localhost:3000` (signup at `/signup` if no seed account).

### 3. Backend API

Pydantic does **not** read `.env` (`model_config` lacks `env_file`), so export
vars with the **double-underscore** `DATABASE__URL` name:

```powershell
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"  # 32+ chars required
$env:ENCRYPTION_KEY="$(openssl rand -base64 32)"  # fresh per machine; test vector MDEy... is test-only
$env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"
$env:LLM_API_KEY="mock-key"
$env:OTEL_SDK_DISABLED="true"
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000` — spec at `docs/backend/openapi.yaml`.

Backend tests (full suite hangs/crashes under default xdist — use serial; fast
parallel variant needs 32GB):

```bash
cd apps/api && uv run --project apps/api python -m pytest -q -o addopts=""  # serial, ~8-10min, reliable
# or: python -m pytest -q -o addopts="-n auto --dist loadfile"  # fast, ~2-3min, needs 32GB
```

## Test Accounts

| Email                | Password        | Notes                                                |
| -------------------- | --------------- | ---------------------------------------------------- |
| `demo@vaeloom.app`   | `demo1234`      | Demo DB seed (sign up if missing on fresh DBs)       |
| `audit@vaeloom.test` | `AuditPass123!` | Auto-seeded for e2e (`apps/web/e2e/api-launcher.py`) |

## Docs

- [Documentation index](docs/README.md) — master navigation hub
- [Architecture](docs/ARCHITECTURE.md) — pointer index (C4, HLD/LLD, ADRs)
- [API reference](docs/API_REFERENCE.md) — v0.2.0, 254 paths / 315 ops
- [Contributing](CONTRIBUTING.md) — uv flow, `pnpm dev:web`-only rule
- [Security](SECURITY.md) — disclosure via `security@vaeloom.dev` (48h ack)
- [Support](docs/SUPPORT.md) | [Glossary](docs/GLOSSARY.md) |
  [Roadmap](docs/ROADMAP.md)
- Agent sessions: read [AGENTS.md](AGENTS.md) first (gotchas that WILL break
  fresh setups: `DATABASE__URL`, CSP `connect-src`, `transformKeys`, CSRF).

## License

Proprietary — see [LICENSE](LICENSE). Security reports:
[SECURITY.md](SECURITY.md).
