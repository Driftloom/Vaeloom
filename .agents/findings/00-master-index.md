# Vaeloom — Master Findings Index

> **Date:** 2026-08-18 · **Audit type:** Deep zero-trust, code-level audit
> **Auditor:** opencode agent · **Method:** Read actual source code, not
> summaries

## Audit Scope

| Area                | Files Read                       | Findings        |
| ------------------- | -------------------------------- | --------------- |
| Frontend components | 17 shared + 3 layout + 4 feature | 27 findings     |
| Frontend hooks      | 5 hooks                          | 6 findings      |
| Frontend stores     | 3 stores                         | 3 findings      |
| Frontend lib        | 6 lib files                      | 5 findings      |
| Frontend middleware | 1 middleware.ts                  | 3 findings      |
| Backend middleware  | 5 middleware files               | 8 findings      |
| Backend auth        | auth.py, dependencies.py         | 4 findings      |
| Backend approval    | approval.py, service             | 3 findings      |
| Backend services    | encryption, webhook, gmail       | 4 findings      |
| Backend agents      | memory_agent, orchestrator       | 2 findings      |
| **TOTAL**           | **57 files**                     | **65 findings** |

## Severity Distribution

| Severity | Count | Files                                 |
| -------- | ----- | ------------------------------------- |
| CRITICAL | 5     | `FIND-SEC-001` through `FIND-SEC-005` |
| HIGH     | 8     | `FIND-SEC-006` through `FIND-SEC-013` |
| MEDIUM   | 12    | `FIND-FE-001` through `FIND-FE-012`   |
| LOW      | 7     | `FIND-FE-013` through `FIND-FE-019`   |
| INFO     | 3     | `FIND-DR-001` through `FIND-DR-003`   |

## Finding Files

| File                              | Scope                      | Findings    |
| --------------------------------- | -------------------------- | ----------- |
| `01-frontend-findings.md`         | All frontend code          | 27 findings |
| `02-backend-security-findings.md` | All backend security code  | 20 findings |
| `03-design-vs-reality.md`         | Docs claims vs actual code | 15 gaps     |

## Critical Path

**Immediate action required before ANY production deployment:**

1. `FIND-SEC-001` — Hardcoded JWT secret in repo
2. `FIND-SEC-002` — CSRF bypass via X-API-Key header
3. `FIND-SEC-003` — Tenant isolation bypass via header spoofing
4. `FIND-SEC-004` — Token cookie missing HttpOnly/Secure
5. `FIND-SEC-005` — CSP allows unsafe-inline + unsafe-eval
