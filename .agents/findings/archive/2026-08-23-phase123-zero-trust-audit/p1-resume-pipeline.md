# P1 Audit — Resume Document Pipeline (templates, builders, artifacts, routes, frontend)

Date: 2026-08-23 · Zero-trust re-verification of session-delivered work.

## What was re-verified (fresh, not trusted from prior reports)

| Claim                                       | Method                                                                                                                                                        | Result                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| All 5 templates render                      | live render each slug                                                                                                                                         | PASS                                                                                                                                        |
| XSS-safe rendering (Jinja2 autoescape)      | injected `<script>/<img onerror>/<svg onload>` into name/summary/bullets across all 5 templates; asserted no raw tag survives                                 | **PASS** (note: first probe was a false alarm — my own test assertion counted the literal text `onerror` inside escaped entities as a leak) |
| Page-fit loop ≤ max_pages                   | live chromium: 9-entry resume → 2 pages, 74.5KB PDF                                                                                                           | PASS                                                                                                                                        |
| Cover letter + cheat-sheet compile live PDF | chromium renders                                                                                                                                              | PASS (61.5KB / 21.8KB)                                                                                                                      |
| DOCX output valid OOXML                     | zip magic + python-docx reload + section text assertions                                                                                                      | PASS                                                                                                                                        |
| Migration 0023 ↔ ORM consistency            | column-by-column compare vs `ResumeArtifact`; RLS policy fail-closed pattern matches migration 0020 convention; SQLite no-op path present                     | PASS                                                                                                                                        |
| Route authz                                 | tailor/compile/cover-letter/cheatsheet/download all verify workspace ownership (`_verify_workspace_access`) AND scope artifact/resume queries by workspace_id | PASS                                                                                                                                        |
| Rate limits on compile endpoints            | decorators present (6/min compile+letter, 4/min cheatsheet); integration tests exercise them                                                                  | PASS                                                                                                                                        |
| Frontend camelCase fix                      | only consumers of `ResumeResponse` are `api-client.ts` + `ResumeBuilder.tsx` (grepped whole web src) — fix is self-contained; tsc clean; 34/34 jest           | PASS                                                                                                                                        |
| Templates reach Docker runtime              | `apps/api/Dockerfile:12` `COPY src/api/ ./api/` carries non-python `templates/` dir                                                                           | PASS (fragile — see F-P1-3)                                                                                                                 |

## Findings

### F-P1-1 [MEDIUM] API image lacks Playwright chromium → PDF features 503 in prod

`apps/api/Dockerfile` installs only curl in the runner stage. `page.pdf()`
raises `PlaywrightUnavailableError` → routes correctly return 503 with the setup
hint (graceful), but the feature is dead in production until ops adds:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 && \
    playwright install --with-deps chromium
```

Browser tools (P2) degrade to the httpx fallback instead — functional but weaker
on JS-heavy boards. **Status:** documented; needs infra-owner sign-off (image
size +30–300MB).

### F-P1-2 [MEDIUM] AGENTS.md test-count drift

AGENTS.md said "2661 collected"; reality after P2/P3 = 2672 files / 2724 items
(2718 passed + 4 skipped + 2 xfailed at last full run). **Status:** fixed in
this pass.

### F-P1-3 [LOW] Template packaging relies on source-copy, not wheel data

`[tool.setuptools.packages.find]` won't include `src/api/templates/**` as
package data if anyone switches the Dockerfile to wheel-only imports (dropping
the `COPY src/api/ ./api/` line). Works today by construction; flagged so a
future image refactor doesn't silently break rendering. Recommend adding
`[tool.setuptools.package-data] api=["templates/**/*.j2"]`.

### F-P1-4 [LOW] Pre-existing: `POST /resumes/{id}/generate` has no workspace check

Untouched legacy route accepts any resume id for an authenticated user (no
`_verify_workspace_access`). Tailor/compile paths added this session DO check.
Left as-is (pre-existing surface, changing it may break old clients) — recommend
follow-up hardening ticket.

## Verified non-issues (checked because they looked wrong)

- `GET /resumes/templates` cannot collide with future `GET /{resume_id}` —
  FastAPI literal-before-param ordering; also `/master` precedent.
- Artifact download cross-workspace access → 404 (workspace-scoped query).
- `iframe sandbox=""` preview blocks scripts (strictest sandbox value).
- Inline-bytes artifact storage (<2MB docs) — RLS applies; S3 offload key
  reserved but unused (documented in ADR-034).
