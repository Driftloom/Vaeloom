# Vaeloom — Enterprise Production Readiness Program

**Audited commit:** `592db98e`
(`fix(web): externalize supabase auth + otel api for server builds`) **Default
branch:** `master` **Method:** 6 parallel read-only audits, each re-reading
committed source and running real commands. Every claim below is anchored to
`file:line`. Nothing is inferred from documentation. **Date:** 2026-09-26

---

## 0. Verdict

**NO-GO for production and enterprise readiness.**

This is not a polish verdict. The audit found defects that make specific,
current claims provably false:

| Claim in the repo                                                            | Reality                                                                                                                                                                                   | Evidence                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| "3640 tests collected" (AGENTS.md)                                           | **4265** collected                                                                                                                                                                        | `pytest --collect-only`                                    |
| "security suite 233/233" (AGENTS.md)                                         | **385** collected, **8 FAILED**                                                                                                                                                           | `pytest tests/security -q` → `8 failed, 377 passed`        |
| "RLS 42/42 tables FORCE" (AGENTS.md)                                         | `marketplace_listings` has **no ENABLE at all**; `workspace_capabilities` has ENABLE but **no FORCE**; ORM declares 68 tables                                                             | `0043:93-97`, `0049:93`, repo-wide grep                    |
| "RLS REMEDIATED & PROVEN" (`docs/security/RLS-SERVICE-POLICY-EXPOSURE.md:3`) | 0053/0054/0055/0056 **re-opened 15 tables** with `USING (true)` for the app role after 0052 closed them                                                                                   | `0053:195-209`, `0054:50-58`, `0055:53-58`, `0056:181-186` |
| "OpenAPI 241 paths / 294 ops" (AGENTS.md)                                    | **243 / 296**                                                                                                                                                                             | `yaml.safe_load` count                                     |
| "jest-axe 0 critical" (`evidence/phases/mvp/mvp-p21/08-registers.md:54`)     | `jest-axe` is **not a dependency and not in the lockfile**. The `try/require` always throws; the assertion is dead code                                                                   | `a11y.test.tsx:36-46`, `pnpm-lock.yaml` grep               |
| "`basic-smoke.spec.ts` — 8 tests PASS" (`mvp-p21/10-handoff...md:224`)       | **File does not exist**                                                                                                                                                                   | repo-wide glob                                             |
| "Coverage gated at 80/80/75/70" (root `jest.config.ts:8-15`)                 | That config is **dead**. No package references it. Nothing can fail on coverage                                                                                                           | no `coverageThreshold` in either package config            |
| "Visual regression" (36+4 committed PNGs)                                    | 36 of 40 are **never compared** (CI re-runs with `--update-snapshots`); the other 4 **can never be found** (filename missing the `-chromium-` project segment, no `snapshotPathTemplate`) | `ci-frontend.yml:62,67`; `playwright.config.ts:29`         |
| "Load test gate passed" (`deploy.yml:122-124`)                               | `run: echo "Load test gate passed"`                                                                                                                                                       | literal                                                    |
| "41 Page Routes" (`apps/web/README.md:31`)                                   | **56**                                                                                                                                                                                    | route tree enumeration                                     |

**Three of the four highest-severity findings are self-inflicted trust damage in
user-facing surfaces**, not internal engineering debt:

- `settings/security/page.tsx` shows a hardcoded TOTP secret `JBSWY3DPEHPK3PXP`,
  six hardcoded recovery codes, two invented sessions, an `RLS VERIFIED` badge,
  and a TOTP verifier that accepts **any 6 digits** (`:65-71`), then prints
  _"Token verified successfully. Synchronized with server time."_ Its Revoke
  buttons have no `onClick` (`:263-298`). It has **zero** API imports. The real
  components already exist and work — `TwoFactorAuthCard.tsx:35,71` and
  `ActiveSessions.tsx:30,41,63` — but are only rendered at
  `profile/page.tsx:239,243`. The fake page is the one in the sidebar
  (`Sidebar.tsx:92`).
- `invite/[token]/page.tsx:16-26` is a `setTimeout` handshake with a hardcoded
  org name and a `Row-Level Security Enforced` claim, and the token is never
  sent anywhere. Backend-side, `accept_invitation` never compares
  `invitation.email` to the caller (`organization_service.py:426-495`).
- Five routes in primary navigation render fixture data with no `dataMode`
  contract — `dataMode` does not exist anywhere in `apps/web/src`.
  `tasks/page.tsx:147` reports **"100% deterministic success rate"**.
  `email/page.tsx:85-89` renders a live-looking connected Gmail account with a
  pulsing green dot from static fixture data.

---

## 1. The 8 root causes

~180 raw findings collapse into 8 systemic causes. Fix the causes, and most
individual findings disappear.

### RC-1 — Secrets are in the browser, and in the logs

`api.ts:66,79,80` puts the access token in `localStorage` **and** a JS-readable
cookie. `api.ts:109,113,114` does the same for a **30-day** refresh token.
`auth/callback/route.ts:96-106` sets both cookies without `httpOnly` or
`secure`. The only `set_cookie` in the entire backend is CSRF
(`main.py:391-398`).

Meanwhile `auth/callback/route.ts:25` logs the raw OAuth `code`, `:26-29` logs
the cookie inventory, `:69-72` dumps the backend user payload, `:79` logs error
bodies. And `auth_service.py:970` logs the **raw password reset token**:
`logger.info("Password reset token generated for user %s: %s", user.id, raw_token)`.

Any XSS or any log reader gets permanent account takeover.
`docs/backend/Authentication.md:88,108` documents HttpOnly cookies and lists
localStorage as a _threat to avoid_ — the code does the opposite. **One XSS in
an app with 30-day refresh tokens in localStorage is a total compromise.**

### RC-2 — The organization API has no authorization

`apps/api/src/api/routers/organizations.py` has **zero** role or permission
checks on any endpoint — read or write. Every handler's dependency list is
`get_db` + `get_current_user`.

`check_org_permission` exists at `organization_service.py:356` and has **0
production callers** (1 test caller). `require_permission` at
`middleware/rbac.py:13-22` has **0 production callers**. `AddMemberRequest.role`
is a bare `str` (`organizations.py:40-43`) whose only enumeration is a
docstring.

**Any authenticated user can add any UUID to any org unit as `role="owner"`,**
or mint an owner invitation. Cross-tenant isolation _is_ implemented
(`organization_service.py:120-122,215-217,255-257,286-288,505-508`) — but tenant
≠ role, and there is no role layer at all.

There are also **four divergent role systems**: `dependencies.py:45-49`
(viewer/editor/admin = 1/2/3), `organization_service.py:363`
(viewer/member/lead/admin/owner = 10/20/30/40/50), `middleware/rbac.py:6-10`
(viewer/editor/admin), and a fourth hardcoded in the UI at
`organizations/page.tsx:33-58` presented to users as a "Role & Permission
Matrix" (`page.tsx:861-894`) that is not server-derived.

### RC-3 — Invitations are unbound bearer tokens

`accept_invitation` (`organization_service.py:426-495`) matches on
`token_hash` + `status == "pending"` (`:444-447`) and grants `invitation.role`
in `invitation.organization_id` (`:464-471`). It receives only `user_id`
(`:302`) — **`invitation.email` is never read**, even though the column exists
(`schema.py:1549`).

Consumption is SELECT-then-UPDATE with a commit in the middle (`:444-449` →
`add_member` commits at `:243` → `:473-474` commits again). No
`UPDATE ... WHERE status='pending'`, no rowcount check, no `FOR UPDATE`. Two
concurrent accepts both pass the filter; the audit event fires twice.

`expires_at` **is** correctly checked (`:305,453-461`) — that part is right.

The URL contract is broken three ways: the email sends `/invite/{token}`
(`organization_service.py:341`), the UI builds `/join?token=`
(`page.tsx:371,587`), the endpoint is
`POST /organizations/invitations/{token}/accept` (`organizations.py:286`).

### RC-4 — There is no contract layer; there are four parallel ones

| Concern          | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes**       | No manifest exists. `Sidebar.tsx:50-112` (29 links), `TopNav.tsx:25-57` (32 breadcrumb keys), and `CommandCenter.tsx:89-644` (24 commands) each hardcode their own list. They disagree with each other and the filesystem.                                                                                                                                                                                                                                                                                          |
| **Entitlements** | `MeResponse` (`auth-dto.ts:50-53`) and `Workspace` (`workspace.ts:8-15`) have **no plan, tier, role, entitlements, or flags**. All gating is a build-time public env var, inconsistently named in 3 places: `NEXT_PUBLIC_ENABLE_ENTERPRISE` (`Sidebar.tsx:43`, `EnterpriseGated.tsx:40`) vs `ENTERPRISE_ROUTES_ENABLED` shown to end users (`billing/page.tsx:217,251,258`) vs `enterprise_routes_enabled` in AGENTS.md. `NEXT_PUBLIC_*` is inlined at build time — it cannot vary per tenant, role, or deployment. |
| **Transport**    | `api-client.ts` is 3,702 lines with **7 raw `fetch()` sites** (`:363,653,787,863,927,946,1088`) plus a hand-rolled XHR (`:681-739`) that bypass the 401→refresh→retry queue and correlation-ID capture. Its `logout()` (`:120-126`) removes localStorage but **not** the cookies, while `api.ts:85-92` does both. 62 components import `api-client`; 26 import `api`. `api.ts` is 7.27% covered; `api-client.ts` is **0%**.                                                                                         |
| **SDK**          | 12 confirmed mismatches. `/memory` vs mounted `/memories` (TS `:54,59,64,69`; Py `:38,42`), 3 conflicting pagination envelopes, `X-Workspace-ID` never sent (so multi-workspace users hit the "first workspace" heuristic at `memory.py:62-75,603-613` and silently read the wrong workspace), and `X-API-Key` is **rejected 401** — `middleware/auth.py:75-77` accepts only `Authorization: Bearer`.                                                                                                               |

Dead links this produces: `CommandCenter.tsx:340` → `/analytics` (no such route;
reachable via ⌘K), `TopNav.tsx:47` breadcrumb key for it,
`EnterpriseGated.tsx:25` → `/workspaces` (the real route is `/workspace`) —
which is the _only_ exit button on every gated page. Gate asymmetry:
`/organizations` and `/marketplace` are hidden in nav but have **no page-level
gate**; `/billing` has a page gate but sits in the **non**-enterprise nav group
(`Sidebar.tsx:88-97`), so with the flag off every MVP user sees a nav item that
always renders a wall.

### RC-5 — Data sources are unlabelled

`dataMode` does not exist. `apps/web/src/lib/fixtures/` has 5 files consumed by
5 routes that sit in **unconditional** primary navigation. Four of five render a
`DEMO` badge; `help/page.tsx:76-78` does not — it shows `KNOWLEDGE BASE` as a
primary badge. `settings/security` shows no demo disclosure at all, only
assurance badges.

Worse, three fixture pages render **unqualified correctness and security
claims** from static data: `tasks:147` "100% deterministic success rate";
`search:111,114,194` "Partitions: 6" / "Indexed Entities: 142" / "Traversal
Latency: 14ms"; `email:85-89,263,240-243` a connected Gmail account with a live
pulse, "Scanned by GmailAgent (System 1 Choice)", and "Ingested" with fixture
confidences. The fixture file's own header says it should _"never claim live
connection when disconnected"_ (`email.ts:3`).

Meanwhile pages silently pick among {real API, `.catch(() => null)`, fixture,
local state, hardcoded literal} with no uniform marker — `billing/page.tsx:58`
renders `emptyUsage = {apiCalls: 0, users: 1}` as real when the backend is down;
`memory/page.tsx:57` shows `F-02:` honesty comments (the one page doing it
right).

### RC-6 — The design system has three token authorities and zero tested behaviour

- `globals.css` = 86 custom properties, is the **de facto runtime** source.
- `packages/ui-kit/src/tokens/` = a **disjoint namespace** (`--color-bg-*`,
  `--space-*`, `--color-ai-*`). Namespace overlap is **2 of 86 properties
  (2.3%)**. `generateCssVariables()` has exactly 2 references repo-wide: its
  definition and its own test. It is **dead code**.
- `docs/design-system/03-tokens.md:31,44,51` claims the opposite in all three
  sentences.

Across focus tokens: **9 MATCH / 22 DIFFER / 4 BROKEN**. `--primary-fg` (used by
`FilterBar.tsx:65,72`) is defined nowhere. `var(--font-size-12)`
(`component.json:65`) is defined nowhere. `.bg-scrim` cited at
`tailwind.config.ts:13` is actually `.bg-void` (`globals.css:445-447`).

`globals.css:41` sets `--bg: 0 0 0` (pure black) while
`tailwind.config.ts:11-14` states _"pure black is NOT the app background
anywhere"_. `DESIGN.md:3-4` calls itself the "Single Source of Truth" and is
**right about fonts** (Inter / Space Grotesk / IBM Plex Mono all load correctly,
`layout.tsx:2,18,24,30`) and **right about the 4px grid and `text-2xs`** — but
its "secondary button" (`DESIGN.md:123`), `globals.css:312-318`, and
`Button.tsx:28-29` are three different buttons, and it defines 4 styles where
`globals.css` has 5 `.btn-*` classes and `Button.tsx` has 5 variants.

Behavioural coverage: **0 of 230 ui-kit component functions are executed by the
ui-kit suite.** `components.test.ts:6-39` is 34 × `toBeDefined()`;
`tokens.test.ts` asserts key-parity among 3 JSONs and never compares to
`globals.css`. `package.json:12` uses `jest --passWithNoTests`, so deleting the
suite still exits 0. Lint: **5 errors, 56 warnings** — including
`Checkbox.tsx:13` and `Radio.tsx:9` destructuring an `error` prop and **never
using it**, so form controls silently accept and discard error state.

### RC-7 — Tests are configured to pass, and the gates that look real are hollow

Real coverage, measured: **apps/web 11.34% statements / 8.64% branches / 10.09%
functions** across 300 files, **238 of them at exactly 0%**. At 0%:
`middleware.ts`, `useAuth.tsx`, `api-client.ts` (3,457 lines),
`error-tracking.ts`, `web-vitals.ts`, `realtime-client.ts`, and **every route
page except the landing page and `capabilities`**.

24 false-green patterns were catalogued. The four worst:

- `module05-documents.spec.ts:19,27-29` — the **only** XSS-upload-rejection test
  in the repo. `.catch(() => null)` then `if (resp) { expect(400) }` with **no
  else**. Delete server-side `.html` MIME rejection and this test still passes
  green.
- `module05-documents.spec.ts:50,56,59-64` — the **only** `nosniff` /
  `Content-Disposition: attachment` assertions. Same shape.
- `quality.spec.ts:26-38` — the 12-route × 2-theme axe gate. A route that
  throws, 404s, or redirects to `/login` has **zero** serious/critical
  violations → `bad === []` → **PASS**. It cannot distinguish "accessible" from
  "broken".
- `a11y.test.tsx:36-46` — `require('jest-axe')` in a try/catch inside a test
  that renders a `SmokeShell` **it authored itself** (`:9-31`) and imports
  **zero application code**.

Plus: `mutations.spec.ts:77-81` is named _"approvals keyboard A/R works on
focused card"_ and performs no keyboard action; `auth.spec.ts:41-63` is named
_"sidebar reaches every core route"_, uses `page.goto` and never clicks a link,
and asserts `h1` count == 1 — **satisfied by `not-found.tsx:6`
(`<h1>404</h1>`)**.

`page.keyboard.press('Tab')` has **zero occurrences** in all of `apps/web/e2e`.
`Modal.tsx:36-55` focus trap and `:59,70` focus restore are 0% covered.
`aria-sort` has **zero occurrences repo-wide** despite `DataTable.tsx:19-21`
accepting `sortBy/onSort`.

The harness itself is genuinely good: `playwright.config.ts:30-51` boots the
real FastAPI via `api-launcher.py` with real seeded users (`:95-97`) and real
JWT login through the actual UI (`helpers.ts:9-19`, no token injection). Keep
it; fix what it asserts.

### RC-8 — The delivery path has never run

`git symbolic-ref refs/remotes/origin/HEAD` → `refs/remotes/origin/master`.
`gh repo view` → `{"name":"master"}`.

**Six workflows trigger on `main`.** Consequences:

| Workflow                                                      | Trigger                                      | Verdict                                                  |
| ------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `ci.yml`                                                      | `push:[main,develop]`, `pull_request:[main]` | **100% DEAD** — no schedule, no dispatch. Has never run. |
| `docker-build.yml`                                            | `push:[main]`                                | **DEAD** — no image has ever been built                  |
| `deploy-staging.yml`                                          | `workflow_run: [Docker Build]`               | **DEAD** — chained to a dead workflow                    |
| `deploy.yml` push path                                        | `push:[main]`                                | **DEAD** — the only automated deploy trigger             |
| `a11y-audit.yml` / `security-audit.yml` / `security-scan.yml` | push+PR on `main`                            | push/PR **DEAD**; weekly cron survives                   |
| `ci-backend.yml`, `ci-frontend.yml`                           | `[push, pull_request]` unfiltered            | alive                                                    |
| `ci-integration.yml`                                          | cron + dispatch                              | alive, **never on PR**                                   |
| `docs-validate.yml`                                           | PR paths                                     | alive                                                    |

**A PR to `master` runs `ci-backend`, `ci-frontend`, and `docs-validate`. No
CodeQL. No Gitleaks. No `pnpm audit`. No a11y gate.** The only security signal
is a weekly cron against a stale tree.

The infra that _would_ run is also non-functional:

- **Web Docker cannot build off-CI.** `next.config.js:20` gates
  `output:'standalone'` on `CI==='true' && platform!=='win32'`;
  `apps/web/Dockerfile` never sets `CI` → `.next/standalone` is never produced →
  `Dockerfile:35` `COPY` fails. It only works on GitHub runners because they
  inject `CI=true` as a platform default. `Dockerfile:16` also runs
  `--frozen-lockfile` with 4 package dirs copied while `pnpm-lock.yaml` has **21
  importers**.
- **Context mismatch in 3 of 4 places.** `docker-compose.yml:65`
  `build: ./apps/web`; `docker-build.yml:19`
  `context: ./apps/${{matrix.service}}`; `deploy.yml:64-73` emits
  `context=apps/web`. All fail at `COPY pnpm-lock.yaml`. Only
  `docker-compose.prod.yml:70-72` is correct.
- **The API k8s Deployment cannot start.** `containerPort: 4000` + probes on
  4000 (`api/deployment.yaml:32,78,85`) but `apps/api/Dockerfile:23-24` is
  `EXPOSE 8000` / `--port 8000`. Independently, `validate_settings()` raises 7
  hard errors against the env the manifest provides — missing `JWT_SECRET`,
  `ENCRYPTION_KEY`, `STORAGE_SECRET_KEY`, `RATE_LIMIT_REDIS_URL`, and
  `allowed_origins` still defaulting to localhost under
  `SERVICE_ENVIRONMENT: production` (`configmap.yaml:21`) → `RuntimeError` at
  `main.py:388-391` → CrashLoopBackOff.
- **19 of 23 Deployments are fictional** — `auth-service`, `memory-store`,
  `rbac-service`, … on ports 3010–3180. The repo has 2 apps.
  `base/kustomization.yaml:4-5` stamps `part-of: vaeloom` on all of them, so
  `deploy.yml:145`'s `kubectl wait` can **never** succeed.
- **The web liveness probe depends on the public internet.** There is no
  `apps/web/src/app/api/health/route.ts` — the only `route.ts` in the entire app
  is `auth/callback/route.ts`. The probe "works" via the `next.config.js:94-97`
  `/health/:path*` rewrite to `INTERNAL_API_URL || NEXT_PUBLIC_API_URL`, and the
  Deployment sets only `NEXT_PUBLIC_API_URL: https://api.vaeloom.dev`
  (`web/deployment.yaml:40-41`). **A backend outage restarts the frontend
  pods.** `INTERNAL_API_URL` is set in no manifest anywhere.
- **nginx upstream is a service that does not exist.**
  `infra/ops/nginx.conf:94-97` `server backend:8000;` — the compose service is
  `api` / `container_name: vaeloom-api`. NXDOMAIN → nginx fails at boot →
  cascades through `depends_on`.
- **`.env.production` does not exist** (only `.env.production.template`), so
  `docker-compose.prod.yml:105,141,345` aborts immediately.
- **Ingress and secrets are in no kustomization.**
  `base/kustomization.yaml:7-58` omits `networking/ingress.yaml` and
  `secrets/*.yaml`, so `kubectl apply -k base` deploys no ingress and no secret,
  while the api Deployment requires `vaeloom-db-secret`.
- **`build-and-push` has no `needs:`** (`deploy.yml:44`) — untested code builds.
- **Registry path in 3 forms**, no `@digest` ever reaches the cluster;
  `deploy.yml:94` signs the digest and `:142` applies the tag.
- **The load gate is `echo`** (`:122-124`) _and_ `k6-script.js:27-31` targets
  `http://localhost:8000` with hardcoded `test@vaeloom.ai / password123`, no
  `BASE_URL`, no services. `http_req_failed: rate<0.01` (`:19`) against a dead
  port → k6 exits 99 → deploy is **skipped**. It can neither succeed nor
  measure.
- **Rollback is a bare `kubectl rollout undo`** (`:146-149`) with no
  `rollout status` and no re-verification, and `if: failure()` is job-scoped — a
  `terraform-plan` or `load-test-gate` failure skips the job, so the rollback
  never runs. `:162` reads `job.status` inside the `slack-notify` job, so Slack
  always reports success.
- **Only `terraform plan`, never apply** (`:35`) — the uploaded `tfplan` is a
  dead artifact. `:16` resolves the cluster to `staging` on push because
  `github.event.inputs` is empty; there is no prod path.
- **Production CSP `connect-src` omits the API host entirely**
  (`next.config.js:46` lists `https://vaeloom.app`, not
  `api.vaeloom.app`/`.dev`) → browser calls to the API host are blocked.
  Hostname drift across 6 files: `vaeloom.app` / `vaeloom.dev` /
  `app.vaeloom.app`.
- **No `HEALTHCHECK` in any Dockerfile in the repo.** No `USER` in the API image
  (runs as root). No `securityContext` on either Deployment.

---

## 2. Program structure — 9 waves

Waves are **sequenced by dependency, not by severity**. W1 is a prerequisite for
nothing but trust. W2/W3 are parallel (different files, both backend). W4 needs
W1's route list. W5–W7 run in parallel after W4. W8 runs in parallel from the
start (it touches only infra). W9 proves everything and is last.

```
WAVE 0  FREEZE & BASELINE            0.5d    ──┐
WAVE 1  TRUTH — kill the lies       3–4d    ──┤
WAVE 2  SESSION & RECOVERY          5–7d    ──┼── lane A
WAVE 3  AUTHORIZATION               5–7d    ──┼── lane B
WAVE 8  DELIVERY                    5–6d    ──┼── lane C  (parallel from day 1)
WAVE 4  CONTRACTS                   4–5d    ──┤
WAVE 5  DESIGN SYSTEM & UI/UX       5–6d    ──┼── lane D
WAVE 6  TEST GATE                   6–8d    ──┤
WAVE 7  SDK & DEVELOPER CONTRACT    4–5d    ──┼── lane E
WAVE 9  PROOF & EVIDENCE LEDGER     3d      ──┘
                                     ─────
                              TOTAL  41–51d single-threaded
                              ≈  22–27d with 5 parallel lanes
```

**Total effort: ~6–8 weeks single-threaded, ~3–4 weeks across 5 parallel
lanes.**

---

### WAVE 0 — FREEZE & BASELINE (0.5 day)

The tree is collaborative and was changing during the audit. Freeze before
touching anything.

- [ ] **W0.1** Tag `592db98e` as `audit/frontend-enterprise-20260926`. All
      findings in this document are relative to it.
- [ ] **W0.2** Land the 6 audit reports as
      `evidence/frontend-enterprise/01..06-*.md` plus a machine-readable
      `findings.json` (`{id, severity, file, line, claim, status}`).
- [ ] **W0.3** Publish the false-claims register (§5) as
      `evidence/frontend-enterprise/07-false-claims.md`. Correcting
      documentation is **not** cosmetic here — a doc that says "RLS REMEDIATED"
      is an active hazard.
- [ ] **W0.4** Open a branch protection rule on `master` requiring
      `ci-backend` + `ci-frontend` + `docs-validate` + the repaired gates.
- [ ] **W0.5** Do not start Wave 1 until W0.1–W0.4 are done.

**Gate:** baseline tag exists; findings register is committed; the 8 RED
security tests are recorded as RED.

---

### WAVE 1 — TRUTH: kill the lies (3–4 days) — P0

Highest severity, zero dependencies, and it is the wave a customer-impacting
incident would come from. Do this first and ship it.

- [ ] **W1.1 `settings/security` — delete the fabrication.** `page.tsx` has
      **zero** API imports. Replace the page body with the two components that
      already work: `TwoFactorAuthCard.tsx:35,71` (`api.mfa.setup()`/`enable()`)
      and `ActiveSessions.tsx:30,41,63`
      (`listSessions`/`revokeSession`/`revokeOtherSessions`), currently only at
      `profile/page.tsx:239,243`. Or make `/settings/security` a 308 redirect to
      `/profile` and remove it from `Sidebar.tsx:92`. Either way, delete: the
      literal `JBSWY3DPEHPK3PXP` (`:60,144`), the 6 recovery codes (`:31-38`),
      the 2 fake sessions (`:40-57`), the `RLS VERIFIED` badge (`:82-84`), the
      `ENFORCED` badge derived from `useState(true)` (`:25,117`), the
      6-digit-always-passes verifier (`:65-71`), the "Synchronized with server
      time" copy (`:180-183`), and the two no-op Revoke buttons (`:263-298`).
- [ ] **W1.2 `/invite/[token]` — delete the handshake.** `page.tsx:16-26` is
      `setTimeout(...,1000)` → `setTimeout(...,1500)` →
      `router.push('/workspace')`, with a hardcoded `'Acme Distributed Labs'`
      (`:51`), `'Security Reviewer (RBAC)'` (`:55`), and a
      `Row-Level Security Enforced` claim (`:59-61`). Either call the real
      `POST /organizations/invitations/{token}/accept` (W3) or render a truthful
      "this link cannot be verified in your session — ask your admin to
      re-issue" state. **No simulated acceptance, ever.**
- [ ] **W1.3 `/account-locked` — delete the fake incident.** `:34` is the
      literal `Incident ID: SEC-LOCK-2026-9411`. `:30-31` claims a 15-minute
      gate with no timer and no server call. Render real lockout metadata or
      nothing.
- [ ] **W1.4 Introduce the `dataMode` contract and segregate fixtures.**
      `dataMode: 'live' | 'preview' | 'stub' | 'dead'` on every route in the
      manifest. Move `career`, `search`, `tasks`, `email`, `help` to
      `/preview/*` and remove them from production `Sidebar` and `CommandCenter`
      by capability, not by a badge. A `<DataModeBanner>` renders the mode from
      the manifest; it cannot be forgotten per-page.
- [ ] **W1.5 Remove unqualified claims from fixture surfaces.**
      `tasks/page.tsx:147` "100% deterministic success rate";
      `career/page.tsx:87,93,100,128,288-289,369` (`'+6% QoQ'`, hardcoded
      `value="$380k - $480k"` that ignores the fixture's own
      `targetCompensation`, `'+34% YoY'`, `High (98.4%)`, `SCOUTING ACTIVE`);
      `search/page.tsx:111,114,194` (`Partitions: 6`, `Indexed Entities: 142`,
      `Traversal Latency: 14ms (System 1 Index)`);
      `email/page.tsx:85-89,240-243,263` (live-connection pulse from fixture,
      `Ingested` with fixture confidences,
      `Scanned by GmailAgent (System 1 Choice)`).
- [ ] **W1.6 Add `help`'s missing disclosure.** `help/page.tsx:76-78` shows
      `KNOWLEDGE BASE` as a `variant="primary"` badge with **no demo marker**,
      and `help.ts:91` asserts _"RLS enforced at the database layer"_ as
      documented fact. Fix both.
- [ ] **W1.7 Kill the dead links.** `CommandCenter.tsx:340` → `/analytics`
      (delete the command, or build the route from the real `analyticsApi` at
      `api-client.ts:1749-1770` which already exists and is never read).
      `TopNav.tsx:47` breadcrumb key for the same. `EnterpriseGated.tsx:25` →
      `/workspaces` → `/workspace` (this is the only exit button on every gated
      page; today it 404s). `Sidebar.tsx:94` billing out of the non-enterprise
      group.
- [ ] **W1.8 Close the gate asymmetry.** `/organizations` and `/marketplace`
      have **no page-level gate** — direct URL bypasses the nav. Add gates.
      Standardise the flag name in one place. Until W4.4 lands, the page-level
      gate is defence-in-depth, never the authorization boundary.
- [ ] **W1.9 Fix silent fallbacks.** `billing/page.tsx:58` renders
      `emptyUsage = {apiCalls: 0, users: 1}` as real when the API is down
      (`.catch(() => null)` at `:83-97`). `window.open('#')` at `:213` for mock
      invoices. `developer/page.tsx:87,145,247` generates `vlm_live_` API keys
      **in the browser** and stores them in `localStorage` — there is no server
      counterpart and the real prefix is `vael_` (`api_keys.py:29`).
- [ ] **W1.10 Add a CI assertion that no unverified claim can ship.** A lint
      rule that fails on `VERIFIED|ENFORCED|100%|RLS VERIFIED` in JSX **unless**
      the string is bound to a fetched value. This is what stops W1 from
      regressing.

**Gate:** zero production routes render an unverified security or correctness
claim; zero dead links; every fixture route is `preview`-labelled and outside
production nav; W1.10 is a blocking CI check.

---

### WAVE 2 — SESSION & RECOVERY (5–7 days) — P0 · lane A

- [ ] **W2.1 HttpOnly session, delete browser storage.** Backend sets
      `vaeloom_session` with `httponly=True, secure=True, samesite='lax'`.
      Delete `api.ts:66,79,80` (access) and `:109,113,114` (refresh, 30-day).
      Add `httpOnly`/`secure` to `auth/callback/route.ts:96-106`.
- [ ] **W2.2 BFF pattern.** `next.config.js:87-89` already rewrites
      `/api/v1/:path*` → backend. Extend so the browser only ever talks
      same-origin: cookies flow automatically, **no Bearer token in JS at all**.
      Add a Next route handler for `/api/v1/auth/refresh` that owns rotation.
- [ ] **W2.3 Delete sensitive logging.** `auth/callback/route.ts:25` (OAuth
      code), `:26-29` (cookie inventory), `:30-31` (supabase URL + anon key
      prefix), `:69-72` (backend user payload), `:79` (error body).
      `auth_service.py:970` (raw reset token). `sso.py:77,108` (upstream
      `resp.text`).
- [ ] **W2.4 Make password reset actually work.** `request_password_reset`
      (`auth_service.py:941-971`) **sends no email at all** and returns
      "instructions have been sent" (`routers/auth.py:147-154`). `email_service`
      exists and is used at `organization_service.py:338` — wire it. Then move
      `_password_resets` from a process-local dict (`:939,962`) to a
      `password_reset_tokens` table (hashed, `expires_at`, `used_at`,
      `attempts`) — the model precedent is `EmailVerificationToken` and
      `OrganizationInvitation.token_hash`. Make the Redis path atomic (`GETDEL`)
      and **re-check `expires_at` server-side on both paths** — the Redis path
      currently skips the expiry check entirely (`:987-996`).
- [ ] **W2.5 Reset must clear lockout.** `reset_password_with_token`
      (`auth_service.py:1007-1015`) revokes sessions but never touches
      `failed_login_attempts` / `locked_until`. Add the reset. Add an audited
      `POST /admin/users/{id}/unlock` — there is currently no admin unlock path,
      so 10 wrong attempts means a 15-minute dead end with no self-service and
      no support lever.
- [ ] **W2.6 Make logout real and correctly scoped.** `api.ts:351-355` and
      `useAuth.tsx:167-181` never call `POST /auth/logout`; the server session
      stays valid. And `routers/auth.py:192-195` revokes **every** ACTIVE
      session for the user (`WHERE user_id = :uid AND status = 'ACTIVE'`),
      logging out all devices — scope it to `jti = :jti` and keep bulk revoke on
      the explicit endpoint.
- [ ] **W2.7 Atomic refresh rotation.** `auth_service.py:527-550` has the
      comment _"Atomic rotation transition (GAP-AUTH-05)"_ but does `SELECT`
      with **no `FOR UPDATE`**, then `status = "ROTATED"; flush()` at
      `:549-550`. Under READ COMMITTED two concurrent refreshes both succeed.
      Replace with
      `UPDATE auth_sessions SET status='ROTATED' WHERE refresh_token=:t AND status='ACTIVE'`
      and require `rowcount == 1`, else run the family-revoke branch.
- [ ] **W2.8 Stop storing raw secrets at rest.** `schema.py:112-113` persists
      the raw access JWT and the raw refresh token in plaintext. Store a hash of
      the refresh token (indexed lookup) and stop persisting the access JWT at
      all — the precedent for hashing is already in the same schema.
- [ ] **W2.9 Close the MFA bypass.** `routers/auth.py:341-349` (SSO) and
      `:677-678` (SAML) call `issue_token` and return tokens with **no
      `mfa_required` branch** — the branch that password login honours at
      `auth_service.py:349-369`. An MFA-enrolled tenant member logs in with a
      federated token and never sees a TOTP prompt. Route all token issuance
      through one helper.
- [ ] **W2.10 Harden MFA enrolment.** `setup_mfa` (`auth_service.py:394-400`)
      overwrites `user.mfa_secret` and recovery codes with **no password or
      existing-TOTP re-auth**. `/mfa/setup` and `/mfa/enable`
      (`routers/auth.py:681,692`) carry **no `@rate_limit`** — only
      `/mfa/verify` (`:704`) is limited. Add step-up auth and rate limits. Add
      `POST /auth/mfa/disable` requiring password + current TOTP; today the
      toggle is `useState` only (`security/page.tsx:129`).
- [ ] **W2.11 Bind SSO identities.** `routers/auth.py:439` is a bare expression
      `payload.get("sub")` with no comparison; the account is resolved by
      **email alone** (`:324`) and auto-created if absent (`:327-336`). Persist
      `(provider, sub)`, require an exact match on subsequent logins, and refuse
      auto-link of a pre-existing account.
- [ ] **W2.12 Make middleware honest.** `middleware.ts:17-38` splits the token,
      `atob`s the payload, and checks only `parsed.exp` — **no signature
      verification, no `alg` check**. Either verify with `jose` against JWKS, or
      delete the impression of validation: treat middleware as a UX redirect
      only and force `/auth/me`. Also `:4` `PROTECTED_PREFIXES = ['/workspace']`
      leaves `/invite/[token]`, `/account-locked`, `/forbidden`,
      `/session-expired`, `/p/[userId]` unguarded, and `:5-15` `PUBLIC_PATHS` /
      `:46` `isPublicExact` is **dead code** (assigned, never read). Invert to a
      single protected-prefix rule so the two lists cannot drift.
- [ ] **W2.13 Resolve the doc contradiction.**
      `docs/backend/Authentication.md:35,88,108` documents HttpOnly cookies and
      lists localStorage as a threat. Either the doc is wrong or the code is.
      Fix whichever, and note in the changelog which one changed.
- [ ] **W2.14 Add the 12 missing session/recovery tests** — every one of these
      is currently absent: concurrent refresh one-winner; reset replay (consume
      once → 200 → replay → 400); reset expiry (seed `now - 1s` → 400, no
      password change); reset delivery failure; reset clears lockout;
      wrong-account invite; invite replay; invite concurrent accept; MFA
      brute-force exhaustion; logout revokes only the current session; SSO MFA
      enforcement; `api.ts` regression asserting **no** token in `localStorage`
      and correct cookie flags.

**Gate:** no browser-readable refresh token (verified by test, not by
inspection); no credential in any log; 423 → email → reset → login works end to
end; SSO cannot bypass MFA; concurrent refresh has exactly one winner.

---

### WAVE 3 — AUTHORIZATION (5–7 days) — P0 · lane B

- [ ] **W3.1 Add the role dependency and wire all 8 mutations.**
      `check_org_permission` (`organization_service.py:356`) → a FastAPI
      dependency. Apply to `POST /` (`:78`), `PATCH /{org_id}` (`:112`),
      `DELETE /{org_id}` (`:146`), `POST /{org_id}/members` (`:175`),
      `DELETE /{org_id}/members/{user_id}` (`:204`),
      `POST /{org_id}/invitations` (`:219`), `DELETE /invitations/{id}`
      (`:268`), `POST /invitations/{token}/accept` (`:286`).
- [ ] **W3.2 Constrain role assignment.** `AddMemberRequest.role` (`:40-43`) and
      `CreateInvitationRequest.role` (`:48`) are bare `str` with a docstring as
      the only enumeration. Make them `Literal[...]` or an enum. Today any
      authenticated user can request `role="owner"`.
- [ ] **W3.3 Unify the four role systems into one enum.**
      `dependencies.py:45-49` (viewer/editor/admin = 1/2/3),
      `organization_service.py:363` (viewer/member/lead/admin/owner =
      10/20/30/40/50), `middleware/rbac.py:6-10`, and the UI's hardcoded set at
      `organizations/page.tsx:33-58`. `require_permission`
      (`middleware/rbac.py:13-22`) has zero production callers — either wire it
      or delete it. The "Role & Permission Matrix" the UI renders
      (`page.tsx:861-894`) must be server-derived.
- [ ] **W3.4 Fix the tenant fallback.** `_get_tenant_id`
      (`organizations.py:51-62`) falls back to the user's own `sub` as the
      tenant id when the JWT has no `tenant_id` claim, silently degrading tenant
      scope to "my own user id". Require a real tenant claim; return **403**,
      not 400 (`:59-62`).
- [ ] **W3.5 Bind invitations to identity.** In `accept_invitation`, compare
      normalized `invitation.email` to the authenticated user's email; **403 on
      mismatch**. The column exists (`schema.py:1549`) and is used only for a
      domain whitelist at creation (`:290-301`).
- [ ] **W3.6 Make consumption atomic.** Replace the
      SELECT-then-UPDATE-with-intervening-commit (`:444-449` → `:243` →
      `:473-474`) with a single conditional
      `UPDATE ... WHERE token_hash=:h AND status='pending' AND expires_at > now()`
      requiring `rowcount == 1`, then add the member. Enforce the single-use
      invariant at the database level.
- [ ] **W3.7 Stop returning raw tokens in list responses, and fix the URL
      contract.** `organizations.py:245` returns `"token": raw_token` in the
      create response; `organization_service.py:412-424` returns every invitee's
      **email** to any tenant-authenticated caller (role-gate + redact). The
      UI's "Copy Link" column (`page.tsx:582,600`) is permanently dead.
      Reconcile `/invite/{token}` (`:341`) vs `/join?token=`
      (`page.tsx:371,587`) vs `POST /organizations/invitations/{token}/accept`
      (`:286`).
- [ ] **W3.8 Make the API-key lifecycle reachable.** `APIKeyManager`
      (`services/api_keys.py:116`) is imported by nothing outside its own file.
      There is **no `api_keys` router** among the 44 in `routers/`.
      `validate_key` is never called. `AuthMiddleware:75-77` accepts only
      `Authorization: Bearer`, so even a legitimately issued key is rejected.
      Add the router (create / list / rotate / revoke, secret shown once),
      accept `X-API-Key` in the middleware, enforce the `permissions` scope
      (`api_keys.py:37`), write `last_used` on use (currently only nulled on
      rotate, `:87`), and enforce tenant + workspace. The model
      (`schema.py:171-187`) is already correct and RLS-covered.
- [ ] **W3.9 Make RLS migration failures fatal.** `_safe()` at `0052:23-33`,
      `0053:37-47`, `0054:29-39`, `0055:28-38`, `0056 _safe_pg` wraps every
      statement in a savepoint, rolls back on exception, and `print()`s. A
      failed `ALTER TABLE … ENABLE ROW LEVEL SECURITY` leaves a table
      **completely unprotected** with a green migration log. The project's own
      `0032:7-13` docstring already identified this exact anti-pattern and then
      adopted it. Replace with real exceptions + the structured logger.
- [ ] **W3.10 Close the two RLS coverage gaps.** `marketplace_listings` is
      created at `0043:56` and gets **policies** at `0047:129-135` but has **no
      `ENABLE ROW LEVEL SECURITY` anywhere** — repo-wide grep returns 0 matches,
      so every policy on it is a dead letter and any role with table privileges
      sees all rows. `workspace_capabilities` gets ENABLE at `0049:93` but **no
      FORCE** — without FORCE the table owner bypasses RLS, which is the entire
      reason `0010_rls_force_and_roles.py` exists.
- [ ] **W3.11 Re-scope the 19 `USING (true)` app-role policies.** Chain: `0047`
      created 25; `0052` removed `vaeloom_app` from 21; `0053:195-209` re-added
      7; `0054:50-58` +2; `0055:53-58` +1; `0056:181-186` +5. Prioritise by data
      class: `notification_device_tokens` (every tenant's push tokens),
      `outbox_events` (full event payloads), `prompt_versions` (prompt content),
      `webhook_deliveries`, `dead_letter_events`, and the 5 registries. Either
      add a scope column or move them to a service-role-only role.
- [ ] **W3.12 Fix the `0056:188-199` tenant policy.**
      `USING (workspace_id IS NULL OR workspace_id = ...)` treats a NULL
      `workspace_id` as matching **every** tenant, so any NULL-workspace row in
      the 5 registries is readable/writable by any authenticated session.
- [ ] **W3.13 Fix the security-suite app divergence.**
      `tests/security/conftest.py:74-79,105-132` mounts 27 routers **without
      `organizations`**, and mounts
      `billing`/`analytics`/`audit`/`iam`/`plugins`/`recommendations`/`scim`,
      which production gates behind `enterprise_routes_enabled`
      (`main.py:474-484`). The security suite validates a route surface **that
      does not exist in a default deployment** — which is why
      `test_cross_tenant_org_tree_isolation` 404s. The root
      `tests/conftest.py:121,192` mounts it correctly; the two conftests must
      converge on the production app factory.
- [ ] **W3.14 Get the 8 RED security tests green before anything ships.** 5×
      `test_xss.py` signup accepts `<script>`, `javascript:`, `<svg onload>`,
      `"><script>`, `<img onerror>` as an **email** (201, expected 422) — these
      are negative controls proving the input guard does not fire.
      `test_tenant_zero_trust_gaps.py::test_cross_tenant_org_tree_isolation` 404
      (W3.13). `test_stage2_zero_trust.py::test_scim_per_tenant_isolation` 401.
      `test_redteam_loop.py::test_accepted_open_tools_recorded` — the OPEN tool
      set drifted (`compile_cover_letter`, `compile_resume_docx`,
      `compile_resume_pdf`, `delegate_to_sub_agent`, `notify_user`,
      `spawn_sub_agents`, `web_search`); review and re-baseline, do not just
      re-record.
- [ ] **W3.15 Add the missing authorization tests.** viewer/member/lead/admin ×
      every mutation endpoint, asserting **exact** 403. Cross-tenant 404.
      Wrong-email invite 403. Concurrent accept → exactly one 200. Revoked /
      cross-workspace API key → exact denial. `check_org_permission`'s existing
      test (`test_organizations.py:274-304`) calls the service directly and so
      proves a property of **dead code** — it must become an HTTP-level matrix
      test.

**Gate:** every org mutation has a server-enforced role policy; a viewer cannot
mutate and gets an exact 403; invitations are identity-bound and single-use; a
revoked or cross-tenant API key is denied; RLS migrations cannot silently skip;
the security suite is 385/385 green.

---

### WAVE 8 — DELIVERY (5–6 days) — P0 · lane C · starts day 1

Runs in parallel from day 1 because it touches only infra files and shares
nothing with Waves 1–7.

- [ ] **W8.1 Fix the branch gate.** Align all 6 workflows to `master`, or
      deliberately rename the default branch. Add `workflow_dispatch` to
      `ci.yml` so it can never be dark again. **Highest-value single fix in this
      wave** — today a PR to `master` runs no security scan at all.
- [ ] **W8.2 Make the web Docker build work off-CI.** Set `ENV CI=true` in the
      builder stage (`apps/web/Dockerfile:20`) or change `next.config.js:20` to
      key only on `process.platform`. Then fix the lockfile mismatch:
      `Dockerfile:16` runs `--frozen-lockfile` with 4 package dirs while
      `pnpm-lock.yaml` has **21 importers** — either copy all importer
      `package.json` files or scope the lockfile.
- [ ] **W8.3 Fix the build context in 3 places.** `docker-compose.yml:65`,
      `docker-build.yml:19`, `deploy.yml:64-73` all use `apps/web` as context.
      Only `docker-compose.prod.yml:70-72` uses the repo root. Make one of them
      canonical and reference it from the rest.
- [ ] **W8.4 Unify the image name.** `$ECR/vaeloom-web:<sha>`
      (`docker-build.yml:21`) vs `$ECR/vaeloom/web:<sha>` + `:latest`
      (`deploy.yml:82-83`) vs k8s `vaeloom/web:latest` with no host. One name,
      one place to compute it.
- [ ] **W8.5 Gate the build on tests.** `build-and-push` (`deploy.yml:44`) has
      no `needs:`. Add `needs: [ci-frontend, ci-backend, security-scan]`.
- [ ] **W8.6 Make the API Deployment startable.** `containerPort` and both
      probes are 4000 (`api/deployment.yaml:32,78,85`); the image serves 8000.
      And the env it provides fails `validate_settings()` 7 ways: missing
      `JWT_SECRET`, `ENCRYPTION_KEY`, `STORAGE_SECRET_KEY`,
      `RATE_LIMIT_REDIS_URL`, and `allowed_origins` still defaulting to
      localhost under `SERVICE_ENVIRONMENT: production` (`configmap.yaml:21`) →
      `RuntimeError` (`main.py:388-391`). Add a preflight step that runs
      `validate_settings()` against the exact manifest env in CI.
- [ ] **W8.7 Delete the 19 fictional Deployments.** `auth-service`,
      `memory-store`, `ai-service`, `rbac-service`, … on ports 3010–3180. The
      repo has 2 apps. Because `base/kustomization.yaml:4-5` stamps
      `part-of: vaeloom` on all 23, `deploy.yml:145`'s `kubectl wait` can never
      succeed — **the deploy job fails at the verify step today**. Either build
      them or remove them; do not leave them.
- [ ] **W8.8 Give the web app a real health route and a local probe.** Create
      `apps/web/src/app/api/health/route.ts` returning liveness only. Point
      `web/deployment.yaml:49-60` at it, **not** the `/health/:path*` rewrite to
      `https://api.vaeloom.dev`. Today a backend outage restarts the frontend.
      Add `startupProbe`, `timeoutSeconds`, `failureThreshold` (both are
      absent). Set `INTERNAL_API_URL` in the manifest (it is set nowhere) so the
      rewrite is intra-cluster.
- [ ] **W8.9 Add ingress and secrets to the kustomization.**
      `base/kustomization.yaml:7-58` omits `networking/ingress.yaml` and
      `secrets/*.yaml`; `kubectl apply -k base` deploys no ingress and no secret
      while the api Deployment requires `vaeloom-db-secret`. Then validate the
      render **semantically**, not just by exit code.
- [ ] **W8.10 Fix the nginx upstream.** `infra/ops/nginx.conf:94-97`
      `server backend:8000;` → the compose service is `api`. NXDOMAIN at boot.
      Replace the `nginx -t` healthcheck (`:53-57`) with a real liveness probe —
      `nginx -t` passes on a config whose upstreams don't resolve.
- [ ] **W8.11 Create `.env.production` from the template, and add the missing
      dev vars.** `docker-compose.prod.yml:105,141,345` requires a file that
      does not exist. `docker-compose.yml:80-105` has no `ENCRYPTION_KEY` but
      `config.py:342-343` hard-errors below 32 chars, and `ALLOWED_ORIGINS` at
      `:92` is comma-separated while `config.py:114` types it `list[str]` →
      pydantic JSON parse failure. Add `depends_on: condition: service_healthy`
      for `web`.
- [ ] **W8.12 Pin immutable digests.** No `@digest` reaches the cluster; both
      Deployments use `latest` + `imagePullPolicy: Always`. `deploy.yml:94`
      signs the digest and `:142` applies the tag. Set the image by digest.
- [ ] **W8.13 Make the load gate real or delete it.** `deploy.yml:122-124` is
      `echo`. `k6-script.js:27-31` targets `http://localhost:8000` with
      hardcoded `test@vaeloom.ai / password123`, no `BASE_URL`, no services — so
      `http_req_failed: rate<0.01` (`:19`) exits 99 and the deploy is
      **skipped**. Point it at ephemeral staging with seeded credentials and
      assert the real exit code, or remove the gate and stop claiming one.
- [ ] **W8.14 Make rollback verifiable.** `deploy.yml:146-149` is a bare
      `kubectl rollout undo` with no `rollout status` and no re-verification,
      and `if: failure()` is job-scoped so a `terraform-plan` or
      `load-test-gate` failure skips the job and never reaches the rollback.
      Move rollback to `if: always()` in a job that runs after `deploy`, and
      re-run auth + `/health` + RLS smoke **after** the rollback. Fix `:162` —
      it reads `job.status` inside the `slack-notify` job, so Slack always
      reports success.
- [ ] **W8.15 Decide the environment model.** `:16` resolves the cluster to
      `staging` on push because `github.event.inputs` is empty; there is no prod
      path. Add explicit `environment:` selection. Also add the missing
      `terraform apply` (`:35` is plan-only; the uploaded `tfplan` is a dead
      artifact) and fix `deploy-staging.yml` (wrong `github.sha` under
      `workflow_run`, no cluster creds, no namespace, Azure kubectl against an
      EKS target).
- [ ] **W8.16 Fix the production CSP.** `next.config.js:46` omits the API host
      from `connect-src` → browser API calls are blocked in any production
      build. Resolve the 6-way hostname drift (`vaeloom.app` / `vaeloom.dev` /
      `app.vaeloom.app`) into one source.
- [ ] **W8.17 Harden the containers.** Add `HEALTHCHECK` (absent from every
      Dockerfile in the repo), a `USER` for the API image (it runs as root), and
      `securityContext` on both Deployments (`runAsNonRoot`,
      `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`,
      `seccompProfile`) — the web image already does `USER nextjs` at
      `Dockerfile:38`, the manifest just doesn't reference `vaeloom-web-sa`.
      Resolve the DDL race: `apps/api/Dockerfile:24` runs
      `alembic upgrade head && uvicorn --workers 4` while `main.py:143-144` runs
      `Base.metadata.create_all` **then** `command.upgrade` — concurrent DDL on
      every deploy with `maxUnavailable: 0`. Note `deploy.resources` is inert
      under `docker compose up` (needs Swarm).
- [ ] **W8.18 Make the remaining gates blocking.** `docs-validate.yml:36-42` is
      `grep -q ... || echo` (never fails). Re-wire `a11y-audit.yml` to `master`
      (W6.2 fixes the script).

**Gate:** `docker compose build` and
`docker compose -f docker-compose.prod.yml build` both succeed locally; the API
Deployment passes `validate_settings()` against its own manifest env;
`kubectl wait` completes; deploy → smoke → rollback → smoke is rehearsed and
logged; no workflow is dark on `master`.

---

### WAVE 4 — CONTRACTS (4–5 days) — P0

- [ ] **W4.1 Create the route manifest.** It does not exist. One typed registry:
      `{ id, path, label, group, icon, capability, dataMode, breadcrumb, aliases, redirectTo, primaryAction, mobilePattern }`.
      `Sidebar`, `TopNav` breadcrumbs, `CommandCenter`, command search,
      `sitemap.ts`, and **E2E route generation** all read it. This single file
      eliminates the 3-way disagreement and becomes the source for W6.7's route
      coverage.
- [ ] **W4.2 Make link resolution a CI gate.** Every `href` and `redirectTo` in
      the registry must resolve to a real `page.tsx`. This is what permanently
      kills `/analytics` and `/workspaces`.
- [ ] **W4.3 Replace client-side redirects with server `redirect()`.**
      `documents/page.tsx:14`, `resumes/page.tsx:14`, `connectors/page.tsx:14`
      all use `router.replace` — no page in the entire app calls `redirect()`,
      `permanentRedirect()`, or `notFound()`. `connectors/dynamic:197` →
      `connectors:14` → `capabilities` is a 2-hop bounce. `documents` and
      `resumes` have **no `loading.tsx` and no `error.tsx`** at all.
- [ ] **W4.4 Server-derived entitlements.** Add `plan`, `tier`, `role`,
      `entitlements`, `flags` to `MeResponse` (`auth-dto.ts:50-53`) and
      `Workspace` (`workspace.ts:8-15`) — they have **none** today. Read
      `analyticsApi` and `billingApi` (which exist and are never read for
      gating) for capability decisions. Demote `NEXT_PUBLIC_ENABLE_ENTERPRISE`
      to a preview switch only. **A hidden control is not an authorization
      boundary.**
- [ ] **W4.5 One transport.** Split `api-client.ts` (3,702 lines) into generated
      transport + resource facades + stream/upload adapters + a compatibility
      layer. Route the 7 raw `fetch()` sites (`:363,653,787,863,927,946,1088`)
      and the XHR path (`:681-739`) through `api.request` so they get the
      401→refresh queue and correlation-ID capture. Allowlist any remaining
      direct fetch. Fix `logout()` (`:120-126`) to clear cookies. Migrate
      `ChatWindow.tsx:302-337` and fix `agents/[agentId]/page.tsx:109-122`
      (reads the wrong token key).
- [ ] **W4.6 Add a transport parity test suite.** Token acquisition, CSRF
      attach, 403-retry-once (`api.ts:221-228`), 401 refresh leader/follower
      (`:231-272` — **the highest-risk untested code in the client**),
      error-body shape parsing (`:274-301`), 204→undefined (`:303`), `FormData`
      Content-Type elision (`:178-180`), `X-Workspace-ID` derivation
      (`:183-205`), and `transformKeys` (`:46-62`, the #1 documented footgun in
      AGENTS.md).
- [ ] **W4.7 Enforce destructive-action UX.** Every destructive mutation
      declares: target, scope, count, consequence, pending state, failure,
      rollback/undo, receipt/history. Currently `security/page.tsx:263-298` has
      two confirmations that do nothing, and `billing/page.tsx:213` opens `#`.
- [ ] **W4.8 Add a shared `<Breadcrumb>`.** Five independent hardcoded
      mechanisms exist today (`TopNav.tsx:25-65` + 4 inline
      `<nav aria-label="Breadcrumb">`), and the breadcrumb's leaf is a
      non-clickable `<span>` (`TopNav.tsx:171`).

**Gate:** zero dead links; one registry drives all navigation; entitlements come
from the server; one transport with a parity test suite; every destructive
action has a contract.

---

### WAVE 5 — DESIGN SYSTEM & UI/UX (5–6 days) — P0/P1 · lane D

#### 5a. Token authority

- [ ] **W5.1 Pick one authority and delete the others.** Recommendation:
      **`globals.css` is the runtime source of truth** (86 custom properties,
      actually shipped, actually themed). Either regenerate
      `packages/ui-kit/src/tokens/themes/*.json` **from** it, or delete the JSON
      engine. Do not keep a second namespace. Current overlap is 2 of 86
      properties (2.3%); `generateCssVariables()` has 2 references repo-wide and
      is dead code.
- [ ] **W5.2 Fix the 4 broken token references.** `--primary-fg` (consumed by
      `FilterBar.tsx:65,72`, defined nowhere), `--primary-700`
      (`globals.css:567`, hardcoded in `tailwind.config.ts:60` instead),
      `.bg-scrim` (cited `tailwind.config.ts:13`; the class is `.bg-void` at
      `globals.css:445-447`), `var(--font-size-12)` (`component.json:65`,
      undefined).
- [ ] **W5.3 Resolve the pure-black contradiction.** `globals.css:41`
      `--bg: 0 0 0` + `useTheme.tsx:50-54` + `layout.tsx:128` vs
      `tailwind.config.ts:11-14` _"pure black is NOT the app background
      anywhere"_. One of them is a lie; decide and delete the other.
- [ ] **W5.4 Fix the theme selector leak.** `globals.css:530,531,540,567` use
      `:root:not(.dark)`. `useTheme.tsx:41-48` always adds exactly one of
      `light`/`dark`/`high-contrast`, so `high-contrast` **also matches**
      `:root:not(.dark)` and gets light-mode aurora/panel rules on a black
      canvas.
- [ ] **W5.5 Make the focus ring consistent in high-contrast.** `globals.css`
      does not override `--color-focus-ring` for high-contrast (stays `#818cf8`)
      while the token engine forces `#ffff00` (`tokens/index.ts:107`). Pick one
      — a focus ring must be visible in all three themes.
- [ ] **W5.6 Add a token parity test** that fails when `globals.css` and the
      token source disagree, and a raw-value lint: `apps/web/src` still has
      **556** raw Tailwind palette class occurrences (235 in `app/`, 268 in
      `components/` — top: `text-white` 53, `bg-white` 39, `bg-emerald-500` 25,
      `text-emerald-400` 24, `border-emerald-500` 21) and **109** raw-hex lines
      across 18 files, against `DESIGN.md:10-14` which forbids both.
- [ ] **W5.7 Reconcile `DESIGN.md` with reality, once.** Three "secondary
      buttons" (`DESIGN.md:123`, `globals.css:312-318`, `Button.tsx:28-29`);
      three button inventories (4 styles / 5 `.btn-*` / 5 variants incl.
      `outline`); two input-label definitions (`DESIGN.md:133` vs
      `globals.css:371` vs `Input.tsx:27` vs `FormField.tsx:33`);
      `--radius-sm: 4px` (`globals.css:19`) silently changes Tailwind's stock
      2px `rounded-sm`.

#### 5b. Primitive behaviour contract

- [ ] **W5.8 Fix the 5 hard a11y failures.** `Modal.tsx` and `Tabs.tsx` are
      correct — use them as the reference implementations.
  - `Card.tsx:3,39` — `CardProps extends HTMLAttributes<HTMLDivElement>`, so
    `onClick` is a **valid typed prop** on a bare `<div>` with no `role`,
    `tabIndex`, or key handler. No production file uses it yet; the API makes
    the next one easy to get wrong.
  - `StatCard.tsx:16,33,37` — `onClick?: () => void` forwarded straight to
    `Card`. Same defect.
  - `DataTable.tsx:60-67` — `sortBy`/`sortDir`/`onSort` are accepted and the
    chevron recolours, but the `<th>` emits only `scope="col"` + `onClick`: **no
    `aria-sort`, no button**. `aria-sort` has **zero occurrences repo-wide**.
    `:117-123` `onRowClick` → non-semantic `<tr>`.
  - `Drawer.tsx:32,34-50,56-95` — `drawerRef` is declared and attached but
    **never read for focus**: no initial focus, no Tab/Shift-Tab trap, no
    restore. `role="dialog" aria-modal="true"` is on the full-screen wrapper,
    not the panel; the `<h3>` title is never associated. `Modal.tsx:36-55,59,70`
    does all of this correctly — port it.
  - `FormField.tsx:24-27,33,44` — label association is correct and SSR-safe, but
    `aria-describedby` is only handed to the consumer as render-prop args and
    **FormField has zero consumers in `apps/web`**. Wire it, or it is unverified
    code.
- [ ] **W5.9 Fix the dropped `error` prop.** `Checkbox.tsx:13` and `Radio.tsx:9`
      destructure `error` and `className` and **never use them** (confirmed by
      lint). Both are form controls that accept error state and silently discard
      it — the single most damaging defect in the kit for a forms-heavy product.
      Also fix the non-semantic `<div onClick>` visual shim
      (`Checkbox.tsx:37-49`, `Radio.tsx:35`) and the `h-4 w-4`-in-`h-5` hit
      area.
- [ ] **W5.10 Enforce the 44px touch-target floor.** **31 interactive elements
      are below 44px**; the only explicit `min-h-[44px]` in the codebase is
      `ChatComposer.tsx:68`. Worst: `FilterBar.tsx:90-97` tag-remove at
      **12×12**; `FilterBar.tsx:102-108` "Clear all" ~16; `Toast.tsx:44-51` and
      `SearchField.tsx:39` ~18; `Modal.tsx:91-95` close at **20×20**;
      `Alert.tsx:61-68` and `Banner.tsx:57-64` ~22; `Checkbox`/`Radio`/`Switch`
      at 20 tall; `IconButton` default 36×36; `Button` default ~36; `Tabs`
      default ~36. Set `md+` ≥ 44px, `sm` ≥ 24px (WCAG 2.5.8), and add a CI
      check. Also fix the app-level offenders: `shared/Toggle.tsx:23`,
      `shared/Toast.tsx:130-134`, `shared/ErrorState.tsx:34`,
      `ProfileHeader.tsx:142`, `PluginsView.tsx:192,208`, `SkillsView.tsx:170`,
      `ThemePreferences.tsx:148-168` (5 swatches).
- [ ] **W5.11 Fix the theme-broken components.** `Alert.tsx:15-31` hardcodes
      dark-only Tailwind palette in **all 4 variants**
      (`bg-blue-950/30 … text-blue-200`, `bg-emerald-950/30 …`,
      `bg-amber-950/30 …`, `bg-red-950/30 …`) → invisible or wrong in light
      mode. `FilterBar.tsx:63` category chips ~24px tall with no `aria-pressed`
      (active state is visual-only).
- [ ] **W5.12 Fix the AI/memory primitives.** `SourceCitation.tsx:27` falls back
      to `window.open(url,'_blank')` with **no `noopener,noreferrer`**; `:36-41`
      the hover tooltip is `hidden group-hover:flex` + `pointer-events-none` →
      **invisible to keyboard and touch** (no `group-focus-within`) and it holds
      2 of the 5 lint errors. `ConfidenceIndicator.tsx:28-37` uses a `title`
      attribute as its only accessible name and gives the numeric value no
      programmatic association. `StatCard.tsx:56` renders `↑`/`↓`/`•` as visible
      text with no `aria-label` and no `aria-hidden` → AT reads "up arrow"
      before the value. `Tooltip.tsx:7,28-43` has `role="tooltip"` never wired
      via `aria-describedby` and untyped `children` in a `<div>`.
      `EmptyState.tsx:32` hardcodes `<h3>`. `Pagination.tsx:27` puts
      `aria-label` on a plain `<div>` with no `role="navigation"`.
- [ ] **W5.13 Fix non-semantic click targets in the app.**
      `AgentDirectivesCard.tsx:152-159` — `<div onClick>` autonomy-mode
      selector, no role/tabIndex/keydown, three radio-like options reachable by
      mouse only, and it renders **emoji as the mode icon** (`:163`). Run the
      emoji-as-icon scan repo-wide and replace with the ui-kit icon set.
- [ ] **W5.14 Fix the ui-kit lint gate and dead code.** 5 errors
      (`AgentStatus.tsx:3`, `SourceCitation.tsx:39:65,75`,
      `MemoryEvidence.tsx:34:9,19`) + 56 warnings including 5 unused imports and
      2 `Unexpected any` in `DataTable.tsx:12,125`. **Lint must block** — today
      the package that is supposed to be the canonical design system ships with
      a failing lint.
- [ ] **W5.15 One primitive authority.** 7 true duplicates remain between
      `packages/ui-kit/src` and `apps/web/src/components`. Migrate app wrappers
      to re-exports. Then add a CI rule that blocks a new local primitive.
- [ ] **W5.16 Replace the fake component tests.** `components.test.ts:6-39` is
      34 × `toBeDefined()` — it executes **0 of 230** ui-kit functions (every
      component file reports `functions: 0%`). `tokens.test.ts` never compares
      to `globals.css`. `package.json:12` uses `jest --passWithNoTests`, so
      deleting the suite still exits 0. `jest.config.js:4`
      `testMatch: ['**/__tests__/**/*.test.ts?(x)']` means any co-located test
      is **silently ignored**. Write real render tests: keyboard, focus
      trap/restore, label association, `aria-sort`, variant coverage including
      `outline` (`<Button` appears in **zero** test files repo-wide, and the
      string `outline` appears in **zero** test files repo-wide).

#### 5c. UX contracts

- [ ] **W5.17 Adopt the page archetypes.** Ban "header + 4 stat cards + filter
      pills + card list" unless the page is genuinely a KPI dashboard or data
      table. Adopt the 8 archetypes (Dashboard / Career cockpit / AI run /
      Search / Master-detail / Files / Settings / Admin console) with first
      viewport, single primary action, and mobile pattern per archetype. Today 5
      routes repeat the same card+filter pattern.
- [ ] **W5.18 Build the route-state matrix.** 13 surfaces × 7 states with:
      trigger, visible copy, available action, `dataMode`, freshness, retry
      scope, mutation status, announcement, test, screenshot. Distinguish "no
      data" from "not connected" from "no permission" from "preview unavailable"
      from "provider failed" from "stale cache" — today they are conflated.
      `TopNav.tsx:99-109` swallows notification errors entirely.
- [ ] **W5.19 Define the canonical mutation contract.** Authoritative success,
      pending, conflict, unknown outcome, rollback/undo, receipt/history. Every
      mutation declares whether it is optimistic, server-authoritative,
      idempotent, reversible, or audit-only. **A timeout is not a success** —
      `jobs` and `capabilities` can currently show success after a backend
      failure.
- [ ] **W5.20 Adopt the responsive contract.** 320–414 single column, one
      primary action, list→detail, no horizontal scroll; 768 compact; 1024
      persistent sidebar + 2-pane; 1440 full workbench; 2560 density cap,
      centered. **2560 is untested anywhere** — `quality.spec.ts:45` stops
      at 1440. Add a 200% zoom/reflow check (`axe-config.ts:103` audits only at
      a hardcoded 1280×720).
- [ ] **W5.21 Complete the motion semantics.** The global
      `prefers-reduced-motion` block (`globals.css:583-594`) is correct and does
      neutralize all 8 custom animations plus the Tailwind set — that part is
      genuinely good. But there are **zero** `motion-reduce:` / `motion-safe:`
      variants in either package, so no component can opt in or out
      deliberately. `prefers-contrast: more` covers only 4 tokens (`:257-264`).
      Then: motion must express cause-and-effect only. The pulsing indicators on
      `email/page.tsx:85-89` imply live provider health with no verified source
      — that is decorative motion making a false claim, and it goes with W1.5.
- [ ] **W5.22 Fix `aria-current` on detail routes.** `Sidebar.tsx:265` uses
      exact `pathname === link.path`, so `/files/[documentId]`,
      `/memory/[memoryId]`, and `/settings/security` mark **nothing** current.
      Use prefix matching.
- [ ] **W5.23 Typecheck the tests.** `apps/web/tsconfig.json:11` excludes
      `**/*.spec.*` and `**/*.test.*` — 10 Jest files and 8 Playwright specs are
      never typechecked.
- [ ] **W5.24 Reconcile the 2 branch-design divergences the audit found.**
      `globals.css` and `DESIGN.md` are the honest surfaces; the
      `docs/design-system/*` and `DESIGN-SYSTEM-FINAL-AUDIT.md` claims are not
      (see §5).

**Gate:** one token namespace with a parity test; 0 ui-kit lint errors; 0 hard
a11y failures in the 8 named primitives; 0 interactive elements under 44px (24px
for `sm`); raw palette classes → 0; every primitive has a rendered behaviour
test; the state matrix and mutation contract exist and are enforced by the
registry.

---

### WAVE 6 — TEST GATE (6–8 days) — P0

The harness is good. The assertions are not. Fix assertions, not infrastructure.

- [ ] **W6.1 Kill the 4 critical false-greens first.**
      `module05-documents.spec.ts:19,27-29` and `:50,56,59-64` — the only
      XSS-upload and download-header assertions, both `.catch(() => null)` +
      `if (resp)` with **no else**. `quality.spec.ts:26-38` — the axe gate
      passes on an error page or a login redirect. `quality.spec.ts:49-57` — the
      320px responsive gate passes on a blank page. `a11y.test.tsx:36-46` —
      `jest-axe` is not a dependency, so the `toHaveNoViolations()` is dead code
      and the test asserts 5 non-nulls on a component it wrote itself.
- [ ] **W6.2 Fix the `a11y-audit` workflow.** `a11y-audit.yml:49-50` runs
      `npx tsx audit-pages.ts` where `audit-pages.ts:1` imports an unresolvable
      `playwright` (no `package.json` under `testing/accessibility`, so
      `pnpm-workspace.yaml:10 'testing/*'` matches nothing) → `MODULE_NOT_FOUND`
      and the job dies. Then fix the script: routes are wrong (`/auth/login`,
      `/auth/signup` don't exist), `workspaceId` is the literal `'demo'`, there
      is no auth and no backend so every route audits as the login page,
      `axe-config.ts:1` imports a non-existent `@axe-core/puppeteer`, only
      `critical` fails while `axe-config.ts:46-48` defines
      serious/moderate/minor thresholds that are **never read**, and `:65-74`
      `catch { return { violations: [] } }` records a navigation failure as a
      pass. The Playwright axe runner in `quality.spec.ts` is the better harness
      — consolidate onto it.
- [ ] **W6.3 Enforce exact assertions repo-wide.** Ban `if (await x.count())`
      without `else`, `.catch(() => null)` before an assertion, and `goto` +
      `waitForTimeout` with no URL/content assertion. Every spec must assert the
      **final URL**, an **exact status**, and **distinguishing content** (not
      `body` visible, not `h1` count — `not-found.tsx:6` satisfies that with
      `<h1>404</h1>`). Rewrite the mislabelled ones: `mutations.spec.ts:77-81`
      (claims keyboard A/R, does none), `:18-22` (claims a diff modal, opens
      none), `:35-41,60-74` (fully guarded), `auth.spec.ts:41-63` (claims
      sidebar coverage, never clicks a link).
- [ ] **W6.4 Make coverage real and measured.** The root `jest.config.ts:8-15`
      `coverageThreshold` (70/75/80/80) is **dead** — no package references it.
      `ci.yml:68` forwards `--coverage` but `:73` uploads the root `coverage/`,
      which is never created. Baseline from the measured truth (**apps/web
      11.34% stmts / 8.64% br / 10.09% fn**, 300 files with 238 at 0%; **ui-kit
      57.14% stmts / 0.00% br / 14.34% fn**, all 57 component files at
      `functions: 0%`), set a ratcheting threshold that cannot regress, and
      upload per-package reports.
- [ ] **W6.5 Generate route coverage from the W4.1 manifest.** 43 of 56 routes
      have **zero** tests. axe covers **13 of 56 (23%)**. Untested includes
      every auth route, `/invite/[token]`, `/account-locked`, `/forbidden`,
      `/status`, `/vault`, `/tasks`, `/search`, `/email`, `/career`, `/help`,
      `/cognition`, `/council`, `/billing`, `/settings/security`, `/admin`,
      `/organizations`, `/marketplace`, `/developer`, `/feature-flags`, and
      **every** `loading.tsx` (47) and `error.tsx` (17) boundary.
- [ ] **W6.6 Add the 11 missing state tests.** Token storage, `api-client`
      transport, `middleware`, route link resolution, fixture `dataMode`, **401
      refresh concurrency** (`api.ts:231-272` — the highest-risk untested code
      in the client), 403 role denial, 404, 429, 500, offline. `429` has **zero
      occurrences** in the web tree; `navigator.onLine` has **zero occurrences**
      in `apps/web/src`.
- [ ] **W6.7 Add keyboard, focus, and motion tests.**
      `page.keyboard.press('Tab')` has **zero occurrences** in all of
      `apps/web/e2e`. `Modal.tsx:36-55` trap and `:59,70` restore are 0%
      covered. `SkipLink` 0%. Sidebar shortcuts (⌘/Ctrl+B, `?`,
      `Sidebar.tsx:176-189`) 0%. Add `Drawer` focus tests (W5.8).
      `reducedMotion` appears exactly once (`landing.spec.ts:78`) and is inside
      the non-gating visual block; the app implements reduced motion in 8+
      places with **0% behavioural coverage**.
- [ ] **W6.8 Make visual regression a real gate.** 4 landing baselines are named
      `landing-*-win32.png` but the project is `chromium` and there is no
      `snapshotPathTemplate` → they can never be found and will fail on a clean
      checkout. 36 of 40 are excluded from the gate and re-run with
      `--update-snapshots` (`ci-frontend.yml:62,67`), which always passes. Fix
      the names, add `snapshotPathTemplate`, compare (not refresh) in CI, and
      baseline at 375 + 1440 + one dark + one high-contrast.
- [ ] **W6.9 Add `forbidOnly: !!process.env.CI`** to
      `apps/web/playwright.config.ts` (the dead
      `testing/e2e/playwright.config.ts:6` has it). A stray `test.only`
      currently skips 75 of 76 tests and CI goes green. Also set `retries` and
      remove `reuseExistingServer: true` from CI paths.
- [ ] **W6.10 Delete the dead `testing/e2e` suite** — 13 tests, selectors that
      no longer exist (`data-testid="sidebar"`, `"login-error"`,
      `"connectors-page"`, `"connect-button"`), no workflow references it, and
      its `mobile-chrome` Pixel 5 project never runs. Delete
      `testing/accessibility/` after porting the axe thresholds.
- [ ] **W6.11 Verify the action refs.** `actions/checkout@v7` in **11 of 12**
      workflows, `upload-artifact@v7`, `cache@v6`. Latest published majors are
      `checkout@v4/v5`, `upload-artifact@v4`, `cache@v4`. If these are wrong,
      `ci-frontend.yml` fails at step 1 and **the entire frontend gate is
      dark**. Verify first.
- [ ] **W6.12 Run the real thing.** A `playwright test` execution has never been
      run as part of this audit. Before the gate can be claimed, run all 76
      against a real stack and record the result, including the 30 visual tests.

**Gate:** zero conditional assertions; every route has generated coverage;
coverage thresholds are real and ratcheting; axe covers 100% of routes in 3
themes and fails on `serious`; keyboard and focus paths are tested; visual
comparison blocks; the full E2E suite has been executed and recorded.

---

### WAVE 7 — SDK & DEVELOPER CONTRACT (4–5 days) — P0/P1 · lane E

- [ ] **W7.1 Fix the 12 confirmed contract mismatches.** `/memory` → `/memories`
      (TS `client.ts:54,59,64,69`; Py `client.py:38,42`). Response envelopes: Py
      expects `{data}` where the backend returns a bare `MemoryResponse`
      (`memory.py:391`); TS **double-unwraps** — `const { data: response } = …`
      already yields the body, so `response.data` is `undefined`
      (`client.ts:73-75`). Send `X-Workspace-ID` or the "first workspace"
      heuristic (`memory.py:62-75,603-613`) silently reads the wrong workspace
      for multi-workspace users. Reconcile 3 pagination shapes: `{data, meta}`
      (SDK `types.ts:28`), `{items, total}` (orgs),
      `{memories, total, page, page_size}` (memory).
- [ ] **W7.2 Structured errors.** TS `client.ts:31-39` collapses 401/403/429 to
      a string and discards `response.data`. Py `client.py:22-35` raises a bare
      `Exception("Rate limit exceeded")`. Carry
      `code, status, message, field, requestId, docsUrl, retryable, safeDetails`.
      Preserve the request ID through SDK, portal, webhook delivery, and logs.
- [ ] **W7.3 Auth.** `X-API-Key` is rejected 401 (`middleware/auth.py:75-77`) —
      it is the **only** credential the SDKs advertise. It becomes valid in
      W3.8, or the SDKs must not advertise it. `X-Tenant-Id` is ignored (JWT
      wins, `tenant.py:175-183`) — remove it from the surface or make it
      authoritative. Base URL `https://api.vaeloom.dev` (`client.ts:21`,
      `client.py:12`) vs `api.vaeloom.app` used elsewhere.
- [ ] **W7.4 Add SDK tests.** **Zero test files exist under `sdk/`.**
      `sdk/typescript/package.json:12` is `jest --passWithNoTests`, which always
      passes; the Python SDK has no runner and is not in `ci-backend.yml`. Add a
      contract suite against a real local API: create / get / search / list,
      plus exact 400/401/403/404/409/422/429/500 and timeout outcomes.
- [ ] **W7.5 Decide the publication posture.** `sdk/typescript/package.json` has
      **no `publishConfig` and no `private: true`** — a stray `npm publish` from
      that directory would attempt a real publish to the `@vaeloom` scope.
      `sdk/python/setup.py` has no guard. No workflow publishes
      (`rg -i "npm publish|pypi|twine"` → 0). Either add `private: true` +
      document the beta, or publish properly with a version check.
- [ ] **W7.6 Make OpenAPI the machine contract authority — and add the drift
      gate.** `scripts/gen_openapi.py` exists and writes both
      `specs/api/openapi.yaml` and `docs/backend/openapi.yaml` (byte-identical,
      so identical-by-construction is a mirror, not independent evidence). It is
      **never invoked from CI** (`rg openapi .github/workflows` → 0). The spec's
      last commit is 2026-09-23; HEAD is 2026-09-25 — 2 days and many commits of
      drift, undetectable.
      `evidence/phases/mvp/mvp-p08/07-compatibility-deprecation.md:69,79`
      already filed this as a **BLOCK** and it is still missing. Add: generate
      in CI → diff → fail on drift → regenerate clients → run contract tests.
      Then correct the counts everywhere (243 paths / 296 ops, not 241/294).
- [ ] **W7.7 Rebuild the developer portal honestly.** `developer/page.tsx` shows
      a false SDK/Go/v2 inventory, static quotas, and browser-generated keys
      (W1.9). Add a redacted request log with correlation search, quota truth
      from the real contract, and webhook delivery inspection/replay with
      explicit side effects.
- [ ] **W7.8 Execute the docs examples in CI.** They use `/v1` while the app
      uses `/api/v1`; they reference TanStack Query while the app uses SWR;
      `evidence/phases/mvp/mvp-p08` references a verification script that
      doesn't exist. One canonical OpenAPI-linked quickstart per language,
      compiled or run in CI.
- [ ] **W7.9 Add `setup`/`doctor`.** pnpm and uv are pinned but the documented
      commands disagree; root `pnpm dev:be` uses bare uvicorn where project
      guidance requires uv. One cross-platform setup path, verified on Windows
      and Linux.
- [ ] **W7.10 Instrument TTHW/TTFC.** Docs visit → key issued → first request
      success → first failure class → quickstart completion. Report p50/p90 by
      language and tier. No secrets or message bodies.

**Gate:** the SDK first call works against a mounted local API in under 10
minutes, verified in CI; all 12 mismatches closed; structured errors with
request IDs; OpenAPI drift fails CI; publication posture decided and enforced.

---

### WAVE 9 — PROOF & EVIDENCE LEDGER (3 days) — P0

Nothing is production-ready until this passes. Every other wave's claim must be
reproducible by a command in this ledger.

- [ ] **W9.1 Run the live PostgreSQL RLS matrix on the current commit.**
      `tests/test_rls_live_pg.py` (6 tests) and `test_rls_live_extended.py` (7)
      are `skipif`-gated on `VAELOOM_TEST_PG_URL` and **no workflow sets it**
      (`rg VAELOOM_TEST_PG_URL .github/workflows` → 0). `ci-integration.yml`
      starts `postgres:16` with db `vaeloom_test` (which **would** satisfy the
      `*_test` gate) but never exports the var, never runs alembic, and only
      runs `tests/integration/`. **Zero occurrences of "rls" in any workflow
      file.** Wire it. Also fix the harness: `test_rls_live_pg.py:87` drops and
      recreates policies on the target DB, so it proves its own transcribed SQL
      rather than the applied migration state.
- [ ] **W9.2 Extend the matrix.** It currently covers **3 tables** (`memories`,
      `users`, `documents`) and none of the 19 `USING(true)` tables,
      `marketplace_listings`, or `workspace_capabilities`. Add the
      negative-control matrix: unset GUCs → 0 rows; cross-tenant → 0;
      cross-workspace same tenant → 0; own scope → own rows only; `WITH CHECK`
      rejects mismatched insert; live password login as `vaeloom_app` without
      pre-set GUCs. Add login, verify, invite, worker, and scheduler coverage.
- [ ] **W9.3 Regenerate all RLS evidence.** Every RLS artifact predates the
      current policy set: `evidence/security/rls-verification.md` and
      `evidence/database/rls-matrix.md` are from 2026-09-20; migrations
      0052–0056 landed 2026-09-23/24. The DR drill log validates the **0054**
      state, not 0055/0056, and waives Redis.
- [ ] **W9.4 Run the full backend suite and record it honestly.** 4265 collected
      (not 3640), 385 security (not 233). Serial `-o addopts=""` for the record;
      note the xdist instability documented in AGENTS.md. **All 8 RED tests from
      W3.14 must be green.**
- [ ] **W9.5 Re-run the DR drill** on the current commit, without the Redis
      waiver.
- [ ] **W9.6 Rehearse deploy → smoke → rollback → smoke** on ephemeral staging
      with the auth/org/RLS suite, using digest-pinned images.
- [ ] **W9.7 Build the machine-checkable evidence ledger.** Every claim in
      `AGENTS.md`, `docs/`, and `evidence/` gets a status — `PROVEN` (with the
      command + commit that proves it) / `STALE` / `FALSE` — and CI fails when a
      `PROVEN` claim's command stops passing. This is the structural fix for the
      repo's recurring problem: documentation asserting status that the code
      does not support. It is also the single highest-leverage anti-drift
      mechanism available.
- [ ] **W9.8 Run the final frontend gate end to end:** typecheck (with tests
      included), lint (0 errors), Jest with coverage thresholds, full Playwright
      (76 tests executed, not listed), axe on 100% of routes in 3 themes, visual
      comparison, 2560px, 200% zoom, reduced motion, keyboard-only. Record every
      artifact with its commit SHA.

**Gate:** every claim in the repository is `PROVEN` with a command and a commit,
or it is corrected. Live RLS matrix green on the current commit. Full backend
suite green. Deploy/rollback rehearsed and logged.

---

## 3. Parallel lanes

No two lanes touch the same files. F and G from the source plan are merged (CI
files) to avoid conflict.

| Lane  | Waves                | Files                                                                                                                                                       | Starts                          | Duration        |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------- |
| **A** | 2 (session/recovery) | `apps/web/src/lib/api.ts`, `auth/callback/route.ts`, `middleware.ts`, `useAuth.tsx`, `auth_service.py`, `routers/auth.py`, `schema.py`                      | after W0                        | 5–7d            |
| **B** | 3 (authorization)    | `routers/organizations.py`, `organization_service.py`, `api_keys.py`, `middleware/auth.py`, `alembic/versions/00{52..56}`, `tests/security/conftest.py`     | after W0                        | 5–7d            |
| **C** | 8 (delivery)         | `.github/workflows/*`, `apps/web/Dockerfile`, `apps/api/Dockerfile`, `next.config.js`, `docker-compose*.yml`, `infra/kubernetes/**`, `infra/ops/nginx.conf` | **day 1**                       | 5–6d            |
| **D** | 1 → 4 → 5            | `Sidebar/TopNav/CommandCenter/EnterpriseGated`, `globals.css`, `tailwind.config.ts`, `packages/ui-kit/**`, fixture pages                                    | after W0                        | 3–4 + 4–5 + 5–6 |
| **E** | 6 (tests) + 7 (SDK)  | `apps/web/e2e/**`, `apps/web/jest.config.js`, `packages/ui-kit/jest.config.js`, `sdk/**`, `scripts/gen_openapi.py`                                          | after W4.1 (needs the manifest) | 6–8 + 4–5       |
| **F** | 9 (proof)            | `evidence/**`, staging, the ledger                                                                                                                          | after A, B, C, E                | 3d              |

**Two coordination points** (serialize these explicitly):

1. **C and E both touch `.github/workflows/`.** C in W8.1/W8.18, E in
   W6.2/W6.11. Sequence C first (branch fix unblocks E's runs).
2. **B and E both touch `tests/security/`.** B in W3.13/W3.14, E in W6. B first.

---

## 4. Release gate — the actual checklist

Do not claim production readiness until every line is checked with a **command
and a commit**, not a screenshot.

**Security**

- [ ] No browser-readable access or refresh token — enforced by a test that
      fails CI
- [ ] No credential, token, OAuth code, or user payload in any log — enforced by
      a log scanner
- [ ] Password reset: real delivery, durable single-use token, replay → 400,
      expiry → 400
- [ ] Account lockout has a recovery path and reset clears it
- [ ] SSO/SAML cannot bypass MFA; MFA enrolment requires step-up auth
- [ ] Refresh rotation has exactly one winner under concurrency
- [ ] Every organization mutation has a server-enforced role policy; exact-403
      matrix test green
- [ ] Invitations are identity-bound, single-use, and atomic
- [ ] API keys are server-issued, hashed, scoped, expiring, revocable,
      one-time-shown
- [ ] Live PostgreSQL RLS matrix green on the current commit, including the
      `USING(true)` tables
- [ ] Security suite 385/385 green
- [ ] No UI gate is treated as an authorization boundary

**Truth**

- [ ] No production route renders an unverified security or correctness claim
- [ ] Every fixture route is `dataMode: preview` and outside production
      navigation
- [ ] `dataMode` is enforced by a CI check, not by per-page discipline
- [ ] Every claim in `AGENTS.md` / `docs/` / `evidence/` is `PROVEN` with a
      command + commit, or corrected

**Contracts**

- [ ] One route manifest; zero dead links; CI link-resolution gate
- [ ] Server-derived entitlements; no `NEXT_PUBLIC_*` authorization input
- [ ] One transport with a parity test suite; zero un-allowlisted direct fetches
- [ ] SDK first call works in CI against a mounted local API
- [ ] OpenAPI drift fails CI; generated clients regenerated

**Design system & UX**

- [ ] One token namespace; parity test green; 0 broken token references
- [ ] 0 ui-kit lint errors; 0 hard a11y failures in the 8 named primitives
- [ ] 0 interactive elements under 44px (`sm` ≥ 24px)
- [ ] 0 raw palette classes; 0 raw hex in components
- [ ] Every primitive has a rendered behaviour test (not `toBeDefined()`)
- [ ] Route-state matrix and mutation contract enforced by the registry
- [ ] Keyboard, focus-trap/restore, `aria-sort`, label association tested
- [ ] `prefers-reduced-motion` and `prefers-contrast: more` both honoured
      per-component

**Tests**

- [ ] Zero conditional assertions; zero `goto`+`waitForTimeout` without a
      content assertion
- [ ] 100% of routes have generated coverage (was 13/56 for axe)
- [ ] Coverage thresholds real and ratcheting (was dead config)
- [ ] axe green on 100% of routes × 3 themes, failing on `serious` as well as
      `critical`
- [ ] Visual comparison blocks in CI (was refresh-and-upload)
- [ ] Full 76-test Playwright suite executed and recorded
- [ ] `forbidOnly` set in CI

**Delivery**

- [ ] Every workflow triggers on `master` (6 were dead)
- [ ] A PR to `master` runs security scan + a11y (today it runs neither)
- [ ] `docker compose build` works locally for both dev and prod
- [ ] The API Deployment passes `validate_settings()` against its own manifest
      env
- [ ] `kubectl wait` completes (impossible today with 23 deployments)
- [ ] Web liveness probe is intra-cluster (today it hits
      `https://api.vaeloom.dev`)
- [ ] Deploy → smoke → rollback → smoke rehearsed and logged
- [ ] Load-test gate is real or removed
- [ ] Immutable digests in the cluster; no `latest`
- [ ] Non-root + `securityContext` on both workloads; `HEALTHCHECK` present

---

## 5. False-claims register

Documentation that asserts status the code does not support is an **active
hazard**, not a cosmetic issue. Correct these in Wave 0–1.

| Claim                                                                  | Location                                                                            | Reality                                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "3640 tests collected"                                                 | `AGENTS.md`                                                                         | **4265**                                                                                                |
| "security suite 233/233 (170 unique)"                                  | `AGENTS.md`                                                                         | **385 collected, 8 FAILED**                                                                             |
| "RLS 42/42 tables FORCE"                                               | `AGENTS.md`, `evidence/modules-01-03/08-database-rls.md:5`                          | `marketplace_listings` has **no ENABLE**; `workspace_capabilities` has no FORCE; ORM declares 68 tables |
| "44/44 Tables (100% Coverage)"                                         | `evidence/security/rls-verification.md:4`, `evidence/database/rls-matrix.md:3`      | two different numbers (42 vs 44) vs 68 tables vs 2 unprotected                                          |
| "RLS REMEDIATED & EMPIRICALLY PROVEN LIVE via Migration 0052"          | `docs/security/RLS-SERVICE-POLICY-EXPOSURE.md:3`                                    | 0053–0056 **re-opened 15 tables**; the doc's own inventory table still describes the pre-0052 world     |
| "OpenAPI 241 paths / 294 ops"                                          | `AGENTS.md`, `docs/backend/Local-Development.md:105`                                | **243 / 296**                                                                                           |
| "regenerated 2026-09-15"                                               | `CHANGELOG.md:13`                                                                   | last commit 2026-09-23; no drift check exists                                                           |
| "jest-axe 0 critical"                                                  | `evidence/phases/mvp/mvp-p21/06-security-privacy-a11y.md:115`, `08-registers.md:54` | `jest-axe` is not a dependency; the assertion is dead code                                              |
| "`basic-smoke.spec.ts` — 8 tests PASS"                                 | `mvp-p21/10-handoff...md:224`, `09-gate-report.md:51,125`                           | **file does not exist**                                                                                 |
| "OpenAPI drift check: MISSING — BLOCK"                                 | `mvp-p08/07-compatibility-deprecation.md:69,79`                                     | accurate and still unfixed; `gen_openapi.py` is not in any workflow                                     |
| "All tokens are canonically authored in `@vaeloom/ui-kit/src/tokens/`" | `docs/design-system/03-tokens.md:31`                                                | `globals.css` is the runtime source; namespace overlap is 2/86 (2.3%)                                   |
| "Tokens compile to CSS variables via `generateCssVariables()`"         | `03-tokens.md:44`                                                                   | never invoked outside its own test                                                                      |
| "Tailwind maps directly to these CSS variables"                        | `03-tokens.md:51`                                                                   | maps to `--bg`/`--surface`/`--text`, which the engine never emits                                       |
| "DS-GATE-03 PASSED (validateTokens → valid)"                           | `DESIGN-SYSTEM-FINAL-AUDIT.md:47`                                                   | only checks key parity among 3 JSONs, never against `globals.css`                                       |
| "DS-GATE-05 eliminated 1,000+ duplicate inline SVGs"                   | `DESIGN-SYSTEM-FINAL-AUDIT.md:49`                                                   | ~1,300 `<svg` occurrences remain in `apps/web/src`                                                      |
| "DS-GATE-07 `shared/` duplicates consolidated"                         | `:51,107-117`                                                                       | 7 true duplicates remain                                                                                |
| "DS-GATE-08 zero raw hex in `app/`"                                    | `:52`                                                                               | 11 raw-hex lines remain; **556** raw palette classes remain                                             |
| "fully implemented, verified, release-ready"                           | `DESIGN-SYSTEM-FINAL-AUDIT.md:137-138`                                              | contradicted by 5 lint errors and 0 rendered-component tests                                            |
| "41 Page Routes" + `/mfa`                                              | `apps/web/README.md:31,33`                                                          | **56 routes**; `/mfa` does not exist                                                                    |
| "Web stores tokens (httpOnly cookies / headers)"                       | `docs/backend/Authentication.md:35,88`                                              | code uses `localStorage` + JS-readable cookies; the same doc lists localStorage as a threat at `:108`   |
| "Staging deploys automatically on merge to `main`"                     | `docs/devops/Deployment.md:126,248,281`, `docs/DEPLOYMENT_RUNBOOK.md:73`            | no workflow triggers on `main`; the default branch is `master`                                          |
| "a11y-audit" as a blocking gate                                        | `.github/workflows/a11y-audit.yml`                                                  | the job dies on `MODULE_NOT_FOUND`                                                                      |
| "Load test gate passed"                                                | `deploy.yml:122-124`                                                                | `echo`                                                                                                  |
| "Web health probe"                                                     | `infra/kubernetes/base/apps/web/deployment.yaml:49-60`                              | no `apps/web/src/app/api/health/route.ts` exists; the probe egresses to a public DNS name               |
| `NEXT_PUBLIC_ENABLE_ENTERPRISE` vs `ENTERPRISE_ROUTES_ENABLED`         | `Sidebar.tsx:43` / `billing/page.tsx:217,251,258` / `AGENTS.md`                     | three names for one flag                                                                                |

---

## 6. Risks and how to reverse each wave

| Wave | Reversibility | Rollback                                                                                                                                                                                             |
| ---- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 4/5           | Restore the tagged baseline; nav is registry-driven from W4.1 so reverting is one file                                                                                                               |
| 2    | 2/5           | **Hardest.** Removing browser tokens requires the BFF + backend cookie. Ship behind a flag: dual-read for one release, then remove. Keep a server-side revoke-all endpoint reachable during rollout. |
| 3    | 4/5           | `require_org_role` behind a per-endpoint allowlist; roles unify before enforcement lands. Migration changes are forward-only — snapshot staging first.                                               |
| 4    | 5/5           | Registry is additive; each nav surface migrates independently                                                                                                                                        |
| 5    | 5/5           | Token source choice is one file; primitive fixes are per-component                                                                                                                                   |
| 6    | 5/5           | Assertions only; no production code path changes                                                                                                                                                     |
| 7    | 4/5           | Keep SDKs unpublished/private until every contract gate is green                                                                                                                                     |
| 8    | 3/5           | Infra only; no data-plane change. Rehearse rollback **before** the first real deploy.                                                                                                                |
| 9    | 5/5           | Evidence only                                                                                                                                                                                        |

**Biggest single risk:** Wave 2's session migration, because it touches every
authenticated request and a mistake locks out every user. Mitigate with
dual-read + a server-side emergency revoke, and rehearse on staging with a real
user journey (signup → verify → MFA → workspace switch → logout) before
production.

---

## 7. What stays out of scope

| Deferred                                                       | Rationale                                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New product pages                                              | Breadth is not the blocker. Trust, contracts, and delivery are.                                                                                                                           |
| Backend persistence for career / email / tasks                 | Product contracts undefined; they stay `preview` until defined (W1.4)                                                                                                                     |
| Public SDK launch                                              | Private beta + contract gates first (W7.5)                                                                                                                                                |
| CLI                                                            | Second broken integration surface; only after the SDK path is green                                                                                                                       |
| New telemetry vendor                                           | Instrument privacy-safe events first; vendor is an ops decision                                                                                                                           |
| i18n / localization                                            | No locale contract or target locale set                                                                                                                                                   |
| Full service mesh                                              | NetworkPolicies exist; a mesh is an infra investment, not a trust fix                                                                                                                     |
| Marketing / landing visual direction                           | The landing is already the most honest surface in the repo (`landing.test.tsx:63-99` asserts no false compliance claims, no fake connectors, honest Gmail-autonomy copy) — leave it alone |
| Deleting the 19 fictional k8s Deployments' _intended_ topology | W8.7 removes them because they break deploys. If they are a real roadmap, they need their own images and CI — out of scope here                                                           |

---

## 8. Immediately actionable, in order

If you want to start this week, in this exact order:

1. **W8.1** — re-point 6 workflows from `main` to `master`. 10 minutes.
   Currently a PR to `master` runs **no security scan at all**.
2. **W0.1** — tag the audit baseline.
3. **W1.1 + W1.2** — delete the fabricated security page and the simulated
   invite acceptance. These are the two things a customer would screenshot.
4. **W1.7** — kill the 4 dead links (`/analytics`, `/workspaces`, and the
   billing nav wall).
5. **W3.1 + W3.2** — add the role dependency and constrain `role` to a
   `Literal`. Any authenticated user can currently make themselves `owner`.
6. **W3.5 + W3.6** — bind invitations to identity and make consumption atomic.
7. **W2.3** — delete the two secret-logging lines. Ten minutes, closes a
   critical.
8. **W2.7** — make refresh rotation atomic (the comment already claims it is).
9. **W6.1** — fix the 4 critical false-greens so the suite stops lying.
10. **W9.7** — build the evidence ledger so none of the above silently
    regresses.

Steps 1, 3, 7 are hours, not days. Do them first and the repository stops lying
about itself, which is the precondition for every other fix being trustworthy.
