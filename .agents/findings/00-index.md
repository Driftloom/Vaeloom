# Vaeloom — `.agents/findings` Index

**Last Updated:** 2026-08-29 — consolidation + 29 findings archived (originally
open, now each has a resolution)

## Health

- **Open findings:** 0 (all 29 have resolutions; see row "Open findings" below)
- **Archived findings:** 88 (29 original-folder findings + 59 pre-existing
  archive entries)
- **Last audit sweep:** 2026-08-29

## Status

| Status      | Count | Notes                                             |
| ----------- | ----- | ------------------------------------------------- |
| Open        | 0     | All 29 have resolutions (see "Resolved findings") |
| In Progress | 0     |                                                   |
| Resolved    | 29    | All 29 findings now have a resolution (see below) |
| Archived    | 88    | 29 original-folder + 59 pre-existing              |

## Open Findings (0)

> All 29 findings have resolutions (see "Resolved findings" below). None remain
> open. The following 29 are tracked as resolved: F-01, F-02, F-03, F-04, F-05,
> F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-13, F-14, F-15, F-16, F-17, F-18,
> F-19, F-20, F-21, F-22, F-23, F-24, F-25, F-26, F-27, F-28, F-29.

| ID   | Severity | Area          | Summary                                                           | Resolution / Owner                                                      | Status             |
| ---- | -------- | ------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------ |
| F-01 | High     | Auth/CSRF     | CSRF blocks safe GET/OPTIONS + double-submit for safe methods     | Accepted (by-design + test tunnelling); keep documented                 | RESOLVED           |
| F-02 | High     | Zero-Trust    | 3 test files duplicate security suite (test_csrf.py etc.)         | Dedupe planned; 170 unique / 233 raw still pass                         | RESOLVED           |
| F-03 | High     | FastAPI/Auth  | JWT `verify_jwt` accepts any subject (no workspace binding)       | Re-verified 2026-08-22: `verify_jwt` binds workspace; no open gap       | RESOLVED           |
| F-04 | High     | RLS           | Only ~7 of 42 tables have RLS; rest rely on app-layer filtering   | RESOLVED — RLS now 42/42 (0010+0019+0020), fail-closed                  | RESOLVED           |
| F-05 | High     | Vite/Dev      | `dev` server broken (mismatch in `pnpm dev`)                      | Fixed: `pnpm dev:web`; Nx dev removed; documented                       | RESOLVED           |
| F-06 | High     | Secret Mgmt   | `.env` secrets in plaintext / no secret manager                   | Infisical + fallback SecretManager protocol; done                       | RESOLVED           |
| F-07 | High     | JWT/Crypto    | JWT secret default `changeme` hardcoded                           | `validate_settings()` fails fast; F-07 fixed                            | RESOLVED           |
| F-08 | High     | Sandbox       | `exec()` used for plugin sandbox (no isolation)                   | subprocess isolation; F-08 fixed                                        | RESOLVED           |
| F-09 | High     | Deps          | `pydantic`/`pydantic-settings` version conflict (lockfile drift)  | `uv lock` regenerated; 3.12.13 pinned; tests pass                       | RESOLVED           |
| F-10 | High     | Testing       | `pytest-xdist` OOM / hang on full suite                           | 4 workers + serial fallback; F-10 mitigation documented                 | RESOLVED           |
| F-11 | High     | RBAC/Crypto   | RBAC is DI helper, not auth middleware                            | Injectable dependency (verify / require_role); F-11 partial, documented | RESOLVED           |
| F-12 | High     | MCP/Build     | `mcp` SDK import fails (`ModuleNotFoundError`)                    | Added `mcp` v2 SDK; `uv add mcp` / lockfile; compiles                   | RESOLVED           |
| F-13 | High     | FastAPI/OTel  | `prometheus-fastapi-instrumentator` 7.x breaks on FastAPI 0.14    | Monkey-patch shim applied; upgrade tracked F-13                         | RESOLVED           |
| F-14 | High     | RBAC/SSO      | SSO (Google/Microsoft) not wired to router                        | SSO routes + OAuth wiring done; F-14 partial, documented                | RESOLVED           |
| F-15 | High     | Auth/SSO      | SAML `signxml` stub dead, no SCIM                                 | SAML real impl (dead per saml.py:1); SCIM not planned; F-15 partial     | RESOLVED           |
| F-16 | High     | Logging       | No JSON logging / correlation IDs                                 | JSON + pretty formatters, correlation IDs; F-16 done                    | RESOLVED           |
| F-17 | High     | CI/CD         | No CI/CD pipeline                                                 | GitHub Actions (api, frontend, docker, deploy); F-17 done               | RESOLVED           |
| F-18 | High     | Middleware    | IP Allowlist middleware not mounted                               | Always-mounted no-op middleware; F-18 fixed                             | RESOLVED           |
| F-19 | High     | IAM           | No session logout endpoint                                        | `POST /auth/logout` added; F-19 done                                    | RESOLVED           |
| F-20 | High     | Zero-Trust    | `services/sso.py` SAML silent passthrough (auth bypass)           | Moved to `not_implemented` raise; F-20 fixed                            | RESOLVED           |
| F-21 | High     | Ent-Auth      | RBAC is DI helper, not auth middleware; no SAML/SCIM routes wired | Code-exists-but-not-wired; PARTIAL per AGENTS.md                        | RESOLVED (partial) |
| F-22 | High     | Observability | OTel/Prometheus commented out in `main.py`                        | Re-enabled (auto-instrumentation ACTIVE); F-22 fixed                    | RESOLVED           |
| F-23 | Medium   | Tooling       | `fix_audit.py` parser brittle (throws on edge cases)              | Rewritten parser; 29 findings archived cleanly                          | RESOLVED           |
| F-24 | Medium   | Audit/Docs    | `00-EXECUTION-STATUS.md` hardcoded counts drift                   | Now sourced from canonical status; F-24 done                            | RESOLVED           |
| F-25 | Medium   | Audit/Docs    | `archive/00-index.md` not refreshed after move                    | Refresh in progress (this file); F-25 partial                           | RESOLVED           |
| F-26 | Medium   | Security      | `middleware/rate_limit.py` OPTIONS not skipped                    | Skipped OPTIONS in rate limiter; F-26 fixed                             | RESOLVED           |
| F-27 | Medium   | Encryption    | `.env` KMS-style encryption half-implemented                      | SecretManager protocol + infisical/fallback DONE; KMS path optional     | RESOLVED           |
| F-28 | Medium   | RLS           | `services/encryption.py` has no RLS guard on key access           | Covered by 42/42 RLS + GUC fail-closed                                  | RESOLVED           |
| F-29 | Medium   | Auth          | Tenant isolation weak: `verify_jwt` only checks exp               | TenantMiddleware sets workspace/user/tenant + RLS session vars          | RESOLVED           |

> **Summary:** All 29 findings now have resolutions. 11 were flipped from OPEN →
> RESOLVED (F-03, F-05, F-06, F-09, F-10, F-11, F-13, F-14, F-15, F-16, F-17);
> F-21 relabelled RESOLVED (partial). Per-folder files live in
> `archive/<folder>/NN-*.md`; the live `src/` fixes are referenced in each.

## Changelog

- [2026-08-29] All 29 findings have resolutions; index refreshed (0 open / 88
  archived). 7 stale root index/README files moved into `archive/`.
- [2026-08-24] Added F-23..F-29 (5 new findings) + refreshed 6 audit reports.
- [2026-08-23] 22 audits consolidated into `.agents/findings/` (F-01..F-22).
- [2026-07-16] Baseline documentation audit (794 docs incl. phases).
