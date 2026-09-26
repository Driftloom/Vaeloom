# Execution Log — Enterprise Production Readiness Program

**Baseline tag:** `audit/frontend-enterprise-20260926` (commit `592db98e`)
**Plan:**
[`ENTERPRISE-PRODUCTION-READINESS-PLAN.md`](./ENTERPRISE-PRODUCTION-READINESS-PLAN.md)
**Branch:** `master` (changes uncommitted — see §6)

---

## 1. Verified gate results

Every number below was produced by running the command, on the working tree as
it now stands.

| Gate                        | Baseline (`592db98e`)     | Now                                     | Command                                                      |
| --------------------------- | ------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| API security suite          | 8 failed / 377 passed     | **2 failed / 383 passed**               | `pytest tests/security -q -o addopts="-n 4 --dist loadfile"` |
| API XSS suite               | 5 failed / 5 passed       | **29 passed**                           | `pytest tests/security/test_xss.py`                          |
| API SQL-injection suite     | 1 failed / 29 passed      | **30 passed**                           | `pytest tests/security/test_sql_injection.py`                |
| API org suite               | 6 passed                  | **10 passed** (4 new negative controls) | `pytest tests/test_organizations.py`                         |
| API auth suite              | 13 passed                 | **14 passed** (2 new rotation tests)    | `pytest tests/test_auth.py`                                  |
| `apps/web` typecheck        | pass                      | **pass (exit 0)**                       | `pnpm --filter @vaeloom/web typecheck`                       |
| `packages/ui-kit` typecheck | pass                      | **pass (exit 0)**                       | `pnpm --filter @vaeloom/ui-kit typecheck`                    |
| `apps/web` lint             | pass w/ warnings          | **pass (exit 0)**                       | `pnpm --filter @vaeloom/web lint`                            |
| `packages/ui-kit` lint      | **5 errors**, 56 warnings | **0 errors**, 10 warnings               | `pnpm --filter @vaeloom/ui-kit lint`                         |
| Web Jest                    | 57 passed                 | **57 passed**                           | `pnpm --filter @vaeloom/web test`                            |
| UI-kit Jest                 | 5 passed                  | **5 passed**                            | `pnpm --filter @vaeloom/ui-kit test`                         |
| Web production build        | pass                      | **pass (exit 0)**                       | `pnpm --filter @vaeloom/web build`                           |

### Pre-existing failures confirmed NOT caused by these changes

Verified by `git stash` + re-run on the clean baseline:

- `tests/test_auth_service.py` — 6 failures. `AsyncMock` fixtures leave
  `user.mfa_enabled` as `None`, so `PublicUser` validation fails. Unrelated to
  any change here.
- `tests/test_module05_auth.py::test_workspace_invitation_flow` — asserts 401,
  receives 403. The middleware stack answers 403 (workspace access denied)
  before rejecting the invalid bearer token. The request _is_ denied, so this is
  an ordering/correctness issue, not an auth bypass. Low severity, pre-existing.

### Remaining RED (2) — both need a decision, not a code fix

1. `tests/security/test_redteam_loop.py::test_accepted_open_tools_recorded` —
   the OPEN tool set drifted: `compile_cover_letter`, `compile_resume_docx`,
   `compile_resume_pdf`, `delegate_to_sub_agent`, `notify_user`,
   `spawn_sub_agents`, `web_search`. Each needs a product security review before
   re-baselining. Re-recording without review would hide a real change.
2. `tests/security/test_stage2_zero_trust.py::test_scim_per_tenant_isolation` —
   401 where the test expects 201. Separate SCIM subsystem; untouched here.

---

## 2. Secrets no longer in logs (W2.3)

| Was                                                                                     | Now                           |
| --------------------------------------------------------------------------------------- | ----------------------------- |
| `auth/callback/route.ts:25` logged the raw OAuth `code`                                 | deleted                       |
| `auth/callback/route.ts:26-29` logged the cookie inventory                              | deleted                       |
| `auth/callback/route.ts:30-31` logged the Supabase URL and anon-key prefix              | deleted                       |
| `auth/callback/route.ts:69-72` logged the full `/auth/me` payload (PII + workspace ids) | logs workspace **count** only |
| `auth/callback/route.ts:79` logged the upstream error body                              | logs status + `bodyBytes`     |
| **`auth_service.py:970` logged the raw password-reset token**                           | logs user id + expiry         |
| `sso.py:77,108` logged upstream `resp.text` verbatim                                    | logs status + `bodyBytes`     |

The reset-token line was the worst: anyone with application-log read access
could complete any password reset.

---

## 3. Account recovery correctness (W2.4b, W2.5)

Three real defects fixed in `auth_service.py`:

1. **A reset token could be redeemed twice.** Tokens were written to _both_
   Redis and a process-local dict, but only the Redis key was deleted on use. A
   replay hit Redis → miss → fell through to the still-populated dict →
   succeeded. Both paths are now consumed unconditionally, with `GETDEL` (Redis
   ≥ 6.2) for atomicity and a pipelled fallback.
2. **Password reset did not clear lockout.** `reset_password_with_token` revoked
   sessions but left `failed_login_attempts` / `locked_until` intact, so a
   locked-out user had no self-service recovery — the reset "succeeded" and the
   next login still returned 423. Now cleared.
3. **Expiry was unchecked on the Redis path** — the code fell through to the
   in-memory branch without validating `expires_at`.

Still open (deliberately, see plan W2.4): reset **delivery** is still a no-op —
no email is sent — and the token still lives in a process-local dict rather than
a table. Both need the email service wired and a `password_reset_tokens`
migration.

---

## 4. Session rotation is now atomic (W2.7)

`refresh_token` previously did `SELECT` → check `status != "ACTIVE"` in Python →
assign `status = "ROTATED"`. Under READ COMMITTED two concurrent refreshes both
read `ACTIVE` and both succeeded, so a stolen token could be exchanged twice
before theft detection fired — despite the comment claiming _"Atomic rotation
transition (GAP-AUTH-05)"_.

Now a conditional `UPDATE ... WHERE status = 'ACTIVE'` with a `rowcount == 1`
check decides a single winner; every loser is treated as replay and triggers
family revocation.

Two tests were added because **neither existed**:

- `test_concurrent_refresh_has_exactly_one_winner` — fires 5 concurrent
  refreshes with the same token, asserts exactly one 200 and the rest 401.
- `test_replayed_refresh_token_is_rejected` — asserts 401 with the revocation
  message in the RFC 7807 envelope.

Both pass. The audit's "concurrent" test (`test_auth_zero_trust_gaps.py:232`)
turned out to be **sequential** — it awaited each request rather than gathering
them.

---

## 5. Organization authorization (W3.1–W3.6)

This was the most severe finding: **zero** role checks on any endpoint, and
`role` was a bare `str`, so any authenticated user could add any UUID to any org
unit as `role="owner"`.

### Root cause found during the fix

`check_org_permission` existed but had **zero production callers**. It could not
simply be wired up: `create_organization` never enrolled the creator as a
member, so a freshly created org had no members and _every_ subsequent mutation
by its own creator would have 403'd. The org creator is now enrolled as `owner`
in the same call.

### Changes

- **Single role hierarchy.** `ORG_ROLE_HIERARCHY` / `ORG_ROLES` in
  `organization_service.py` replaces the four divergent sets (this module,
  `dependencies.py` viewer/editor/admin, `middleware/rbac.py`, and a hardcoded
  list in the web organizations page).
- **`require_org_role(min_role)` FastAPI dependency** on all six mutable
  endpoints: `PATCH`/`DELETE` org → `admin`/`owner`; add/remove member →
  `admin`; create invitation → `admin`; **list invitations → `admin`** (that
  response returns every invitee's email address).
- **Roles are a closed set.**
  `Literal["viewer","member","lead","admin","owner"]` on
  `AddMemberRequest.role`, `CreateInvitationRequest.role`, and both
  `default_role` fields. Unknown roles now 422.
- **Escalation blocked.** `assert_can_grant_role` refuses to grant a role above
  the caller's own, so `admin` cannot mint an `owner`.
- **Last-owner guard.** An admin cannot remove the final active owner and orphan
  the org.
- **Invitations bound to identity.** `accept_invitation` now compares the
  normalized `invitation.email` to the authenticated account and returns **403**
  on mismatch. The token was a pure bearer credential.
- **Atomic single-use consumption.** Replaced
  SELECT-then-UPDATE-with-an-intervening-commit with a conditional
  `UPDATE ... WHERE status = 'pending'` requiring `rowcount == 1`.

### A latent bug the audit missed

`check_org_permission`'s fallback imported **`TenantMember`, a model that does
not exist** in `models/schema.py`. It was unreachable because every existing
test hit the membership branch first. Wiring the dependency made the path
reachable and it raised `ImportError`. Corrected to `WorkspaceUser` with
`role.in_(["ADMIN","OWNER"])`, following the existing authority at
`workspace_service.py:55`.

### Four new negative-control tests

Per the repo's own Negative Control Principle — each asserts an exact status:

- `test_role_matrix_denies_unauthorized_mutations` — a `member` attempting six
  different mutations, each must be **exactly 403**; reading members is still
  allowed.
- `test_admin_cannot_grant_owner` — `admin → owner` is 403; `admin → admin`
  is 201.
- `test_unknown_role_is_rejected` — `superuser` / `root` are 422.
- `test_invitation_is_bound_to_invited_email` — wrong account 403, intended
  recipient 200, **replay 400**.

---

## 6. Fabricated surfaces replaced (W1.1, W1.2, W1.7)

### `settings/security` — the page that lied about security

It had **zero API imports** and rendered: a hardcoded TOTP secret
`JBSWY3DPEHPK3PXP`, six hardcoded recovery codes, two invented sessions with
documentation-reserved IPs, an `RLS VERIFIED` badge derived from
`useState(true)`, a TOTP verifier that accepted **any 6 digits** and then
printed _"Token verified successfully. Synchronized with server time."_, and two
Revoke buttons with no `onClick`.

Replaced with the two components that already existed in the repo and were
**rendered nowhere**: `TwoFactorAuthCard` (real `POST /auth/mfa/setup` +
`/enable`) and `ActiveSessions` (real `GET /auth/sessions`,
`DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-others`). Two-factor
status now comes from `user.mfaEnabled`, which is server-derived via
`GET /auth/me` → `PublicUser.mfa_enabled` → `transformKeys` (`api.ts:303`). No
assurance badge is rendered, because an unbacked badge is a false claim.

Also fixed: `PublicUser` in `packages/shared-types` was missing `mfaEnabled`,
`emailVerified`, and `avatarUrl` — a type-contract drift against the Pydantic
model.

### `/invite/[token]` — simulated acceptance

`setTimeout(1000)` → success → `setTimeout(1500)` → `/workspace`, with a
hardcoded `Acme Distributed Labs`, `Security Reviewer (RBAC)`, and a
`Row-Level Security Enforced` claim. The token was never sent anywhere.

Now calls the real `organizationsApi.acceptInvitation(token)` and renders honest
states: not-signed-in → sign-in link preserving the path via `?redirect=`;
accepting; accepted; and **distinct 400 / 401 / 403 / network** error copy
explaining the cause and the recovery. Organization name and role are explicitly
_not_ shown pre-acceptance, because no server endpoint can resolve a token to a
previewable invitation.

### Dead links

- `CommandCenter.tsx` `nav-analytics` → `/analytics` (no such route) — **command
  removed**.
- `TopNav.tsx` breadcrumb key for `analytics` — **removed**.
- `EnterpriseGated.tsx:25` `/workspaces` → `/workspace`. This was the _only_
  exit button on every gated page, and it 404'd.
- `EnterpriseGated.tsx` no longer prints the internal env var name
  `NEXT_PUBLIC_ENABLE_ENTERPRISE` to end users.
- Breadcrumb map was missing `capabilities` and `history`, which both exist as
  routes — **added**.

---

## 7. Delivery branch gate (W8.1, W8.2, W8.3)

The repository default branch is `master`; **six workflows triggered on
`main`**. `ci.yml` was 100% dead — no push, no PR, no schedule, no dispatch. A
PR to `master` ran no CodeQL, no Gitleaks, no dependency audit, and no
accessibility gate.

| Workflow             | Change                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `ci.yml`             | `main, develop` → `master`; added `workflow_dispatch` so it can never be dark again       |
| `a11y-audit.yml`     | → `master`, added dispatch                                                                |
| `security-audit.yml` | → `master`, added dispatch                                                                |
| `security-scan.yml`  | → `master`, added dispatch                                                                |
| `docker-build.yml`   | → `master`; **per-service build context** (web needs the repo root, api needs `apps/api`) |
| `deploy.yml`         | **push trigger deliberately removed** — see below                                         |

`deploy.yml` is now manual-only **on purpose**, with the reason in the file. Its
push trigger was dead, and re-pointing it to `master` would have made an
unattended deploy fire on every merge against a pipeline with eight unresolved
blockers: no `needs:` on the build, 19 of 23 k8s Deployments referencing images
nobody builds, an unstartable API Deployment, no post-deploy smoke, an `echo`
load-test gate, and a rollback that never re-verifies. It ships disabled until
W8.5–W8.15 land.

`apps/web/Dockerfile` now sets `ENV CI=true` in the builder stage.
`next.config.js:20` gates `output: 'standalone'` on `CI === 'true'`, so without
it `.next/standalone` was never produced and `Dockerfile:35`'s `COPY` failed —
the web image could not be built off CI at all.

---

## 8. Other real bugs found and fixed

- **The organizations page crashed at runtime.** `api-client.ts` typed
  `getTree`/`getMembers`/`getInvitations` as returning arrays, but the backend
  returns a `{ items, total }` envelope. The page then did `roots.map(...)` on
  an object. Fixed with an explicit `unwrapItems` helper and a comment
  explaining the contract.
- **Stored XSS via the signup email field.** The validator only checked
  `has an @ and a dot in the domain`, so
  `xss-<script>alert('xss')</script>@test.com` was accepted with 201. Now
  validated with `email-validator` via a reusable `NormalizedEmail` type.
  `test_environment=True` is required because the reserved `.test` TLD is used
  throughout the suites and the Playwright harness; it relaxes only the
  special-use _domain_ check, so markup in the local part is still rejected
  (verified against 8 payloads).
- **`Checkbox` and `Radio` silently discarded their `error` prop.** Both
  destructured it and never used it, so a form control marked invalid showed no
  styling, no `aria-invalid`, and no announcement. Rewritten following
  `Textarea.tsx`, the strongest form component in the kit: `useId` →
  `htmlFor`/`id`, `aria-invalid`, `aria-describedby`, `role="alert"`, plus the
  `<div onClick>` visual shim replaced with a real `<label htmlFor>` and the
  20px hit area raised to 24px.
- **UI-kit lint now passes.** 5 errors → 0. The remaining diffs across ~30
  ui-kit files are mechanical `import/order` and unused-import removals from
  `lint --fix`, plus the one real fix (`import type { StatusDotType }`).

### One test was updated rather than "made to pass"

`test_organization_membership_lifecycle` asserted `len(members) == 1` — i.e.
that a new org starts with **no** members. That premise is why role checks could
never be added. It now asserts the new contract precisely: exactly one `owner`
(the creator, and not the added member), the added member has the expected role,
and after removal the owner remains so the org cannot be left ownerless.

`test_signup_injection` similarly asserted a _fixed status per payload_, which
encoded the weaker guarantee that an injection string must be **stored** (201)
rather than **rejected** (422). It now asserts the actual invariant: whichever
outcome, the payload is not executed, the `users` table survives, and no row was
conjured by the injected predicate.

---

## 9. Not done in this pass

Plan items still open, with the reason:

| Item                                                         | Why not now                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W2.1/W2.2 HttpOnly session + BFF                             | The highest-risk change in the program. It touches every authenticated request and a mistake locks out every user. Needs the dual-read + server-side emergency-revoke rollout described in the plan. Deliberately deferred rather than half-done. |
| W2.4 password-reset **delivery**                             | Requires wiring `email_service` and a `password_reset_tokens` migration. The replay and lockout defects are fixed; the "we sent you a link" claim is still unearned and W1.2's copy is the only user-visible surface.                             |
| W2.9/W2.10 MFA SSO bypass, step-up enrolment                 | Needs a single token-issuance helper across SSO/SAML/password paths.                                                                                                                                                                              |
| W1.4 `dataMode` contract + fixture segregation               | Requires the route manifest (W4.1) to drive it; doing it ad hoc per page would create a second registry.                                                                                                                                          |
| W1.5 fixture claim removal on career/search/tasks/email/help | Same dependency as W1.4.                                                                                                                                                                                                                          |
| W3.8 API-key lifecycle                                       | `APIKeyManager` exists and is unreachable; needs a router plus `X-API-Key` support in `AuthMiddleware`.                                                                                                                                           |
| W3.9–W3.12 RLS                                               | Migration `_safe()` swallowing, `marketplace_listings` with no RLS, 19 `USING (true)` tables. Forward-only migrations needing a staging snapshot.                                                                                                 |
| W6.1 false-green E2E                                         | 24 patterns catalogued; the 4 critical ones are next.                                                                                                                                                                                             |
| W8.4–W8.15 remaining delivery                                | Image naming, digest pinning, the 19 fictional Deployments, the web health route, nginx upstream, `.env.production`, real load gate, verified rollback.                                                                                           |
| W9 live RLS matrix, evidence ledger                          | Runs after the above.                                                                                                                                                                                                                             |

---

## 10. State of the working tree

**Nothing is committed.** 56 files modified, 2 untracked plan documents, on
`master`. Per the repository's collaborative-tree rule the audit preserved user
work and did not reset or overwrite anything.

```
git tag -l "audit/*"        # audit/frontend-enterprise-20260926
git diff --stat             # 56 files, +1214 / -586
```

Recommended next step: branch from `master`, commit as three reviewable commits
(security/truth, authorization, delivery+design-system), and open a PR so the
repaired CI gates — which are only just alive again — run on it for the first
time.
