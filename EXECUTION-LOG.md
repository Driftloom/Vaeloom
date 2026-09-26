# Execution Log — Enterprise Production Readiness Program

**Baseline tag:** `audit/frontend-enterprise-20260926` (commit `592db98e`)
**Plan:**
[`ENTERPRISE-PRODUCTION-READINESS-PLAN.md`](./ENTERPRISE-PRODUCTION-READINESS-PLAN.md)
**Branch:** `master` (changes uncommitted — see §12)

---

## 0. Audit corrections

Three audit findings were checked against source and found **wrong**. Recorded
so nobody re-derives them:

| Audit claim                                                                     | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Password reset sends no email at all… no email call"                           | **Wrong.** `auth_service.py:1055` in the baseline commit already calls `email_service.send_password_reset_email(...)`; the method exists at `email_service.py:143`. The audit's grep was faulty. The _real_ residual defect: delivery failure is swallowed by `except → logger.warning` while the API still answers "instructions have been sent". Since the endpoint must answer identically for unknown addresses (anti-enumeration), the correct fix is copy, not a 500 — see §7. |
| "`account-locked/page.tsx:34` is a hardcoded `Incident ID: SEC-LOCK-2026-9411`" | **Wrong.** No `SEC-LOCK` or `Incident ID` string exists anywhere in the working tree **or** in `HEAD`. Fabricated detail.                                                                                                                                                                                                                                                                                                                                                            |
| "`settings/security` and `invite/[token]` fabricate security state"             | **Correct** — the single most important finding. Both rebuilt.                                                                                                                                                                                                                                                                                                                                                                                                                       |

Two more corrections surfaced during implementation:

- `check_org_permission` imported **`TenantMember`, a model that does not
  exist**. Unreachable until wiring the role dependency made the path live, at
  which point it raised `ImportError`. Corrected to `WorkspaceUser` with
  `role.in_(["ADMIN","OWNER"])`, following `workspace_service.py:55`.
- The audit's "concurrent refresh" test (`test_auth_zero_trust_gaps.py:232`) is
  **sequential** — it awaits each request instead of gathering them, so it never
  exercised the race it names.

---

## 1. Verified gate results

Every number produced by running the command on the tree as it now stands.

| Gate                        | Baseline (`592db98e`)                  | Now                                              | Command                                       |
| --------------------------- | -------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| API security suite (serial) | 8 failed / 377 passed                  | **0 failed / 385 passed**                        | `pytest tests/security -q -o addopts=""`      |
| API XSS suite               | 5 failed / 5 passed                    | **29 passed**                                    | `pytest tests/security/test_xss.py`           |
| API SQL-injection suite     | 1 failed / 29 passed                   | **30 passed**                                    | `pytest tests/security/test_sql_injection.py` |
| API org suite               | 6 passed                               | **10 passed** (4 new negative controls)          | `pytest tests/test_organizations.py`          |
| API auth suite              | 13 passed                              | **14 passed** (2 new rotation tests)             | `pytest tests/test_auth.py`                   |
| API MFA-bypass suite        | did not exist                          | **3 passed**                                     | `pytest tests/test_mfa_bypass.py`             |
| `apps/web` typecheck        | pass                                   | **pass (exit 0)**                                | `pnpm --filter @vaeloom/web typecheck`        |
| `apps/web` lint             | pass w/ warnings                       | **pass (exit 0)**                                | `pnpm --filter @vaeloom/web lint`             |
| `apps/web` Jest             | 57 passed                              | **88 passed**                                    | `pnpm --filter @vaeloom/web test`             |
| `packages/ui-kit` typecheck | pass                                   | **pass (exit 0)**                                | `pnpm --filter @vaeloom/ui-kit typecheck`     |
| `packages/ui-kit` lint      | **5 errors**, 56 warnings              | **0 errors, 0 warnings**                         | `pnpm --filter @vaeloom/ui-kit lint`          |
| `packages/ui-kit` Jest      | 5 passed, **0 component fns executed** | **149 passed, 151/231 fns (65.4%)**              | `pnpm --filter @vaeloom/ui-kit test`          |
| Web production build        | pass                                   | **pass (exit 0)**                                | `pnpm --filter @vaeloom/web build:isolated`   |
| Playwright                  | 76 tests, 0 executed                   | **86 tests, all 40 visual baselines resolvable** | `npx playwright test --list`                  |

### The 2 remaining RED tests now pass

- `test_redteam_loop.py::test_accepted_open_tools_recorded` — green; the file is
  46/46 in isolation.
- `test_stage2_zero_trust.py::test_scim_per_tenant_isolation` — green once the
  security conftest mounted the router it was asserting against.

### Parallelism flake (pre-existing)

Under `-n 4 --dist loadfile` the suite intermittently errors one
`test_redteam_loop` teardown. It passes 46/46 in isolation and 385/385 serially.
Matches AGENTS.md finding 39. **The serial run is the number to trust.**

### Pre-existing failures confirmed NOT caused by these changes

Verified by `git stash` + re-run on the clean baseline:

- `tests/test_auth_service.py` — 6 failures. `AsyncMock` fixtures leave
  `user.mfa_enabled` as `None`, so `PublicUser` validation fails.
- `tests/test_module05_auth.py::test_workspace_invitation_flow` — asserts 401,
  receives 403. The stack answers 403 before rejecting the invalid bearer. The
  request _is_ denied; ordering issue, not an auth bypass.

---

## 2. Secrets no longer in logs (W2.3)

| Was                                                               | Now                           |
| ----------------------------------------------------------------- | ----------------------------- |
| `auth/callback/route.ts:25` logged the raw OAuth `code`           | deleted                       |
| `:26-29` logged the cookie inventory                              | deleted                       |
| `:30-31` logged the Supabase URL and anon-key prefix              | deleted                       |
| `:69-72` logged the full `/auth/me` payload (PII + workspace ids) | logs workspace **count** only |
| `:79` logged the upstream error body                              | logs status + `bodyBytes`     |
| **`auth_service.py:970` logged the raw password-reset token**     | logs user id + expiry         |
| `sso.py:77,108` logged upstream `resp.text` verbatim              | logs status + `bodyBytes`     |

---

## 3. Account recovery (W2.4b, W2.5)

Three real defects fixed in `auth_service.py`:

1. **A reset token could be redeemed twice.** Tokens were written to _both_
   Redis and a process-local dict, but only the Redis key was deleted on use. A
   replay hit Redis → miss → fell through to the still-populated dict →
   succeeded. Both paths are now consumed unconditionally, with `GETDEL` (Redis
   ≥ 6.2) for atomicity and a pipelled fallback.
2. **Password reset did not clear lockout.** It revoked sessions but left
   `failed_login_attempts` / `locked_until` intact, so a locked-out user had no
   self-service recovery — the reset "succeeded" and the next login still
   returned 423. Now cleared. This is what makes the `/account-locked` page's
   "Reset Password & Unlock" promise true.
3. **Expiry was unchecked on the Redis path** — execution fell through to the
   in-memory branch without validating `expires_at`.

Still open: the token lives in a process-local dict rather than a
`password_reset_tokens` table. Multi-worker deployments need the migration.

---

## 4. Session rotation is atomic (W2.7) + secrets hashed at rest (W2.8)

**Rotation.** `refresh_token` did `SELECT` → check `status != "ACTIVE"` in
Python → assign `status = "ROTATED"`. Under READ COMMITTED two concurrent
refreshes both read `ACTIVE` and both succeeded, so a stolen token could be
exchanged twice before theft detection fired — despite the comment claiming
_"Atomic rotation transition (GAP-AUTH-05)"_. Now a conditional
`UPDATE ... WHERE status = 'ACTIVE'` with a `rowcount == 1` check picks one
winner; every loser is treated as replay and triggers family revocation.

**At rest.** `issue_token` stored the raw access JWT in `auth_sessions.token`
and the raw refresh token in `auth_sessions.refresh_token`. A database dump,
backup, or read-only DB access yielded replayable credentials. Both now store a
SHA-256 digest via `_token_digest()`, and both read sites (`:587` refresh
lookup, `:969` revocation check) hash the input before comparing. `jti` remains
the non-secret handle used for targeted revocation and the sessions list.

Four tests were added because none existed:

- `test_concurrent_refresh_has_exactly_one_winner` — 5 concurrent refreshes,
  exactly one 200.
- `test_replayed_refresh_token_is_rejected` — 401 with the revocation message in
  the RFC 7807 envelope.
- `test_mfa_bypass.py` (3 tests) — see §5.

---

## 5. MFA can no longer be bypassed (W2.9)

`sso_token_login` (`routers/auth.py:341`) and the SAML callback (`:530`) both
called `issue_token` **directly**, while only the password path honoured
`mfa_required` (`auth_service.py:349-370`). A user enrolled in TOTP could sign
in with an SSO/SAML assertion and receive a full token pair without ever seeing
a code.

Added `AuthService.issue_login_response()` as the single issuance path for every
authentication method, with `evaluate_mfa_requirement()` covering both user
enrolment and tenant policy. All three handlers now route through it. Three
tests in `tests/test_mfa_bypass.py` cover: enrolled user gets a challenge and no
credentials; non-enrolled user gets tokens; **tenant policy demands MFA even for
a non-enrolled user**.

---

## 6. Organization authorization (W3.1–W3.6)

The most severe finding: **zero** role checks on any endpoint, and `role` was a
bare `str`, so any authenticated user could add any UUID to any org unit as
`role="owner"`.

**Root cause found during the fix:** `check_org_permission` existed with zero
production callers, and could not simply be wired up — `create_organization`
never enrolled the creator, so a new org had no members and _every_ subsequent
mutation by its own creator would 403. The creator is now enrolled as `owner` in
the same call.

Changes:

- **Single role hierarchy** — `ORG_ROLE_HIERARCHY` / `ORG_ROLES` replace four
  divergent sets (this module, `dependencies.py`, `middleware/rbac.py`, and a
  hardcoded list in the web organizations page).
- **`require_org_role(min_role)` dependency** on all six mutable endpoints:
  `PATCH`/`DELETE` org → `admin`/`owner`; add/remove member → `admin`; create
  invitation → `admin`; **list invitations → `admin`** (that response returns
  every invitee's email).
- **Closed role set** — `Literal["viewer","member","lead","admin","owner"]`;
  unknown roles now 422.
- **Escalation blocked** — `assert_can_grant_role` refuses to grant a role above
  the caller's own.
- **Last-owner guard** — an admin cannot remove the final active owner.
- **Invitations bound to identity** — `accept_invitation` compares normalized
  `invitation.email` to the authenticated account, **403** on mismatch. The
  token was a pure bearer credential.
- **Atomic single-use consumption** — conditional
  `UPDATE ... WHERE status = 'pending'` with `rowcount == 1`.
- **Logout scoped** (`routers/auth.py:181`) — it revoked _every_ ACTIVE session
  for the user, so signing out on one device silently signed you out of all of
  them. Now scoped to the caller's `jti`; bulk revocation stays on
  `/auth/sessions/revoke-others`.

Four negative-control tests, each asserting an exact status: role matrix (6
mutations × 403, member read still allowed), `admin → owner` blocked /
`admin → admin` allowed, unknown role 422, and invite binding (wrong account
403, intended 200, **replay 400**).

---

## 7. Fabricated surfaces replaced (W1.1, W1.2, W1.7)

**`settings/security`** had **zero API imports** and rendered a hardcoded TOTP
secret `JBSWY3DPEHPK3PXP`, six hardcoded recovery codes, two invented sessions,
an `RLS VERIFIED` badge derived from `useState(true)`, a TOTP verifier accepting
**any 6 digits** that then printed _"Token verified successfully. Synchronized
with server time."_, and two Revoke buttons with no `onClick`.

Replaced with `TwoFactorAuthCard` (real `POST /auth/mfa/setup` + `/enable`) and
`ActiveSessions` (real `GET /auth/sessions`, `DELETE /auth/sessions/{id}`,
`POST /auth/sessions/revoke-others`) — both already existed in the repo and were
**rendered nowhere**. Two-factor status now derives from `user.mfaEnabled` ←
`GET /auth/me` → `PublicUser.mfa_enabled` → `transformKeys` (`api.ts:303`). No
assurance badge is rendered, because an unbacked badge is a false claim.
`PublicUser` in `packages/shared-types` was also missing
`mfaEnabled`/`emailVerified`/`avatarUrl` — type drift against the Pydantic
model, now fixed.

**`/invite/[token]`** was a `setTimeout` handshake with a hardcoded
`Acme Distributed Labs`, `Security Reviewer (RBAC)` and a
`Row-Level Security Enforced` claim; the token was never sent anywhere. Now
calls the real `organizationsApi.acceptInvitation(token)` with distinct 400 /
401 / 403 / network error copy, and deliberately does **not** show org name or
role pre-acceptance because no endpoint can resolve a token to a previewable
invitation.

**Dead links:** `nav-analytics` → `/analytics` removed (no such route); its
`TopNav` breadcrumb key removed; `EnterpriseGated.tsx` `/workspaces` →
`/workspace` (was the only exit button on every gated page, and it 404'd); the
internal env var name no longer shown to end users; `capabilities` and `history`
were missing from the breadcrumb map and were added.

---

## 8. Delivery branch gate (W8.1–W8.3)

Default branch is `master`; **six workflows triggered on `main`**. `ci.yml` was
100% dead. A PR to `master` ran no CodeQL, no Gitleaks, no dependency audit, no
a11y gate.

| Workflow                                                    | Change                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ci.yml`                                                    | → `master`, plus `workflow_dispatch` so it can never be dark again                        |
| `a11y-audit.yml`, `security-audit.yml`, `security-scan.yml` | → `master`, plus dispatch                                                                 |
| `docker-build.yml`                                          | → `master`; **per-service build context** (web needs the repo root, api needs `apps/api`) |
| `deploy.yml`                                                | **push trigger deliberately removed** — see below                                         |

`deploy.yml` is now manual-only, with the reason in the file. Its push trigger
was dead, and re-pointing it to `master` would fire an unattended deploy on
every merge against a pipeline with eight unresolved blockers: no `needs:` on
the build, 19 of 23 k8s Deployments referencing images nobody builds, an
unstartable API Deployment, no post-deploy smoke, an `echo` load-test gate, and
a rollback that never re-verifies.

`apps/web/Dockerfile` now sets `ENV CI=true` in the builder stage.
`next.config.js:20` gates `output: 'standalone'` on `CI === 'true'`, so without
it `.next/standalone` was never produced and the `COPY` failed — the web image
could not be built off CI at all.

---

## 9. Build/dev-server collision — fixed durably

Twice, a production build ran while a dev server was live and overwrote
`apps/web/.next` with production artifacts (`BUILD_ID`, `export-marker.json`),
after which every route returned a bare 500. Both times it was me or a sub-agent
running a verification build.

Permanent fix:

- `next.config.js` — `distDir: process.env.NEXT_DIST_DIR || '.next'`. The
  default is unchanged, so CI, Docker (`apps/web/Dockerfile` copies
  `.next/standalone`) and `next start` are untouched.
- `apps/web/scripts/build-isolated.cjs` + `pnpm build:isolated` — builds into
  `.next-build`. Implemented in Node rather than `cross-env` so it works on
  Windows/macOS/Linux with no new dependency.
- `.gitignore` — `apps/web/.next-build/`.

**Verified:** a production build ran to completion (exit 0) while the dev server
was serving; `.next` contained no production markers afterwards and `/`,
`/login`, `/invite/abc123` all still returned 200.

---

## 10. Other real bugs found and fixed

- **The memory-correction feature was dead in the UI.**
  `MemoryCorrectionPanel.tsx:31` read `res.items`, but `GET /api/v1/memories`
  returns `{memories,total,page,page_size}` (`MemoryListResponse`). `items` was
  always `undefined`, so the panel always rendered "No memories yet" and **the
  correction modal was unreachable in production**. Now reads `memories`, uses
  the real `Memory` type instead of an ad-hoc `MemoryRow`, and surfaces a load
  failure through `ErrorState` instead of swallowing it into an empty list.
- **The organizations page crashed at runtime.** `api-client.ts` typed
  `getTree`/`getMembers`/`getInvitations` as arrays; the backend returns a
  `{items,total}` envelope. The page did `roots.map(...)` on an object. Fixed
  with an explicit `unwrapItems` helper.
- **Stored XSS via the signup email field.** The validator only checked
  `has an @ and a dot in the domain`, so
  `xss-<script>alert('xss')</script>@test.com` was accepted with 201. Now
  validated with `email-validator` through a reusable `NormalizedEmail` type.
  `test_environment=True` is required because the reserved `.test` TLD is used
  throughout the suites and the Playwright harness; it relaxes only the
  special-use _domain_ check, so markup in the local part is still rejected
  (verified against 8 payloads).
- **`Checkbox` and `Radio` silently discarded their `error` prop** — accepted,
  destructured, never used. A form control marked invalid showed no styling, no
  `aria-invalid`, no announcement. Rewritten following `Textarea.tsx`, plus the
  `<div onClick>` visual shim replaced with a real `<label htmlFor>` and the hit
  area raised to 24px.
- **`Button` had no default `type`**, so a `Button` inside a `<form>` submitted
  it. Now defaults to `type="button"` with an explicit `type` still winning;
  test added both ways.
- **The job-search input had no accessible name** (placeholder only). axe does
  **not** flag placeholder-only inputs, so the a11y gate had a real blind spot.
  Now has a `<label>` + `aria-label` and 44px targets.
- **`/capabilities` (default Skills view) had no `<h1>`.** The axe gate only
  runs wcag2a/aa/21aa/22aa tags, which exclude the `page-has-heading-one`
  best-practice rule, so nothing caught it. Added.
- **The two previously-dangling token references were defined**: `--primary-fg`
  (used by `FilterBar`) and `--primary-700` were referenced by shipped code but
  declared nowhere.
- **Token authority documented.** `packages/ui-kit/src/tokens` is dead code
  (`generateCssVariables()` has no callers outside its own test) while
  `globals.css` is the real runtime source. The module docstring and a
  `TOKEN_SOURCE_OF_TRUTH` export now say so, so nobody adds a code path that
  assumes otherwise. `docs/design-system/03-tokens.md` still contradicts this
  and needs correcting.
- **UI-kit tests went from 5 `toBeDefined()` calls to 149 real render tests**,
  executing 151 of 231 component functions (was 0).

### Three tests were updated rather than made to pass

- `test_organization_membership_lifecycle` asserted `len(members) == 1` — i.e. a
  new org starts with _no_ members. That premise is why role checks could never
  be added. It now asserts the new contract precisely: exactly one `owner` (the
  creator, not the added member), and after removal the owner remains so the org
  cannot be left ownerless.
- `test_signup_injection` asserted a _fixed status per payload_, encoding the
  weaker guarantee that an injection string must be **stored** (201) rather than
  **rejected** (422). It now asserts the invariant: whichever outcome, the
  payload is not executed, the `users` table survives, and no row was conjured
  by the injected predicate.
- `test_cross_tenant_org_tree_isolation` asserted `isinstance(orgs, list)` when
  the endpoint returns a `{items,total}` envelope. It now asserts the real
  property: Tenant B sees **zero** organizations.

---

## 11. Still open

| Item                                                             | Why not now                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W2.1/W2.2 HttpOnly session + BFF**                             | The highest-risk change in the program: it touches every authenticated request and a mistake locks out every user. Needs the dual-read + server-side emergency-revoke rollout in the plan. Deliberately deferred rather than half-done. This remains the single largest outstanding security risk. |
| Reset token durability                                           | Still a process-local dict; multi-worker needs the `password_reset_tokens` migration.                                                                                                                                                                                                              |
| MFA step-up on re-enrol / disable endpoint                       | `setup_mfa` overwrites the secret with no re-auth; no `/mfa/disable` exists.                                                                                                                                                                                                                       |
| W3.8 API-key lifecycle                                           | `APIKeyManager` exists and is unreachable; needs a router + `X-API-Key` in `AuthMiddleware`.                                                                                                                                                                                                       |
| W3.9–W3.12 RLS                                                   | `_safe()` swallowing, `marketplace_listings` with no RLS, 19 `USING (true)` tables. Forward-only migrations needing a staging snapshot.                                                                                                                                                            |
| W4.1 route manifest + W1.4/W1.5 `dataMode` + fixture segregation | The manifest must come first; doing it per-page would create a second registry.                                                                                                                                                                                                                    |
| W1.10 CI guard against unverified claims                         | Needs the manifest to know which routes are fixture-backed.                                                                                                                                                                                                                                        |
| W6 visual as a real gate                                         | The specs are fixed and documented; `.github/workflows/ci-frontend.yml:62,67` still refreshes instead of comparing.                                                                                                                                                                                |
| W8.4–W8.15 delivery                                              | Image naming, digest pinning, the 19 fictional Deployments, the web health route, nginx upstream, `.env.production`, real load gate, verified rollback.                                                                                                                                            |
| W9 live RLS matrix, evidence ledger                              | Runs after the above.                                                                                                                                                                                                                                                                              |
| Dead suites                                                      | `testing/e2e/**` (13 tests, rotted selectors, no workflow references it) and `testing/accessibility/audit-pages.ts` (unresolvable `playwright` import; records a navigation failure as a PASS). Both need deleting.                                                                                |
| `apps/web/tsconfig.json:11`                                      | Excludes `**/*.spec.ts` / `**/*.test.tsx`, so `pnpm typecheck` checks neither the E2E suite nor the Jest tests. Two real type errors were found only by running `tsc` out-of-band.                                                                                                                 |

---

## 12. HttpOnly session cookies — backend foundation (W2.1 / W2.1a)

**Status: backend done and verified. Frontend cutover NOT done — localStorage is
still the live path.**

### What was wrong

`apps/web/src/lib/api.ts` persisted both credentials in `localStorage` **and**
mirrored them into `document.cookie` **without `HttpOnly`**. Two JS-readable
copies of a 30-day refresh token. Any XSS on the origin could exfiltrate a
credential that survives the tab closing and cannot be revoked by clearing
storage. The cookie mirror added nothing but a second exfiltration vector: a
JS-readable cookie is no safer than localStorage, and `getToken()` even
_promoted_ the cookie copy back into localStorage.

### What was built

`apps/api/src/api/services/session_cookies.py` — new module:

- `vaeloom_at` / `vaeloom_rt`, `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Secure` derived from `service_environment`, overridable with
  `AUTH_COOKIE_SECURE`. Omitted locally because browsers drop `Secure` cookies
  on plain `http://`, which would make local login fail silently
- `delete_cookie` reuses the same attributes — mismatched attributes are the
  classic reason "logout" appears to do nothing

Wiring: `signup`, `login`, `refresh`, `logout`, `mfa/verify`, `sso/{provider}`,
`saml/callback`. `middleware/auth.py` now falls back to the cookie when there is
no `Authorization` header and **fails closed** if neither is present.

**Dual-read rollout.** The body still carries tokens, because the TypeScript
SDK, the CLI and all 385 existing tests authenticate with
`Authorization: Bearer` and have no cookie jar. A browser opts out of the body
by sending `X-Auth-Mode: cookie`; the router then sets the cookies and blanks
`access_token`/`refresh_token` in the response. One endpoint, two consumers, no
flag day. `refresh` reads cookie-then-body so both callers work through the
transition.

### The CSRF finding that forced a design change

`/api/v1/auth/refresh` was in an unconditional CSRF skip list. That was correct
only while refresh took an **explicit body token**, which a browser will not
populate on a cross-site request. The cookie migration changes that: the
credential becomes **ambient**, so an attacker page can make the browser send it
— and because rotation invalidates the previous token, forcing it repeatedly
**locks the victim out**.

First attempt exempted _any_ request carrying an `Authorization` or `X-API-Key`
header, reasoning that a header is not ambient. That broke 8 existing tests, and
the suite was right: `test_csrf.py` deliberately asserts that **every** mutating
request needs a CSRF token regardless of credential type. My rule silently
reduced coverage. Corrected to a narrow exemption scoped to the one endpoint the
migration actually affects:

- every mutation still needs the double-submit token, whatever it authenticates
  with (**posture unchanged**)
- `/auth/refresh` alone is exempt, and only when no session cookie is present —
  i.e. the caller used the explicit body token

### Evidence

`apps/api/tests/security/test_session_cookies.py` — 19 tests. Written with
negative controls, because a test that only asserts "a cookie was set" passes
just as happily against a JS-readable cookie:

- each cookie is independently `HttpOnly` (not just one, not just the joined
  string)
- the negative case that a middleware rejecting _every_ cookie request would
  also pass, so the positive "valid CSRF token is allowed" case is required too
- cookie-authenticated mutation without a CSRF token → 403
- bearer mutation → still 403 (pins the exemption as narrow)
- anonymous mutation → still 403
- cookie-based refresh → 403; body-token refresh → 401 (passed CSRF, rejected on
  credential)

**Full security suite: 404 passed / 0 failed** (was 385; +19).

### What is NOT done — do not read this as a completed migration

- The web client still writes to and reads from `localStorage`. Nothing sends
  `X-Auth-Mode: cookie` yet. **The vulnerability is still live.**
- `apps/web/src/lib/realtime-client.ts:64` puts the long-lived access JWT in a
  **WebSocket query string**. Query strings land in proxy and server logs and in
  `Referer`, and a WS handshake cannot carry a CSRF-protected header. This is a
  hard blocker for a naive cookie migration: the token must remain JS-readable,
  or the WS must move to a short-lived single-use ticket.
- `ChatWindow.tsx:317` builds its own `Authorization` header outside
  `request()`, so it needs `credentials: 'include'` and cannot be fixed by
  editing `api.ts` alone.
- Two API clients coexist — `lib/api.ts` (41 importers) and `lib/api-client.ts`
  (68). Both send CSRF correctly, but any cutover has to touch both.
- `middleware/csrf.py` mounts _inside_ `AuthMiddleware` in the test fixture, so
  an invalid token 401s before CSRF is consulted. Harmless today (no state
  change) but it means CSRF failures are only observable with a valid
  credential, which is why the focused `csrf_only_client` fixture exists.
- The frontend needs a real auth-state signal once no token is readable. Today
  `getToken()` doubles as "am I logged in" in 4 components.

---

## 14. WebSocket handshake tickets + frontend cutover (W2.1c / W2.2)

**Status: code complete and green. NOT verified against a running API — see §15,
which blocks that verification.**

### The blocker this removed

`realtime-client.ts:64` put the long-lived access JWT in the WebSocket query
string. That is why the access token had to stay readable by JavaScript: the
browser `WebSocket` constructor cannot set an `Authorization` header, so the
credential had to travel in the URL. Query strings are additionally written to
access logs, proxy logs and `Referer`.

`POST /api/v1/realtime/ws-ticket` (`apps/api/src/api/services/ws_tickets.py`)
mints a 256-bit opaque value, 60s TTL, destroyed on first redemption. No claims,
no JWT, bound to the identity resolved at mint time. Redemption is a Redis
`GET`+`DEL` in one script so two racing handshakes cannot both win. `?token=` is
retained for SDK/CLI callers, which legitimately hold the token.

The browser no longer puts a JWT in any URL. `?token=` remains server-side for
non-browser clients.

### Frontend cutover

`lib/api.ts` no longer stores a credential anywhere JS-readable:

- `setToken` records a non-secret `vaeloom.session` marker and dispatches the
  existing event, so ~40 importing modules are unchanged
- `getToken()` returns `null` so no `Authorization: Bearer <placeholder>` can be
  built; callers that wanted "am I logged in" use the new `hasSession()`
- the module **purges `vaeloom.accessToken` / `vaeloom.refreshToken` on load**.
  Without this, anyone signed in before the change keeps a live token in
  `localStorage` forever — the migration would have left the vulnerability in
  place for the longest-signed-in users
- every request sends `X-Auth-Mode: cookie`, so the backend blanks the token
  fields and the web bundle never receives one
- `refresh()` sends no body token and does send a CSRF token, since a cookie
  _is_ attached to cross-site requests

Both clients already used `credentials: 'include'`, so omitting the header was
enough for the cookie to take over — the cutover did not need a new transport.

Callers converted to `hasSession()`: `app/workspace/page.tsx`,
`components/shared/AuthRedirectProbe.tsx`,
`components/landing/sections/LandingNav.tsx`, `hooks/useAuth.tsx`.
`ChatWindow.tsx` built its own `Authorization` header outside `request()` and
now uses `credentials: 'include'`.

### Evidence

- `apps/web/src/__tests__/session-storage.security.test.ts` — 8 tests. Each
  searches _every_ storage surface for the secret value itself, so a regression
  is caught regardless of which key or API is used. Includes a positive control
  (a marker is written) and a `localStorage`-throws case, because private
  browsing must not break login.
- `apps/api/tests/test_ws_tickets.py` — 14 tests, including one against real
  Redis. That test initially passed "by accident": an unbackdated in-memory
  entry had never reached Redis. The store is now pinned per test so behaviour
  cannot depend on ambient `REDIS_URL`.
- **web 96/96** (88 + 8 new), typecheck 0, lint 0 errors
- **API security 404 passed / 0 failed**

---

## 15. BLOCKER — migration 0057 cannot be applied to PostgreSQL

Found while trying to boot the API for an end-to-end cookie test. **This is
deploy-blocking and is not fixed.**

```
asyncpg.exceptions.DatatypeMismatchError:
  foreign key constraint "password_reset_tokens_user_id_fkey" cannot be implemented
DETAIL: Key columns "user_id" and "id" are of incompatible types
```

`0057_password_reset_tokens` (added by a sub-agent, never reviewed) hard-codes
`user_id` as `sa.UUID()` with an FK to `users.id`. `0001_initial_schema.py`
declares `users.id` as `sa.UUID()` too, so on any database built by this chain
the types match. The failure proves the target database's `users.id` is a
different type — most likely `varchar`/`text`, meaning `public.users` was
created outside the migration chain (SQL editor, or an earlier hand-written
schema).

**A fix was attempted and reverted.** Reflecting `users.id` via
`sa.inspect(op.get_bind())` reported `character varying` while PostgreSQL
reported `uuid` for what should be the same column, so the mismatch was not
reproduced and the source of truth is still unconfirmed. Shipping a speculative
migration fix would be worse than shipping none, so `0057` is back to its
original definition with a loud `KNOWN BROKEN ON POSTGRESQL` comment.

**Required before any deploy:** confirm the real type of `users.id` on the
target instance, then type `user_id` from it. Note the ORM model in
`models/schema.py` declares `UUID(as_uuid=True)`, so if the column really is
`varchar` the ORM mapping is wrong too and both need to change together.

### Why no test caught this

The suite runs on SQLite with tables created from the SQLAlchemy **models**, not
from **migrations**. SQLite also does not enforce foreign key column types. The
migration chain has therefore never been validated against a real PostgreSQL
instance, which is a much larger gap than this one migration.

### Three "swallow and continue" paths found along the way

All three let a broken system present as healthy:

1. `main.py:182` — a failed `command.upgrade` is logged, then startup
   **continues** into the custom migration runner. A half-applied schema is then
   treated as a working one.
2. `config.py:313` — the secret manager sets `database__url` from `DATABASE_URL`
   **after** Pydantic has read the environment, via `object.__setattr__`. An
   operator's explicit `DATABASE__URL` is silently discarded. This is what sent
   my SQLite request to a real PostgreSQL.
3. `main.py:164-169` — `VAELOOM_TARGET_URL` is overwritten from
   `_migration_url()`, so migrations target a different database than the
   runtime engine.

### Operational hazard this exposed

With `DATABASE__URL=sqlite+…` set, the app still ran migrations against a live
PostgreSQL instance. **A local run can mutate a shared or production database.**
Until (2) and (3) are fixed, a developer following the documented startup
instructions in `AGENTS.md` may write to a database they were not targeting.
This should be treated as the highest-priority item in this log.

---

## 16. State of the working tree — including an unwanted commit

**Process failure, disclosed.** Five commits were made **directly to `master`**
by my own sub-agents, which I had not authorised and had not explicitly
forbidden in their briefs. This repo's local git identity is
`Vaeloom Bot <bot@vaeloom.app>` (`git config user.name`), so the commits do not
identify the agent that made them.

I reviewed the content and did **not** rewrite history, because that would be
destructive and the user may want these changes. Their content is sound:

| Commit                                                                             | Files           | Assessment                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `938959c7` test(web): e2e expansion with chromium baselines and SDK client updates | 19 (+935/−194)  | E2E false-green fixes, Playwright config hardening, 40/40 visual baselines resolvable. Sound.                                                                                                                          |
| `39259e35` feat(ui-kit): component refresh with extended coverage                  | 44 (+2206/−166) | 149 real render tests, 4 a11y fixes, touch targets, lint to 0. Sound.                                                                                                                                                  |
| `75df845f` docs: enterprise readiness program and frontend audit pack              | 4 (+3771)       | The plan and audit documents. Sound.                                                                                                                                                                                   |
| `32363d25` fix(api): harden API-key header handling in auth middleware             | 1 (+17/−1)      | Rejects non-string and `Bearer`-shaped values in the `X-API-Key` slot and shape-gates the lookup to `vael_`-prefixed keys of plausible length. **Security-positive** — I verified the prefix against `api_keys.py:29`. |
| `5a98d1ac` feat(web): frontend liveness probe plus a11y and capability updates     | 5 (+452/−88)    | Adds the missing `/api/health` route and points the k8s probe at it. Verified live: returns 200 `{"status":"ok",...}`. Sound.                                                                                          |

Uncommitted (17 files) holds the rest of the programme: MFA bypass closure,
hashed-at-rest tokens, atomic rotation, logout scoping, email-validation copy
fixes, and the infra corrections (web build context, API port 4000→8000, nginx
upstream `backend`→`api`).

**Recommended:** the 5 commits are already on `master` and CI has never run on
this branch, so the cheapest safe path forward is a branch from the current
`master`, commit the remaining 17 files as 2–3 reviewable commits, and open a PR
so the repaired gates execute for the first time. If the user would rather have
a single clean history, `git reset --soft 592db98e` followed by recommitting in
slices achieves that without losing any work — but that is a destructive-ish
history rewrite and needs an explicit go-ahead.

```
git tag -l "audit/*"     # audit/frontend-enterprise-20260926  (the pre-programme baseline)
git log --oneline -6
git diff --stat
```
