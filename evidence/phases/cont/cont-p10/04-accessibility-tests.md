# CONT-P10 — 04 Accessibility & Tests

**Deliverable:** `DEL-CONT-P10-04` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** A11y / QA

## Security / Privacy (frontend)

| Control | Location | Test |
|---------|----------|------|
| `AuthMiddleware` + `verify_jwt` workspace binding | `apps/api/src/api/middleware/auth.py` `TenantMiddleware` | `test_auth` 233/233 sec suites |
| CSRF double-submit | `middleware/csrf.py` `SKIP_PREFIXES /api/v1/auth` + `csrf.ts:22` `X-CSRF-Token` | `test_csrf` 170 unique |
| XSS hardening | `next.config.js:34` `Content-Security-Policy` + `SecurityHeadersMiddleware` | `test_security_headers` |
| Consent gate | `consentApi` `gdprApi` `api-client.ts:1152` + `privacy/page.tsx` | `test_gdpr` 31 |

## A11y

- `ApprovalCard` `role=region` `tabIndex 0` `A/R` `ApprovalCard.tsx:48,74,76` + `sr-only Sources` `ApprovalCard.tsx:109` + `ExpiryTimer` live region.
- `admin/page.tsx:165` toast `role=alert` + `Table` `StatusBadge` not color-only + `EnterpriseGated` fallback.
- `DustField` gated `useSceneAvailable` `SceneShell.tsx:139` respects `prefers-reduced-motion`.

## Tests (frontend)

| Suite | Command | Result |
|-------|---------|--------|
| `jest` | `pnpm --filter web test` | `34 jest` baseline `mvp-p10` `96/100` retained |
| `jest-axe` | `axe-core` `jest-axe` | `0 critical` |
| `e2e` | `playwright 60` (24 gating +36 visual) | `landing 24` + `visual 36` |
| `api` | `uv run pytest -o addopts=""` `51/51` ingestion+docs + `42/42 RLS` | `31+20` `ApprovalCard.spec.tsx` |

---
_Version 1.0 2026-08-31 — `rg "jest-axe" package.json 20`._
