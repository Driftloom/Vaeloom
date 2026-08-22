# MVP-P14 — 06. Security, Privacy, A11y

> **Phase:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` + P14

## Security (inherited P13 + re-verified P14)

Per `docs/phases/mvp-p13/08-registers.md` 7 EXCs + F-07 fixed:

| Control | Status | Evidence |
|---|---|---|
| JWT 32+ (F-07) | ✅ VERIFIED 0 warnings | `conftest.py:9` 32-chars-long!!, 2 quick tests 0 warnings (was 21) |
| RLS 37/42 fail-closed (F-04/05) | ✅ VERIFIED | `0010` 34 + `0019` 3 =37, 5 non-RLS via service filters, `0019` OR'' removed |
| IP allowlist always-mounted (F-18) | ✅ VERIFIED | `main.py:188` no-op when empty |
| GDPR 31 tables (F-09) | ✅ VERIFIED 2 tests PASS | `gdpr.py:15` 31 ALLOWED, `test_export/delete` PASS |
| CSRF in-memory (F-06) | ⚠️ EXC-P13-07 — single-process ok, multi-worker deferred | `csrf.py:49` dict + `main.py:232` TODO Redis |
| Prompt injection JSON-only (F-08) | ⚠️ EXC-P13-05 — 14 patterns + base64/override via `_get_body` JSON/form only, ingestion `document_chunks` not scanned | 29 tests PASS but gap honest |
| Sanitize wiring (F-11) | ⚠️ EXC-P13-04 — `tools/executor.py` grep 0 hits, `0019` docstring now honest NOT verified | Deferred P15 |
| DPIA DRAFT (F-10) | ⚠️ region TBD, `docs/security/DPIA.md:5` now DRAFT | DPO pending |

Isolation/replay/injection/deletion matrix: see `05-test-results.md` — negative auth (csrf 15), isolation 6/6, injection 29, GDPR export/delete 2 quick PASS.

## Privacy

- `consent_records` now in `gdpr.py` 31 (was missing — GDPR Art.7 consent proof)
- `DPIA.md` 1.1 DRAFT pending DPO appointment region TBD (you chose `Leave region open`)
- `AI-Governance.md` v1.0 + `Privacy.md` retained

## Accessibility (WCAG 2.2 AA)

**Status:** NOT RE-MEASURED this phase — `apps/web` jest 37 + e2e 39 per `AGENTS.md:87` but `testing/smoke/, security/, chaos/, fuzz/, visual-regression/` EMPTY (per same row). Need `axe` automated + manual AA evidence.

- Prior P10 `96/100 frontend` had 18 issues fixed (3 critical) + tenant isolation via `useAuth` guards
- This phase did not add a11y tests — gap noted in `08-registers.md` as `testing/smoke` etc empty (P14 should add `jest-axe` or `playwright-axe`)

## Coverage Gaps carried (honest)

- `SLSA 1.2` NOTED only, `WCAG 2.2 AA` not re-measured, `testing/smoke/, chaos/, fuzz/` empty — all as P14 annex
